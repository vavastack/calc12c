import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { KEY_BY_ID } from '../../src/engine/keymap.js';
import { VERSO } from '../../src/ui/verso-data.js';
import { chipsOf, expandKeys } from '../../src/ui/verso.js';

const run = (keys) => {
  const e = new Engine();
  for (const id of expandKeys(keys)) e.press(id);
  return e.state.display;
};

// Resultados desta calculadora para os exemplos do verso da HP 12C (conferir com a HP real)
const ESPERADO = {
  'date-add|D.MY': '28,09,2003 7',
  'date-add|M.DY': '09,28,2003 7',
  'date-diff|D.MY · dias exatos': '499,00',
  'date-diff|D.MY · base 360': '492,00',
  'date-diff|M.DY · dias exatos': '499,00',
  'date-diff|M.DY · base 360': '492,00',
  'int-simple|Juros (360)': '2,63',
  'int-simple|Principal + juros (360)': '452,63',
  'int-simple|Juros (365)': '2,59',
  'int-simple|Principal + juros (365)': '452,59',
  'amort-1|Prestação': '-276,10',
  'amort-1|Juros pagos': '-2.608,19',
  'amort-1|Principal pago': '-705,01',
  'amort-1|Saldo devedor': '49.294,99',
  'bond-price|D.MY · preço': '91,01',
  'bond-price|D.MY · juros acumulados': '2,15',
  'bond-price|M.DY · preço': '91,01',
  'bond-ytm|D.MY': '4,86',
  'depr-1|Linha reta': '1.900,00',
  'depr-1|Soma dos dígitos': '3.166,67',
  'depr-1|Saldo decrescente': '2.500,00',
};

test('verso: todo exemplo pronto dá o resultado esperado, e só os prontos estão na tabela', () => {
  const vistos = new Set();
  for (const g of VERSO) {
    for (const it of g.items) {
      for (const v of it.variants) {
        if (!it.ready) continue;
        const chave = `${it.id}|${v.label}`;
        assert.ok(chave in ESPERADO, `exemplo sem resultado esperado: ${chave}`);
        assert.equal(run(v.keys), ESPERADO[chave], chave);
        vistos.add(chave);
      }
    }
  }
  assert.deepEqual([...vistos].sort(), Object.keys(ESPERADO).sort());
});

test('verso: toda tecla citada existe, inclusive nos exemplos "em breve"', () => {
  for (const g of VERSO) {
    for (const it of g.items) {
      for (const v of it.variants) {
        for (const id of expandKeys(v.keys)) assert.ok(KEY_BY_ID.has(id), `${it.id}: tecla desconhecida "${id}"`);
      }
    }
  }
});

test('verso: f/g e a tecla viram um chip só; dígito sozinho depois de g é tecla (g 4 = D.MY)', () => {
  assert.deepEqual(chipsOf('g 4 31.052003 enter 120 g chs').map((c) => c.text), ['g D.MY', '31,052003', 'ENTER', '120', 'g DATE']);
  assert.deepEqual(chipsOf('f xy 30 n 7 i 450 chs pv f i').map((c) => c.text), ['f CLEAR FIN', '30', 'n', '7', 'i', '450', 'CHS', 'PV', 'f INT']);
});

test('expandKeys: número vira dígitos e "." vira a tecla da vírgula', () => {
  assert.deepEqual(expandKeys('31.05 enter'), ['3', '1', 'dot', '0', '5', 'enter']);
});
