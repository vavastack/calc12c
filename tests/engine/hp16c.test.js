import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, restoreEngine } from '../../src/engine/engines.js';
import { getProfile } from '../../src/engine/profiles.js';

const E = () => createEngine({ profile: '16c' });
// Teclas: dígitos 0-9 e A-F (da..df) como caracteres; o resto, por id.
function run(e, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    if (/^[0-9A-F]+$/.test(tok)) for (const c of tok) e.press(/[0-9]/.test(c) ? c : 'd' + c.toLowerCase());
    else e.press(tok);
  }
  return e;
}
const disp = (e) => e.state.display;

test('perfil 16c: motor de inteiros, só RPN, indicadores próprios', () => {
  const p = getProfile('16c');
  assert.equal(p.kind, 'int');
  assert.deepEqual(p.modes, ['rpn']);
  assert.ok(p.indicators.includes('G') && p.indicators.includes('C'));
  assert.equal(createEngine({ profile: '12c' }).constructor.name, 'Engine');
});

test('liga em decimal, 16 bits, complemento de 2', () => {
  const e = E();
  assert.equal(disp(e), '0 d');
  run(e, 'f dot'); // STATUS
  assert.equal(disp(e), '2-16-0000');
  run(e, '5');
  assert.equal(disp(e), '5 d');
});

test('bases: 255 em decimal vira FF h, 377 o e 11111111 b', () => {
  const e = run(E(), '255 hex');
  assert.equal(disp(e), 'FF h');
  run(e, 'oct');
  assert.equal(disp(e), '377 o');
  run(e, 'bin');
  assert.equal(disp(e), '11111111 b');
  run(e, 'dec');
  assert.equal(disp(e), '255 d');
});

test('entrada: dígito fora da base é ignorado e A-F valem em HEX', () => {
  const e = run(E(), 'hex A F 9');
  assert.equal(disp(e), 'AF9 h');
  const b = run(E(), 'bin 1 0 2 1');
  assert.equal(disp(b), '101 b'); // o 2 foi ignorado
});

test('SHOW (f + base) mostra X noutra base só enquanto a próxima tecla não vem', () => {
  const e = run(E(), '255 f hex');
  assert.equal(disp(e), 'FF h');
  run(e, '1');
  assert.equal(disp(e), '1 d');
});

test('CHS: 50 vira −50; em HEX mostra o complemento (CE h com 8 bits)', () => {
  const f = run(E(), '8 f sto'); // WSIZE 8
  run(f, '50 chs');
  assert.equal(disp(f), '-50 d');
  run(f, 'hex');
  assert.equal(disp(f), 'CE h');
  run(f, 'dec f 1'); // 1's complement
  assert.equal(disp(f), '-49 d');
  run(f, 'f 3'); // UNSGN
  assert.equal(disp(f), '206 d');
  run(f, 'f 2');
  assert.equal(disp(f), '-50 d');
});

test('WSIZE: 0 = 64 bits; acima de 64 dá erro; o número é truncado', () => {
  const e = run(E(), '255 enter 4 f sto');
  assert.equal(e.state.ws, 4);
  assert.equal(e.state.stack.y, '15'); // 255 cortado a 4 bits (cru, em decimal)
  const z = run(E(), '0 f sto');
  assert.equal(z.state.ws, 64);
  const w = run(E(), '65 f sto');
  assert.equal(disp(w), 'Error 3');
});

test('manual p.41: 32767 × 2 em 16 bits dá 32766 com G', () => {
  const e = run(E(), '32767 enter 2 times');
  assert.equal(disp(e), '32766 d');
  assert.equal(e.state.oor, true);
  run(e, 'g 5 5'); // CF 5
  assert.equal(e.state.oor, false);
});

test('manual p.44: 66 ÷ 7 (hex) = E com C; E ÷ 2 = 7 sem C', () => {
  const e = run(E(), 'hex 66 enter 7 divide');
  assert.equal(disp(e), 'E h');
  assert.equal(e.state.carry, true);
  run(e, '2 divide');
  assert.equal(disp(e), '7 h');
  assert.equal(e.state.carry, false);
});

test('divisão por zero dá Error 0 e a divisão trunca para zero', () => {
  const e = run(E(), '5 enter 0 divide');
  assert.equal(disp(e), 'Error 0');
  const f = run(E(), '7 chs enter 2 divide');
  assert.equal(disp(f), '-3 d');
});

test('soma e subtração: carry, borrow e estouro em 8 bits', () => {
  const e = run(E(), '8 f sto'); // WSIZE 8
  run(e, 'hex FF enter 1 plus');
  assert.equal(disp(e), '0 h');
  assert.equal(e.state.carry, true); // vai-um
  run(e, '0 enter 1 minus');
  assert.equal(disp(e), 'FF h');
  assert.equal(e.state.carry, true); // empréstimo
  run(e, 'dec 127 enter 1 plus');
  assert.equal(disp(e), '-128 d');
  assert.equal(e.state.oor, true); // estouro no complemento de 2
});

test('complemento de 1: a soma devolve o vai-um ao bit 0', () => {
  const e = run(E(), '8 f sto');
  run(e, 'f 1 hex FE enter 3 plus'); // 1's: FE = −1, 3 → 2
  assert.equal(disp(e), '2 h');
});

test('lógicas: AND, OR, XOR e NOT', () => {
  const a = run(E(), 'hex F0 enter 3C f times');
  assert.equal(disp(a), '30 h');
  const o = run(E(), 'hex F0 enter 3C f plus');
  assert.equal(disp(o), 'FC h');
  const x = run(E(), 'hex F0 enter 3C f divide');
  assert.equal(disp(x), 'CC h');
  const n = run(E(), 'hex 8 f sto F0 f minus');
  assert.equal(disp(n), 'F h');
});

test('deslocamentos e rotações com o bit de carry', () => {
  const e = run(E(), '8 f sto hex 81 f da'); // SL
  assert.equal(disp(e), '2 h');
  assert.equal(e.state.carry, true);
  run(e, 'f db'); // SR
  assert.equal(disp(e), '1 h');
  assert.equal(e.state.carry, false);
  const r = run(E(), '8 f sto hex 81 f dc'); // RL
  assert.equal(disp(r), '3 h');
  run(r, 'f dd'); // RR
  assert.equal(disp(r), '81 h');
  const c = run(E(), '8 f sto hex 80 f dc g dc'); // RL (C = 1, X = 1) e RLC (entra o C)
  assert.equal(disp(c), '3 h');
  assert.equal(c.state.carry, false);
});

test('RLn e RRn giram Y pelas X posições', () => {
  const e = run(E(), '8 f sto hex 81 enter 4 f de'); // RLn
  assert.equal(disp(e), '18 h');
  run(e, 'enter 4 f df');
  assert.equal(disp(e), '81 h');
});

test('MASKL, MASKR, #B, LJ', () => {
  let e = run(E(), '8 f sto hex 3 f 7');
  assert.equal(disp(e), 'E0 h');
  e = run(E(), '8 f sto hex 3 f 8');
  assert.equal(disp(e), '7 h');
  e = run(E(), 'hex F0F g 7');
  assert.equal(disp(e), '8 h');
  e = run(E(), '16 f sto hex 2000 g da');
  assert.equal(disp(e), '2 h');
  assert.equal(e.state.stack.y, String(0x8000));
});

test('SB, CB, B? e SF/CF', () => {
  let e = run(E(), 'hex 0 f 4 3');
  assert.equal(disp(e), '8 h');
  e = run(e, 'f 5 3');
  assert.equal(disp(e), '0 h');
  e = run(E(), 'g 4 3');
  assert.equal(e.state.flags[3], true);
  run(e, 'f dot');
  assert.equal(disp(e), '2-16-1000');
});

test('RMD, ABS, √x e 1/x', () => {
  let e = run(E(), '17 enter 5 f 9');
  assert.equal(disp(e), '2 d');
  e = run(E(), '5 chs g 8');
  assert.equal(disp(e), '5 d');
  e = run(E(), '17 g oct');
  assert.equal(disp(e), '4 d');
  assert.equal(e.state.carry, true); // não é quadrado perfeito
});

test('pilha: ENTER, x≷y, R↓, LSTx e BSP', () => {
  const e = run(E(), '1 enter 2 enter 3');
  run(e, 'xy');
  assert.equal(disp(e), '2 d');
  run(e, 'rdown');
  assert.equal(disp(e), '3 d');
  run(e, 'plus');
  run(e, 'g enter'); // LSTx
  assert.equal(disp(e), '3 d');
  const b = run(E(), '1 2 3 bsp');
  assert.equal(disp(b), '12 d');
});

test('janelas: HEX de 64 bits mostra 8 dígitos por janela', () => {
  const e = run(E(), '0 f sto hex 123456789 ABCDEF');
  assert.equal(disp(e), '789ABCDEF h'.slice(1)); // enquanto digita, mostra o fim (janela 0)
  run(e, 'enter');
  assert.equal(disp(e), '89ABCDEF h');
  run(e, 'f enter 1'); // WINDOW 1
  assert.equal(disp(e), '1234567 h');
  run(e, 'g sto'); // < : janela para a esquerda (mais significativa); já é a última
  assert.equal(disp(e), '1234567 h');
  run(e, 'g rcl'); // > : volta para a direita
  assert.equal(disp(e), '89ABCDEF h');
});

test('registradores: STO e RCL com 0-9 e A-F', () => {
  const e = run(E(), '42 sto 5 7 sto dd rcl 5');
  assert.equal(disp(e), '42 d');
  run(e, 'rcl dd');
  assert.equal(disp(e), '7 d');
});

test('serializar e restaurar preserva tudo, inclusive 64 bits', () => {
  const e = run(E(), '0 f sto hex FFFFFFFFFFFFFFFF');
  run(e, 'enter 1 plus');
  const r = restoreEngine(e.serialize());
  assert.equal(r.constructor.name, 'Engine16');
  assert.equal(r.state.display, e.state.display);
  assert.equal(r.state.ws, 64);
  assert.equal(r.state.carry, true);
});

test('64 bits em decimal sem sinal: 2^64 − 1', () => {
  const e = run(E(), '0 f sto f 3 hex FFFFFFFFFFFFFFFF dec');
  assert.equal(e.state.stack.x, '18446744073709551615');
});
