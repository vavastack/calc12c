import { CalcError } from './errors.js';

// Equação do valor do dinheiro no tempo (convenção de sinais da HP 12C):
//   PV + PMT·k·((1 − (1+i)^−n) / i) + FV·(1+i)^−n = 0,  k = 1 + i·(BEGIN ? 1 : 0)
// Com i = 0 vale o caso linear: PV + PMT·n + FV = 0.
const err5 = () => new CalcError(5);

// ((1+i)^n − 1) / i, com o limite n quando i → 0.
function annuityFactor(ii, n) {
  if (Math.abs(ii) < 1e-12) return n;
  return (Math.pow(1 + ii, n) - 1) / ii;
}

// f(i) = PV·(1+i)^n + PMT·k·((1+i)^n − 1)/i + FV
function residual(ii, f, begin) {
  const k = 1 + (begin ? ii : 0);
  return f.pv * Math.pow(1 + ii, f.n) + f.pmt * k * annuityFactor(ii, f.n) + f.fv;
}

function bisect(fn, a, b) {
  let fa = fn(a);
  for (let it = 0; it < 300; it++) {
    const m = (a + b) / 2;
    const fm = fn(m);
    if (fm === 0 || b - a < 1e-16 * Math.max(1, Math.abs(m))) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = m;
      fa = fm;
    } else {
      b = m;
    }
  }
  return (a + b) / 2;
}

// Procura, a partir de 0 e para um lado, o primeiro intervalo com troca de sinal.
function firstRoot(fn, grid) {
  let prev = grid[0];
  let fPrev = fn(prev);
  if (fPrev === 0) return prev;
  for (let j = 1; j < grid.length; j++) {
    const cur = grid[j];
    const fCur = fn(cur);
    if (!Number.isFinite(fCur)) break;
    if (fCur === 0) return cur;
    if (Math.sign(fCur) !== Math.sign(fPrev)) return bisect(fn, prev, cur);
    prev = cur;
    fPrev = fCur;
  }
  return null;
}

const POS = [0, 1e-6, 1e-5, 1e-4, 1e-3, 0.005, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2,
  0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50, 100, 1000];
const NEG = [0, -1e-6, -1e-5, -1e-4, -1e-3, -0.005, -0.01, -0.02, -0.05, -0.1, -0.2, -0.3,
  -0.5, -0.75, -0.9, -0.95, -0.99, -0.999];

// n arredondado como na HP: para cima, exceto se a parte fracionária for < 0,005.
function roundN(n) {
  const fl = Math.floor(n);
  return n - fl < 0.005 ? fl : fl + 1;
}

export function solve(target, fin, begin) {
  const { n, i, pv, pmt, fv } = fin;
  const ii = i / 100;
  if (target !== 'i' && ii <= -1) throw err5();
  const k = 1 + (begin ? ii : 0);

  if (target === 'i') {
    if (!(n > 0)) throw err5();
    const fn = (x) => residual(x, fin, begin);
    const pos = firstRoot(fn, POS);
    const neg = firstRoot(fn, NEG);
    const cands = [pos, neg].filter((r) => r !== null);
    if (!cands.length) throw err5();
    const root = cands.reduce((a, b) => (Math.abs(a) <= Math.abs(b) ? a : b));
    return root * 100;
  }

  if (ii === 0) {
    switch (target) {
      case 'n':
        if (pmt === 0) throw err5();
        return roundN(-(pv + fv) / pmt);
      case 'pv':
        return -(fv + pmt * n);
      case 'fv':
        return -(pv + pmt * n);
      case 'pmt':
        if (n === 0) throw err5();
        return -(pv + fv) / n;
    }
  }

  const g = Math.pow(1 + ii, n);
  switch (target) {
    case 'fv':
      return -(pv * g + pmt * k * ((g - 1) / ii));
    case 'pv':
      return -(pmt * k * ((1 - 1 / g) / ii) + fv / g);
    case 'pmt':
      if (n === 0) throw err5();
      return -(pv + fv / g) / (k * ((1 - 1 / g) / ii));
    case 'n': {
      const a = (pmt * k) / ii;
      const ratio = (a - fv) / (pv + a);
      if (!Number.isFinite(ratio) || ratio <= 0) throw err5();
      return roundN(Math.log(ratio) / Math.log(1 + ii));
    }
  }
  throw new Error('alvo desconhecido: ' + target);
}

// f INT: juros simples ordinários (ano de 360 dias) e exatos (365 dias).
export function simpleInterest(days, rate, pv) {
  const base = -pv * days * rate;
  return { interest360: base / 36000, interest365: base / 36500 };
}
