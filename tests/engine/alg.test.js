import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';

// Teclas do ALG da 12C Platinum (Apêndice B do manual): ENTER = "=", g STO = "(", g RCL = ")",
// f CHS = RPN, f EEX = ALG. Operações em cadeia da esquerda para a direita, sem hierarquia.
function run(e, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    if (/^-?\d+(\.\d+)?$/.test(tok)) {
      const neg = tok.startsWith('-');
      for (const c of neg ? tok.slice(1) : tok) e.press(c === '.' ? 'dot' : c);
      if (neg) e.press('chs');
    } else e.press(tok);
  }
  return e;
}
const alg = (seq = '') => run(run(new Engine({ locale: 'br' }), 'f eex'), seq);
const shown = (e) => e.state.display;

// ---------- modo ----------
test('o modo padrão é RPN; f EEX liga o ALG e f CHS volta ao RPN', () => {
  const e = new Engine({ locale: 'br' });
  assert.equal(e.state.mode, 'rpn');
  run(e, 'f eex');
  assert.equal(e.state.mode, 'alg');
  run(e, 'f chs');
  assert.equal(e.state.mode, 'rpn');
});

test('em RPN nada muda: 2 ENTER 3 + continua dando 5 e g STO / g RCL não fazem nada', () => {
  const e = run(new Engine({ locale: 'br' }), '2 enter 3 plus');
  assert.equal(shown(e), '5,00');
  run(e, 'g sto g rcl');
  assert.equal(shown(e), '5,00');
  assert.equal(e.state.parens, 0);
});

test('trocar de modo cancela as operações pendentes', () => {
  const e = alg('5 plus f eex 3 enter');
  assert.equal(shown(e), '3,00');
});

test('o modo é gravado e restaurado com a calculadora', () => {
  const e = alg('5 plus g sto 2 times');
  const b = Engine.restore(e.serialize());
  assert.equal(b.state.mode, 'alg');
  assert.equal(b.state.parens, 1);
  run(b, '3 g rcl enter');
  assert.equal(shown(b), '11,00'); // 5 + (2 × 3)
});

test('estado salvo antes do ALG (sem mode) abre em RPN', () => {
  const o = JSON.parse(new Engine().serialize());
  delete o.mode;
  delete o.alg;
  assert.equal(Engine.restore(JSON.stringify(o)).state.mode, 'rpn');
});

// ---------- aritmética (manual, pp. 22-26 e 237-239) ----------
test('21,1 + 23,8 ENTER = 44,90', () => {
  const e = alg('21.1 plus 23.8');
  assert.equal(shown(e), '23,8');
  run(e, 'enter');
  assert.equal(shown(e), '44,90');
});

test('número negativo: 75 CHS × 7,1 = −532,50', () => {
  assert.equal(shown(alg('75 chs times 7.1 enter')), '-532,50');
});

test('cadeia 456 − 75 ÷ 18,5 × 68 ÷ 1,9: visor após cada tecla e resultado do manual', () => {
  const e = alg('456 minus 75');
  run(e, 'divide');
  assert.equal(shown(e), '381,00');
  run(e, '18.5 times');
  assert.equal(shown(e), '20,59');
  run(e, '68 divide');
  assert.equal(shown(e), '1.400,43');
  run(e, '1.9 enter');
  assert.equal(shown(e), '737,07');
});

test('sem hierarquia de operações: 1 + 2 × 3 = 9 (como a Platinum)', () => {
  assert.equal(shown(alg('1 plus 2 times 3 enter')), '9,00');
});

test('trocar o operador antes do próximo número: 5 + × 3 = 15', () => {
  assert.equal(shown(alg('5 plus times 3 enter')), '15,00');
});

test('depois do ENTER, um operador continua com o resultado e um número começa outra conta', () => {
  const e = alg('2 plus 3 enter times 4 enter');
  assert.equal(shown(e), '20,00');
  run(e, '7 plus 1 enter');
  assert.equal(shown(e), '8,00');
});

test('yˣ é operação de dois argumentos: 2 yˣ 10 = 1.024', () => {
  assert.equal(shown(alg('2 yx 10 enter')), '1.024,00');
});

test('funções de um número usam o visor: 9 √x, 4 1/x', () => {
  assert.equal(shown(alg('9 g yx')), '3,00');
  assert.equal(shown(alg('4 recip')), '0,25');
  assert.equal(shown(alg('100 plus 4 g yx enter')), '102,00'); // 100 + √4
});

test('divisão por zero dá Error 0 e limpa as operações pendentes', () => {
  const e = alg('5 divide 0 enter');
  assert.equal(shown(e), 'Error 0');
  run(e, 'clx');
  assert.equal(e.state.error, null);
  run(e, '2 enter');
  assert.equal(shown(e), '2,00');
});

// ---------- parênteses ----------
test('8 ÷ 5 − 1 = 0,60 (cadeia) e 8 ÷ (5 − 1) = 2,00', () => {
  assert.equal(shown(alg('8 divide 5 minus 1 enter')), '0,60');
  assert.equal(shown(alg('8 divide g sto 5 minus 1 g rcl enter')), '2,00');
});

test('parênteses aninhados e indicador de parênteses abertos', () => {
  const e = alg('2 times g sto 3 plus g sto 4 minus 1');
  assert.equal(e.state.parens, 2);
  run(e, 'g rcl');
  assert.equal(e.state.parens, 1);
  assert.equal(shown(e), '3,00');
  run(e, 'g rcl');
  assert.equal(e.state.parens, 0);
  assert.equal(shown(e), '6,00');
  run(e, 'enter');
  assert.equal(shown(e), '12,00');
});

test('ENTER fecha os parênteses que sobraram', () => {
  const e = alg('10 minus g sto 2 times 3 enter');
  assert.equal(shown(e), '4,00');
  assert.equal(e.state.parens, 0);
});

test('") " sem parêntese aberto é ignorado', () => {
  const e = alg('5 plus 3 g rcl enter');
  assert.equal(shown(e), '8,00');
});

test('no máximo 13 parênteses abertos: o 14º dá erro', () => {
  const e = alg();
  for (let k = 0; k < 13; k++) run(e, 'g sto');
  assert.equal(e.state.parens, 13);
  run(e, 'g sto');
  assert.equal(e.state.error?.code, 4);
});

// ---------- porcentagem e relações (manual, pp. 32-33 e 241) ----------
test('25% de 200: 200 × 25 % = 50,00', () => {
  assert.equal(shown(alg('200 times 25 pct')), '50,00');
});

test('200 reduzido em 25%: 200 − 25 % = 150,00 (valor líquido em um só cálculo)', () => {
  assert.equal(shown(alg('200 minus 25 pct')), '150,00');
});

test('juros simples: 1.250 × 7 % = 87,50 e + 1.250 = 1.337,50', () => {
  const e = alg('1250 times 7 pct');
  assert.equal(shown(e), '87,50');
  run(e, 'plus 1250 enter');
  assert.equal(shown(e), '1.337,50');
});

test('% sozinho divide por 100 e 200 ÷ 25 % = 800', () => {
  assert.equal(shown(alg('50 pct')), '0,50');
  assert.equal(shown(alg('200 divide 25 pct')), '800,00');
});

test('Δ%: 35,5 ENTER 31,25 Δ% = −11,97 (o "−" antes do Δ% é ignorado)', () => {
  assert.equal(shown(alg('35.5 enter 31.25 dpct')), '-11,97');
  assert.equal(shown(alg('35.5 minus 31.25 dpct')), '-11,97');
});

test('%T: 40 ENTER 10 %T = 25,00', () => {
  assert.equal(shown(alg('40 enter 10 pctT')), '25,00');
});

// ---------- teclas financeiras nos dois modos ----------
test('financeiras iguais ao RPN: 12 n, 1 i, −1.000 PV, PMT = 88,85', () => {
  const e = alg('12 n 1 i 1000 chs pv pmt');
  assert.equal(shown(e), '88,85');
  const r = run(new Engine({ locale: 'br' }), '12 n 1 i 1000 chs pv pmt');
  assert.equal(e.state.stack.x, r.state.stack.x);
});

test('mistura: PMT × 12 = 1.066,19', () => {
  assert.equal(shown(alg('12 n 1 i 1000 chs pv pmt times 12 enter')), '1.066,19');
});

test('datas: 31.052003 ENTER 120 g DATE soma dias no ALG também', () => {
  const e = alg('g 4 31.052003 enter 120 g chs');
  assert.match(shown(e), /^28,09,2003/);
});

test('STO e RCL funcionam no meio da conta: 7 STO 1 × RCL 1 = 49', () => {
  assert.equal(shown(alg('7 sto 1 times rcl 1 enter')), '49,00');
});

// ---------- CLx, LSTx, histórico ----------
test('CLx apaga só o número; CLx duas vezes cancela as operações pendentes', () => {
  assert.equal(shown(alg('5 plus 7 clx 3 enter')), '8,00');
  assert.equal(shown(alg('5 plus 7 clx clx 3 enter')), '3,00');
});

test('g LSTx no ALG troca X com LAST X e nunca eleva a pilha', () => {
  const e = alg('5 plus 3 enter');
  assert.equal(shown(e), '8,00');
  const y = e.state.stack.y;
  run(e, 'g enter');
  assert.equal(shown(e), '5,00');
  assert.equal(e.state.stack.y, y);
  run(e, 'g enter');
  assert.equal(shown(e), '8,00');
});

test('histórico: os resultados concluídos sobem pela pilha (x≷y traz o anterior)', () => {
  const e = alg('2 plus 3 enter 4 times 5 enter');
  assert.equal(shown(e), '20,00');
  assert.equal(e.state.stack.y, 5);
  run(e, 'xy');
  assert.equal(shown(e), '5,00');
});

// ---------- fita e programas ----------
test('a fita registra cada operador e o ENTER como "="', () => {
  const e = alg('2 plus 3 enter');
  const t = e.state.tape;
  assert.equal(t[t.length - 1].label, '=');
  assert.equal(t[t.length - 1].text, '5,00');
});

test('programa gravado e rodado em ALG: 25 ENTER 3 ÷ dá 3 (RPN dá 8,33), como no fórum do HP Museum', () => {
  const prog = 'f rs f rdown 25 enter 3 divide f rs';
  const r = run(new Engine({ locale: 'br' }), prog + ' rs');
  assert.equal(shown(r), '8,33');
  const a = run(new Engine({ locale: 'br' }), 'f eex ' + prog + ' rs');
  assert.equal(shown(a), '3,00');
});
