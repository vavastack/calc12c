import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { Stack } from '../../src/engine/stack.js';
import { applyOp } from '../../src/engine/math.js';
import { CalcError } from '../../src/engine/errors.js';

// Helper local: números viram dígitos; 'enter' e nomes de operação executam.
function keys(s, seq) {
  for (const k of seq.split(/\s+/).filter(Boolean)) {
    if (/^-?[0-9.]+$/.test(k)) {
      const neg = k.startsWith('-');
      for (const c of neg ? k.slice(1) : k) (c === '.' ? s.dot() : s.digit(c));
      if (neg) s.chs();
    } else if (k === 'enter') s.enter();
    else applyOp(s, k);
  }
  return s;
}

test('200 enter 15 % → X=30 e Y continua 200', () => {
  const s = keys(new Stack(), '200 enter 15 pct');
  assert.equal(s.x, 30);
  assert.equal(s.y, 200);
});

test('80 enter 100 Δ% → 25', () => {
  assert.equal(keys(new Stack(), '80 enter 100 dpct').x, 25);
});

test('200 enter 50 %T → 25', () => {
  assert.equal(keys(new Stack(), '200 enter 50 pctT').x, 25);
});

test('Δ% e %T mantêm Y', () => {
  assert.equal(keys(new Stack(), '80 enter 100 dpct').y, 80);
  assert.equal(keys(new Stack(), '200 enter 50 pctT').y, 200);
});

test('2 enter 10 yx → 1024', () => {
  assert.equal(keys(new Stack(), '2 enter 10 yx').x, 1024);
});

test('4 √x → 2', () => {
  assert.equal(keys(new Stack(), '4 sqrt').x, 2);
});

test('0 eˣ → 1 e 1 LN → 0', () => {
  assert.equal(keys(new Stack(), '0 expx').x, 1);
  assert.equal(keys(new Stack(), '1 ln').x, 0);
});

test('4 1/x → 0,25', () => {
  assert.equal(keys(new Stack(), '4 recip').x, 0.25);
});

test('3,75 FRAC → 0,75 e 3,75 INTG → 3', () => {
  assert.equal(keys(new Stack(), '3.75 frac').x, 0.75);
  assert.equal(keys(new Stack(), '3.75 intg').x, 3);
});

test('aritmética básica: + − × ÷', () => {
  assert.equal(keys(new Stack(), '7 enter 3 plus').x, 10);
  assert.equal(keys(new Stack(), '7 enter 3 minus').x, 4);
  assert.equal(keys(new Stack(), '7 enter 3 times').x, 21);
  assert.equal(keys(new Stack(), '9 enter 3 divide').x, 3);
});

test('resultado é arredondado para 10 dígitos (1 ÷ 3)', () => {
  assert.equal(keys(new Stack(), '1 enter 3 divide').x, 0.3333333333);
});

test('manual p.27: 13250 − 8% = 12190; 6% = 731,40; total 12921,40', () => {
  const s = keys(new Stack(), '13250 enter 8 pct');
  assert.equal(s.x, 1060);
  keys(s, 'minus');
  assert.equal(s.x, 12190);
  keys(s, '6 pct');
  assert.equal(s.x, 731.4);
  keys(s, 'plus');
  assert.equal(s.x, 12921.4);
});

for (const [seq, nome] of [
  ['1 enter 0 divide', '1 ÷ 0'],
  ['-1 sqrt', '√(−1)'],
  ['0 ln', 'LN 0'],
  ['-2 ln', 'LN de negativo'],
  ['0 recip', '1/0'],
  ['0 enter 0 yx', '0^0'],
  ['-8 enter 0.5 yx', 'negativo^fração'],
  ['0 enter 5 dpct', 'Δ% com base 0'],
  ['0 enter 5 pctT', '%T com base 0'],
  ['10 enter 400 yx', 'resultado fora do alcance (sem Infinity)'],
]) {
  test(`erro 0: ${nome}`, () => {
    const s = new Stack();
    assert.throws(
      () => keys(s, seq),
      (e) => e instanceof CalcError && e.code === 0,
    );
  });
}

test('erro não altera a pilha', () => {
  const s = keys(new Stack(), '5 enter 0');
  assert.throws(() => applyOp(s, 'divide'), CalcError);
  assert.equal(s.x, 0);
  assert.equal(s.y, 5);
});

test('operação desconhecida lança erro de programação', () => {
  assert.throws(() => applyOp(new Stack(), 'xyz'), /desconhecida/);
});

test('g 3 (n!): 5! = 120, 0! = 1, 69! cabe, e não inteiro/negativo/70 dá Erro 0', () => {
  const seq = (s) => { const e = new Engine(); for (const t of s.split(' ')) { if (/^\d+(\.\d+)?$/.test(t)) for (const c of t) e.press(c === '.' ? 'dot' : c); else e.press(t); } return e.state.display; };
  assert.equal(seq('5 g 3'), '120,00');
  assert.equal(seq('0 g 3'), '1,00');
  assert.match(seq('69 g 3'), /e|\d{3}/i);
  for (const bad of ['3.5 g 3', '70 g 3']) assert.match(seq(bad), /Error 0/);
  assert.match(seq('3 chs g 3'), /Error 0/);
});
