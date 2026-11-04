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

  _commit() {
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

  enter() {
    this._commit();
    this.t = this.z;
    this.z = this.y;
    this.y = this.x;
    this.liftEnabled = false;
  }

  swap() {
    this._commit();
    [this.x, this.y] = [this.y, this.x];
    this.liftEnabled = true;
  }

  rollDown() {
    this._commit();
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
    this._commit();
    const r = fn(this.y, this.x); // pode lançar: o estado só muda depois
    this.lastX = this.x;
    this.x = r;
    this.y = this.z;
    this.z = this.t;
    this.liftEnabled = true;
  }

  applyUnary(fn) {
    this._commit();
    const r = fn(this.x);
    this.lastX = this.x;
    this.x = r;
    this.liftEnabled = true;
  }

  // Coloca um resultado (ex.: cálculo financeiro) em X, sem mexer em Y, Z, T.
  setResult(v) {
    this.x = v;
    this.entering = false;
    this.liftEnabled = true;
  }

  // RCL: obedece à regra de elevação como um número digitado.
  recall(v) {
    this._commit();
    if (this.liftEnabled) this._lift();
    this.x = v;
    this.liftEnabled = true;
  }
}
