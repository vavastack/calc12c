import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { bondPrice, bondYield } from '../../src/engine/bonds.js';
import { shiftMonths, days360 } from '../../src/engine/dates.js';

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
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);

// Âncoras independentes (documentação do Excel, PRICE/YIELD com frequência 2 e base 30/360 US):
test('PRICE: liquidação 15/02/2008, vencimento 15/11/2017, cupom 5,75%, taxa 6,5% → 94,63436162', () => {
  near(bondPrice(15.022008, 15.112017, 5.75, 6.5, true).price, 94.63436162, 1e-7);
});

test('YTM: liquidação 15/02/2008, vencimento 15/11/2016, cupom 5,75%, preço 95,04287 → 6,5%', () => {
  near(bondYield(15.022008, 15.112016, 5.75, 95.04287, true), 6.5, 1e-5);
});

test('juros acumulados: 90 dias dos 180 de um cupom de 6% (3 por período) → 1,50', () => {
  const r = bondPrice(15.062020, 15.092025, 6, 5, true); // cupons em 15/03 e 15/09: 90 dias desde 15/03
  near(r.accrued, 1.5, 1e-9);
});

test('no dia do cupom o acumulado é zero; taxa = cupom dá preço 100', () => {
  const r = bondPrice(15.052020, 15.112030, 5, 5, true);
  near(r.accrued, 0, 1e-12);
  near(r.price, 100, 1e-9);
});

test('preço e taxa são inversos (ida e volta)', () => {
  for (const y of [1, 4.75, 6, 12, 25]) {
    const p = bondPrice(28.042004, 15.112013, 4.75, y, true).price;
    near(bondYield(28.042004, 15.112013, 4.75, p, true), y, 1e-6);
  }
});

test('último cupom (N = 1) usa a fórmula simples', () => {
  const r = bondPrice(15.082020, 15.112020, 6, 5, true);
  // restam 90 dias: (100 + 3) / (1 + 0,5 · 0,025) − 3 · 90/180
  near(r.price, 103 / (1 + 0.5 * 0.025) - 1.5, 1e-6);
});

test('formato M.DY e D.MY dão o mesmo resultado', () => {
  const a = bondPrice(28.042004, 15.112013, 4.75, 6, true);
  const b = bondPrice(4.282004, 11.152013, 4.75, 6, false);
  assert.deepEqual(a, b);
});

test('vencimento no fim do mês acompanha fim de mês nos cupons', () => {
  assert.deepEqual(shiftMonths({ y: 2013, m: 8, d: 31 }, -6), { y: 2013, m: 2, d: 28 });
  assert.deepEqual(shiftMonths({ y: 2013, m: 11, d: 15 }, -6), { y: 2013, m: 5, d: 15 });
  assert.equal(days360({ y: 2013, m: 5, d: 15 }, { y: 2013, m: 11, d: 15 }), 180);
});

test('liquidação depois do vencimento → Error 8; preço ou cupom inválido → Error 5', () => {
  assert.throws(() => bondPrice(15.112020, 15.112010, 5, 5, true), (e) => e.code === 8);
  assert.throws(() => bondYield(15.022008, 15.112016, 5, -10, true), (e) => e.code === 5);
  assert.throws(() => bondPrice(15.022008, 15.112016, -1, 5, true), (e) => e.code === 5);
});

test('pelo teclado: f PRICE devolve preço em X e juros acumulados em Y; f YTM devolve a taxa', () => {
  const e = run(new Engine({ locale: 'br' }), 'f clx g 4 6 i 4.75 pmt 28.042004 enter 15.112013 f yx');
  const esperado = bondPrice(28.042004, 15.112013, 4.75, 6, true);
  near(e.state.stack.x, esperado.price);
  near(e.state.stack.y, esperado.accrued);
  run(e, 'f clx g 4 95.04287 pv 5.75 pmt 15.022008 enter 15.112016 f recip');
  near(e.state.stack.x, 6.5, 1e-4);
});

test('a fita registra PRICE e YTM', () => {
  const e = run(new Engine(), 'f clx g 4 6 i 4.75 pmt 28.042004 enter 15.112013 f yx 95 pv 28.042004 enter 15.112013 f recip');
  const labels = e.state.tape.map((l) => l.label);
  assert.ok(labels.includes('PRICE') && labels.at(-1) === 'YTM');
});
