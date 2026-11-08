// Ponto flutuante decimal da HP-16C (f FLOAT): mantissa de 10 dígitos e expoente de 2 dígitos.
// Os valores são números JS arredondados a 10 dígitos significativos depois de cada operação.
import { range, toRaw, toSigned } from './intmath.js';

export const F_MAX = 9.999999999e99;

// Arredonda a 10 dígitos; fora da faixa vai ao máximo (g = true) e abaixo de 1e-99 vira 0.
export function round10(v) {
  if (Number.isNaN(v)) return { v: 0, g: true };
  if (!Number.isFinite(v) || Math.abs(v) > F_MAX) return { v: v < 0 ? -F_MAX : F_MAX, g: true };
  if (Math.abs(v) < 1e-99) return { v: 0, g: false };
  return { v: Number(v.toPrecision(10)), g: false };
}

// n = 0..9 casas decimais, ou 'sci' (notação científica com 6 casas e expoente de 2 dígitos).
export function formatFloat(v, n, locale = 'br') {
  let t;
  if (n === 'sci' || Math.abs(v) >= 1e10) {
    const [m, e] = (v === 0 ? 0 : v).toExponential(6).split('e');
    const ex = Number(e);
    t = `${m} ${ex < 0 ? '-' : ''}${String(Math.abs(ex)).padStart(2, '0')}`;
  } else t = v.toFixed(n === 'sci' ? 6 : n);
  return locale === 'br' ? t.replace('.', ',') : t;
}

// Inteiro → decimal: Y × 2^X (com os dois lidos conforme o complemento).
export function intToFloat(xRaw, yRaw, ws, cmp) {
  const x = Number(toSigned(xRaw, ws, cmp));
  const y = Number(toSigned(yRaw, ws, cmp));
  return round10(y === 0 ? 0 : y * 2 ** x);
}

// Decimal → inteiro: trunca para zero; fora da faixa do tamanho de palavra fica no extremo (g = true).
export function floatToInt(v, ws, cmp) {
  const [lo, hi] = range(ws, cmp);
  let t = BigInt(Math.trunc(v));
  let g = false;
  if (t > hi) { t = hi; g = true; }
  if (t < lo) { t = lo; g = true; }
  return { raw: toRaw(t, ws, cmp), g };
}
