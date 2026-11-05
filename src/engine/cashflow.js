import { CalcError } from './errors.js';
import { firstRoot, POS, NEG } from './tvm.js';

// Fluxos de caixa da HP 12C: CFo + até 20 fluxos CFj, cada um repetido Nj vezes (1 a 99).
export const MAX_FLOWS = 20; // padrão (clássica); a Platinum aceita 30
export const MAX_NJ = 99;

export class CashFlows {
  constructor(maxFlows = MAX_FLOWS) {
    this.max = maxFlows;
    this.cf0 = 0;
    this.flows = []; // { amt, nj }
  }

  setCf0(x) {
    this.cf0 = x;
    this.flows = []; // CFo recomeça a lista
  }

  addFlow(x) {
    if (this.flows.length >= this.max) throw new CalcError(6);
    this.flows.push({ amt: x, nj: 1 });
  }

  setNj(x) {
    if (!this.flows.length || !Number.isInteger(x) || x < 1 || x > MAX_NJ) throw new CalcError(6);
    this.flows[this.flows.length - 1].nj = x;
  }

  clear() {
    this.cf0 = 0;
    this.flows = [];
  }

  // Lista plana dos fluxos por período: [CFo, f1, f1 (se Nj = 2), f2, ...]
  expanded() {
    const out = [this.cf0];
    for (const { amt, nj } of this.flows) for (let k = 0; k < nj; k++) out.push(amt);
    return out;
  }

  // f NPV: valor presente líquido à taxa do registrador i (% por período).
  npv(ratePct) {
    const r = ratePct / 100;
    if (r <= -1) throw new CalcError(0);
    const v = 1 / (1 + r);
    let p = 1;
    let total = 0;
    for (const a of this.expanded()) {
      total += a * p;
      p *= v;
    }
    if (!Number.isFinite(total)) throw new CalcError(1);
    return total;
  }

  // f IRR: taxa (% por período) que zera o NPV; raiz mais próxima de zero.
  irr() {
    const a = this.expanded();
    if (!(a.some((x) => x > 0) && a.some((x) => x < 0))) throw new CalcError(7);
    const fn = (r) => {
      const v = 1 / (1 + r);
      let p = 1;
      let total = 0;
      for (const x of a) {
        total += x * p;
        p *= v;
      }
      return total;
    };
    const pos = firstRoot(fn, POS);
    const neg = firstRoot(fn, NEG);
    const cands = [pos, neg].filter((r) => r !== null);
    if (!cands.length) throw new CalcError(7);
    return cands.reduce((x, y) => (Math.abs(x) <= Math.abs(y) ? x : y)) * 100;
  }

  toJSON() {
    return { cf0: this.cf0, flows: this.flows.map((f) => ({ amt: f.amt, nj: f.nj })) };
  }

  static valid(o, max = MAX_FLOWS) {
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    return !!o && num(o.cf0) && Array.isArray(o.flows) && o.flows.length <= max
      && o.flows.every((f) => f && num(f.amt) && Number.isInteger(f.nj) && f.nj >= 1 && f.nj <= MAX_NJ);
  }

  static fromJSON(o, max = MAX_FLOWS) {
    const c = new CashFlows(max);
    c.cf0 = o.cf0;
    c.flows = o.flows.map((f) => ({ amt: f.amt, nj: f.nj }));
    return c;
  }
}
