import { test } from 'node:test';
import assert from 'node:assert/strict';
import { round10, formatNumber } from '../../src/engine/number.js';
import { CalcError, ERRORS } from '../../src/engine/errors.js';

test('round10 mantém 10 dígitos significativos', () => {
  assert.equal(round10(1 / 3), 0.3333333333);
});

test('formatNumber pt-BR usa ponto de milhar e vírgula decimal', () => {
  assert.equal(formatNumber(12580, 2, 'br'), '12.580,00');
});

test('formatNumber en-US usa vírgula de milhar e ponto decimal', () => {
  assert.equal(formatNumber(12580, 2, 'us'), '12,580.00');
});

test('formatNumber mantém o sinal em valores negativos', () => {
  assert.equal(formatNumber(-0.5, 2, 'br'), '-0,50');
});

test('ERRORS cobre os códigos 0 a 9 com frase em português', () => {
  for (let c = 0; c <= 9; c++) {
    assert.equal(typeof ERRORS[c], 'string');
    assert.ok(ERRORS[c].length > 3);
  }
});

test('CalcError guarda o código e usa a frase do código', () => {
  const e = new CalcError(5);
  assert.ok(e instanceof Error);
  assert.equal(e.code, 5);
  assert.equal(e.message, ERRORS[5]);
});
