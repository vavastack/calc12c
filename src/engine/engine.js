import { KEY_BY_ID } from './keymap.js';
import { Stack } from './stack.js';
import { Registers } from './registers.js';
import { applyOp } from './math.js';
import { solve, simpleInterest } from './tvm.js';
import { CalcError } from './errors.js';
import { round10, formatNumber } from './number.js';

const VERSION = 1;
const MAX_TAPE = 500;
const FIN = ['n', 'i', 'pv', 'pmt', 'fv'];
const FIN_LABEL = { n: 'n', i: 'i', pv: 'PV', pmt: 'PMT', fv: 'FV' };
const PRIMARY_OPS = ['plus', 'minus', 'times', 'divide', 'yx', 'recip', 'pctT', 'dpct', 'pct'];
const G_OPS = { yx: 'sqrt', recip: 'expx', pctT: 'ln', dpct: 'frac', pct: 'intg' };
const isDigit = (id) => /^[0-9]$/.test(id);
const zeroFin = () => ({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });

export class Engine {
  constructor(opts = {}) {
    this.stack = new Stack();
    this.regs = new Registers();
    this.fin = zeroFin();
    this.begin = false;
    this.shift = null; // null | 'f' | 'g'
    this.pending = null; // null | 'sto' | 'rcl' (aguardando o registrador)
    this.justStored = false; // última operação guardou em n, i, PV, PMT ou FV?
    this.decimals = 2;
    this.locale = opts.locale ?? 'br';
    this.error = null;
    this.tape = [];
    this.tokens = []; // teclas desde a última linha da fita
  }

  // ---------- estado ----------
  get state() {
    const s = this.stack;
    return {
      display: this._display(),
      stack: { x: s.x, y: s.y, z: s.z, t: s.t, lastX: s.lastX },
      regs: this.regs.values(),
      fin: { ...this.fin },
      begin: this.begin,
      shift: this.shift,
      decimals: this.decimals,
      locale: this.locale,
      error: this.error ? { ...this.error } : null,
      tape: this.tape.map((l) => ({ ...l })),
      pending: this.pending,
    };
  }

  setLocale(locale) {
    if (locale !== 'br' && locale !== 'us') throw new Error('formato desconhecido: ' + locale);
    this.locale = locale;
  }

  // ---------- teclas ----------
  press(id) {
    const key = KEY_BY_ID.get(id);
    if (!key) throw new Error('tecla desconhecida: ' + id);
    if (this.error) {
      // Qualquer tecla limpa o erro e não é executada (como na HP).
      this.error = null;
      this.shift = null;
      this.pending = null;
      return;
    }
    if (!key.enabled) {
      this.shift = null;
      this.pending = null;
      return;
    }
    if (id === 'f' || id === 'g') {
      this.pending = null;
      this.shift = id;
      return;
    }
    try {
      this._dispatch(key);
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      this.error = { code: e.code, message: e.message };
      this.shift = null;
      this.pending = null;
      this.tokens = [];
    }
  }

  // Limpar tudo: pilha, registradores, financeiros, fita; mantém o formato (pt-BR / en-US).
  reset() {
    const locale = this.locale;
    Object.assign(this, new Engine({ locale }));
  }

  // Linha da fita tocada: o valor entra em X, respeitando a regra de elevação da pilha.
  loadValue(v) {
    if (this.error) return;
    this.pending = null;
    this.shift = null;
    this.justStored = false;
    this.stack.recall(v);
  }

  // ⌫ (só no teclado do PC): apaga o último dígito; limpa erro ou prefixo pendente.
  backspace() {
    if (this.error) {
      this.error = null;
      this.shift = null;
      this.pending = null;
      return;
    }
    this.shift = null;
    this.pending = null;
    this.stack.backspace();
  }

  _dispatch(key) {
    const shift = this.shift;
    this.shift = null;
    if (this.pending) return this._finishPending(key);
    if (key.id === 'on') return;
    const s = this.stack;
    const entryKey = shift === null && (isDigit(key.id) || key.id === 'dot' || key.id === 'eex' || key.id === 'chs');
    if (!entryKey && s.entering) this.tokens.push(s.entryText());
    const wasStored = this.justStored;
    this.justStored = false;
    if (shift === 'f') return this._f(key);
    if (shift === 'g') return this._g(key, wasStored);
    return this._primary(key, wasStored);
  }

  _primary(key, wasStored) {
    const id = key.id;
    const s = this.stack;
    if (isDigit(id)) return s.digit(id);
    if (PRIMARY_OPS.includes(id)) {
      applyOp(s, id);
      return this._record(key.label);
    }
    if (FIN.includes(id)) return this._finKey(id, wasStored);
    switch (id) {
      case 'dot':
        return s.dot();
      case 'eex':
        return s.eex();
      case 'chs': {
        const wasEntering = s.entering;
        s.chs();
        if (!wasEntering) this.tokens.push('CHS');
        return;
      }
      case 'enter':
        s.enter();
        this.tokens.push('ENTER');
        return;
      case 'xy':
        s.swap();
        this.tokens.push('x≷y');
        return;
      case 'rdown':
        s.rollDown();
        this.tokens.push('R↓');
        return;
      case 'clx':
        s.clx();
        this.tokens.push('CLx');
        return;
      case 'sto':
        s.commit();
        this.pending = 'sto';
        return;
      case 'rcl':
        this.pending = 'rcl';
        return;
    }
  }

  // n, i, PV, PMT, FV: guardam o número exibido; se a operação anterior já guardou
  // um valor financeiro, calculam (regra do manual, p.33-34).
  _finKey(id, wasStored) {
    const s = this.stack;
    if (wasStored) {
      const v = round10(solve(id, this.fin, this.begin));
      this.fin[id] = v;
      s.setResult(v);
    } else {
      s.commit();
      this.fin[id] = s.x;
      s.liftEnabled = true;
    }
    this.justStored = true;
    this._record(FIN_LABEL[id]);
  }

  _g(key, wasStored) {
    const id = key.id;
    const s = this.stack;
    if (id === 'n' || id === 'i') {
      s.applyUnary((x) => round10(id === 'n' ? x * 12 : x / 12));
      this.fin[id] = s.x;
      this.justStored = true;
      return this._record(id === 'n' ? '12×' : '12÷');
    }
    if (id === '7' || id === '8') {
      this.begin = id === '7';
      this.justStored = wasStored; // BEG/END não interrompem "acabou de guardar"
      return;
    }
    if (id === 'enter') {
      s.recall(s.lastX);
      this.tokens.push('LSTx');
      return;
    }
    if (G_OPS[id]) {
      applyOp(s, G_OPS[id]);
      return this._record(key.g);
    }
    // demais funções g (V2 e fora do escopo): ignoradas
  }

  _f(key) {
    const id = key.id;
    const s = this.stack;
    if (isDigit(id)) {
      this.decimals = Number(id);
      return;
    }
    switch (id) {
      case 'i': {
        s.commit();
        const r = simpleInterest(this.fin.n, this.fin.i, this.fin.pv);
        s.loadXYZ(round10(r.interest360), round10(-this.fin.pv), round10(r.interest365));
        return this._record('INT');
      }
      case 'xy': // CLEAR FIN
        s.commit();
        this.fin = zeroFin();
        return;
      case 'clx': // CLEAR REG
        this.regs.clear();
        this.fin = zeroFin();
        s.clearAll();
        this.tokens = [];
        return;
      // 'enter' (PREFIX) só cancela o prefixo; demais funções f: ignoradas
    }
  }

  _finishPending(key) {
    const mode = this.pending;
    this.pending = null;
    const s = this.stack;
    const id = key.id;
    if (isDigit(id)) {
      const n = Number(id);
      if (mode === 'sto') {
        s.commit();
        this.regs.store(n, s.x);
        s.liftEnabled = true;
        this._record(`STO ${n}`);
      } else {
        s.recall(this.regs.recall(n));
        this._record(`RCL ${n}`);
      }
    } else if (mode === 'rcl' && FIN.includes(id)) {
      s.recall(this.fin[id]);
      this._record(`RCL ${FIN_LABEL[id]}`);
    }
    // qualquer outra tecla cancela STO/RCL
  }

  _record(label) {
    this.tokens.push(label);
    const x = this.stack.x;
    this.tape.push({ keys: this.tokens.join(' '), label, value: x, text: this._fmt(x) });
    if (this.tape.length > MAX_TAPE) this.tape.shift();
    this.tokens = [];
  }

  // ---------- visor ----------
  _seps() {
    return this.locale === 'br' ? { thousands: '.', decimal: ',' } : { thousands: ',', decimal: '.' };
  }

  _fmt(x) {
    if (Math.abs(x) >= 1e10) {
      const [m, e] = x.toExponential(6).split('e');
      const exp = Number(e);
      return m.replace('.', this._seps().decimal) + ' ' + (exp < 0 ? '-' : '') + String(Math.abs(exp)).padStart(2, '0');
    }
    return formatNumber(x, this.decimals, this.locale);
  }

  _fmtEntry() {
    const { thousands, decimal } = this._seps();
    const m = /^(-?)(\d*)(\.(\d*))?(?:e(-?)(\d*))?$/.exec(this.stack.entryText());
    const [, sign, int, dot, frac, expSign, expDigits] = m;
    let out = sign + (int || '0').replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    if (dot) out += decimal + frac;
    if (expDigits !== undefined) out += ' ' + expSign + expDigits.padStart(2, '0');
    return out;
  }

  _display() {
    if (this.error) return 'Error ' + this.error.code;
    return this.stack.entering ? this._fmtEntry() : this._fmt(this.stack.x);
  }

  // ---------- serialização ----------
  serialize() {
    return JSON.stringify({
      v: VERSION,
      stack: this.stack.toJSON(),
      regs: this.regs.values(),
      fin: this.fin,
      begin: this.begin,
      shift: this.shift,
      pending: this.pending,
      justStored: this.justStored,
      decimals: this.decimals,
      locale: this.locale,
      error: this.error,
      tape: this.tape,
      tokens: this.tokens,
    });
  }

  static restore(json) {
    const o = JSON.parse(json); // lança SyntaxError se não for JSON
    const bad = () => new Error('estado salvo inválido');
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    const str = (v) => typeof v === 'string';
    if (!o || typeof o !== 'object' || o.v !== VERSION) throw bad();
    if (!Array.isArray(o.regs) || o.regs.length !== 10 || !o.regs.every(num)) throw bad();
    if (!o.fin || !FIN.every((k) => num(o.fin[k]))) throw bad();
    if (typeof o.begin !== 'boolean' || typeof o.justStored !== 'boolean') throw bad();
    if (![null, 'f', 'g'].includes(o.shift) || ![null, 'sto', 'rcl'].includes(o.pending)) throw bad();
    if (!Number.isInteger(o.decimals) || o.decimals < 0 || o.decimals > 9) throw bad();
    if (o.locale !== 'br' && o.locale !== 'us') throw bad();
    if (o.error !== null && !(o.error && Number.isInteger(o.error.code) && o.error.code >= 0 && o.error.code <= 9 && str(o.error.message))) throw bad();
    if (!Array.isArray(o.tape) || !o.tape.every((l) => l && str(l.keys) && str(l.label) && num(l.value) && str(l.text))) throw bad();
    if (!Array.isArray(o.tokens) || !o.tokens.every(str)) throw bad();
    const e = new Engine({ locale: o.locale });
    try {
      e.stack = Stack.fromJSON(o.stack);
    } catch {
      throw bad();
    }
    o.regs.forEach((v, n) => e.regs.store(n, v));
    e.fin = { n: o.fin.n, i: o.fin.i, pv: o.fin.pv, pmt: o.fin.pmt, fv: o.fin.fv };
    Object.assign(e, {
      begin: o.begin, shift: o.shift, pending: o.pending, justStored: o.justStored, decimals: o.decimals,
      error: o.error ? { code: o.error.code, message: o.error.message } : null,
      tape: o.tape.map((l) => ({ keys: l.keys, label: l.label, value: l.value, text: l.text })),
      tokens: [...o.tokens],
    });
    return e;
  }
}
