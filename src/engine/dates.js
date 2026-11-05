import { CalcError } from './errors.js';

// Funções de calendário da HP 12C: datas de 15/10/1582 a 25/11/4046 (calendário gregoriano).
// Uma data é um número: M.DDAAAA (formato mês-dia-ano) ou DD.MMAAAA (dia-mês-ano).

const MIN = 2299161; // 15/10/1582
const MAX = 2299161 + (jdn(4046, 11, 25) - 2299161);

function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function fromJdn(j) {
  const a = j + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    d: e - Math.floor((153 * m + 2) / 5) + 1,
    m: m + 3 - 12 * Math.floor(m / 10),
    y: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

const daysIn = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

// Número digitado → data. Erro 8 se for inválida ou fora do intervalo.
export function parseDate(x, dmy) {
  const lead = Math.floor(x + 1e-9);
  const rest = Math.round((x - lead) * 1e6);
  const mid = Math.floor(rest / 10000);
  const y = rest % 10000;
  const m = dmy ? mid : lead;
  const d = dmy ? lead : mid;
  if (!(m >= 1 && m <= 12 && d >= 1 && y >= 1582) || d > daysIn(y, m)) throw new CalcError(8);
  const j = jdn(y, m, d);
  if (j < MIN || j > MAX) throw new CalcError(8);
  return { y, m, d, j };
}

export function encodeDate({ y, m, d }, dmy) {
  const [a, b] = dmy ? [d, m] : [m, d];
  return Math.round((a + b / 100 + y / 1e6) * 1e6) / 1e6;
}

// 1 = segunda-feira … 7 = domingo.
export const weekday = (j) => (j % 7) + 1;

export function addDays(x, days, dmy) {
  const a = parseDate(x, dmy);
  const j = a.j + Math.trunc(days);
  if (j < MIN || j > MAX) throw new CalcError(8);
  const r = fromJdn(j);
  return { value: encodeDate(r, dmy), parts: r, weekday: weekday(j) };
}

// Dias exatos e dias na base 30/360 entre duas datas (a mais antiga primeiro).
export function daysBetween(x1, x2, dmy) {
  const a = parseDate(x1, dmy);
  const b = parseDate(x2, dmy);
  const z1 = a.d === 31 ? 30 : a.d;
  const z2 = b.d === 31 && (a.d === 30 || a.d === 31) ? 30 : b.d;
  const f = (p, z) => 360 * p.y + 30 * p.m + z;
  return { actual: b.j - a.j, commercial: f(b, z2) - f(a, z1) };
}

// "11,09,2004 6": campos separados por vírgula (pt-BR) ou hífen (en-US) e o dia da semana no fim.
export function formatDate({ y, m, d }, wd, dmy, locale) {
  const sep = locale === 'br' ? ',' : '-';
  const two = (n) => String(n).padStart(2, '0');
  const [a, b] = dmy ? [two(d), two(m)] : [two(m), two(d)];
  return `${a}${sep}${b}${sep}${y} ${wd}`;
}

// Dias na base 30/360 (regra da HP) entre duas datas já decompostas ({ y, m, d }); a mais antiga primeiro.
export function days360(a, b) {
  const z1 = a.d === 31 ? 30 : a.d;
  const z2 = b.d === 31 && (a.d === 30 || a.d === 31) ? 30 : b.d;
  const f = (p, z) => 360 * p.y + 30 * p.m + z;
  return f(b, z2) - f(a, z1);
}

// Data de cupom: a de vencimento menos `months` meses; fim de mês acompanha fim de mês.
export function shiftMonths({ y, m, d }, months) {
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = daysIn(ny, nm);
  return { y: ny, m: nm, d: d === daysIn(y, m) ? last : Math.min(d, last) };
}
