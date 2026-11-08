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

test('registrador (i): STO/RCL (i) e x≷(i) usam o registrador apontado por I', () => {
  const e = run(E(), '5 sto f sst 99 sto f rs'); // I=5; R5=99
  assert.equal(e.state.regs[5], '99');
  const r = run(e, '0 rcl f rs');
  assert.equal(r.state.stack.x, '99');
  run(r, '7 f gsb'); // x≷(i): X=99, R5=7
  assert.equal(r.state.stack.x, '99');
  assert.equal(r.state.regs[5], '7');
});

test('x≷I troca X com I; (i) fora da faixa dá Error 3', () => {
  const e = run(E(), '5 sto f sst 9 f gto');
  assert.equal(e.state.stack.x, '5');
  assert.equal(e.state.texts.idx, '9 d');
  const f = run(E(), '40 sto f sst 1 sto f rs');
  assert.equal(disp(f), 'Error 3');
});

test('GSB I e GTO I usam I como rótulo', () => {
  const e = E();
  prog(e, 'g gto 3 8 g gsb');
  run(e, '3 sto f sst gsb f sst');
  assert.equal(e.state.stack.x, '8');
  const f = run(E(), '20 sto f sst gto f sst');
  assert.equal(disp(f), 'Error 4');
});

test('B? e F? pulam a linha seguinte quando falsos', () => {
  const e = E();
  prog(e, 'g gto 1 f 6 3 9 g gto 2 g 6 0 8');
  run(e, '8 gto 1 rs'); // bit 3 de 8 está ligado: executa 9
  assert.equal(e.state.stack.x, '9');
  const f = E();
  prog(f, 'g gto 1 f 6 3 9');
  run(f, '4 gto 1 rs'); // bit 3 de 4 desligado: pula o 9
  assert.equal(f.state.stack.x, '4');
  const g = E();
  prog(g, 'g gto 1 g 6 2 9');
  run(g, '4 g 4 2 gto 1 rs'); // SF 2 e depois F? 2: executa 9
  assert.equal(g.state.stack.x, '9');
});

test('f MEM mostra linhas livres e registradores; códigos de erro do manual', () => {
  const e = run(E(), 'f 0');
  assert.match(disp(e), /^p-00 r-101$/);
  assert.equal(disp(run(E(), 'g 4 9')), 'Error 1'); // flag 9
  assert.equal(disp(run(E(), '8 f sto f 4 8')), 'Error 2'); // bit 8 em 8 bits
  assert.equal(disp(run(E(), 'f enter 9')), 'Error 1'); // janela 9
});
