// Aritmética de inteiros de largura fixa da HP-16C. Os valores são BigInt "crus": o padrão de bits da palavra,
// de 0 a 2^ws − 1. O modo de complemento ('2' = complemento de 2, '1' = de 1, 'u' = sem sinal) só decide como
// esse padrão é lido como número. Cada operação devolve { raw, c, g }: o resultado, o vai-um/empréstimo (flag 4, C)
// e o fora-de-faixa (flag 5, G).

export const maskOf = (ws) => (1n << BigInt(ws)) - 1n;
const signBit = (ws) => 1n << BigInt(ws - 1);

// Número que o padrão de bits representa.
export function toSigned(raw, ws, cmp) {
  if (cmp === 'u' || raw < signBit(ws)) return raw;
  return cmp === '2' ? raw - (1n << BigInt(ws)) : raw - maskOf(ws); // 1's: todos uns = −0
}

// Maior e menor número que cabem na palavra.
export function range(ws, cmp) {
  if (cmp === 'u') return [0n, maskOf(ws)];
  const max = signBit(ws) - 1n;
  return [cmp === '2' ? -signBit(ws) : -max, max];
}

export function inRange(sv, ws, cmp) {
  const [lo, hi] = range(ws, cmp);
  return sv >= lo && sv <= hi;
}

// Padrão de bits de um número que cabe na faixa.
export function toRaw(sv, ws, cmp) {
  if (sv >= 0n) return sv & maskOf(ws);
  return cmp === '1' ? maskOf(ws) ^ (-sv & maskOf(ws)) : BigInt.asUintN(ws, sv);
}

// Número fora da faixa: o 16C guarda o sinal e só os bits baixos da grandeza (32767 × 2 dá 32766, com G).
function truncate(sv, ws, cmp) {
  if (cmp === 'u') return sv & maskOf(ws);
  const mag = (sv < 0n ? -sv : sv) & (signBit(ws) - 1n);
  return toRaw(sv < 0n ? -mag : mag, ws, cmp);
}

export function add(y, x, ws, cmp) {
  const m = maskOf(ws);
  let s = y + x;
  const c = s > m;
  s &= m;
  if (cmp === '1' && c) s = (s + 1n) & m; // complemento de 1: o vai-um volta ao bit 0
  const g = cmp === 'u' ? c : !inRange(toSigned(y, ws, cmp) + toSigned(x, ws, cmp), ws, cmp);
  return { raw: s, c, g };
}

export function sub(y, x, ws, cmp) {
  const m = maskOf(ws);
  if (cmp === '1') {
    const r = add(y, m ^ x, ws, cmp);
    const sg = toSigned(y, ws, cmp) - toSigned(x, ws, cmp);
    return { raw: r.raw, c: !r.c, g: !inRange(sg, ws, cmp) };
  }
  const raw = BigInt.asUintN(ws, y - x);
  const g = cmp === 'u' ? y < x : !inRange(toSigned(y, ws, cmp) - toSigned(x, ws, cmp), ws, cmp);
  return { raw, c: y < x, g };
}

export function mul(y, x, ws, cmp) {
  const p = toSigned(y, ws, cmp) * toSigned(x, ws, cmp);
  const ok = inRange(p, ws, cmp);
  return { raw: ok ? toRaw(p, ws, cmp) : truncate(p, ws, cmp), c: false, g: !ok };
}

// Divisão inteira (trunca para zero). C = sobrou resto.
export function div(y, x, ws, cmp) {
  const sx = toSigned(x, ws, cmp);
  if (sx === 0n) return null;
  const sy = toSigned(y, ws, cmp);
  const q = sy / sx;
  const ok = inRange(q, ws, cmp);
  return { raw: ok ? toRaw(q, ws, cmp) : truncate(q, ws, cmp), c: sy % sx !== 0n, g: !ok };
}

export function rmd(y, x, ws, cmp) {
  const sx = toSigned(x, ws, cmp);
  if (sx === 0n) return null;
  return { raw: toRaw(toSigned(y, ws, cmp) % sx, ws, cmp), c: false, g: false };
}

// CHS fora do decimal e em sem sinal: troca o número pelo complemento de 1 ou de 2.
export function negate(raw, ws, cmp) {
  const m = maskOf(ws);
  if (cmp === '1') return { raw: m ^ raw, c: false, g: false };
  const r = (m ^ raw) + 1n & m;
  if (cmp === 'u') return { raw: r, c: false, g: true }; // negativo não existe no sem sinal: só avisa com G
  return { raw: r, c: false, g: raw === signBit(ws) }; // o menor negativo continua o mesmo, com G
}

export function popcount(raw) {
  let n = 0;
  for (let v = raw; v > 0n; v >>= 1n) n += Number(v & 1n);
  return n;
}

export function isqrt(n) {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (x + n / x) >> 1n;
  }
  return x;
}

// Deslocamentos e rotações. Devolvem { raw, c } (c = bit que saiu).
export const shiftLeft = (raw, ws) => ({ raw: (raw << 1n) & maskOf(ws), c: (raw & signBit(ws)) !== 0n });
export const shiftRight = (raw) => ({ raw: raw >> 1n, c: (raw & 1n) !== 0n });
export function asr(raw, ws) {
  return { raw: (raw >> 1n) | (raw & signBit(ws)), c: (raw & 1n) !== 0n };
}
export function rotLeft(raw, ws, carryIn = null) {
  const out = (raw & signBit(ws)) !== 0n;
  const bit = carryIn === null ? out : carryIn; // com carry (RLC), entra o C antigo
  return { raw: ((raw << 1n) & maskOf(ws)) | (bit ? 1n : 0n), c: out };
}
export function rotRight(raw, ws, carryIn = null) {
  const out = (raw & 1n) !== 0n;
  const bit = carryIn === null ? out : carryIn;
  return { raw: (raw >> 1n) | (bit ? signBit(ws) : 0n), c: out };
}

// Justificar à esquerda: desloca até o bit mais alto valer 1. Devolve o número e quantos deslocamentos.
export function leftJustify(raw, ws) {
  if (raw === 0n) return { raw, n: 0 };
  let v = raw;
  let n = 0;
  while ((v & signBit(ws)) === 0n) {
    v <<= 1n;
    n += 1;
  }
  return { raw: v, n };
}

// Texto do número em uma base, sem zeros à esquerda (a menos que `pad`).
const RADIX = { hex: 16, dec: 10, oct: 8, bin: 2 };
export function digitsOf(raw, ws, cmp, base, pad = false) {
  if (base === 'dec') {
    const sv = toSigned(raw, ws, cmp);
    return (sv < 0n ? '-' : '') + (sv < 0n ? -sv : sv).toString();
  }
  let t = raw.toString(RADIX[base]).toUpperCase();
  if (pad) t = t.padStart(Math.ceil(ws / Math.log2(RADIX[base])), '0');
  return t;
}
