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
const vendas = 'f sst 32 enter 17000 sigma 40 enter 25000 sigma 45 enter 26000 sigma 40 enter 20000 sigma 38 enter 21000 sigma 50 enter 28000 sigma 35 enter 15000 sigma';

test('manual p.82: Σ+ mostra n; média das vendas e das horas', () => {
  const e = run(new Engine(), vendas);
  assert.equal(e.state.display, '7,00');
  run(e, 'g 0');
  assert.equal(e.state.display, '21.714,29');
  run(e, 'xy');
  assert.equal(e.state.display, '40,00');
});

test('manual p.83: desvios padrão (amostra) e desvio padrão da população', () => {
  const e = run(new Engine(), vendas + ' g dot');
  assert.equal(e.state.display, '4.820,59');
  run(e, 'xy');
  assert.equal(e.state.display, '6,03');
  const p = run(new Engine(), vendas + ' g 0 sigma g dot');
  assert.equal(p.state.display, '4.463,00');
  run(p, 'xy');
  assert.equal(p.state.display, '5,58');
});

test('manual p.84-85: estimativa x̂ (48 g 1), correlação r, intersecção A e inclinação B', () => {
  const e = run(new Engine(), vendas + ' 48 g 1');
  assert.equal(e.state.display, '28.818,93');
  run(e, 'xy');
  assert.equal(e.state.display, '0,90');
  const a = run(new Engine(), vendas + ' 0 g 2');
  assert.equal(a.state.display, '15,55');
  run(a, '1 g 2 xy rdown xy minus');
  near(a.state.stack.x, 0.001126, 0.000001);
  run(a, 'f 3');
  assert.equal(a.state.display, '0,001'); // como no manual: inclinação B = 0,001
});

test('manual p.86: média ponderada do combustível = 1,19', () => {
  const e = run(new Engine(), 'f sst 1.16 enter 15 sigma 1.24 enter 7 sigma 1.20 enter 10 sigma 1.18 enter 17 sigma g 6');
  assert.equal(e.state.display, '1,19');
});

test('g Σ− corrige um par errado já acumulado (e o último par pode ser desfeito)', () => {
  const e = run(new Engine(), 'f sst 5 enter 10 sigma 9 enter 99 sigma');
  assert.equal(e.state.display, '2,00');
  run(e, '9 enter 99 g sigma');
  assert.equal(e.state.display, '1,00');
  assert.deepEqual(e.state.regs.slice(1, 7), [1, 10, 100, 5, 25, 50]);
});

test('estatística sem dados: média dá Erro 2; s com 1 par dá Erro 2; f CLEAR Σ zera R1–R6 e a pilha', () => {
  const e = new Engine();
  run(e, 'g 0');
  assert.equal(e.state.error.code, 2);
  const f = run(new Engine(), 'f sst 3 enter 4 sigma g dot');
  assert.equal(f.state.error.code, 2);
  const g = run(new Engine(), '3 enter 4 sigma f sst');
  assert.deepEqual(g.state.regs.slice(1, 7), [0, 0, 0, 0, 0, 0]);
  assert.equal(g.state.stack.x, 0);
});

function near(a, b, tol) { assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`); }
