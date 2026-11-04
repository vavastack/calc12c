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
const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);

test('STO EEX liga e desliga o indicador C', () => {
  const e = new Engine();
  assert.equal(e.state.compound, false);
  run(e, 'sto eex');
  assert.equal(e.state.compound, true);
  run(e, 'sto eex');
  assert.equal(e.state.compound, false);
});

test('manual p.53 ex.1: 36 + 16/30, i=15%/12, PV=4500, C ligado → PMT = -157,03', () => {
  const e = new Engine();
  run(e, 'f xy g 8 sto eex 16 enter 30 divide 36 plus n 15 g i 4500 pv pmt');
  assert.equal(e.state.display, '-157,03');
  near(e.state.fin.i, 1.25);
});

test('manual p.54 ex.2: n = 42 + 13/30, PV=3950, PMT=-120 → i = 1,16 e 12× = 13,95', () => {
  for (const c of [false, true]) {
    const e = new Engine();
    run(e, 'f xy ' + (c ? 'sto eex ' : '') + '13 enter 30 divide 42 plus n 3950 pv -120 pmt i');
    assert.equal(e.state.display, '1,16', `C=${c}`);
  }
  const e = new Engine();
  run(e, 'f xy sto eex 13 enter 30 divide 42 plus n 3950 pv -120 pmt i 12 times');
  assert.equal(e.state.display, '13,95');
});

test('juros simples (C desligado) e compostos (C ligado) dão resultados diferentes para n fracionário', () => {
  const calc = (c) => {
    const e = new Engine();
    run(e, 'f xy ' + (c ? 'sto eex ' : '') + '12.5 n 2 i 1000 chs pv 0 pmt fv');
    return e.state.fin.fv;
  };
  const simples = calc(false);
  const composto = calc(true);
  assert.ok(Math.abs(simples - composto) > 0.0001);
  // juros simples no meio período: 1000·(1+0,02·0,5)·1,02^12 ; compostos: 1000·1,02^12,5
  near(simples, 1000 * (1 + 0.02 * 0.5) * Math.pow(1.02, 12), 0.01);
  near(composto, 1000 * Math.pow(1.02, 12.5), 0.01);
});

test('PV em período fracionário devolve o valor no início do período fracionário (e é inverso de FV)', () => {
  const e = new Engine();
  run(e, 'f xy sto eex 7.25 n 1.5 i 0 pmt 5000 fv pv');
  const pv = e.state.fin.pv;
  const f = new Engine();
  run(f, `f xy sto eex 7.25 n 1.5 i 0 pmt ${pv.toFixed(8)} chs chs pv fv`);
  near(f.state.fin.fv, 5000, 0.01);
});

test('n inteiro não muda: comportamento anterior preservado e o estado antigo (sem C) ainda restaura', () => {
  const e = new Engine();
  run(e, 'f xy 12 n 1 i 100 chs pv fv');
  const json = JSON.parse(e.serialize());
  delete json.compound;
  const r = Engine.restore(JSON.stringify(json));
  assert.equal(r.state.compound, false);
});

test('o indicador C persiste ao salvar e restaurar', () => {
  const e = run(new Engine(), 'sto eex');
  assert.equal(Engine.restore(e.serialize()).state.compound, true);
});
