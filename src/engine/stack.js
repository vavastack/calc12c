// Pilha RPN da HP 12C (X, Y, Z, T, LastX) com digitação e regra de elevação.
const MAX_DIGITS = 10;

function countDigits(body) {
  if (body.includes('.')) {
    const [i, f] = body.split('.');
    return (i === '0' ? 0 : i.length) + f.length;
  }
  return body === '0' ? 0 : body.length;
}

export class Stack {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.t = 0;
    this.lastX = 0;
    this.entering = false; // há um número sendo digitado
    this.liftEnabled = true; // o próximo número digitado eleva a pilha?
    this._mant = ''; // mantissa digitada, com sinal
    this._exp = null; // { sign: ''|'-', digits: '' } quando em modo EEX
  }

  _lift() {
    this.t = this.z;
    this.z = this.y;
    this.y = this.x;
  }

  _startEntry(initialMant) {
    if (this.liftEnabled) this._lift();
    this._mant = initialMant;
    this._exp = null;
    this.entering = true;
    this.liftEnabled = true;
  }

  _parseEntry() {
    let m = this._mant === '' || this._mant === '-' ? '0' : this._mant;
    if (m.endsWith('.')) m += '0';
    if (this._exp) m += 'e' + this._exp.sign + (this._exp.digits || '0');
    return Number(m);
  }

  commit() {
    if (this.entering) {
      this.x = this._parseEntry();
      this.entering = false;
    }
  }

  entryText() {
    if (!this.entering) return '';
    let t = this._mant;
    if (this._exp) t += 'e' + this._exp.sign + this._exp.digits;
    return t;
  }

  digit(d) {
    if (!this.entering) this._startEntry('');
    if (this._exp) {
      if (this._exp.digits.length < 2) this._exp.digits += d;
    } else {
      const neg = this._mant.startsWith('-');
      let body = neg ? this._mant.slice(1) : this._mant;
      if (body === '0' || body === '') {
        body = d;
      } else if (countDigits(body) < MAX_DIGITS) {
        body += d;
      }
      this._mant = (neg ? '-' : '') + body;
    }
    this.x = this._parseEntry();
  }

  dot() {
    if (!this.entering) this._startEntry('0.');
    else if (this._exp) return;
    else if (!this._mant.includes('.')) {
      this._mant = (this._mant === '' || this._mant === '-' ? this._mant + '0' : this._mant) + '.';
    }
    this.x = this._parseEntry();
  }

  eex() {
    if (!this.entering) this._startEntry('1');
    if (!this._exp) this._exp = { sign: '', digits: '' };
    this.x = this._parseEntry();
  }

  chs() {
    if (this.entering) {
      if (this._exp) {
        this._exp.sign = this._exp.sign ? '' : '-';
      } else {
        this._mant = this._mant.startsWith('-') ? this._mant.slice(1) : '-' + this._mant;
      }
      this.x = this._parseEntry();
    } else {
      this.x = this.x === 0 ? 0 : -this.x;
    }
  }

  // ⌫ do teclado do PC: apaga o último caractere digitado; fora da digitação, age como CLx.
  backspace() {
    if (!this.entering) return this.clx();
    if (this._exp) {
      if (this._exp.digits) this._exp.digits = this._exp.digits.slice(0, -1);
      else this._exp = null;
    } else {
      this._mant = this._mant.slice(0, -1);
      if (this._mant === '' || this._mant === '-') return this.clx();
    }
    this.x = this._parseEntry();
  }

  enter() {
    this.commit();
    this.t = this.z;
    this.z = this.y;
    this.y = this.x;
    this.liftEnabled = false;
  }

  swap() {
    this.commit();
    [this.x, this.y] = [this.y, this.x];
    this.liftEnabled = true;
  }

  rollDown() {
    this.commit();
    const x = this.x;
    this.x = this.y;
    this.y = this.z;
    this.z = this.t;
    this.t = x;
    this.liftEnabled = true;
  }

  clx() {
    this.x = 0;
    this.entering = false;
    this._mant = '';
    this._exp = null;
    this.liftEnabled = false;
  }

  applyBinary(fn) {
    this.commit();
    const r = fn(this.y, this.x); // pode lançar: o estado só muda depois
    this.lastX = this.x;
    this.x = r;
    this.y = this.z;
    this.z = this.t;
    this.liftEnabled = true;
  }

  applyUnary(fn) {
    this.commit();
    const r = fn(this.x);
    this.lastX = this.x;
    this.x = r;
    this.liftEnabled = true;
  }

  // %, Δ%, %T: o resultado vai para X e Y é mantido.
  applyKeepY(fn) {
    this.commit();
    const r = fn(this.y, this.x);
    this.lastX = this.x;
    this.x = r;
    this.liftEnabled = true;
  }

  // Coloca X, Y e Z de uma vez (usado por f INT); T e LastX ficam como estão.
  loadXYZ(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.entering = false;
    this.liftEnabled = true;
  }

  // Zera pilha, LastX e digitação (f CLEAR REG e f CLEAR Σ).
  clearAll() {
    this.x = this.y = this.z = this.t = this.lastX = 0;
    this.entering = false;
    this._mant = '';
    this._exp = null;
    this.liftEnabled = true;
  }

  toJSON() {
    const { x, y, z, t, lastX, entering, liftEnabled, _mant, _exp } = this;
    return { x, y, z, t, lastX, entering, liftEnabled, mant: _mant, exp: _exp ? { ..._exp } : null };
  }

  static fromJSON(o) {
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!o || typeof o !== 'object') throw new Error('pilha inválida');
    for (const k of ['x', 'y', 'z', 't', 'lastX']) if (!num(o[k])) throw new Error('pilha inválida');
    if (typeof o.entering !== 'boolean' || typeof o.liftEnabled !== 'boolean') throw new Error('pilha inválida');
    if (typeof o.mant !== 'string' || !/^-?[0-9.]*$/.test(o.mant)) throw new Error('pilha inválida');
    if (o.exp !== null && !(o.exp && /^-?$/.test(o.exp.sign) && /^[0-9]{0,2}$/.test(o.exp.digits))) {
      throw new Error('pilha inválida');
    }
    const s = new Stack();
    Object.assign(s, { x: o.x, y: o.y, z: o.z, t: o.t, lastX: o.lastX });
    s.entering = o.entering;
    s.liftEnabled = o.liftEnabled;
    s._mant = o.mant;
    s._exp = o.exp ? { sign: o.exp.sign, digits: o.exp.digits } : null;
    return s;
  }

  // Coloca um resultado (ex.: cálculo financeiro) em X, sem mexer em Y, Z, T.
  setResult(v) {
    this.x = v;
    this.entering = false;
    this.liftEnabled = true;
  }

  // RCL: obedece à regra de elevação como um número digitado.
  recall(v) {
    this.commit();
    if (this.liftEnabled) this._lift();
    this.x = v;
    this.liftEnabled = true;
  }
}
