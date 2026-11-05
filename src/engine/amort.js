import { CalcError } from './errors.js';
import { round10 } from './number.js';

// Arredonda para `d` casas (meio para longe de zero), como a HP faz com juros e prestação no AMORT.
export function roundDec(x, d) {
  const f = Math.pow(10, d);
  return (Math.sign(x) * Math.round(round10(Math.abs(x) * f))) / f;
}

// f AMORT: amortiza `count` prestações a partir do saldo em PV.
// Juros e prestação são arredondados ao número de casas do visor a cada período.
// `fresh` + BEGIN: a primeira prestação cai no início do período e não paga juros.
// Devolve { interest, principal, balance } (sinais da HP: pagamentos negativos quando PV > 0).
export function amortize(fin, count, decimals, begin, fresh) {
  if (!Number.isInteger(count) || count < 0 || count > 9999) throw new CalcError(0);
  const pmt = roundDec(fin.pmt, decimals);
  const rate = fin.i / 100;
  let balance = fin.pv;
  let interest = 0;
  let principal = 0;
  for (let k = 0; k < count; k++) {
    const juros = begin && fresh && k === 0 ? 0 : roundDec(-balance * rate, decimals);
    const amort = pmt - juros;
    interest += juros;
    principal += amort;
    balance += amort;
  }
  if (!Number.isFinite(balance)) throw new CalcError(1);
  return { interest: round10(interest), principal: round10(principal), balance: round10(balance) };
}
