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
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);
// Custo 10.000, residual 500, vida 5 anos, fator 125%.
const PREP = 'f clx 5 n 125 i 10000 pv 500 fv';
const dep = (ano, tecla) => { const e = run(new Engine({ locale: 'br' }), PREP); run(e, `${ano} f ${tecla}`); return e.state; };

test('SL: 1.900,00 por ano e restante cai 1.900 a cada ano', () => {
  for (let a = 1; a <= 5; a++) {
    const st = dep(a, 'pctT');
    near(st.stack.x, 1900);
    near(st.stack.y, 9500 - 1900 * a);
  }
  assert.equal(dep(1, 'pctT').display, '1.900,00');
});

test('SOYD: parcelas 3166,67 / 2533,33 / 1900 / 1266,67 / 633,33 somam 9500', () => {
  const esperado = [3166.6666667, 2533.3333333, 1900, 1266.6666667, 633.3333333];
  let acc = 0;
  esperado.forEach((v, k) => {
    const st = dep(k + 1, 'dpct');
    near(st.stack.x, v, 1e-5);
    acc += st.stack.x;
    near(st.stack.y, 9500 - acc, 1e-5);
  });
  near(acc, 9500, 1e-5);
});

test('DB 125%: 2500, 1875, 1406,25 e nunca abaixo do residual', () => {
  near(dep(1, 'pct').stack.x, 2500);
  near(dep(2, 'pct').stack.x, 1875);
  near(dep(3, 'pct').stack.x, 1406.25);
  near(dep(1, 'pct').stack.y, 9500 - 2500);
  // referência ingênua
  let book = 10000, acc = 0;
  for (let a = 1; a <= 5; a++) {
    const d = Math.min(book * 1.25 / 5, book - 500);
    book -= d; acc += d;
    near(dep(a, 'pct').stack.x, d, 1e-6);
    near(dep(a, 'pct').stack.y, 9500 - acc, 1e-6);
  }
  assert.ok(book >= 500);
});

test('DB dobrado (200%) trava no valor residual', () => {
  const e = run(new Engine(), 'f clx 3 n 200 i 1000 pv 400 fv');
  let total = 0;
  for (let a = 1; a <= 3; a++) { run(e, `${a} f pct`); total += e.state.stack.x; }
  near(total, 600, 1e-6);
});

test('x≷y mostra o valor depreciável restante e LSTx guarda o ano', () => {
  const e = run(new Engine(), PREP + ' 2 f dpct');
  assert.equal(e.state.stack.lastX, 2);
  run(e, 'xy');
  near(e.state.stack.x, 9500 - 3166.6666667 - 2533.3333333, 1e-4);
});

test('ano fora de 1..n, fracionário ou vida zero → Error 5', () => {
  for (const seq of [PREP + ' 0 f pctT', PREP + ' 6 f dpct', PREP + ' 2.5 f pct', 'f clx 10000 pv 500 fv 1 f pctT']) {
    assert.equal(run(new Engine(), seq).state.error?.code, 5, seq);
  }
});

test('a fita registra SL, SOYD e DB', () => {
  const e = run(new Engine(), PREP + ' 1 f pctT 1 f dpct 1 f pct');
  assert.deepEqual(e.state.tape.map((l) => l.label).slice(-3), ['SL', 'SOYD', 'DB']);
});
