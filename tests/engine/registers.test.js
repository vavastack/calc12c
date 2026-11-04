import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registers } from '../../src/engine/registers.js';
import { CalcError } from '../../src/engine/errors.js';

test('store e recall guardam e devolvem o valor', () => {
  const r = new Registers();
  r.store(3, 42);
  assert.equal(r.recall(3), 42);
});

test('recall(0) é 0 no início', () => {
  assert.equal(new Registers().recall(0), 0);
});

test('índice fora de 0 a 9 lança Erro 6 (registrador inexistente)', () => {
  const r = new Registers();
  for (const n of [-1, 10, 1.5, NaN]) {
    assert.throws(() => r.store(n, 1), (e) => e instanceof CalcError && e.code === 6);
    assert.throws(() => r.recall(n), (e) => e instanceof CalcError && e.code === 6);
  }
});

test('clear zera tudo', () => {
  const r = new Registers();
  r.store(0, 1);
  r.store(9, 2);
  r.clear();
  assert.deepEqual(r.values(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('values devolve uma cópia de R0 a R9', () => {
  const r = new Registers();
  r.store(2, 7);
  const v = r.values();
  assert.equal(v.length, 10);
  assert.equal(v[2], 7);
  v[2] = 99;
  assert.equal(r.recall(2), 7);
});
