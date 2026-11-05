import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { getProfile } from '../../src/engine/profiles.js';

const P = () => new Engine({ profile: '12cp' });
const C = () => new Engine();
function run(e, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    if (/^\d+(\.\d+)?$/.test(tok)) for (const c of tok) e.press(c === '.' ? 'dot' : c);
    else e.press(tok);
  }
  return e;
}
const gKey = (e, id) => run(e, `g ${id}`);

// ---------- limites por perfil ----------
test('perfis declaram os limites: clássica 99 linhas/20 fluxos/10 registradores; Platinum 400/30/20', () => {
  const c = getProfile('12c');
  const p = getProfile('12cp');
  assert.deepEqual([c.maxLines, c.maxFlows, c.regCount, c.undo], [99, 20, 10, false]);
  assert.deepEqual([p.maxLines, p.maxFlows, p.regCount, p.undo], [400, 30, 20, true]);
});

// ---------- 400 linhas ----------
function fillLines(e, n) {
  run(e, 'f rs f rdown');
  for (let k = 0; k < n; k++) e.press('plus');
}
test('Platinum: aceita 400 linhas e a 401ª dá Error 4', () => {
  const e = P();
  fillLines(e, 400);
  assert.equal(e.state.pc, 400);
  e.press('plus');
  assert.equal(e.state.display, 'Error 4');
});
test('clássica: continua em 99 linhas (a 100ª dá Error 4)', () => {
  const e = C();
  fillLines(e, 99);
  e.press('plus');
  assert.equal(e.state.display, 'Error 4');
});
test('Platinum: linha do programa aparece com 3 dígitos', () => {
  const e = P();
  run(e, 'f rs f rdown 5');
  assert.match(e.state.display, /^001–/);
  run(e, 'g sst');
  assert.match(e.state.display, /^000–/);
});
test('clássica: linha do programa segue com 2 dígitos', () => {
  const e = C();
  run(e, 'f rs f rdown 5');
  assert.match(e.state.display, /^01–/);
});
test('Platinum: GTO grava 3 dígitos (g GTO 1 2 3 = 43 33 123)', () => {
  const e = P();
  run(e, 'f rs f rdown g rdown 1 2');
  assert.equal(e.state.pc, 0, 'ainda não gravou com 2 dígitos');
  run(e, '3');
  assert.equal(e.state.pc, 1);
  assert.equal(e.state.display, '001–  43, 33 123');
});
test('Platinum: laço com GTO acima da linha 99 funciona na execução', () => {
  const e = P();
  run(e, 'f rs f rdown');
  for (let k = 0; k < 120; k++) e.press('1'); // 120 linhas "1"
  run(e, 'f rs'); // volta ao modo de execução
  assert.equal(e.state.pc, 0);
  run(e, 'g rdown 1 2 0'); // GTO 120 no modo de execução: vai até a linha 120
  assert.equal(e.state.pc, 120);
});
test('Platinum: g MEM não quebra com mais de 99 linhas', () => {
  const e = P();
  fillLines(e, 150);
  run(e, 'f rs g 9');
  assert.match(e.state.display, /^P-\d+ r-\d+$/);
});

// ---------- fluxos de caixa ----------
test('Platinum: CFo + 30 fluxos CFj; o 31º dá Error 6', () => {
  const e = P();
  run(e, '100 chs g pv');
  for (let k = 0; k < 30; k++) run(e, '10 g pmt');
  assert.notEqual(e.state.display, 'Error 6');
  run(e, '10 g pmt');
  assert.equal(e.state.display, 'Error 6');
});
test('clássica: 20 fluxos; o 21º dá Error 6', () => {
  const e = C();
  run(e, '100 chs g pv');
  for (let k = 0; k < 20; k++) run(e, '10 g pmt');
  run(e, '10 g pmt');
  assert.equal(e.state.display, 'Error 6');
});

// ---------- f CLEAR PRGM no modo de execução ----------
function threeLines(e) {
  run(e, 'f rs f rdown 1 2 3 f rs');
}
test('Platinum: f CLEAR PRGM em RUN mantém a linha atual', () => {
  const e = P();
  threeLines(e);
  run(e, 'g rdown 0 0 2 f rdown');
  assert.equal(e.state.pc, 2);
});
test('clássica: f CLEAR PRGM em RUN volta à linha 00', () => {
  const e = C();
  threeLines(e);
  run(e, 'g rdown 0 2 f rdown');
  assert.equal(e.state.pc, 0);
});
test('f CLEAR PRGM em PRGM apaga o programa e vai a 000 nas duas', () => {
  for (const e of [P(), C()]) {
    threeLines(e);
    run(e, 'f rs f rdown');
    assert.equal(e.state.pc, 0);
    assert.equal(e.prog.length, 0);
  }
});

// ---------- f RPN / f ALG gravados em programa ----------
test('Platinum: f RPN e f ALG gravam-se como 42 16 e 42 26', () => {
  const e = P();
  run(e, 'f rs f rdown f chs');
  assert.equal(e.state.display, '001–  42 16');
  run(e, 'f eex');
  assert.equal(e.state.display, '002–  42 26');
});
test('Platinum: programa com f ALG muda o modo ao rodar', () => {
  const e = P();
  run(e, 'f rs f rdown f eex f rs');
  assert.equal(e.state.mode, 'rpn');
  run(e, 'rs');
  assert.equal(e.state.mode, 'alg');
});

// ---------- registradores .0 a .9 ----------
test('Platinum: STO . 5 e RCL . 5 usam o registrador .5 (R15) sem tocar R5', () => {
  const e = P();
  run(e, '7 sto 5 9 sto dot 5 rcl 5');
  assert.equal(e.state.stack.x, 7);
  run(e, 'rcl dot 5');
  assert.equal(e.state.stack.x, 9);
  assert.equal(e.state.regs.length, 20);
  assert.equal(e.state.regs[15], 9);
});
test('Platinum: STO + . 3 faz aritmética no registrador .3', () => {
  const e = P();
  run(e, '10 sto dot 3 5 sto plus dot 3 rcl dot 3');
  assert.equal(e.state.stack.x, 15);
});
test('Platinum: STO . 5 em programa grava 44 48 5 e roda', () => {
  const e = P();
  run(e, 'f rs f rdown sto dot 5');
  assert.equal(e.state.display, '001–  44 48 5');
  run(e, 'f rs 8 rs');
  assert.equal(e.state.regs[15], 8);
});
test('clássica: continua com 10 registradores; STO . é ignorado', () => {
  const e = C();
  assert.equal(e.state.regs.length, 10);
  run(e, '4 sto dot 5');
  assert.equal(e.state.regs[5], 0);
});
test('Platinum: estado salvo com 10 registradores (V3.0) abre com 20', () => {
  const old = P();
  const o = JSON.parse(old.serialize());
  o.regs = o.regs.slice(0, 10);
  const e = Engine.restore(JSON.stringify(o));
  assert.equal(e.state.regs.length, 20);
});

// ---------- Backspace e Undo ----------
test('Platinum: g ← apaga o último dígito digitado', () => {
  const e = P();
  run(e, '1 2 3 4');
  gKey(e, 'minus');
  assert.equal(e.state.display, '123');
  gKey(e, 'minus');
  gKey(e, 'minus');
  assert.equal(e.state.display, '1');
});
test('Platinum: g ← fora da digitação zera X (como CLx)', () => {
  const e = P();
  run(e, '5 enter 7 enter');
  gKey(e, 'minus');
  assert.equal(e.state.stack.x, 0);
});
test('Platinum: CLx liga o indicador Undo e g Undo recupera X', () => {
  const e = P();
  run(e, '42 enter clx');
  assert.equal(e.state.undo, true);
  assert.equal(e.state.stack.x, 0);
  gKey(e, 'divide');
  assert.equal(e.state.stack.x, 42);
  assert.equal(e.state.undo, false);
});
test('Platinum: outra tecla depois de CLx apaga a chance de desfazer', () => {
  const e = P();
  run(e, '42 enter clx 3');
  assert.equal(e.state.undo, false);
  gKey(e, 'divide');
  assert.equal(e.state.stack.x, 3);
});
test('Platinum: f e g sozinhos não desligam o Undo', () => {
  const e = P();
  run(e, '42 enter clx f g');
  assert.equal(e.state.undo, true);
});
test('Platinum: f CLEAR REG, CLEAR Σ e CLEAR FIN também podem ser desfeitos', () => {
  let e = P();
  run(e, '9 sto 1 f clx');
  assert.equal(e.state.regs[1], 0);
  assert.equal(e.state.undo, true);
  gKey(e, 'divide');
  assert.equal(e.state.regs[1], 9);

  e = P();
  run(e, '12 i f xy');
  assert.equal(e.state.fin.i, 0);
  gKey(e, 'divide');
  assert.equal(e.state.fin.i, 12);

  e = P();
  run(e, '3 enter 4 sigma f sst');
  assert.equal(e.state.regs[1], 0);
  gKey(e, 'divide');
  assert.equal(e.state.regs[1], 1); // n = 1 depois de um Σ+
});
test('Platinum: g Undo sem nada a desfazer não faz nada', () => {
  const e = P();
  run(e, '7 enter 8');
  gKey(e, 'divide');
  assert.equal(e.state.stack.x, 8);
  assert.equal(e.state.stack.y, 7);
});
test('Platinum: Undo não volta uma operação aritmética', () => {
  const e = P();
  run(e, '5 enter 3 plus');
  gKey(e, 'divide');
  assert.equal(e.state.stack.x, 8);
});
test('Platinum: Undo funciona também no modo ALG', () => {
  const e = P();
  run(e, 'f eex 42 clx');
  gKey(e, 'divide');
  assert.equal(e.state.stack.x, 42);
});
test('clássica: g ÷ e g − não fazem nada e não há Undo', () => {
  const e = C();
  run(e, '42 enter clx');
  assert.equal(e.state.undo, false);
  gKey(e, 'divide');
  assert.equal(e.state.stack.x, 0);
});
test('Platinum: em PRGM, g ← e g Undo não gravam linha', () => {
  const e = P();
  run(e, 'f rs f rdown g minus g divide');
  assert.equal(e.prog.length, 0);
});
