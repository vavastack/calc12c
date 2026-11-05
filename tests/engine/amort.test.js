import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { roundDec } from '../../src/engine/amort.js';

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
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);
// Financiamento de 50.000, 360 meses, 5,25% a.a. (0,4375% a.m.); n volta a 0 para amortizar desde o início.
const PREP = 'f clx 30 g n 5.25 g i 50000 pv pmt 0 n';
const novo = () => run(new Engine({ locale: 'br' }), PREP);

// Referência ingênua e independente do motor.
function ref(pv, ratePct, pmt, count, begin = false) {
  const r2 = (x) => Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-9) / 100;
  const p = r2(pmt);
  let bal = pv, jur = 0, pri = 0;
  for (let k = 0; k < count; k++) {
    const j = begin && k === 0 ? 0 : r2(-bal * ratePct / 100);
    jur += j; pri += p - j; bal += p - j;
  }
  return { jur, pri, bal };
}

test('roundDec: meio para longe de zero', () => {
  assert.equal(roundDec(1.005, 2), 1.01);
  assert.equal(roundDec(-1.005, 2), -1.01);
  assert.equal(roundDec(2.5, 0), 3);
});

test('12 f AMORT: juros em X, principal em Y, 12 em Z, e PV/n atualizados', () => {
  const e = novo();
  const pmt = e.state.fin.pmt;
  const r = ref(50000, 0.4375, pmt, 12);
  run(e, '12 f n');
  const st = e.state;
  near(st.stack.x, r.jur, 1e-6);
  near(st.stack.y, r.pri, 1e-6);
  assert.equal(st.stack.z, 12);
  near(st.fin.pv, r.bal, 1e-6);
  assert.equal(st.fin.n, 12);
  assert.ok(st.stack.x < 0 && st.stack.y < 0 && st.fin.pv < 50000);
});

test('juros + principal = prestações pagas', () => {
  const e = novo();
  const pmt = Math.round(e.state.fin.pmt * 100) / 100;
  run(e, '12 f n');
  near(e.state.stack.x + e.state.stack.y, 12 * pmt, 1e-6);
});

test('AMORT repetido continua de onde parou (12 + 12 = 24 de uma vez)', () => {
  const a = novo();
  run(a, '12 f n 12 f n');
  const b = novo();
  run(b, '24 f n');
  near(a.state.fin.pv, b.state.fin.pv, 1e-6);
  assert.equal(a.state.fin.n, 24);
  const j2 = a.state.stack.x;
  const j1 = ref(50000, 0.4375, a.state.fin.pmt, 12).jur;
  near(j1 + j2, b.state.stack.x, 1e-6);
});

test('x≷y troca juros e principal; o visor segue o número de casas', () => {
  const e = novo();
  run(e, '12 f n');
  assert.match(e.state.display, /^-[\d.]+,\d\d$/);
  run(e, 'xy');
  near(e.state.stack.x, ref(50000, 0.4375, e.state.fin.pmt, 12).pri, 1e-6);
});

test('BEGIN: a primeira prestação não paga juros', () => {
  const e = run(new Engine(), 'f clx g 7 12 n 12 i 1000 pv pmt 0 n 1 f n');
  assert.equal(e.state.stack.x, 0);
  const r = ref(1000, 1, e.state.fin.pmt, 1, true);
  near(e.state.stack.y, r.pri, 1e-6);
});

test('quantidade negativa ou fracionária → Error 0', () => {
  assert.equal(run(novo(), '2.5 f n').state.error.code, 0);
  assert.equal(run(novo(), '3 chs f n').state.error.code, 0);
});

test('0 f AMORT não muda nada', () => {
  const e = novo();
  const pv = e.state.fin.pv;
  run(e, '0 f n');
  assert.equal(e.state.fin.pv, pv);
  assert.equal(e.state.stack.x, 0);
});

test('serialização preserva o estado do AMORT', () => {
  const e = novo();
  run(e, '12 f n');
  const r = Engine.restore(e.serialize());
  run(r, '12 f n');
  run(e, '12 f n');
  near(r.state.fin.pv, e.state.fin.pv, 1e-9);
});

test('a fita registra AMORT', () => {
  assert.equal(run(novo(), '12 f n').state.tape.at(-1).label, 'AMORT');
});
