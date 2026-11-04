import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Stack } from '../../src/engine/stack.js';

// Helper local: 'a b c' -> executa as teclas na pilha.
const OPS = {
  '+': (y, x) => y + x,
  '-': (y, x) => y - x,
  '*': (y, x) => y * x,
  '/': (y, x) => y / x,
};
function keys(s, seq) {
  for (const k of seq.split(/\s+/).filter(Boolean)) {
    if (/^[0-9]$/.test(k)) s.digit(k);
    else if (k === '.') s.dot();
    else if (k === 'enter') s.enter();
    else if (k === 'chs') s.chs();
    else if (k === 'eex') s.eex();
    else if (k === 'swap') s.swap();
    else if (k === 'rdown') s.rollDown();
    else if (k === 'clx') s.clx();
    else if (OPS[k]) s.applyBinary(OPS[k]);
    else throw new Error('tecla desconhecida: ' + k);
  }
  return s;
}

test('3 enter 4 + dá 7', () => {
  const s = keys(new Stack(), '3 enter 4 +');
  assert.equal(s.x, 7);
});

test('2 enter 3 + 4 × dá 20 (cálculo encadeado)', () => {
  const s = keys(new Stack(), '2 enter 3 + 4 *');
  assert.equal(s.x, 20);
});

test('x≷y troca X e Y', () => {
  const s = keys(new Stack(), '1 enter 2 swap');
  assert.equal(s.x, 1);
  assert.equal(s.y, 2);
});

test('R↓ gira T→Z→Y→X e o antigo X vai para T', () => {
  const s = keys(new Stack(), '1 enter 2 enter 3 enter 4 rdown');
  assert.deepEqual([s.x, s.y, s.z, s.t], [3, 2, 1, 4]);
});

test('lastX guarda o X anterior à operação', () => {
  const s = keys(new Stack(), '3 enter 4 +');
  assert.equal(s.lastX, 4);
});

test('Foco 1: zeros à esquerda são descartados (0 0 5 → 5)', () => {
  const s = keys(new Stack(), '0 0 5');
  assert.equal(s.entryText(), '5');
});

test('Foco 1: segundo ponto decimal é ignorado (1.2.3 → 1.23)', () => {
  const s = keys(new Stack(), '1 . 2 . 3');
  assert.equal(s.entryText(), '1.23');
});

test('Foco 1: ponto sem dígito antes vira 0.', () => {
  const s = keys(new Stack(), '. 5');
  assert.equal(s.entryText(), '0.5');
});

test('Foco 1: 11 dígitos — só os 10 primeiros contam', () => {
  const s = keys(new Stack(), '1 2 3 4 5 6 7 8 9 0 1');
  assert.equal(s.entryText(), '1234567890');
});

test('Foco 2: depois de ENTER o próximo dígito substitui X e Y mantém o valor', () => {
  const s = keys(new Stack(), '5 enter 9');
  assert.equal(s.x, 9);
  assert.equal(s.y, 5);
  assert.equal(s.z, 0);
});

test('Foco 2: depois de um resultado o próximo dígito eleva a pilha', () => {
  const s = keys(new Stack(), '3 enter 4 + 9');
  assert.equal(s.x, 9);
  assert.equal(s.y, 7);
});

test('CLx zera X e o próximo dígito não eleva a pilha', () => {
  const s = keys(new Stack(), '1 enter 2 clx 7');
  assert.equal(s.x, 7);
  assert.equal(s.y, 1);
  assert.equal(s.z, 0);
});

test('CHS na digitação inverte o sinal sem encerrar a digitação', () => {
  const s = keys(new Stack(), '5 chs');
  assert.equal(s.entering, true);
  assert.equal(s.entryText(), '-5');
  keys(s, '3');
  assert.equal(s.entryText(), '-53');
});

test('CHS sobre um resultado inverte X', () => {
  const s = keys(new Stack(), '3 enter 4 + chs');
  assert.equal(s.x, -7);
});

test('EEX aceita expoente: 1 EEX 3 → 1000', () => {
  const s = keys(new Stack(), '1 eex 3 enter');
  assert.equal(s.x, 1000);
});

test('EEX sem mantissa começa em 1 (EEX 2 → 100)', () => {
  const s = keys(new Stack(), 'eex 2 enter');
  assert.equal(s.x, 100);
});

test('CHS depois de EEX inverte o expoente (1 EEX CHS 2 → 0,01)', () => {
  const s = keys(new Stack(), '1 eex chs 2 enter');
  assert.equal(s.x, 0.01);
});

test('digitar decimal e usar: 1.5 enter 2 × → 3', () => {
  const s = keys(new Stack(), '1 . 5 enter 2 *');
  assert.equal(s.x, 3);
});

test('setResult coloca o valor em X e reativa a elevação', () => {
  const s = keys(new Stack(), '5 enter');
  s.setResult(42);
  assert.equal(s.x, 42);
  keys(s, '1');
  assert.equal(s.y, 42);
});

test('applyUnary guarda lastX e reativa a elevação', () => {
  const s = keys(new Stack(), '4');
  s.applyUnary((x) => x * 2);
  assert.equal(s.x, 8);
  assert.equal(s.lastX, 4);
});
