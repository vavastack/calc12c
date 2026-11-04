import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KEYS } from '../../src/engine/keymap.js';
import { Engine } from '../../src/engine/engine.js';

// Helper: números viram dígitos (prefixo '-' = CHS depois de digitar); o resto são ids de tecla.
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

// ---------- mapa de teclas ----------
test('KEYS tem 39 teclas com ids únicos', () => {
  assert.equal(KEYS.length, 39);
  assert.equal(new Set(KEYS.map((k) => k.id)).size, 39);
});

test('KEYS: grade vertical 5 × 8 sem sobreposição, ENTER ocupa 2 linhas', () => {
  const cells = new Set();
  for (const k of KEYS) {
    const span = k.rowSpan ?? 1;
    for (let r = k.row; r < k.row + span; r++) {
      assert.ok(r >= 0 && r < 8 && k.col >= 0 && k.col < 5, `fora da grade: ${k.id}`);
      const c = `${r},${k.col}`;
      assert.ok(!cells.has(c), `sobreposição em ${c} (${k.id})`);
      cells.add(c);
    }
  }
  assert.equal(cells.size, 40);
  assert.equal(KEYS.find((k) => k.id === 'enter').rowSpan, 2);
});

test('KEYS: rótulos f e g oficiais das teclas financeiras', () => {
  const k = (id) => KEYS.find((x) => x.id === id);
  assert.deepEqual([k('n').f, k('n').g], ['AMORT', '12×']);
  assert.deepEqual([k('i').f, k('i').g], ['INT', '12÷']);
  assert.deepEqual([k('pv').f, k('pv').g], ['NPV', 'CFo']);
  assert.deepEqual([k('7').g, k('8').g], ['BEG', 'END']);
});

test('KEYS: todas as 39 teclas estão ativas (programação e estatística incluídas)', () => {
  assert.ok(KEYS.every((k) => k.enabled));
});

// ---------- cenário do plano: Financiamento ----------
test('Financiamento: 30 g12× → n=360; 6 g12÷ → i=0,5; PV e PMT → -1199,10', () => {
  const e = new Engine();
  run(e, '30 g n');
  assert.equal(e.state.fin.n, 360);
  run(e, '6 g i');
  assert.equal(e.state.fin.i, 0.5);
  run(e, '200000 pv pmt');
  near(e.state.stack.x, -1199.1, 0.01);
  assert.equal(e.state.display, '-1.199,10');
});

test('digitar e apertar a tecla guarda; apertar de novo calcula', () => {
  const e = run(new Engine(), '12 n 1 i -1000 pv fv');
  near(e.state.stack.x, 1126.83, 0.01);
  assert.equal(e.state.fin.pv, -1000);
});

test('f seguido de dígito define as casas decimais', () => {
  const e = run(new Engine(), '2 enter 3 plus f 4');
  assert.equal(e.state.decimals, 4);
  assert.equal(e.state.display, '5,0000');
  assert.equal(e.state.shift, null);
});

test('g 7 aciona BEGIN e g 8 volta para END', () => {
  const e = run(new Engine(), 'g 7');
  assert.equal(e.state.begin, true);
  run(e, 'g 8');
  assert.equal(e.state.begin, false);
});

test('f e g acendem o prefixo e o próximo comando o consome', () => {
  const e = new Engine();
  e.press('f');
  assert.equal(e.state.shift, 'f');
  e.press('g');
  assert.equal(e.state.shift, 'g');
  e.press('8');
  assert.equal(e.state.shift, null);
});

// ---------- erros ----------
test('1 ÷ 0 mostra Error 0 e a próxima tecla limpa o erro sem executar', () => {
  const e = run(new Engine(), '1 enter 0 divide');
  assert.equal(e.state.error.code, 0);
  assert.equal(e.state.display, 'Error 0');
  assert.ok(e.state.error.message.length > 3);
  e.press('5');
  assert.equal(e.state.error, null);
  assert.notEqual(e.state.display, '5');
  run(e, '7');
  assert.equal(e.state.display, '7');
});

test('erro de juros compostos mostra Error 5', () => {
  const e = run(new Engine(), '12 n 1000 chs pv 2000 chs fv i');
  assert.equal(e.state.display, 'Error 5');
});

test('teclas desativadas (R/S, SST, Σ+) são ignoradas sem erro e limpam o prefixo', () => {
  const e = run(new Engine(), '5 enter 3');
  const antes = JSON.stringify(e.state.stack);
  for (const id of ['rs']) e.press(id);
  e.press('g');
  e.press('rs');
  assert.equal(e.state.error, null);
  assert.equal(e.state.shift, null);
  assert.equal(JSON.stringify(e.state.stack), antes);
});

test('função f/g ainda não implementada é ignorada sem erro', () => {
  const e = run(new Engine(), '5 f pv');
  assert.equal(e.state.error, null);
  assert.equal(e.state.shift, null);
  assert.equal(e.state.stack.x, 5);
});

test('tecla desconhecida lança erro de programação', () => {
  assert.throws(() => new Engine().press('zzz'), /desconhecida/);
});

// ---------- registradores e pilha ----------
test('STO e RCL com R0 a R9', () => {
  const e = run(new Engine(), '42 sto 3 clx rcl 3');
  assert.equal(e.state.stack.x, 42);
  assert.equal(e.state.regs[3], 42);
});

test('RCL de um registrador financeiro exibe o valor sem calcular', () => {
  const e = run(new Engine(), '325 chs pmt rcl pmt');
  assert.equal(e.state.display, '-325,00');
});

test('STO seguido de tecla inválida é cancelado', () => {
  const e = run(new Engine(), '9 sto plus');
  assert.equal(e.state.error, null);
  assert.equal(e.state.regs.every((v) => v === 0), true);
});

test('g ENTER (LSTx) recupera o último X', () => {
  const e = run(new Engine(), '3 enter 4 plus g enter');
  assert.equal(e.state.stack.x, 4);
  assert.equal(e.state.stack.y, 7);
});

test('f CLx zera registradores, financeiros, pilha e LastX; f x≷y zera só os financeiros', () => {
  const e = run(new Engine(), '5 sto 1 12 n 3 enter 4 plus f xy');
  assert.equal(e.state.fin.n, 0);
  assert.equal(e.state.regs[1], 5);
  assert.equal(e.state.stack.x, 7);
  run(e, '12 n f clx');
  assert.deepEqual(e.state.stack, { x: 0, y: 0, z: 0, t: 0, lastX: 0 });
  assert.equal(e.state.regs[1], 0);
  assert.equal(e.state.fin.n, 0);
});

test('f INT deixa juros ordinários em X, principal em Y e juros exatos em Z', () => {
  const e = run(new Engine(), '60 n 7 i 450 chs pv f i');
  near(e.state.stack.x, 5.25);
  assert.equal(e.state.stack.y, 450);
  near(e.state.stack.z, 5.178, 0.001);
});

test('formato en-US e alternância de formato', () => {
  const e = run(new Engine({ locale: 'us' }), '12580 enter 1 plus');
  assert.equal(e.state.display, '12,581.00');
  e.setLocale('br');
  assert.equal(e.state.display, '12.581,00');
});

test('visor mostra a digitação com separadores de milhar', () => {
  const e = run(new Engine(), '1234567 dot 5');
  assert.equal(e.state.display, '1.234.567,5');
});

test('números muito grandes aparecem em notação científica, nunca NaN', () => {
  const e = run(new Engine(), '9 enter 11 yx');
  assert.ok(!/NaN|Infinity/.test(e.state.display));
  assert.match(e.state.display, /,\d+ 10$/);
});

// ---------- fita ----------
test('cada operação concluída acrescenta uma linha na fita', () => {
  const e = run(new Engine(), '3 enter 4 plus');
  assert.equal(e.state.tape.length, 1);
  const l = e.state.tape[0];
  assert.equal(l.keys, '3 ENTER 4 +');
  assert.equal(l.label, '+');
  assert.equal(l.value, 7);
  assert.equal(l.text, '7,00');
  run(e, '2 times');
  assert.equal(e.state.tape.length, 2);
  assert.equal(e.state.tape[1].keys, '2 ×');
});

test('guardar e calcular valores financeiros entram na fita', () => {
  const e = run(new Engine(), '12 n 1 i -1000 pv fv');
  assert.deepEqual(e.state.tape.map((l) => l.label), ['n', 'i', 'PV', 'FV']);
  assert.equal(e.state.tape[2].value, -1000);
});

test('erro não acrescenta linha à fita', () => {
  const e = run(new Engine(), '1 enter 0 divide');
  assert.equal(e.state.tape.length, 0);
});

// ---------- serialização ----------
test('serialize/restore reproduz o mesmo estado (inclui digitação em andamento)', () => {
  const e = run(new Engine(), '30 g n 6 g i 200000 pv pmt 5 sto 2 12 enter 3 dot');
  const e2 = Engine.restore(e.serialize());
  assert.deepEqual(e2.state, e.state);
  run(e, '5');
  run(e2, '5');
  assert.deepEqual(e2.state, e.state);
});

test('restore recusa lixo, JSON de outra forma e versão antiga', () => {
  assert.throws(() => Engine.restore('lixo'));
  assert.throws(() => Engine.restore('{"lixo":true}'));
  assert.throws(() => Engine.restore('{"v":0}'));
  assert.throws(() => Engine.restore('null'));
  const bom = JSON.parse(new Engine().serialize());
  bom.fin.n = 'abc';
  assert.throws(() => Engine.restore(JSON.stringify(bom)));
  const bom2 = JSON.parse(new Engine().serialize());
  bom2.regs = [1, 2];
  assert.throws(() => Engine.restore(JSON.stringify(bom2)));
});

// ---------- exemplos do manual ----------
const exemplos = JSON.parse(readFileSync(new URL('../manual-examples.json', import.meta.url))).examples;
for (const ex of exemplos) {
  test(`exemplo [${ex.source}] ${ex.id}`, () => {
    const e = new Engine();
    for (const step of ex.steps) {
      run(e, step.keys);
      assert.equal(e.state.error, null, `erro em "${step.keys}": ${e.state.display}`);
      if (step.display !== null) assert.equal(e.state.display, step.display, `após "${step.keys}"`);
    }
  });
}

test('backspace do Engine apaga a digitação e limpa erro sem executar', () => {
  const e = run(new Engine(), '1 2 3');
  e.backspace();
  assert.equal(e.state.display, '12');
  const e2 = run(new Engine(), '1 enter 0 divide');
  e2.backspace();
  assert.equal(e2.state.error, null);
});

test('reset zera pilha, registradores, financeiros e fita, mantendo o formato', () => {
  const e = run(new Engine({ locale: 'us' }), '30 g n 5 sto 2 3 enter 4 plus');
  e.reset();
  const novo = new Engine({ locale: 'us' });
  assert.deepEqual(e.state, novo.state);
  assert.equal(e.state.tape.length, 0);
});

test('loadValue coloca um valor em X seguindo a regra de elevação (linha da fita)', () => {
  const e = run(new Engine(), '3 enter 4 plus');
  e.loadValue(42);
  assert.equal(e.state.stack.x, 42);
  assert.equal(e.state.stack.y, 7);
  assert.equal(e.state.error, null);
});
