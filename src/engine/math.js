import { CalcError } from './errors.js';
import { round10 } from './number.js';

// Resultado final: 10 dígitos significativos; nunca NaN/Infinity (Erro 0).
function fin(v) {
  if (!Number.isFinite(v)) throw new CalcError(0);
  return round10(v);
}

const BINARY = {
  plus: (y, x) => y + x,
  minus: (y, x) => y - x,
  times: (y, x) => y * x,
  divide: (y, x) => {
    if (x === 0) throw new CalcError(0);
    return y / x;
  },
  yx: (y, x) => {
    if (y === 0 && x <= 0) throw new CalcError(0);
    if (y < 0 && !Number.isInteger(x)) throw new CalcError(0);
    return Math.pow(y, x);
  },
};

// %, Δ% e %T não retiram Y da pilha: Y continua disponível (valor líquido).
const KEEP_Y = {
  pct: (y, x) => (y * x) / 100,
  dpct: (y, x) => {
    if (y === 0) throw new CalcError(0);
    return ((x - y) / y) * 100;
  },
  pctT: (y, x) => {
    if (y === 0) throw new CalcError(0);
    return (x / y) * 100;
  },
};

const UNARY = {
  recip: (x) => {
    if (x === 0) throw new CalcError(0);
    return 1 / x;
  },
  sqrt: (x) => {
    if (x < 0) throw new CalcError(0);
    return Math.sqrt(x);
  },
  expx: (x) => Math.exp(x),
  ln: (x) => {
    if (x <= 0) throw new CalcError(0);
    return Math.log(x);
  },
  frac: (x) => x - Math.trunc(x),
  intg: (x) => Math.trunc(x),
};

export function applyOp(stack, op) {
  if (BINARY[op]) return stack.applyBinary((y, x) => fin(BINARY[op](y, x)));
  if (UNARY[op]) return stack.applyUnary((x) => fin(UNARY[op](x)));
  if (KEEP_Y[op]) return stack.applyKeepY((y, x) => fin(KEEP_Y[op](y, x)));
  throw new Error('operação desconhecida: ' + op);
}
