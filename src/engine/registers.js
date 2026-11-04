import { CalcError } from './errors.js';

// Registradores de armazenamento R0 a R9.
export class Registers {
  constructor() {
    this._r = new Array(10).fill(0);
  }

  _check(n) {
    if (!Number.isInteger(n) || n < 0 || n > 9) throw new CalcError(6);
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
