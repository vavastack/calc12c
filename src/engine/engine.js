import { getProfile, hasProfile, DEFAULT_PROFILE } from './profiles.js';
import { AlgState, MAX_PARENS } from './alg.js';
import { Stack } from './stack.js';
import { Registers } from './registers.js';
import { CashFlows } from './cashflow.js';
import { amortize, roundDec } from './amort.js';
import { sl, soyd, db } from './depreciation.js';
import { bondPrice, bondYield } from './bonds.js';
import { applyOp, compute, percentOf, divide100 } from './math.js';
import { solve, simpleInterest } from './tvm.js';
import { CalcError } from './errors.js';
import { MAX_LINES, lineText, memoryText, validLine } from './program.js';
import { addDays, daysBetween, formatDate } from './dates.js';
import { accumulate, means, deviations, weightedMean, estimateX, estimateY } from './stats.js';
import { round10, formatNumber } from './number.js';

const VERSION = 1;
const MAX_TAPE = 500;
const FIN = ['n', 'i', 'pv', 'pmt', 'fv'];
const FIN_LABEL = { n: 'n', i: 'i', pv: 'PV', pmt: 'PMT', fv: 'FV' };
const PRIMARY_OPS = ['plus', 'minus', 'times', 'divide', 'yx', 'recip', 'pctT', 'dpct', 'pct'];
const OPKEYS = ['plus', 'minus', 'times', 'divide'];
const ALG_OPS = ['plus', 'minus', 'times', 'divide', 'yx']; // operações de dois números do modo ALG
const STAT_G = { '0': 'mean', dot: 'sd', '6': 'wmean', '1': 'estx', '2': 'esty', sigma: 'sigmaminus' };
const G_OPS = { yx: 'sqrt', recip: 'expx', pctT: 'ln', dpct: 'frac', pct: 'intg', 3: 'fact' };
const isDigit = (id) => /^[0-9]$/.test(id);
const zeroFin = () => ({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0 });

export class Engine {
  constructor(opts = {}) {
    this.profile = opts.profile ?? DEFAULT_PROFILE; // perfil de calculadora (mapa de teclas, modos); ver profiles.js
    const def = getProfile(this.profile);
    this.mode = opts.mode && def.modes.includes(opts.mode) ? opts.mode : def.defaultMode; // 'rpn' | 'alg'
    this.alg = new AlgState(); // operações pendentes do modo ALG
    this.stack = new Stack();
    this.regs = new Registers();
    this.fin = zeroFin();
    this.cf = new CashFlows(); // CFo, CFj, Nj (V2)
    this.amortFresh = true; // nenhuma prestação amortizada desde a última mudança em n, i, PV, PMT ou FV
    this.begin = false;
    this.prgm = false; // modo de programação (indicador PRGM)
    this.prog = []; // linhas de programa (índice 0 = linha 01); null = linha vazia (GTO 00)
    this.pc = 0; // linha atual (0 = início)
    this.stoOp = null; // operador de STO aritmético em andamento
    this.gtoDigits = ''; // dígitos de GTO em andamento
    this.running = false;
    this.pauses = []; // resultados mostrados por PSE durante a última execução
    this.dmy = false; // indicador D.MY: datas no formato dia-mês-ano
    this.dateText = null; // resultado de g DATE exibido como "11,09,2004 6" até a próxima tecla
    this.compound = false; // indicador C: juros compostos no período fracionário (STO EEX)
    this.shift = null; // null | 'f' | 'g'
    this.pending = null; // null | 'sto' | 'rcl' (aguardando o registrador)
    this.justStored = false; // última operação guardou em n, i, PV, PMT ou FV?
    this.decimals = 2;
    this.locale = opts.locale ?? 'br';
    this.error = null;
    this.tape = [];
    this.tokens = []; // teclas desde a última linha da fita
  }

  get keyById() {
    return getProfile(this.profile).keyById;
  }

  // ---------- estado ----------
  get state() {
    const s = this.stack;
    return {
      display: this._display(),
      profile: this.profile,
      mode: this.mode,
      parens: this.alg.depth,
      stack: { x: s.x, y: s.y, z: s.z, t: s.t, lastX: s.lastX },
      regs: this.regs.values(),
      fin: { ...this.fin },
      begin: this.begin,
      compound: this.compound,
      dmy: this.dmy,
      prgm: this.prgm,
      pc: this.pc,
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
    const key = this.keyById.get(id);
    if (!key) throw new Error('tecla desconhecida: ' + id);
    if (id !== 'f' && id !== 'g') this.dateText = null;
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
      this.alg.clearPending(); // um erro cancela as operações pendentes do ALG
      this.shift = null;
      this.pending = null;
      this.tokens = [];
    }
  }

  // Limpar tudo: pilha, registradores, financeiros, fita; mantém o formato (pt-BR / en-US).
  reset() {
    const locale = this.locale;
    Object.assign(this, new Engine({ locale, profile: this.profile, mode: this.mode }));
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
    if (shift === 'f' && key.id === 'rs' && !this.pending) return this._togglePrgm(); // f P/R
    if (this.prgm) return this._prgmKey(key, shift);
    if (this.pending) return this._finishPending(key);
    if (key.id === 'on') return;
    const s = this.stack;
    const a = this.alg;
    a.wasFresh = a.fresh; // ALG: a tecla anterior foi um operador? e foi CLx?
    a.fresh = false;
    a.wasClx = a.clxPrev;
    a.clxPrev = false;
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
    if (this.mode === 'alg' && this._algPrimary(key)) return;
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
      case 'sigma':
        return this._stat('sigmaplus');
      case 'rs':
        return this._run();
      case 'sst':
        return this._singleStep();
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
      const v = round10(solve(id, this.fin, this.begin, this.compound));
      this.fin[id] = v;
      s.setResult(v);
    } else {
      s.commit();
      this.fin[id] = s.x;
      s.liftEnabled = true;
    }
    this.justStored = true;
    this.amortFresh = true;
    this._record(FIN_LABEL[id]);
  }

  _g(key, wasStored) {
    const id = key.id;
    const s = this.stack;
    if (id === 'n' || id === 'i') {
      s.applyUnary((x) => round10(id === 'n' ? x * 12 : x / 12));
      this.fin[id] = s.x;
      this.justStored = true;
      this.amortFresh = true;
      return this._record(id === 'n' ? '12×' : '12÷');
    }
    if (id === '7' || id === '8') {
      this.begin = id === '7';
      this.justStored = wasStored; // BEG/END não interrompem "acabou de guardar"
      return;
    }
    if (id === 'enter') {
      if (this.mode === 'alg') return this._algLastX(); // no ALG, LSTx troca X com LAST X
      s.recall(s.lastX);
      this.tokens.push('LSTx');
      return;
    }
    if (id === 'sto' || id === 'rcl') { // g ( e g ): só existem no ALG
      if (this.mode === 'alg') return id === 'sto' ? this._algOpen() : this._algClose();
      return;
    }
    if (id === '4' || id === '5') {
      this.dmy = id === '4'; // g D.MY / g M.DY
      this.justStored = wasStored;
      return;
    }
    if (id === 'sst') {
      this.pc = Math.max(0, this.pc - 1); // g BST
      this.dateText = lineText(this.pc, this.prog[this.pc - 1]);
      return;
    }
    if (id === 'rdown') {
      this.pending = 'gto';
      this.gtoDigits = '';
      return;
    }
    if (id === '9') {
      this.dateText = memoryText(this.prog.length); // g MEM
      return;
    }
    if (id === 'rs') {
      this.pauses.push(this._fmt(this.stack.x)); // g PSE fora de um programa: só mostra
      return;
    }
    if (id === 'pv' || id === 'pmt' || id === 'fv') return this._cashFlowKey(id);
    if (id === 'chs') return this._date();
    if (id === 'eex') return this._deltaDays();
    if (STAT_G[id]) return this._stat(STAT_G[id]);
    if (G_OPS[id]) {
      applyOp(s, G_OPS[id]);
      return this._record(key.g);
    }
    // demais funções g (V2 e fora do escopo): ignoradas
  }

  // g CFo, g CFj, g Nj: guardam o número exibido (X) na lista de fluxos de caixa.
  _cashFlowKey(id) {
    const s = this.stack;
    s.commit();
    if (id === 'pv') this.cf.setCf0(s.x);
    else if (id === 'pmt') this.cf.addFlow(s.x);
    else this.cf.setNj(s.x);
    s.liftEnabled = true;
    this._record({ pv: 'CFo', pmt: 'CFj', fv: 'Nj' }[id]);
  }

  _f(key) {
    const id = key.id;
    const s = this.stack;
    if (isDigit(id)) {
      this.decimals = Number(id);
      return;
    }
    switch (id) {
      case 'chs': // f RPN
      case 'eex': // f ALG
        return this._setMode(id === 'chs' ? 'rpn' : 'alg');
      case 'i': {
        s.commit();
        const r = simpleInterest(this.fin.n, this.fin.i, this.fin.pv);
        s.loadXYZ(round10(r.interest360), round10(-this.fin.pv), round10(r.interest365));
        return this._record('INT');
      }
      case 'n': { // AMORT: X = nº de prestações; devolve juros (X), principal (Y) e nº de prestações (Z)
        s.commit();
        const count = s.x;
        const r = amortize(this.fin, count, this.decimals, this.begin, this.amortFresh);
        this.fin.pv = r.balance;
        this.fin.n = round10(this.fin.n + count);
        this.amortFresh = false;
        s.lastX = count;
        s.loadXYZ(r.interest, r.principal, count);
        return this._record('AMORT');
      }
      case 'pmt': // RND — arredonda X às casas do visor (o valor interno passa a ser o exibido)
        s.applyUnary((x) => roundDec(x, this.decimals));
        return this._record('RND');
      case 'yx': { // PRICE — Y = liquidação, X = vencimento; devolve preço (X) e juros acumulados (Y)
        s.commit();
        const mat = s.x;
        const r = bondPrice(s.y, mat, this.fin.pmt, this.fin.i, this.dmy);
        s.lastX = mat;
        s.loadXYZ(r.price, r.accrued, s.z);
        return this._record('PRICE');
      }
      case 'recip': { // YTM — preço em PV; devolve a taxa anual em X
        s.commit();
        const mat = s.x;
        const y = bondYield(s.y, mat, this.fin.pmt, this.fin.pv, this.dmy);
        s.lastX = mat;
        s.loadXYZ(y, s.y, s.z);
        return this._record('YTM');
      }
      case 'pctT': // SL
      case 'dpct': // SOYD
      case 'pct': { // DB — X = ano; devolve depreciação (X) e valor depreciável restante (Y)
        s.commit();
        const year = s.x;
        const r = { pctT: sl, dpct: soyd, pct: db }[id](this.fin, year);
        s.lastX = year;
        s.loadXYZ(r.dep, r.remaining, s.z);
        return this._record({ pctT: 'SL', dpct: 'SOYD', pct: 'DB' }[id]);
      }
      case 'pv': // NPV
      case 'fv': { // IRR
        s.commit();
        const v = round10(id === 'pv' ? this.cf.npv(this.fin.i) : this.cf.irr());
        s.setResult(v);
        return this._record(id === 'pv' ? 'NPV' : 'IRR');
      }
      case 'xy': // CLEAR FIN
        s.commit();
        this.fin = zeroFin();
        this.amortFresh = true;
        return;
      case 'rdown': // CLEAR PRGM (no modo de execução só volta à linha 00)
        this.pc = 0;
        return;
      case 'sst': // CLEAR Σ: zera R1..R6, a pilha e o visor
        this.alg.clearPending();
        for (let n = 1; n <= 6; n++) this.regs.store(n, 0);
        s.clearAll();
        this.tokens = [];
        return;
      case 'clx': // CLEAR REG
        this.alg.clearPending();
        this.regs.clear();
        this.cf.clear();
        this.amortFresh = true;
        this.fin = zeroFin();
        s.clearAll();
        this.tokens = [];
        return;
      // 'enter' (PREFIX) só cancela o prefixo; demais funções f: ignoradas
    }
  }

  // ---------- modo ALG (HP 12C Platinum, Apêndice B) ----------
  _setMode(mode) {
    this.stack.commit();
    if (!getProfile(this.profile).modes.includes(mode)) return;
    this.mode = mode;
    this.alg.clearPending(); // trocar de modo cancela o que estava pendente
  }

  // Teclas que mudam de significado no ALG. Devolve true se tratou a tecla.
  _algPrimary(key) {
    const id = key.id;
    const s = this.stack;
    if (ALG_OPS.includes(id)) return this._algOp(key), true;
    if (id === 'enter') return this._algEquals(), true;
    if (id === 'pct') return this._algPercent(), true;
    if (id === 'pctT' || id === 'dpct') return this._algRelative(key), true;
    if (id === 'clx') return this._algClx(), true;
    // começar um número novo guarda o que estava no visor em LAST X (manual, p. 239)
    if ((isDigit(id) || id === 'dot' || id === 'eex') && !s.entering) s.lastX = s.x;
    return false;
  }

  // + − × ÷ yˣ: faz a conta pendente com o que está no visor e deixa o novo operador esperando o próximo número.
  _algOp(key) {
    const s = this.stack;
    const a = this.alg;
    const f = a.top;
    s.commit();
    if (a.wasFresh && f.op) { // dois operadores seguidos: vale o último
      f.op = key.id;
      a.fresh = true;
      this.tokens.push(key.label);
      return;
    }
    const v = f.op ? compute(f.op, f.acc, s.x) : s.x;
    s.x = v;
    s.entering = false;
    s.liftEnabled = false; // o próximo número substitui o visor, sem elevar a pilha
    f.acc = v;
    f.op = key.id;
    a.fresh = true;
    this._record(key.label);
  }

  // ENTER: com conta pendente age como "=" e fecha os parênteses; sem conta, é o ENTER da pilha (Y recebe X).
  _algEquals() {
    const s = this.stack;
    const a = this.alg;
    s.commit();
    if (!a.pending) {
      s.enter();
      this.tokens.push('ENTER');
      return;
    }
    let v = s.x;
    for (let i = a.frames.length - 1; i >= 0; i--) if (a.frames[i].op) v = compute(a.frames[i].op, a.frames[i].acc, v);
    a.clearPending();
    this._algComplete(v);
    this._record('=');
  }

  // Resultado concluído: entra em X e o anterior sobe na pilha de histórico (4 resultados, manual p. 239).
  _algComplete(v) {
    const s = this.stack;
    const a = this.alg;
    s.t = s.z;
    s.z = s.y;
    s.y = a.lastResult;
    s.x = v;
    a.lastResult = v;
    s.entering = false;
    s.liftEnabled = false; // o próximo número começa outra conta sem elevar a pilha
  }

  // %: com + ou − pendente calcula o percentual do primeiro número e já dá o valor líquido (200 − 25 % = 150);
  // com × ou ÷ usa o número dividido por 100; sem operação pendente só divide por 100.
  _algPercent() {
    const s = this.stack;
    const f = this.alg.top;
    s.commit();
    const b = s.x;
    let r;
    if (!f.op) r = divide100(b);
    else if (f.op === 'plus' || f.op === 'minus') r = compute(f.op, f.acc, percentOf(f.acc, b));
    else r = compute(f.op, f.acc, divide100(b));
    s.lastX = b;
    s.x = r;
    s.entering = false;
    s.liftEnabled = true;
    f.acc = null;
    f.op = null;
    this._record('%');
  }

  // Δ% e %T: o número antes do operador pendente vira Y e o operador é ignorado (35,5 − 31,25 Δ% = 35,5 ENTER 31,25 Δ%).
  _algRelative(key) {
    const s = this.stack;
    const f = this.alg.top;
    s.commit();
    if (f.op) {
      s.y = f.acc;
      f.acc = null;
      f.op = null;
    }
    applyOp(s, key.id);
    this._record(key.label);
  }

  // CLx apaga o número do visor; CLx duas vezes seguidas cancela também as operações pendentes.
  _algClx() {
    const a = this.alg;
    this.stack.clx();
    if (a.wasClx) a.clearPending();
    a.clxPrev = true;
    this.tokens.push('CLx');
  }

  // g LSTx no ALG: troca X com LAST X, nunca eleva a pilha.
  _algLastX() {
    const s = this.stack;
    s.commit();
    const x = s.x;
    s.x = s.lastX;
    s.lastX = x;
    s.entering = false;
    s.liftEnabled = true;
    this.tokens.push('LSTx');
  }

  // g (: abre um nível. g ): fecha o nível e calcula o que havia dentro. Até 13 abertos.
  _algOpen() {
    const a = this.alg;
    this.stack.commit();
    if (a.depth >= MAX_PARENS) throw new CalcError(4);
    a.frames.push({ acc: null, op: null });
    this.stack.liftEnabled = false;
    a.fresh = true;
    this.tokens.push('(');
  }

  _algClose() {
    const s = this.stack;
    const a = this.alg;
    s.commit();
    if (a.depth === 0) return; // sem parêntese aberto: a tecla não faz nada
    const f = a.top;
    const v = f.op ? compute(f.op, f.acc, s.x) : s.x;
    a.frames.pop();
    s.x = v;
    s.entering = false;
    s.liftEnabled = false;
    this.tokens.push(')');
  }

  // ---------- programação ----------
  _togglePrgm() {
    this.stack.commit();
    this.prgm = !this.prgm;
    this.pending = null;
    if (!this.prgm) this.pc = 0; // voltar ao modo de execução leva à linha 00
  }

  _gotoLine(nn) {
    if (nn > MAX_LINES) throw new CalcError(4);
    this.pc = nn;
  }

  _stoArith(opId, n) {
    const x = this.stack.x;
    const cur = this.regs.recall(n);
    const v = { plus: cur + x, minus: cur - x, times: cur * x, divide: cur / x }[opId];
    if (!Number.isFinite(v)) throw new CalcError(opId === 'divide' ? 0 : 1);
    this.regs.store(n, round10(v));
    this._record(`STO ${{ plus: '+', minus: '−', times: '×', divide: '÷' }[opId]} ${n}`);
  }

  // Grava uma instrução na linha seguinte à atual (sobrescreve a linha: a memória é de tamanho fixo, como na HP).
  _storeLine(line) {
    if (this.pc >= MAX_LINES) throw new CalcError(4);
    while (this.prog.length < this.pc) this.prog.push(null);
    this.prog[this.pc] = line;
    this.pc += 1;
  }

  // Tecla pressionada no modo de programação: é gravada em vez de executada.
  _prgmKey(key, shift) {
    const id = key.id;
    const isD = isDigit(id);
    if (this.pending) {
      const mode = this.pending;
      this.pending = null;
      if (mode === 'sto' && OPKEYS.includes(id)) {
        this.pending = 'stoop';
        this.stoOp = id;
      } else if (mode === 'stoop' && isD) this._storeLine({ s: null, id: 'sto', op: this.stoOp, arg: id });
      else if (mode === 'sto' && (isD || id === 'eex')) this._storeLine({ s: null, id: 'sto', arg: id });
      else if (mode === 'rcl' && (isD || FIN.includes(id))) this._storeLine({ s: null, id: 'rcl', arg: id });
      else if (mode === 'gto' && id === 'dot' && this.gtoDigits === '') {
        this.pending = 'gotoline'; // GTO . nn: só vai até a linha, sem gravar
      } else if (mode === 'gotoline' && isD) {
        this.gtoDigits += id;
        if (this.gtoDigits.length < 2) this.pending = 'gotoline';
        else this._gotoLine(Number(this.gtoDigits));
      } else if (mode === 'gto' && isD) {
        this.gtoDigits += id;
        if (this.gtoDigits.length < 2) this.pending = 'gto';
        else this._storeLine({ s: 'g', id: 'rdown', arg: this.gtoDigits });
      }
      this.dateText = null;
      return;
    }
    if (id === 'on') return;
    if (shift === 'f' && id === 'rdown') {
      this.prog = []; // CLEAR PRGM
      this.pc = 0;
      return;
    }
    if (shift === null && id === 'sst') {
      this.pc = Math.min(MAX_LINES, this.pc + 1);
      return;
    }
    if (shift === 'g' && id === 'sst') {
      this.pc = Math.max(0, this.pc - 1);
      return;
    }
    if (shift === 'g' && id === 'rdown') {
      this.pending = 'gto';
      this.gtoDigits = '';
      return;
    }
    if (shift === null && (id === 'sto' || id === 'rcl')) {
      this.pending = id;
      return;
    }
    this._storeLine({ s: shift, id });
  }

  // Executa uma linha como se as teclas fossem apertadas. Devolve 'halt', 'skip' ou { goto }.
  _execLine(line) {
    const { s, id } = line;
    if (id === 'rs' && s === null) return 'halt';
    if (id === 'rs' && s === 'g') {
      this.pauses.push(this._fmt(this.stack.x)); // PSE
      return null;
    }
    if (s === 'g' && id === 'rdown') {
      const nn = Number(line.arg);
      if (nn > MAX_LINES) throw new CalcError(4);
      return { goto: nn };
    }
    if (s === 'g' && id === 'xy') {
      this.stack.commit();
      return this.stack.x <= this.stack.y ? null : 'skip'; // x≤y
    }
    if (s === 'g' && id === 'clx') {
      this.stack.commit();
      return this.stack.x === 0 ? null : 'skip'; // x=0
    }
    if (id === 'sto' || id === 'rcl') {
      this.stack.commit();
      this.pending = id;
      this.shift = null;
      if (line.op) {
        this._finishPending(this.keyById.get(line.op));
        this._finishPending(this.keyById.get(line.arg));
      } else this._finishPending(this.keyById.get(line.arg));
      return null;
    }
    if (id === 'sst' || id === 'on' || id === 'f' || id === 'g') return null;
    this.shift = s;
    this._dispatch(this.keyById.get(id));
    return null;
  }

  // Passo de execução: avança uma linha, trata desvios e testes.
  _step() {
    this.pc += 1;
    const line = this.pc <= this.prog.length ? this.prog[this.pc - 1] : null;
    if (!line || this.pc > MAX_LINES) {
      this.pc = 0; // linha vazia = GTO 00: volta ao início e para
      return 'halt';
    }
    const r = this._execLine(line);
    if (r === 'skip') {
      this.pc += 1;
      return null;
    }
    if (r && r.goto !== undefined) {
      if (r.goto === 0) {
        this.pc = 0;
        return 'halt';
      }
      this.pc = r.goto - 1; // a execução continua NA linha pedida
      return null;
    }
    return r;
  }

  // R/S: executa a partir da linha seguinte à atual até um R/S, o fim do programa ou um erro.
  _run(maxSteps = 100000) {
    const s = this.stack;
    s.commit();
    this.running = true;
    this.pauses = [];
    try {
      for (let n = 0; n < maxSteps; n++) if (this._step() === 'halt') break;
    } finally {
      this.running = false;
      this.tokens = [];
    }
    this.dateText = null;
    this._record('R/S');
  }

  // SST no modo de execução: executa só a próxima linha.
  _singleStep() {
    this.stack.commit();
    this.running = true;
    this.pauses = [];
    try {
      this._step();
    } finally {
      this.running = false;
      this.tokens = [];
    }
  }

  takePauses() {
    const p = this.pauses;
    this.pauses = [];
    return p;
  }

  // g DATE: data (Y) + número de dias (X) → data em X, com o dia da semana (1 = segunda … 7 = domingo)
  _date() {
    const s = this.stack;
    s.commit();
    const r = addDays(s.y, s.x, this.dmy);
    s.applyBinary(() => r.value);
    this.dateText = formatDate(r.parts, r.weekday, this.dmy, this.locale);
    this._record('DATE');
    this.tape[this.tape.length - 1].text = this.dateText;
  }

  // g ΔDYS: datas em Y (mais antiga) e X → dias exatos em X e dias na base 30/360 em Y
  _deltaDays() {
    const s = this.stack;
    s.commit();
    const r = daysBetween(s.y, s.x, this.dmy);
    const { x, z } = s;
    s.loadXYZ(r.actual, r.commercial, z);
    s.lastX = x;
    this._record('ΔDYS');
  }

  // Σ+, Σ−, x̄, s, x̄w, ŷ,r, x̂,r — registros estatísticos R1..R6
  _stat(op) {
    const s = this.stack;
    s.commit();
    const r = [1, 2, 3, 4, 5, 6].map((n) => this.regs.recall(n));
    const save = (v) => v.forEach((x, k) => this.regs.store(k + 1, x));
    const push2 = (top, below) => {
      s.liftEnabled = true;
      s.recall(round10(below));
      s.liftEnabled = true;
      s.recall(round10(top));
    };
    switch (op) {
      case 'sigmaplus':
      case 'sigmaminus': {
        const x = s.x;
        save(accumulate(r, x, s.y, op === 'sigmaplus' ? 1 : -1));
        s.lastX = x;
        s.x = this.regs.recall(1);
        s.entering = false;
        s.liftEnabled = false;
        return this._record(op === 'sigmaplus' ? 'Σ+' : 'Σ−');
      }
      case 'mean': {
        const m = means(r);
        push2(m.x, m.y);
        return this._record('x̄');
      }
      case 'sd': {
        const d = deviations(r);
        push2(d.x, d.y);
        return this._record('s');
      }
      case 'wmean': {
        s.recall(round10(weightedMean(r)));
        return this._record('x̄w');
      }
      case 'esty':
      case 'estx': {
        const input = s.x;
        const e = op === 'esty' ? estimateY(r, input) : estimateX(r, input);
        const { y: oy } = s;
        s.lastX = input;
        s.loadXYZ(round10(e.value), round10(e.r), oy);
        return this._record(op === 'esty' ? 'ŷ' : 'x̂');
      }
    }
  }

  _finishPending(key) {
    const mode = this.pending;
    this.pending = null;
    const s = this.stack;
    const id = key.id;
    if (mode === 'stoop' && isDigit(id)) {
      this._stoArith(this.stoOp, Number(id));
    } else if (mode === 'gto' && isDigit(id)) {
      this.gtoDigits += id;
      if (this.gtoDigits.length < 2) this.pending = 'gto';
      else this._gotoLine(Number(this.gtoDigits));
    } else if (isDigit(id)) {
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
    } else if (mode === 'sto' && OPKEYS.includes(id)) {
      this.pending = 'stoop'; // STO + − × ÷ n
      this.stoOp = id;
    } else if (mode === 'sto' && id === 'eex') {
      this.compound = !this.compound; // STO EEX liga/desliga o indicador C
      this._record(this.compound ? 'STO EEX (C ligado)' : 'STO EEX (C desligado)');
    } else if (mode === 'rcl' && FIN.includes(id)) {
      s.recall(this.fin[id]);
      this._record(`RCL ${FIN_LABEL[id]}`);
    }
    // qualquer outra tecla cancela STO/RCL
  }

  _record(label) {
    if (this.running) return;
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
    if (this.prgm) return this.dateText ?? lineText(this.pc, this.prog[this.pc - 1]);
    if (this.dateText && !this.stack.entering) return this.dateText;
    return this.stack.entering ? this._fmtEntry() : this._fmt(this.stack.x);
  }

  // ---------- serialização ----------
  serialize() {
    return JSON.stringify({
      v: VERSION,
      profile: this.profile,
      mode: this.mode,
      alg: this.alg.toJSON(),
      stack: this.stack.toJSON(),
      regs: this.regs.values(),
      fin: this.fin,
      cf: this.cf.toJSON(),
      amortFresh: this.amortFresh,
      begin: this.begin,
      compound: this.compound,
      dmy: this.dmy,
      prgm: this.prgm,
      prog: this.prog,
      pc: this.pc,
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
    if (![null, 'f', 'g'].includes(o.shift) || ![null, 'sto', 'rcl', 'stoop', 'gto', 'gotoline'].includes(o.pending)) throw bad();
    if (!Number.isInteger(o.decimals) || o.decimals < 0 || o.decimals > 9) throw bad();
    if (o.locale !== 'br' && o.locale !== 'us') throw bad();
    if (o.error !== null && !(o.error && Number.isInteger(o.error.code) && o.error.code >= 0 && o.error.code <= 9 && str(o.error.message))) throw bad();
    if (!Array.isArray(o.tape) || !o.tape.every((l) => l && str(l.keys) && str(l.label) && num(l.value) && str(l.text))) throw bad();
    if (!Array.isArray(o.tokens) || !o.tokens.every(str)) throw bad();
    if (o.prog !== undefined && !(Array.isArray(o.prog) && o.prog.length <= MAX_LINES && o.prog.every(validLine))) throw bad();
    if (o.cf !== undefined && !CashFlows.valid(o.cf)) throw bad();
    const profile = o.profile ?? DEFAULT_PROFILE; // estados antigos não tinham perfil: eram da 12C
    if (typeof profile !== 'string' || !hasProfile(profile)) throw bad();
    if (o.mode !== undefined && !['rpn', 'alg'].includes(o.mode)) throw bad(); // modo sem suporte no perfil (ex.: ALG na clássica) volta ao padrão
    if (o.alg !== undefined && !AlgState.valid(o.alg)) throw bad();
    const e = new Engine({ locale: o.locale, profile, mode: o.mode });
    if (o.alg) e.alg = AlgState.fromJSON(o.alg);
    try {
      e.stack = Stack.fromJSON(o.stack);
    } catch {
      throw bad();
    }
    o.regs.forEach((v, n) => e.regs.store(n, v));
    if (o.cf) e.cf = CashFlows.fromJSON(o.cf);
    e.amortFresh = o.amortFresh !== false;
    e.fin = { n: o.fin.n, i: o.fin.i, pv: o.fin.pv, pmt: o.fin.pmt, fv: o.fin.fv };
    Object.assign(e, {
      begin: o.begin, compound: o.compound === true, dmy: o.dmy === true, prgm: o.prgm === true, prog: Array.isArray(o.prog) ? o.prog : [], pc: Number.isInteger(o.pc) && o.pc >= 0 && o.pc <= MAX_LINES ? o.pc : 0, shift: o.shift, pending: o.pending, justStored: o.justStored, decimals: o.decimals,
      error: o.error ? { code: o.error.code, message: o.error.message } : null,
      tape: o.tape.map((l) => ({ keys: l.keys, label: l.label, value: l.value, text: l.text })),
      tokens: [...o.tokens],
    });
    return e;
  }
}
