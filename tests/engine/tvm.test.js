import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solve, simpleInterest } from '../../src/engine/tvm.js';
import { CalcError } from '../../src/engine/errors.js';

const near = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperado ${b} ±${tol}, obtido ${a}`);
const fin = (o) => ({ n: 0, i: 0, pv: 0, pmt: 0, fv: 0, ...o });
const erro5 = (e) => e instanceof CalcError && e.code === 5;

// ---- casos do plano ----
test('fv: n=12, i=1, pv=-1000 → 1126,83', () => {
  near(solve('fv', fin({ n: 12, i: 1, pv: -1000 }), false), 1126.83, 0.01);
});

test('pmt: financiamento 360 × 0,5% de 200000 — END -1199,10; BEGIN -1193,14', () => {
  const f = fin({ n: 360, i: 0.5, pv: 200000 });
  near(solve('pmt', f, false), -1199.1, 0.01);
  near(solve('pmt', f, true), -1193.14, 0.01);
});

test('i: n=12, pv=-1000, fv=1126,825 → 1,000', () => {
  near(solve('i', fin({ n: 12, pv: -1000, fv: 1126.825 }), false), 1, 0.0001);
});

test('n: pv=-1000, i=1, fv=1126,825 → 12', () => {
  near(solve('n', fin({ i: 1, pv: -1000, fv: 1126.825 }), false), 12, 0.01);
});

// ---- Foco 3: i = 0 ----
test('Foco 3: i=0 usa o caso linear (pmt = 100, sem NaN)', () => {
  const v = solve('pmt', fin({ n: 10, i: 0, pv: -1000, fv: 0 }), false);
  assert.equal(v, 100);
});

test('Foco 3: i=0, fv com pmt=-100 → 1000 (e pmt=+100 → -1000)', () => {
  assert.equal(solve('fv', fin({ n: 10, i: 0, pmt: -100 }), false), 1000);
  assert.equal(solve('fv', fin({ n: 10, i: 0, pmt: 100 }), false), -1000);
});

test('Foco 3: i=0, pv e n lineares', () => {
  assert.equal(solve('pv', fin({ n: 10, i: 0, pmt: -100 }), false), 1000);
  assert.equal(solve('n', fin({ i: 0, pv: -1000, pmt: 100 }), false), 10);
});

test('Foco 3: i=0 com BEGIN não muda o resultado linear', () => {
  assert.equal(solve('pmt', fin({ n: 10, i: 0, pv: -1000 }), true), 100);
});

test('i = 0 como resposta: pv=-1000, fv=1000 → 0', () => {
  assert.equal(solve('i', fin({ n: 5, pv: -1000, fv: 1000 }), false), 0);
});

// ---- erros (Erro 5: juros compostos) ----
test('sinais iguais em pv e fv ao buscar i → Erro 5', () => {
  assert.throws(() => solve('i', fin({ n: 12, pv: -1000, fv: -2000 }), false), erro5);
});

test('n sem solução (pv e fv de sinais iguais, sem pmt) → Erro 5', () => {
  assert.throws(() => solve('n', fin({ i: 1, pv: 1000, fv: 1000 }), false), erro5);
});

test('i ≤ -100 → Erro 5', () => {
  assert.throws(() => solve('fv', fin({ n: 3, i: -100, pv: -1 }), false), erro5);
  assert.throws(() => solve('pmt', fin({ n: 3, i: -150, pv: -1 }), false), erro5);
});

test('pmt com n = 0 → Erro 5 (sem NaN)', () => {
  assert.throws(() => solve('pmt', fin({ n: 0, i: 1, pv: -1000 }), false), erro5);
  assert.throws(() => solve('pmt', fin({ n: 0, i: 0, pv: -1000 }), false), erro5);
});

test('n com i=0 e pmt=0 → Erro 5', () => {
  assert.throws(() => solve('n', fin({ i: 0, pv: -1000, fv: 500 }), false), erro5);
});

// ---- exemplos do manual HP 12C (pt-BR), tolerância de meio centavo ----
test('manual p.41: n do empréstimo de 35000 a 10,5% a.a. com PMT -325 → 328 (arredonda p/ cima)', () => {
  assert.equal(solve('n', fin({ i: 10.5 / 12, pv: 35000, pmt: -325 }), false), 328);
});

test('manual p.42: pagamento final — FV com n=328 → 181,89 e n=327 → -141,87', () => {
  const f = fin({ i: 10.5 / 12, pv: 35000, pmt: -325 });
  near(solve('fv', { ...f, n: 328 }, false), 181.89, 0.005);
  near(solve('fv', { ...f, n: 327 }, false), -141.87, 0.005);
});

test('manual p.43: poupança quinzenal — n = 58', () => {
  assert.equal(solve('n', fin({ i: 6.25 / 24, pv: -775, pmt: -50, fv: 4000 }), false), 58);
});

test('manual p.45: taxa anual p/ 6000 → 10000 em 8 anos trimestral — i=1,61 e 6,44 ao ano', () => {
  const i = solve('i', fin({ n: 32, pv: -6000, fv: 10000 }), false);
  near(i, 1.61, 0.005);
  near(i * 4, 6.44, 0.005);
});

test('manual p.46: PV do carro — 5.389,72 (n=48, i=1,25, PMT -150)', () => {
  near(solve('pv', fin({ n: 48, i: 1.25, pmt: -150 }), false), 5389.72, 0.005);
});

test('manual p.47: PV dos condomínios — -369.494,09', () => {
  near(solve('pv', fin({ n: 5, i: 12, pmt: 17500, fv: 540000 }), false), -369494.09, 0.005);
});

test('manual p.48: PMT da hipoteca de 43400 — -523,99', () => {
  near(solve('pmt', fin({ n: 348, i: 14.25 / 12, pv: 43400 }), false), -523.99, 0.005);
});

test('manual p.48: PMT semestral da aposentadoria — -717,44', () => {
  near(solve('pmt', fin({ n: 30, i: 9.75 / 2, pv: -3200, fv: 60000 }), false), -717.44, 0.005);
});

test('manual p.49: FV da hipoteca após 5 anos — -42.652,37', () => {
  near(solve('fv', fin({ n: 60, i: 14.25 / 12, pv: 43400, pmt: -523.99 }), false), -42652.37, 0.005);
});

test('manual p.50: FV com depósitos no início do mês (BEGIN) — 1.281,34', () => {
  near(solve('fv', fin({ n: 24, i: 6.25 / 12, pmt: -50 }), true), 1281.34, 0.005);
});

test('manual p.51: valor do imóvel com taxa negativa — 28.346,96', () => {
  near(solve('fv', fin({ n: 6, i: -2, pv: -32000 }), false), 28346.96, 0.005);
});

// ---- juros simples (f INT) ----
test('manual p.35: juros simples de 450 a 7% por 60 dias — 5,25 (ordinários) e 5,18 (exatos)', () => {
  const r = simpleInterest(60, 7, -450);
  near(r.interest360, 5.25, 0.005);
  near(r.interest365, 5.18, 0.005);
});

test('i negativa: pv=-1000, fv=800 em 2 períodos → −10,56%', () => {
  const r = solve('i', fin({ n: 2, pv: -1000, fv: 800 }), false);
  near(r, (Math.sqrt(0.8) - 1) * 100, 1e-6);
});
