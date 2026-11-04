import { CalcError } from './errors.js';
import { round10 } from './number.js';

// Estatística da HP 12C. Os registros estatísticos são R1..R6:
//   R1 = n, R2 = Σx, R3 = Σx², R4 = Σy, R5 = Σy², R6 = Σxy.
// `r` é o vetor [n, Σx, Σx², Σy, Σy², Σxy] (índices 0..5).

export function accumulate(r, x, y, sign = 1) {
  const next = [r[0] + sign, r[1] + sign * x, r[2] + sign * x * x, r[3] + sign * y, r[4] + sign * y * y, r[5] + sign * x * y];
  if (!next.every(Number.isFinite)) throw new CalcError(1);
  return next;
}

export function means(r) {
  if (r[0] === 0) throw new CalcError(2);
  return { x: r[1] / r[0], y: r[3] / r[0] };
}

// Desvio padrão da amostra (divisor n−1).
export function deviations(r) {
  const [n, sx, sxx, sy, syy] = r;
  if (n < 2) throw new CalcError(2);
  const sd = (s, ss) => Math.sqrt(Math.max(0, (n * ss - s * s) / (n * (n - 1))));
  return { x: sd(sx, sxx), y: sd(sy, syy) };
}

// Média ponderada: itens em Y (\), pesos em X (Σ+) → Σxy / Σx.
export function weightedMean(r) {
  if (r[1] === 0) throw new CalcError(0);
  return r[5] / r[1];
}

// Reta y = A + B·x e coeficiente de correlação r.
function regression(r) {
  const [n, sx, sxx, sy, syy, sxy] = r;
  if (n < 2) throw new CalcError(2);
  const dx = n * sxx - sx * sx;
  if (dx === 0) throw new CalcError(2);
  const B = (n * sxy - sx * sy) / dx;
  const A = (sy - B * sx) / n;
  const dy = n * syy - sy * sy;
  const den = Math.sqrt(dx * dy);
  const corr = den === 0 ? (dy === 0 ? 1 : 0) : (n * sxy - sx * sy) / den;
  return { A, B, r: Math.max(-1, Math.min(1, corr)) };
}

// ŷ dado x  (g 2).
export function estimateY(r, x) {
  const g = regression(r);
  return { value: g.A + g.B * x, r: g.r };
}

// x̂ dado y  (g 1).
export function estimateX(r, y) {
  const g = regression(r);
  if (g.B === 0) throw new CalcError(2);
  return { value: (y - g.A) / g.B, r: g.r };
}

export const rnd = round10;
