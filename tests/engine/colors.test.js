import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validHex, mix, lighten, darken, luminance, inkOn, customVars } from '../../src/ui/colors.js';

test('validHex aceita só #rrggbb', () => {
  for (const ok of ['#000000', '#FFaa00', '#12abEF']) assert.equal(validHex(ok), true, ok);
  for (const bad of ['000000', '#fff', '#12345', '#gggggg', '', null, 12, 'red']) assert.equal(validHex(bad), false, String(bad));
});

test('mix, lighten e darken', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(lighten('#336699', 0), '#336699');
  assert.equal(lighten('#336699', 1), '#ffffff');
  assert.equal(darken('#336699', 1), '#000000');
  assert.equal(darken('#ff8000', 0.5), '#804000');
});

test('luminância e tinta legível', () => {
  assert.equal(luminance('#000000'), 0);
  assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-9);
  assert.equal(inkOn('#f2a93c'), '#14110a'); // fundo claro → tinta escura
  assert.equal(inkOn('#1d3f6e'), '#ffffff'); // fundo escuro → tinta branca
});

test('customVars: só gera variáveis para as cores válidas', () => {
  assert.deepEqual(customVars({}), {});
  assert.deepEqual(customVars({ plate: null, f: 'vermelho', g: '#abc', display: undefined }), {});
  const v = customVars({ f: '#ff0000' });
  assert.equal(v['--gold'], '#ff0000');
  assert.match(v['--keyf-bg'], /^linear-gradient\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  assert.equal(v['--keyf-text'], '#ffffff'); // vermelho puro é escuro o bastante para tinta branca
  assert.equal(v['--flash-f'], '#ff0000e6');
  assert.ok(!('--blue' in v) && !('--brand' in v));
});

test('customVars: placa, tecla g e visor', () => {
  const v = customVars({ plate: '#b98a35', g: '#4db4e6', display: '#aef2ff' });
  assert.equal(v['--brand'], '#b98a35');
  assert.equal(v['--plate-c'], '#b98a35');
  assert.equal(v['--blue'], '#4db4e6');
  assert.equal(v['--display-text'], '#aef2ff');
  assert.equal(v['--display-glow'], '0 0 12px #aef2ff8c');
  for (const val of Object.values(v)) assert.ok(!/undefined|NaN/.test(val), val);
});
