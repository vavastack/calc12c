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

test('D.MY e M.DY ligam/desligam o indicador de formato', () => {
  const e = run(new Engine(), 'g 4');
  assert.equal(e.state.dmy, true);
  run(e, 'g 5');
  assert.equal(e.state.dmy, false);
});

test('manual p.31: 14/05/2004 + 120 dias = 11/09/2004, sábado (6), formato dia-mês-ano', () => {
  const e = run(new Engine(), 'g 4 14.052004 enter 120 g chs');
  assert.equal(e.state.display, '11,09,2004 6');
  run(e, 'f 6');
  assert.equal(e.state.display.startsWith('11,09,2004'), false); // o resultado especial some na próxima tecla
});

test('manual p.31-32: de 3/6/2004 a 14/10/2005 = 498 dias exatos e 491 no ano comercial', () => {
  const e = run(new Engine(), 'g 5 6.032004 enter 10.142005 g eex');
  assert.equal(e.state.display, '498,00');
  run(e, 'xy');
  assert.equal(e.state.display, '491,00');
  run(e, 'xy');
  assert.equal(e.state.display, '498,00');
});

test('datas anteriores (dias negativos), ano bissexto e dia da semana', () => {
  const a = run(new Engine(), 'g 5 3.012004 enter 1 chs g chs'); // 1/3/2004 − 1 dia = 29/02/2004 (domingo)
  assert.equal(a.state.display, '02,29,2004 7');
  const b = run(new Engine(), 'g 5 12.311999 enter 1 g chs'); // 31/12/1999 + 1 = 01/01/2000 (sábado)
  assert.equal(b.state.display, '01,01,2000 6');
});

test('data inválida ou fora do intervalo dá Erro 8', () => {
  for (const seq of ['g 5 2.302004 enter 1 g chs', 'g 5 13.012004 enter 1 g chs', 'g 5 1.011500 enter 1 g chs', 'g 5 1.012004 enter 1 g eex']) {
    const e = run(new Engine(), seq);
    assert.equal(e.state.error?.code, 8, seq);
  }
});

test('formato dia-mês-ano é salvo e restaurado', () => {
  const e = run(new Engine(), 'g 4');
  assert.equal(Engine.restore(e.serialize()).state.dmy, true);
});
