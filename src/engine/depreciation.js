import { CalcError } from './errors.js';
import { round10 } from './number.js';

// Depreciação da HP 12C. Entradas: n = vida útil, PV = custo, FV = valor residual,
// i = fator do saldo decrescente em % (só DB; 200 = dobrado), X = ano.
// Saída: depreciação do ano e valor depreciável restante (custo − residual − depreciado até o ano).
function check(fin, year) {
  if (!(fin.n > 0)) throw new CalcError(5);
  if (!Number.isInteger(year) || year < 1 || year > Math.ceil(fin.n)) throw new CalcError(5);
}

function result(dep, total, accumulated) {
  return { dep: round10(dep), remaining: round10(total - accumulated) };
}

// f SL: linha reta — mesma parcela todo ano.
export function sl(fin, year) {
  check(fin, year);
  const total = fin.pv - fin.fv;
  const dep = total / fin.n;
  return result(dep, total, dep * year);
}

// f SOYD: soma dos dígitos dos anos — parcelas decrescentes (n, n−1, …, 1).
export function soyd(fin, year) {
  check(fin, year);
  const n = fin.n;
  const total = fin.pv - fin.fv;
  const parcela = (k) => (total * 2 * Math.max(n - k + 1, 0)) / (n * (n + 1));
  let acc = 0;
  for (let k = 1; k <= year; k++) acc += parcela(k);
  return result(parcela(year), total, acc);
}

// f DB: saldo decrescente — taxa = fator / n sobre o saldo contábil; nunca abaixo do valor residual.
export function db(fin, year) {
  check(fin, year);
  if (fin.i < 0) throw new CalcError(5);
  const rate = fin.i / 100 / fin.n;
  let book = fin.pv;
  let dep = 0;
  for (let k = 1; k <= year; k++) {
    dep = Math.max(Math.min(book * rate, book - fin.fv), 0);
    book -= dep;
  }
  return result(dep, fin.pv - fin.fv, fin.pv - book);
}
