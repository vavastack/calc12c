import { CalcError } from './errors.js';
import { round10 } from './number.js';
import { parseDate, days360, shiftMonths } from './dates.js';

// Títulos da HP 12C: cupons semestrais, valor de face 100, base 30/360 (E = 180 dias).
// Entradas: PMT = cupom anual (%), i = taxa anual (%), PV = preço (só YTM),
// Y = data de liquidação, X = data de vencimento.
const E = 180;

function schedule(settle, maturity, dmy) {
  const s = parseDate(settle, dmy);
  const m = parseDate(maturity, dmy);
  if (m.j <= s.j) throw new CalcError(8);
  const key = (p) => p.y * 10000 + p.m * 100 + p.d;
  let k = 0;
  let prev = m;
  let next = m;
  while (key(prev) > key(s)) {
    next = prev;
    k += 1;
    prev = shiftMonths(m, -6 * k);
  }
  const a = days360(prev, s);
  return { n: k, a, dsc: E - a };
}

function priceFor(sc, coupon, yieldPct) {
  const r = yieldPct / 200;
  if (r <= -1) throw new CalcError(5);
  const cpn = coupon / 2;
  const accrued = (cpn * sc.a) / E;
  const t = sc.dsc / E;
  let price;
  if (sc.n === 1) {
    price = (100 + cpn) / (1 + t * r) - accrued;
  } else {
    price = 100 / Math.pow(1 + r, sc.n - 1 + t);
    for (let j = 1; j <= sc.n; j++) price += cpn / Math.pow(1 + r, j - 1 + t);
    price -= accrued;
  }
  if (!Number.isFinite(price)) throw new CalcError(5);
  return { price, accrued };
}

// f PRICE: preço (sem juros acumulados) e juros acumulados por 100 de face.
export function bondPrice(settle, maturity, coupon, yieldPct, dmy) {
  if (coupon < 0) throw new CalcError(5);
  const sc = schedule(settle, maturity, dmy);
  const r = priceFor(sc, coupon, yieldPct);
  return { price: round10(r.price), accrued: round10(r.accrued) };
}

// f YTM: taxa anual (%) que leva ao preço dado (sem juros acumulados).
export function bondYield(settle, maturity, coupon, price, dmy) {
  if (coupon < 0 || !(price > 0)) throw new CalcError(5);
  const sc = schedule(settle, maturity, dmy);
  const fn = (y) => priceFor(sc, coupon, y).price - price;
  let lo = -99; // %
  let hi = 10000;
  let flo = fn(lo);
  if (Math.sign(flo) === Math.sign(fn(hi))) throw new CalcError(5);
  for (let it = 0; it < 300; it++) {
    const mid = (lo + hi) / 2;
    const fm = fn(mid);
    if (fm === 0 || hi - lo < 1e-13) return round10(mid);
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return round10((lo + hi) / 2);
}
