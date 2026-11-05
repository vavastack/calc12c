import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';

// Teclas: números viram dígitos (prefixo '-' = CHS); o resto são ids de tecla.
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
const novo = () => new Engine({ locale: 'br' });
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);

// Cálculo de referência, escrito de forma ingênua e independente do motor.
function npvRef(cf0, flows, ratePct) {
  let t = 0;
  let total = cf0;
  for (const [amt, nj] of flows) for (let k = 0; k < nj; k++) total += amt / Math.pow(1 + ratePct / 100, ++t);
  return total;
}

// Exemplo A: CF0 −1000, depois 400, 500, 600; taxa 10%.
const EX_A = 'f clx 10 i -1000 g pv 400 g pmt 500 g pmt 600 g pmt';
// Exemplo B (com Nj): CF0 −10000, depois 3000 durante 4 períodos; taxa 8%.
const EX_B = 'f clx 8 i -10000 g pv 3000 g pmt 4 g fv';

test('NPV (exemplo A): 227,65', () => {
  const e = run(novo(), EX_A + ' f pv');
  near(e.state.stack.x, npvRef(-1000, [[400, 1], [500, 1], [600, 1]], 10), 1e-6);
  assert.equal(e.state.display, '227,65');
});

test('NPV (exemplo B, Nj repete o fluxo): −63,62', () => {
  const e = run(novo(), EX_B + ' f pv');
  near(e.state.stack.x, npvRef(-10000, [[3000, 4]], 8), 1e-6);
  assert.equal(e.state.display, '-63,62');
});

test('NPV só com CFo devolve o próprio CFo', () => {
  const e = run(novo(), 'f clx 10 i -500 g pv f pv');
  assert.equal(e.state.stack.x, -500);
});

test('IRR (exemplo A) anula o NPV', () => {
  const e = run(novo(), EX_A + ' f fv');
  near(npvRef(-1000, [[400, 1], [500, 1], [600, 1]], e.state.stack.x), 0, 1e-6);
  assert.ok(e.state.stack.x > 0);
});

test('IRR (exemplo B, com Nj) anula o NPV', () => {
  const e = run(novo(), EX_B + ' f fv');
  near(npvRef(-10000, [[3000, 4]], e.state.stack.x), 0, 1e-6);
});

test('IRR negativa: −1000 seguido de 400 duas vezes', () => {
  const e = run(novo(), 'f clx -1000 g pv 400 g pmt 2 g fv f fv');
  assert.ok(e.state.stack.x < 0);
  near(npvRef(-1000, [[400, 2]], e.state.stack.x), 0, 1e-6);
});

test('IRR sem troca de sinal → Error 7', () => {
  const e = run(novo(), 'f clx 1000 g pv 400 g pmt f fv');
  assert.equal(e.state.error.code, 7);
});

test('CFo zera a lista de fluxos anterior', () => {
  const e = run(novo(), EX_A + ' -200 g pv 10 i f pv');
  assert.equal(e.state.stack.x, -200);
});

test('CFj sem Nj conta uma vez; Nj vale só para o último CFj', () => {
  const e = run(novo(), 'f clx 10 i 0 g pv 100 g pmt 200 g pmt 2 g fv f pv');
  near(e.state.stack.x, npvRef(0, [[100, 1], [200, 2]], 10), 1e-6);
});

test('limite de 20 fluxos: o 21º dá Error 6', () => {
  const e = novo();
  run(e, 'f clx 0 g pv');
  for (let k = 0; k < 20; k++) run(e, '1 g pmt');
  assert.equal(e.state.error, null);
  run(e, '1 g pmt');
  assert.equal(e.state.error.code, 6);
});

test('Nj fora de 1..99 ou sem CFj → Error 6', () => {
  for (const seq of ['f clx 0 g pv 1 g pmt 0 g fv', 'f clx 0 g pv 1 g pmt 100 g fv', 'f clx 0 g pv 1 g pmt 2.5 g fv', 'f clx 0 g pv 3 g fv']) {
    assert.equal(run(novo(), seq).state.error?.code, 6, seq);
  }
});

test('CFo, CFj e Nj mantêm o valor no visor e deixam a pilha pronta para o próximo número', () => {
  const e = run(novo(), 'f clx 10 i -1000 g pv');
  assert.equal(e.state.display, '-1.000,00');
  run(e, '400');
  assert.equal(e.state.display, '400');
});

test('a fita registra CFo, CFj, Nj, NPV e IRR', () => {
  const e = run(novo(), EX_B + ' f pv f fv');
  assert.deepEqual(e.state.tape.map((l) => l.label).slice(-5), ['CFo', 'CFj', 'Nj', 'NPV', 'IRR']);
});

test('CLEAR REG apaga os fluxos; CLEAR FIN não', () => {
  let e = run(novo(), EX_A + ' f xy 10 i f pv');
  near(e.state.stack.x, npvRef(-1000, [[400, 1], [500, 1], [600, 1]], 10), 1e-6);
  e = run(novo(), EX_A + ' f clx 10 i f pv');
  assert.equal(e.state.stack.x, 0);
});

test('serialização guarda e restaura os fluxos', () => {
  const e = run(novo(), EX_B);
  const r = Engine.restore(e.serialize());
  run(r, 'f pv');
  near(r.state.stack.x, npvRef(-10000, [[3000, 4]], 8), 1e-6);
});

test('estado salvo antigo, sem fluxos, ainda é aceito', () => {
  const o = JSON.parse(novo().serialize());
  delete o.cf;
  assert.doesNotThrow(() => Engine.restore(JSON.stringify(o)));
});

test('os fluxos funcionam dentro de um programa gravado', () => {
  const e = novo();
  run(e, 'f clx 10 i -1000 g pv 400 g pmt 500 g pmt 600 g pmt');
  run(e, 'f rs f rdown f pv f rs'); // P/R, CLEAR PRGM, grava "f NPV", sai do modo de programação
  run(e, 'rs');
  near(e.state.stack.x, 227.6, 0.1);
});
