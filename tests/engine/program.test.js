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
const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);

// Programa do manual p.90: custo líquido = preço − 25% + R$5 de envio.
const CUSTO = 'f rs f rdown enter 2 5 pct minus 5 plus f rs';

test('manual p.90-92: programa do custo líquido: R$625 → 473,75 e R$159 → 124,25', () => {
  const e = run(new Engine(), CUSTO);
  assert.equal(e.state.prgm, false);
  run(e, '625 rs');
  assert.equal(e.state.display, '473,75');
  run(e, '159 rs');
  assert.equal(e.state.display, '124,25');
});

test('manual p.90-94: modo de programação mostra linha e códigos de tecla (36, 2, 5, 25, 30, 5, 40)', () => {
  const e = run(new Engine(), 'f rs f rdown');
  assert.equal(e.state.prgm, true);
  assert.equal(e.state.display, '00–');
  const esperado = [['enter', '01–  36'], ['2', '02–  2'], ['5', '03–  5'], ['pct', '04–  25'], ['minus', '05–  30'], ['5', '06–  5'], ['plus', '07–  40']];
  for (const [k, txt] of esperado) {
    run(e, k);
    assert.equal(e.state.display, txt);
  }
  // nada foi executado no modo de programação
  assert.equal(e.state.stack.x, 0);
  run(e, 'g sst');
  assert.equal(e.state.display, '06–  5');
  run(e, 'sst sst');
  assert.equal(e.state.display, '08–  43, 33 00'); // linha vazia = GTO 00
});

test('manual p.93-94: instruções com prefixo ocupam uma linha: g x≷y... STO 1, STO + 1, GTO 02', () => {
  const e = run(new Engine(), 'f rs f rdown sto 1 sto plus 1 g rs g rdown 0 2');
  const textos = [];
  for (let n = 0; n < 4; n++) {
    run(e, n === 0 ? 'g sst g sst g sst g sst' : '');
  }
  run(e, 'g sst g sst g sst g sst'); // volta ao começo
  run(e, 'sst');
  textos.push(e.state.display);
  run(e, 'sst');
  textos.push(e.state.display);
  run(e, 'sst');
  textos.push(e.state.display);
  run(e, 'sst');
  textos.push(e.state.display);
  assert.deepEqual(textos, ['01–  44 1', '02–  44 40 1', '03–  43 31', '04–  43, 33 02']);
});

test('manual p.101-103: fatura com PSE e STO+ : 13×68,5 → 890,50 / 60,11 / 950,61 e somas das colunas', () => {
  const e = new Engine();
  run(e, 'f rs f rdown times g rs sto plus 1 rcl 0 pct g rs sto plus 2 plus sto plus 3 f rs');
  run(e, 'f sst 6.75 sto 0');
  run(e, '13 enter 68.5 rs');
  assert.equal(e.state.display, '950,61');
  assert.deepEqual(e.takePauses(), ['890,50', '60,11']);
  run(e, '18 enter 72.9 rs');
  assert.equal(e.state.display, '1.400,77');
  run(e, '24 enter 85 rs');
  assert.equal(e.state.display, '2.177,70');
  run(e, '5 enter 345 rs');
  assert.equal(e.state.display, '1.841,44');
  run(e, 'rcl 1');
  assert.equal(e.state.display, '5.967,70');
  run(e, 'rcl 2');
  assert.equal(e.state.display, '402,82');
  run(e, 'rcl 3');
  assert.equal(e.state.display, '6.370,52');
});

test('R/S dentro do programa para a execução e R/S de novo continua na linha seguinte', () => {
  const e = run(new Engine(), 'f rs f rdown 1 rs 2 plus f rs');
  run(e, 'rs');
  assert.equal(e.state.display, '1');
  run(e, 'rs');
  assert.equal(e.state.display, '3,00');
});

test('desvios e testes: ciclo GTO com x≤y soma até R1 chegar a 5', () => {
  const e = new Engine();
  // 01 RCL 1 · 02 1 · 03 + · 04 STO 1 · 05 5 · 06 g x≤y · 07 GTO 00 · 08 GTO 01
  run(e, 'f rs f rdown rcl 1 1 plus sto 1 5 g xy g rdown 0 0 g rdown 0 1 f rs rs');
  assert.equal(e.state.regs[1], 5);
  assert.equal(e.state.pc, 0);
});

test('x=0 pula a próxima linha quando X ≠ 0 e executa quando X = 0', () => {
  const um = run(new Engine(), 'f rs f rdown g clx 9 f rs 4 rs');
  assert.equal(um.state.stack.x, 4); // X=4≠0: pulou o "9"
  const dois = run(new Engine(), 'f rs f rdown g clx 9 f rs 0 rs');
  assert.equal(dois.state.stack.x, 9); // X=0: executou o "9"
});

test('GTO nn no modo de execução move a linha atual; f CLEAR PRGM no modo de execução volta à linha 00', () => {
  const e = run(new Engine(), CUSTO);
  run(e, 'g rdown 0 4');
  assert.equal(e.state.pc, 4);
  run(e, 'f rdown');
  assert.equal(e.state.pc, 0);
});

test('programa com mais de 99 linhas dá Erro 4; f CLEAR PRGM apaga o programa', () => {
  const e = run(new Engine(), 'f rs f rdown');
  for (let n = 0; n < 99; n++) run(e, '1');
  assert.equal(e.state.error, null);
  run(e, '1');
  assert.equal(e.state.error.code, 4);
  run(e, 'sst f rdown');
  assert.equal(e.state.pc, 0);
});

test('g MEM mostra linhas e registradores; o programa é salvo e restaurado', () => {
  const e = run(new Engine(), CUSTO);
  run(e, 'g 9');
  assert.equal(e.state.display, 'P-08 r-20');
  const r = Engine.restore(e.serialize());
  run(r, '625 rs');
  assert.equal(r.state.display, '473,75');
});

test('estado antigo (sem programa) ainda restaura', () => {
  const j = JSON.parse(new Engine().serialize());
  delete j.prog; delete j.prgm; delete j.pc;
  assert.equal(Engine.restore(JSON.stringify(j)).state.prgm, false);
});

test('STO + − × ÷ n com o registrador', () => {
  const e = run(new Engine(), '10 sto 1 3 sto plus 1 2 sto times 1 4 sto minus 1 5 sto divide 1');
  assert.equal(e.state.regs[1], 4.4); // ((10+3)×2 − 4) ÷ 5
});
