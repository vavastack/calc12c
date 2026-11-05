import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { KEY_BY_ID } from '../../src/engine/keymap.js';
import { VERSO, fullKeys } from '../../src/ui/verso-data.js';
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
  'alg-soma|Soma': '44,90',
  'alg-cadeia|Cadeia': '737,07',
  'alg-cadeia|Sem hierarquia · 1 + 2 × 3': '9,00',
  'alg-paren|Sem parênteses': '0,60',
  'alg-paren|Com parênteses': '2,00',
  'alg-pct|25% de 200': '50,00',
  'alg-pct|200 reduzido em 25%': '150,00',
  'alg-delta|Δ%': '-11,97',
  'prog-dobro|Gravar': '0,00',
  'prog-dobro|Rodar com 5': '10,00',
  'prog-dobro|Linha 1 (SST)': '2',
  'prog-dobro|Linhas 1 e 2 (SST)': '10,00',
  'prog-custo|Gravar': '0,00',
  'prog-custo|Rodar com 625': '473,75',
  'prog-custo|Rodar com 159': '124,25',
  'prog-media|Gravar': '0,00',
  'prog-media|Rodar com 8 e 6': '7,00',
  'prog-fin|Gravar': '0,00',
  'prog-fin|Rodar com 1000': '-88,85',
  'prog-soma|Gravar': '0,00',
  'prog-soma|Rodar com 5': '15,00',
  'prog-soma|Rodar com 100': '5.050,00',
};

test('verso: todo exemplo pronto dá o resultado esperado, e só os prontos estão na tabela', () => {
  const vistos = new Set();
  for (const g of VERSO) {
    for (const it of g.items) {
      for (const v of it.variants) {
        if (!it.ready) continue;
        const chave = `${it.id}|${v.label}`;
        assert.ok(chave in ESPERADO, `exemplo sem resultado esperado: ${chave}`);
        assert.equal(run(fullKeys(it, v)), ESPERADO[chave], chave);
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
        for (const id of expandKeys(fullKeys(it, v))) assert.ok(KEY_BY_ID.has(id), `${it.id}: tecla desconhecida "${id}"`);
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

test('lições de programação: o laço soma 1..n para vários n e o programa roda de novo sem regravar', () => {
  const rec = VERSO.find((g) => g.id === 'prog').items.find((i) => i.id === 'prog-soma').variants[0].keys;
  const e = new Engine();
  for (const id of expandKeys(rec)) e.press(id);
  for (const n of [1, 2, 10, 37, 100]) {
    for (const id of expandKeys(`${n} rs`)) e.press(id);
    assert.equal(e.state.stack.x, (n * (n + 1)) / 2, `n=${n}`);
  }
});

test('lições de programação: a listagem do exemplo tem uma linha por linha gravada', () => {
  for (const it of VERSO.find((g) => g.id === 'prog').items) {
    const e = new Engine();
    for (const id of expandKeys(it.variants[0].keys)) e.press(id);
    assert.equal(e.prog.filter(Boolean).length, it.listing.length, it.id);
  }
});
