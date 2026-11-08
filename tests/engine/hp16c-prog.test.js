import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, restoreEngine } from '../../src/engine/engines.js';
import { keyCode, lineDone, lineText, memInfo, runTest, MAX_LINES } from '../../src/engine/program16.js';

const E = () => createEngine({ profile: '16c' });
function run(e, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    if (/^[0-9A-F]+$/.test(tok)) for (const c of tok) e.press(/[0-9]/.test(c) ? c : 'd' + c.toLowerCase());
    else e.press(tok);
  }
  return e;
}
const disp = (e) => e.state.display;
// Grava um programa: entra em PRGM, digita as teclas, sai.
const prog = (e, keys) => run(e, 'g rs ' + keys + ' g rs');

test('program16: códigos de tecla, fim de linha e texto', () => {
  assert.equal(keyCode('gto'), 22);
  assert.equal(keyCode('7'), 7);
  assert.equal(lineDone(['g']), false);
  assert.equal(lineDone(['sto']), false);
  assert.equal(lineDone(['sto', '5']), true);
  assert.equal(lineDone(['sto', 'dot']), false);
  assert.equal(lineDone(['sto', 'dot', '5']), true);
  assert.equal(lineDone(['g', 'gto']), false);
  assert.equal(lineDone(['g', 'gto', '1']), true);
  assert.equal(lineDone(['plus']), true);
  assert.equal(lineText(3, ['g', 'gto', '1']), '003- 43,22, 1');
  assert.equal(lineText(5, ['5']), '005-  5');
});

test('program16: testes e memória', () => {
  assert.equal(runTest('plus', 0n, 1n, 16, '2'), true);
  assert.equal(runTest('2', 0xFFFFn, 0n, 16, '2'), true); // -1 < 0
  assert.equal(runTest('2', 0xFFFFn, 0n, 16, 'u'), false);
  assert.equal(memInfo(0, 16).r, 101);
  assert.equal(MAX_LINES, 203);
});

test('P/R entra em PRGM, grava sem executar e sai', () => {
  const e = E();
  run(e, 'g rs');
  assert.equal(e.state.prgm, true);
  assert.equal(disp(e), '000-');
  run(e, '5 plus');
  assert.equal(e.state.pc, 2);
  assert.equal(e.state.stack.x, '0'); // nada foi executado
  assert.equal(disp(e), '002- 40');
  run(e, 'g rs');
  assert.equal(e.state.prgm, false);
});

test('GSB n roda a sub-rotina até o RTN', () => {
  const e = E();
  prog(e, 'g gto 1 2 times g gsb');
  run(e, '3 enter gsb 1');
  assert.equal(disp(e), '6 d');
});

test('laço com DSZ sobre I: soma 1 três vezes', () => {
  const e = E();
  prog(e, 'g gto 1 1 plus g hex gto 1');
  run(e, '3 sto f sst 0 gto 1 rs');
  assert.equal(e.state.stack.x, '3');
});

test('teste x=0 executa a próxima linha só se verdadeiro', () => {
  const e = E();
  prog(e, 'g gto 1 g plus 9');
  run(e, '0 gto 1 rs');
  assert.equal(e.state.stack.x, '9');
  const f = E();
  prog(f, 'g gto 1 g plus 9');
  run(f, '5 gto 1 rs');
  assert.equal(f.state.stack.x, '5');
});

test('R/S dentro do programa para a execução; SST executa uma linha', () => {
  const e = E();
  prog(e, 'g gto 2 1 rs 2');
  run(e, 'gto 2 rs');
  assert.equal(e.state.stack.x, '1');
  const s = E();
  prog(s, '7 8');
  run(s, 'g gsb sst');
  assert.equal(s.state.stack.x, '7');
  run(s, 'g sst');
  assert.equal(s.state.pc, 0);
});

test('Error 4: rótulo inexistente e memória cheia; Error 5: sub-rotinas demais', () => {
  const e = E();
  run(e, 'gsb 9');
  assert.equal(disp(e), 'Error 4');
  const f = E();
  prog(f, 'g gto 1 gsb 1');
  run(f, 'gsb 1');
  assert.equal(disp(f), 'Error 5');
  const m = E();
  run(m, 'g rs');
  for (let i = 0; i < MAX_LINES; i++) run(m, '1');
  run(m, '1');
  assert.equal(disp(m), 'Error 4');
});

test('CLEAR PRGM apaga o programa e BSP apaga a linha atual', () => {
  const e = E();
  prog(e, '1 2 3');
  run(e, 'g rs bsp g rs');
  assert.equal(e.state.pc, 2);
  run(e, 'g rs f rdown g rs');
  assert.equal(e.state.pc, 0);
  run(e, 'sst');
  assert.equal(e.state.stack.x, '0');
});

test('o programa sobrevive a serialize/restore', () => {
  const e = E();
  prog(e, 'g gto 1 2 times g gsb');
  const r = restoreEngine(e.serialize());
  run(r, '4 enter gsb 1');
  assert.equal(r.state.stack.x, '8');
});
