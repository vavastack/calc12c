// Motor da HP-16C: inteiros de largura fixa (1 a 64 bits) em HEX, DEC, OCT e BIN, com complemento de 1, de 2 ou sem sinal.
// Segue a interface do Engine da 12C (press, state, serialize, restore...), mas guarda tudo como BigInt "cru":
// o padrão de bits de cada registrador. Etapa atual: teclado sem programação nem ponto flutuante.
import { CalcError } from './errors.js';
import { getProfile } from './profiles.js';
import { labelKey, memInfo, MAX_LINES, MAX_RETURNS, MESSAGES_16C, isPrefix, lineDone, lineText, keyCode, runTest } from './program16.js';
import { add, asr, digitsOf, div, inRange, isqrt, leftJustify, maskOf, mul, negate, popcount, range, rmd, rotLeft, rotRight, shiftLeft, shiftRight, sub, toRaw, toSigned } from './intmath.js';

const VERSION = 1;
const MAX_TAPE = 200;
const WIN = { hex: 8, dec: 8, oct: 8, bin: 16 }; // dígitos por janela do visor
const LETTER = { hex: 'h', dec: 'd', oct: 'o', bin: 'b' };
const RADIX = { hex: 16, dec: 10, oct: 8, bin: 2 };
const CMP_CODE = { 2: '2', 1: '1', u: '0' };
const bad = () => new Error('estado salvo inválido');
const arg = (m) => new CalcError(3, m);
const err16 = (code) => new CalcError(code, MESSAGES_16C[code]);
const MAX_RUN = 200000; // passos por execução: evita travar a tela num laço infinito
const TEST_KEYS = ['1', '2', '3', 'minus', '0', 'dot', 'chs', 'plus'];

const digitOf = (id) => (/^[0-9]$/.test(id) ? id : /^d[a-f]$/.test(id) ? id[1].toUpperCase() : null);

export class Engine16 {
  constructor(opts = {}) {
    this.profile = opts.profile ?? '16c';
    this.locale = opts.locale ?? 'br';
    this.mode = 'rpn';
    this.ws = 16;
    this.cmp = '2'; // '2' | '1' | 'u'
    this.base = 'dec';
    this.st = { x: 0n, y: 0n, z: 0n, t: 0n, l: 0n };
    this.flags = [false, false, false, false, false, false]; // flags 0 a 5 (4 = C, 5 = G)
    this.regs = new Array(getProfile(this.profile).regCount).fill(0n);
    this.entry = null; // dígitos sendo digitados (texto) ou null
    this.lift = true;
    this.shift = null;
    this.pending = null; // 'sto' | 'rcl' | 'sto.' | 'rcl.' | 'sb' | 'cb' | 'sf' | 'cf' | 'window'
    this.window = 0;
    this.temp = null; // texto temporário (SHOW, STATUS) até a próxima tecla
    this.error = null;
    this.tape = [];
    this.tokens = [];
    this.prog = []; // linhas do programa: cada uma é a lista de teclas de uma instrução
    this.pc = 0; // linha atual: a próxima a executar é prog[pc]
    this.prgm = false;
    this.rec = []; // instrução em montagem (modo PRGM)
    this.ret = []; // retornos de GSB pendentes
    this.idx = 0n; // registrador I
    this.running = false;
    this.halt = false;
    this.pauses = [];
  }

  get keyById() {
    return getProfile(this.profile).keyById;
  }

  // ---------- estado ----------
  get state() {
    const { x, y, z, t, l } = this.st;
    const text = (v) => this._valText(v, 0);
    return {
      display: this._display(),
      profile: this.profile,
      mode: 'rpn',
      parens: 0,
      stack: { x: String(x), y: String(y), z: String(z), t: String(t), lastX: String(l) },
      texts: { x: text(x), y: text(y), z: text(z), t: text(t), lastX: text(l), regs: this.regs.map(text), idx: text(this.idx) },
      regs: this.regs.map(String),
      fin: { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 },
      begin: false,
      compound: false,
      dmy: false,
      prgm: this.prgm,
      pc: this.pc,
      shift: this.shift,
      decimals: 0,
      locale: this.locale,
      error: this.error ? { ...this.error } : null,
      tape: this.tape.map((r) => ({ ...r })),
      pending: this.pending,
      undo: false,
      ws: this.ws,
      cmp: this.cmp,
      base: this.base,
      carry: this.flags[4],
      oor: this.flags[5],
      flags: [...this.flags],
      window: this.window,
    };
  }

  setLocale(locale) {
    if (locale !== 'br' && locale !== 'us') throw new Error('formato desconhecido: ' + locale);
    this.locale = locale;
  }

  reset() {
    const locale = this.locale;
    Object.assign(this, new Engine16({ locale, profile: this.profile }));
  }

  loadValue(v) {
    if (this.error) return;
    this.pending = null;
    this.shift = null;
    this._push(BigInt(v) & maskOf(this.ws));
  }

  // ⌫ do teclado do PC
  backspace() {
    if (this.error) {
      this.error = null;
      this.shift = null;
      this.pending = null;
      return;
    }
    this.shift = null;
    this.pending = null;
    this._bsp();
  }

  // ---------- teclas ----------
  press(id) {
    const key = this.keyById.get(id);
    if (!key) throw new Error('tecla desconhecida: ' + id);
    if (id !== 'f' && id !== 'g') this.temp = null;
    if (this.error) {
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
    try {
      if (this.prgm) this._recordPress(id);
      else this._pressRaw(id);
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      this.error = { code: e.code, message: e.message };
      this.shift = null;
      this.pending = null;
      this.entry = null;
      this.tokens = [];
      this.rec = [];
      this.running = false;
    }
  }

  _pressRaw(id) {
    if (id === 'f' || id === 'g') {
      if (!['sto', 'rcl', 'gsb', 'gto'].includes(this.pending)) this.pending = null; // STO f I, GTO f I: o prefixo só prepara o argumento
      this.shift = id;
      return;
    }
    this._dispatch(this.keyById.get(id));
  }

  // ---------- programação ----------
  // Modo PRGM: as teclas viram linhas de programa em vez de serem executadas.
  _recordPress(id) {
    const r = this.rec;
    if (isPrefix(id) && (r.length === 0 || ['sto', 'rcl', 'gsb', 'gto'].includes(r[0]))) {
      if (r.length === 0) r.push(id);
      this.shift = id;
      return;
    }
    if (r.length === 0 && id === 'sst') { this.pc = Math.min(this.pc + 1, this.prog.length); return; }
    if (r.length === 0 && id === 'bsp') {
      if (this.pc > 0) this.prog.splice(--this.pc, 1);
      return;
    }
    if (r.length === 1 && isPrefix(r[0])) {
      const pre = r[0];
      if (pre === 'g' && id === 'rs') { this.rec = []; this.shift = null; this.prgm = false; return; }
      if (pre === 'g' && id === 'sst') { this.rec = []; this.shift = null; this.pc = Math.max(this.pc - 1, 0); return; }
      if (pre === 'f' && id === 'rdown') { this.rec = []; this.shift = null; this.prog = []; this.pc = 0; this.ret = []; return; }
    }
    r.push(id);
    this.shift = null;
    if (!lineDone(r)) return;
    this.rec = [];
    if (this.prog.length >= MAX_LINES) throw err16(4);
    this.prog.splice(this.pc++, 0, r);
  }

  _findLabel(id) {
    const i = this.prog.findIndex((l) => l.length === 3 && l[0] === 'g' && l[1] === 'gto' && l[2] === id);
    if (i < 0) throw err16(4);
    return i;
  }

  _execLine(line) {
    this.shift = null;
    this.pending = null;
    for (const k of line) this._pressRaw(k);
  }

  _run() {
    this.running = true;
    this.halt = false;
    let steps = 0;
    try {
      while (!this.halt && this.pc < this.prog.length && ++steps <= MAX_RUN) this._execLine(this.prog[this.pc++]);
      if (!this.halt && this.pc >= this.prog.length) this.pc = 0;
    } finally {
      this.running = false;
    }
  }

  _step() {
    if (this.pc >= this.prog.length) { this.pc = 0; return; }
    this.running = true;
    this.halt = false;
    try {
      this._execLine(this.prog[this.pc++]);
      if (this.pc >= this.prog.length) this.pc = 0;
    } finally {
      this.running = false;
    }
  }

  _skip() {
    if (this.running && this.pc < this.prog.length) this.pc++;
  }

  _rtn() {
    if (this.ret.length) this.pc = this.ret.pop();
    else {
      this.pc = 0;
      this.halt = true;
    }
  }

  // Teclas de programação; devolve true se tratou.
  _control(shift, id) {
    if (shift === null && (id === 'gsb' || id === 'gto')) { this._commit(); this.pending = id; return true; }
    if (shift === null && id === 'rs') {
      if (this.running) this.halt = true;
      else { this._commit(); this._run(); }
      return true;
    }
    if (shift === null && id === 'sst') { this._commit(); if (!this.running) this._step(); return true; }
    if (shift === 'f' && id === 'rdown') { this.pc = 0; this.ret = []; return true; }
    if (shift === 'f' && id === 'gto') { this._commit(); [this.st.x, this.idx] = [this.idx, this.st.x]; this.lift = true; this._record('x≷I'); return true; }
    if (shift === 'f' && id === 'gsb') {
      this._commit();
      const n = this._indirect();
      [this.st.x, this.regs[n]] = [this.regs[n], this.st.x];
      this.lift = true;
      this._record('x≷(i)');
      return true;
    }
    if (shift === 'f' && id === '6') { this._commit(); this.pending = 'btest'; return true; }
    if (shift === 'g' && id === '6') { this._commit(); this.pending = 'ftest'; return true; }
    if (shift === 'f' && id === '0') {
      this._commit();
      const { b, r } = memInfo(this.prog.length, this.ws);
      this.temp = `p-${String(b).padStart(2, '0')} r-${String(r).padStart(2, '0')}`;
      return true;
    }
    if (shift !== 'g') return false;
    if (id === 'gsb') { this._commit(); this._rtn(); return true; }
    if (id === 'gto') { this._commit(); this.pending = 'lbl'; return true; }
    if (id === 'hex' || id === 'dec') {
      this._commit();
      this.idx = (this.idx + (id === 'hex' ? maskOf(this.ws) : 1n)) & maskOf(this.ws);
      if (this.idx === 0n) this._skip();
      return true;
    }
    if (id === 'rs') { this._commit(); this.prgm = true; this.rec = []; return true; }
    if (id === 'sst') { this.pc = Math.max(this.pc - 1, 0); return true; }
    if (id === 'xy') { this.pauses.push(1000); return true; }
    if (TEST_KEYS.includes(id)) {
      this._commit();
      if (!runTest(id, this.st.x, this.st.y, this.ws, this.cmp)) this._skip();
      return true;
    }
    return false;
  }

  // Registrador apontado por I (o valor de I como número sem sinal).
  _indirect() {
    if (this.idx >= BigInt(this.regs.length)) throw err16(3);
    return Number(this.idx);
  }

  takePauses() {
    const p = this.pauses;
    this.pauses = [];
    return p;
  }

  _dispatch(key) {
    const shift = this.shift;
    this.shift = null;
    const id = key.id;
    if (!(shift === 'g' && (id === 'sto' || id === 'rcl')) && !this.pending) this.window = 0; // quase toda tecla volta à janela 0
    if (this.pending) return this._finishPending(key);
    if (id === 'on') return;
    if (!this.pending && this._control(shift, id)) return;
    if (shift === 'f') return this._f(key);
    if (shift === 'g') return this._g(key);
    return this._primary(key);
  }

  // ---------- pilha e entrada ----------
  _commit() {
    if (this.entry === null) return;
    this.tokens.push(this.entry === '' ? '0' : this.entry);
    this.st.x = this._parse(this.entry);
    this.entry = null;
  }

  _parse(text) {
    if (text === '') return 0n;
    const v = BigInt(({ hex: '0x', dec: '', oct: '0o', bin: '0b' })[this.base] + text);
    return this.base === 'dec' && this.cmp !== 'u' ? toRaw(v, this.ws, this.cmp) : v;
  }

  _fits(text) {
    const v = BigInt(({ hex: '0x', dec: '', oct: '0o', bin: '0b' })[this.base] + (text || '0'));
    if (this.base !== 'dec' || this.cmp === 'u') return v <= maskOf(this.ws);
    return v <= range(this.ws, this.cmp)[1]; // decimal com sinal: o negativo vem pelo CHS
  }

  _digit(d) {
    if (parseInt(d, 16) >= RADIX[this.base]) return; // dígito que não existe na base: ignorado
    const cur = this.entry ?? '';
    const next = (cur === '0' ? '' : cur) + d;
    if (!this._fits(next)) return;
    if (this.entry === null) {
      if (this.lift) this._rise();
      this.lift = true;
    }
    this.entry = next;
    this.st.x = this._parse(next);
  }

  _rise() {
    const s = this.st;
    s.t = s.z;
    s.z = s.y;
    s.y = s.x;
  }

  _push(raw) {
    if (this.lift) this._rise();
    this.st.x = raw;
    this.lift = true;
  }

  _drop() {
    const s = this.st;
    s.y = s.z;
    s.z = s.t;
  }

  _flags(r) {
    this.flags[4] = r.c;
    this.flags[5] = r.g;
  }

  // Operação de dois números (Y op X): o resultado fica em X e a pilha desce.
  _binary(fn, label, setFlags = true) {
    this._commit();
    const s = this.st;
    const r = fn(s.y, s.x, this.ws, this.cmp);
    if (!r) throw new CalcError(0);
    if (setFlags) this._flags(r);
    s.l = s.x;
    s.x = r.raw;
    this._drop();
    this.lift = true;
    this._record(label);
  }

  // Operação de um número (só X), com resultado { raw, c?, g? }.
  _unary(fn, label, flags = 'cg') {
    this._commit();
    const s = this.st;
    const r = fn(s.x, this.ws, this.cmp);
    if (!r) throw new CalcError(0);
    if (flags.includes('c')) this.flags[4] = r.c ?? false;
    if (flags.includes('g')) this.flags[5] = r.g ?? false;
    s.l = s.x;
    s.x = r.raw;
    this.lift = true;
    this._record(label);
  }

  _bsp() {
    if (this.entry !== null) {
      this.entry = this.entry.slice(0, -1);
      this.st.x = this._parse(this.entry);
      return;
    }
    this._clx();
  }

  _clx() {
    this.entry = null;
    this.st.x = 0n;
    this.lift = false;
    this.tokens.push('CLx');
  }

  // ---------- teclas sem prefixo ----------
  _primary(key) {
    const id = key.id;
    const d = digitOf(id);
    if (d !== null) return this._digit(d);
    switch (id) {
      case 'hex':
      case 'dec':
      case 'oct':
      case 'bin':
        this._commit();
        this.base = id;
        return;
      case 'plus':
        return this._binary(add, '+');
      case 'minus':
        return this._binary(sub, '−');
      case 'times':
        return this._binary(mul, '×');
      case 'divide':
        return this._binary(div, '÷');
      case 'enter': {
        this._commit();
        const s = this.st;
        s.t = s.z;
        s.z = s.y;
        s.y = s.x;
        this.lift = false;
        this.tokens.push('ENTER');
        return;
      }
      case 'xy': {
        this._commit();
        const s = this.st;
        [s.x, s.y] = [s.y, s.x];
        this.lift = true;
        this.tokens.push('x≷y');
        return;
      }
      case 'rdown': {
        this._commit();
        const s = this.st;
        [s.x, s.y, s.z, s.t] = [s.y, s.z, s.t, s.x];
        this.lift = true;
        this.tokens.push('R↓');
        return;
      }
      case 'bsp':
        return this._bsp();
      case 'chs':
        return this._chs();
      case 'sto':
      case 'rcl':
        this._commit();
        this.pending = id;
        return;
    }
  }

  _chs() {
    this._commit();
    const s = this.st;
    const signed = this.base === 'dec' && this.cmp !== 'u';
    const r = signed ? this._negateSigned(s.x) : negate(s.x, this.ws, this.cmp);
    this.flags[5] = r.g;
    s.x = r.raw;
    this.lift = true;
    this.tokens.push('CHS');
    this._record('CHS');
  }

  _negateSigned(raw) {
    const sv = toSigned(raw, this.ws, this.cmp);
    const n = -sv;
    if (!inRange(n, this.ws, this.cmp)) return { raw, g: true }; // −(menor negativo)
    return { raw: toRaw(n, this.ws, this.cmp), g: false };
  }

  // ---------- f ----------
  _f(key) {
    const id = key.id;
    const s = this.st;
    switch (id) {
      case 'da': return this._shiftOp(shiftLeft, 'SL');
      case 'db': return this._shiftOp(shiftRight, 'SR');
      case 'dc': return this._shiftOp(rotLeft, 'RL');
      case 'dd': return this._shiftOp(rotRight, 'RR');
      case 'de': return this._rotN(true, false, 'RLn');
      case 'df': return this._rotN(false, false, 'RRn');
      case '7': return this._maskOp(true);
      case '8': return this._maskOp(false);
      case '9': return this._binary(rmd, 'RMD');
      case 'divide': return this._binary((y, x) => ({ raw: y ^ x }), 'XOR', false);
      case 'times': return this._binary((y, x) => ({ raw: y & x }), 'AND', false);
      case 'plus': return this._binary((y, x) => ({ raw: y | x }), 'OR', false);
      case 'minus': return this._unary((x, ws) => ({ raw: maskOf(ws) ^ x }), 'NOT', '');
      case 'hex':
      case 'dec':
      case 'oct':
      case 'bin':
        this._commit();
        this.temp = this._valText(s.x, 0, id);
        return;
      case '1': this.cmp = '1'; return;
      case '2': this.cmp = '2'; return;
      case '3': this.cmp = 'u'; return;
      case '4': this.pending = 'sb'; return this._commit();
      case '5': this.pending = 'cb'; return this._commit();
      case 'sto': return this._wsize();
      case 'enter': this._commit(); this.pending = 'window'; return;
      case 'dot':
        this._commit();
        this.temp = `${CMP_CODE[this.cmp]}-${this.ws}-${[3, 2, 1, 0].map((n) => (this.flags[n] ? 1 : 0)).join('')}`;
        return;
      case 'xy': // CLEAR REG
        this.regs.fill(0n);
        return;
      // CLEAR PRGM, CLEAR PREFIX: nada a fazer; demais: fora desta etapa
    }
  }

  _wsize() {
    this._commit();
    const s = this.st;
    let n = Number(s.x);
    if (s.x > 64n) n = 99;
    if (n === 0) n = 64;
    if (n > 64) throw arg('Tamanho de palavra inválido');
    this.ws = n;
    const m = maskOf(n);
    for (const k of ['x', 'y', 'z', 't', 'l']) s[k] &= m;
    this.regs = this.regs.map((r) => r & m);
    this.lift = true;
  }

  _shiftOp(fn, label) {
    this._commit();
    const s = this.st;
    const useCarry = fn === rotLeft || fn === rotRight ? null : undefined;
    const r = useCarry === undefined ? fn(s.x, this.ws) : fn(s.x, this.ws, null);
    this.flags[4] = r.c;
    s.l = s.x;
    s.x = r.raw;
    this.lift = true;
    this._record(label);
  }

  _carryOp(fn, label) {
    this._commit();
    const s = this.st;
    const r = fn(s.x, this.ws, this.flags[4]);
    this.flags[4] = r.c;
    s.l = s.x;
    s.x = r.raw;
    this.lift = true;
    this._record(label);
  }

  // RLn, RRn, RLCn, RRCn: giram Y pelas X posições; o resultado fica em X.
  _rotN(left, carry, label) {
    this._commit();
    const s = this.st;
    const n = s.x > 255n ? 255 : Number(s.x);
    let v = s.y;
    let c = this.flags[4];
    for (let i = 0; i < n; i++) {
      const r = left ? rotLeft(v, this.ws, carry ? c : null) : rotRight(v, this.ws, carry ? c : null);
      v = r.raw;
      c = r.c;
    }
    this.flags[4] = n === 0 ? this.flags[4] : c;
    s.l = s.x;
    s.x = v;
    this._drop();
    this.lift = true;
    this._record(label);
  }

  _maskOp(left) {
    this._commit();
    const s = this.st;
    if (s.x > BigInt(this.ws)) throw err16(2);
    const n = Number(s.x);
    const low = (1n << BigInt(n)) - 1n;
    s.l = s.x;
    s.x = left ? low << BigInt(this.ws - n) : low;
    this.lift = true;
    this._record(left ? 'MASKL' : 'MASKR');
  }

  // ---------- g ----------
  _g(key) {
    const id = key.id;
    const s = this.st;
    switch (id) {
      case 'da': return this._leftJustify();
      case 'db': return this._shiftOp((raw, ws) => asr(raw, ws), 'ASR');
      case 'dc': return this._carryOp(rotLeft, 'RLC');
      case 'dd': return this._carryOp(rotRight, 'RRC');
      case 'de': return this._rotN(true, true, 'RLCn');
      case 'df': return this._rotN(false, true, 'RRCn');
      case '7': return this._unary((x) => ({ raw: BigInt(popcount(x)) }), '#B', '');
      case '8': return this._unary((x, ws, cmp) => this._abs(x, ws, cmp), 'ABS', 'g');
      case 'oct': return this._unary((x, ws, cmp) => this._sqrt(x, ws, cmp), '√x');
      case 'bin': return this._unary((x, ws, cmp) => this._recip(x, ws, cmp), '1/x');
      case '4': this._commit(); this.pending = 'sf'; return;
      case '5': this._commit(); this.pending = 'cf'; return;
      case 'times': return this._dblMul();
      case 'divide': return this._dblDiv(false);
      case '9': return this._dblDiv(true);
      case 'rdown': {
        this._commit();
        [s.x, s.y, s.z, s.t] = [s.t, s.x, s.y, s.z];
        this.lift = true;
        this.tokens.push('R↑');
        return;
      }
      case 'bsp':
        return this._clx();
      case 'enter':
        this._commit();
        this._push(s.l);
        this.tokens.push('LSTx');
        return;
      case 'sto': return this._scroll(1);
      case 'rcl': return this._scroll(-1);
    }
  }

  _abs(x, ws, cmp) {
    if (cmp === 'u') return { raw: x, g: false };
    const sv = toSigned(x, ws, cmp);
    if (sv >= 0n) return { raw: x, g: false };
    if (!inRange(-sv, ws, cmp)) return { raw: x, g: true };
    return { raw: toRaw(-sv, ws, cmp), g: false };
  }

  _sqrt(x, ws, cmp) {
    const sv = toSigned(x, ws, cmp);
    if (sv < 0n) return null; // raiz de negativo: Error 0
    const r = isqrt(sv);
    return { raw: r, c: r * r !== sv, g: false };
  }

  _recip(x, ws, cmp) {
    const sv = toSigned(x, ws, cmp);
    if (sv === 0n) return null;
    const one = 1n;
    const q = one / sv; // trunca: só ±1 dá diferente de zero
    return { raw: toRaw(q, ws, cmp), c: one % sv !== 0n, g: false };
  }

  _leftJustify() {
    this._commit();
    const s = this.st;
    const r = leftJustify(s.x, this.ws);
    s.l = s.x;
    this._rise();
    s.y = r.raw;
    s.x = BigInt(r.n);
    this.lift = true;
    this._record('LJ');
  }

  // Multiplicação e divisão de precisão dupla: o par Y:X (ou Z:Y) guarda um número de 2·ws bits.
  _dbl(hi, lo) {
    const w = BigInt(this.ws);
    const v = (hi << w) | lo;
    return this.cmp === 'u' ? v : BigInt.asIntN(this.ws * 2, v);
  }

  _dblMul() {
    this._commit();
    const s = this.st;
    const p = toSigned(s.y, this.ws, this.cmp) * toSigned(s.x, this.ws, this.cmp);
    const u = BigInt.asUintN(this.ws * 2, p);
    s.l = s.x;
    s.x = u & maskOf(this.ws);
    s.y = u >> BigInt(this.ws);
    this.flags[5] = false;
    this.lift = true;
    this._record('DBL×');
  }

  _dblDiv(remainder) {
    this._commit();
    const s = this.st;
    const sx = toSigned(s.x, this.ws, this.cmp);
    if (sx === 0n) throw new CalcError(0);
    const n = this._dbl(s.z, s.y);
    const r = remainder ? n % sx : n / sx;
    const ok = inRange(r, this.ws, this.cmp);
    s.l = s.x;
    s.x = ok ? toRaw(r, this.ws, this.cmp) : BigInt.asUintN(this.ws, r);
    s.y = s.t;
    s.z = s.t;
    this.flags[5] = !ok;
    this.flags[4] = !remainder && n % sx !== 0n;
    this.lift = true;
    this._record(remainder ? 'DBLR' : 'DBL÷');
  }

  _scroll(dir) {
    const max = this._windowCount(this.st.x) - 1;
    this.window = Math.max(0, Math.min(Math.max(0, max), this.window + dir));
  }

  // ---------- STO, RCL, bits, flags, janela ----------
  _finishPending(key) {
    const mode = this.pending;
    this.pending = null;
    const id = key.id;
    const d = digitOf(id);
    const s = this.st;
    if (mode === 'gsb' || mode === 'gto' || mode === 'lbl') {
      if (mode === 'lbl') return;
      let lab = id;
      if (id === 'sst') {
        if (this.idx > 15n) throw err16(4);
        lab = labelKey(Number(this.idx));
      } else if (d === null) return;
      const to = this._findLabel(lab);
      if (mode === 'gsb') {
        if (this.running) {
          if (this.ret.length >= MAX_RETURNS) throw err16(5);
          this.ret.push(this.pc);
        } else this.ret = [];
      }
      this.pc = to + 1;
      if (mode === 'gsb' && !this.running) this._run();
      return;
    }
    if (mode === 'sto' || mode === 'rcl' || mode === 'sto.' || mode === 'rcl.') {
      if (id === 'dot' && !mode.endsWith('.')) {
        this.pending = mode + '.';
        return;
      }
      if (id === 'sst' && !mode.endsWith('.')) {
        if (mode === 'sto') { this.idx = s.x; this.lift = true; } else this._push(this.idx);
        return;
      }
      if (id === 'rs' && !mode.endsWith('.')) {
        const n = this._indirect();
        if (mode === 'sto') { this.regs[n] = s.x; this.lift = true; } else this._push(this.regs[n]);
        return;
      }
      if (d === null) return;
      const n = parseInt(d, 16) + (mode.endsWith('.') ? 16 : 0);
      if (n >= this.regs.length) throw err16(3);
      const label = `${mode.startsWith('sto') ? 'STO' : 'RCL'} ${mode.endsWith('.') ? '.' : ''}${d}`;
      if (mode.startsWith('sto')) {
        this.regs[n] = s.x;
        this.lift = true;
      } else this._push(this.regs[n]);
      this._record(label);
      return;
    }
    if (d === null) return;
    const n = parseInt(d, 16);
    if (mode === 'btest') {
      if (n >= this.ws) throw err16(2);
      if (!((s.x >> BigInt(n)) & 1n)) this._skip();
      return;
    }
    if (mode === 'ftest') {
      if (n > 5) throw err16(1);
      if (!this.flags[n]) this._skip();
      return;
    }
    if (mode === 'window') {
      if (n > 7) throw err16(1);
      this.window = n;
    } else if (mode === 'sf' || mode === 'cf') {
      if (n > 5) throw err16(1);
      this.flags[n] = mode === 'sf';
    } else {
      if (n >= this.ws) throw err16(2);
      s.x = mode === 'sb' ? s.x | (1n << BigInt(n)) : s.x & ~(1n << BigInt(n));
      this.lift = true;
      this._record(mode === 'sb' ? `SB ${d}` : `CB ${d}`);
    }
  }

  // ---------- visor ----------
  _windowCount(raw) {
    const len = digitsOf(raw, this.ws, this.cmp, this.base, this.flags[3]).replace('-', '').length;
    return Math.ceil(len / WIN[this.base]);
  }

  // Texto de um valor na base (a atual, se não vier outra) e janela dadas; o fim do número é a janela 0.
  _valText(raw, window = this.window, base = this.base) {
    const full = digitsOf(raw, this.ws, this.cmp, base, this.flags[3]);
    return this._slice(full, window, base);
  }

  _slice(full, window, base) {
    const neg = full.startsWith('-');
    const digits = neg ? full.slice(1) : full;
    const size = WIN[base];
    const end = digits.length - window * size;
    const part = end <= 0 ? '0' : digits.slice(Math.max(0, end - size), end);
    return (neg && window === 0 ? '-' : '') + part + ' ' + LETTER[base];
  }

  _display() {
    if (this.error) return 'Error ' + this.error.code;
    if (this.prgm) {
      if (this.rec.length) return String(this.pc + 1).padStart(3, '0') + '- ' + this.rec.map(keyCode).filter((c) => c !== undefined).join(',');
      return this.pc === 0 ? '000-' : lineText(this.pc, this.prog[this.pc - 1]);
    }
    if (this.temp !== null) return this.temp;
    if (this.entry !== null) return this._slice(this.entry === '' ? '0' : this.entry, 0, this.base);
    return this._valText(this.st.x);
  }

  _record(label) {
    this.tokens.push(label);
    this.tape.push({ keys: this.tokens.join(' '), label, value: String(this.st.x), text: this._valText(this.st.x, 0) });
    if (this.tape.length > MAX_TAPE) this.tape.shift();
    this.tokens = [];
  }

  // ---------- serialização ----------
  serialize() {
    const s = this.st;
    return JSON.stringify({
      v: VERSION,
      profile: this.profile,
      ws: this.ws,
      cmp: this.cmp,
      base: this.base,
      st: { x: String(s.x), y: String(s.y), z: String(s.z), t: String(s.t), l: String(s.l) },
      flags: this.flags,
      regs: this.regs.map(String),
      entry: this.entry,
      lift: this.lift,
      shift: this.shift,
      pending: this.pending,
      window: this.window,
      locale: this.locale,
      error: this.error,
      tape: this.tape,
      tokens: this.tokens,
      prog: this.prog,
      pc: this.pc,
      prgm: this.prgm,
      ret: this.ret,
      idx: String(this.idx),
    });
  }

  static restore(json) {
    const o = JSON.parse(json);
    const big = (v, ws) => {
      if (typeof v !== 'string' || !/^[0-9]+$/.test(v)) throw bad();
      const b = BigInt(v);
      if (b > maskOf(ws)) throw bad();
      return b;
    };
    if (!o || typeof o !== 'object' || o.v !== VERSION) throw bad();
    if (typeof o.profile !== 'string') throw bad();
    if (!Number.isInteger(o.ws) || o.ws < 1 || o.ws > 64) throw bad();
    if (!['2', '1', 'u'].includes(o.cmp) || !['hex', 'dec', 'oct', 'bin'].includes(o.base)) throw bad();
    if (!o.st || !Array.isArray(o.flags) || o.flags.length !== 6 || !o.flags.every((f) => typeof f === 'boolean')) throw bad();
    if (!Array.isArray(o.regs) || !Array.isArray(o.tape) || !Array.isArray(o.tokens)) throw bad();
    if (o.locale !== 'br' && o.locale !== 'us') throw bad();
    if (![null, 'f', 'g'].includes(o.shift) || ![null, 'sto', 'rcl', 'sto.', 'rcl.', 'sb', 'cb', 'sf', 'cf', 'window', 'gsb', 'gto', 'lbl', 'btest', 'ftest'].includes(o.pending)) throw bad();
    if (o.entry !== null && !(typeof o.entry === 'string' && /^[0-9A-F]*$/.test(o.entry))) throw bad();
    const e = new Engine16({ locale: o.locale, profile: o.profile });
    Object.assign(e, {
      ws: o.ws,
      cmp: o.cmp,
      base: o.base,
      flags: [...o.flags],
      entry: o.entry,
      lift: o.lift !== false,
      shift: o.shift,
      pending: o.pending,
      window: Number.isInteger(o.window) && o.window >= 0 && o.window < 8 ? o.window : 0,
      error: o.error && Number.isInteger(o.error.code) ? { code: o.error.code, message: String(o.error.message) } : null,
      tape: o.tape.filter((r) => r && typeof r.keys === 'string' && typeof r.text === 'string').map((r) => ({ keys: r.keys, label: String(r.label), value: String(r.value), text: r.text })),
      tokens: o.tokens.map(String),
    });
    if (Array.isArray(o.prog)) {
      const okLine = (l) => Array.isArray(l) && l.length > 0 && l.length <= 4 && l.every((k) => typeof k === 'string' && e.keyById.has(k));
      if (o.prog.length > MAX_LINES || !o.prog.every(okLine)) throw bad();
      e.prog = o.prog.map((l) => [...l]);
      e.pc = Number.isInteger(o.pc) && o.pc >= 0 && o.pc <= e.prog.length ? o.pc : 0;
      e.prgm = o.prgm === true;
      e.ret = Array.isArray(o.ret) ? o.ret.filter((n) => Number.isInteger(n) && n >= 0 && n <= e.prog.length).slice(0, MAX_RETURNS) : [];
      e.idx = typeof o.idx === 'string' && /^[0-9]+$/.test(o.idx) ? big(o.idx, o.ws) : 0n;
    }
    for (const k of ['x', 'y', 'z', 't', 'l']) e.st[k] = big(o.st[k], o.ws);
    o.regs.slice(0, e.regs.length).forEach((v, n) => { e.regs[n] = big(v, o.ws); });
    return e;
  }
}
