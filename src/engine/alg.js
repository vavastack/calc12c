// Modo ALG da HP 12C Platinum (Apêndice B do manual): as operações são feitas na ordem em que são digitadas,
// da esquerda para a direita, sem hierarquia (1 + 2 × 3 = 9). ENTER faz o papel de "=" e fecha os parênteses.
// Este módulo guarda só o estado das operações pendentes; quem calcula e mexe na pilha é o engine.js.
export const MAX_PARENS = 13; // parênteses abertos ao mesmo tempo (manual, p. 26)

export class AlgState {
  constructor() {
    this.lastResult = 0; // último resultado concluído (alimenta a pilha de histórico)
    this.fresh = false; // a última tecla foi um operador ou "(": o próximo número começa do zero
    this.wasFresh = false; // valor de `fresh` antes da tecla que está sendo tratada
    this.clxPrev = false; // a tecla anterior foi CLx
    this.wasClx = false;
    this.clearPending();
  }

  // Cada nível (o principal e um por parêntese aberto) guarda o acumulado e o operador esperando o próximo número.
  clearPending() {
    this.frames = [{ acc: null, op: null }];
    this.fresh = false;
  }

  get depth() {
    return this.frames.length - 1;
  }

  get top() {
    return this.frames[this.frames.length - 1];
  }

  // Há algo a calcular quando o ENTER for apertado?
  get pending() {
    return this.depth > 0 || this.top.op !== null;
  }

  toJSON() {
    return { frames: this.frames.map((f) => ({ ...f })), lastResult: this.lastResult };
  }

  static valid(o) {
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    return !!o && typeof o === 'object' && num(o.lastResult) && Array.isArray(o.frames) && o.frames.length >= 1 &&
      o.frames.length <= MAX_PARENS + 1 &&
      o.frames.every((f) => f && (f.acc === null || num(f.acc)) && (f.op === null || ['plus', 'minus', 'times', 'divide', 'yx'].includes(f.op)));
  }

  static fromJSON(o) {
    const a = new AlgState();
    a.frames = o.frames.map((f) => ({ acc: f.acc, op: f.op }));
    a.lastResult = o.lastResult;
    return a;
  }
}
