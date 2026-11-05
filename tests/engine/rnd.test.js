import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';

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

test('RND arredonda X às casas do visor: 2,345 → 2,35 (meio para longe de zero)', () => {
  const e = run(new Engine(), '2.345 f pmt');
  assert.equal(e.state.stack.x, 2.35);
});

test('RND com número negativo: −2,345 → −2,35', () => {
  assert.equal(run(new Engine(), '2.345 chs f pmt').state.stack.x, -2.35);
});

test('RND respeita f 0 e f 4, e o valor interno fica igual ao exibido', () => {
  const e = run(new Engine(), 'f 4 1 enter 3 divide f pmt');
  assert.equal(e.state.stack.x, 0.3333);
  run(e, 'f 9');
  assert.equal(e.state.display, '0,333300000');
  assert.equal(run(new Engine(), 'f 0 2.5 f pmt').state.stack.x, 3);
});

test('RND guarda o valor anterior em LSTx e entra na fita', () => {
  const e = run(new Engine(), '2.345 f pmt');
  assert.equal(e.state.stack.lastX, 2.345);
  assert.equal(e.state.tape.at(-1).label, 'RND');
});

test('o uso clássico: soma de valores arredondados difere da soma dos exatos', () => {
  const e = run(new Engine(), '1.005 f pmt 1.005 f pmt plus');
  assert.equal(e.state.stack.x, 2.02);
});
