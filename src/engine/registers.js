import { CalcError } from './errors.js';

// Registradores de armazenamento: R0 a R9 e, na Platinum, também .0 a .9 (índices 10 a 19).
export class Registers {
  constructor(count = 10) {
    this._r = new Array(count).fill(0);
  }

  get size() {
    return this._r.length;
  }

  _check(n) {
    if (!Number.isInteger(n) || n < 0 || n >= this._r.length) throw new CalcError(6);
  }

  store(n, v) {
    this._check(n);
    this._r[n] = v;
  }

  recall(n) {
    this._check(n);
    return this._r[n];
  }

  clear() {
    this._r.fill(0);
  }

  values() {
    return [...this._r];
  }
}
