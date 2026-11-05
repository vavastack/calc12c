import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { buildMemoryFile, parseMemoryFile, loadInto, MEM_KIND } from '../../src/ui/memories.js';

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
const cheio = () => run(new Engine({ locale: 'br' }), 'f clx 12 n 1 i 1000 pv pmt 42 sto 3 10 i -1000 g pv 400 g pmt 500 g pmt f rs f rdown enter 2 5 pct minus f rs');
const NOW = new Date('2026-11-05T12:00:00Z');

test('o nome do arquivo leva a data e o conteúdo é um JSON identificável', () => {
  const { name, text } = buildMemoryFile(cheio(), NOW);
  assert.equal(name, 'calc12c-memorias-2026-11-05.json');
  const o = JSON.parse(text);
  assert.equal(o.tipo, MEM_KIND);
  assert.equal(o.versao, 1);
  assert.equal(o.criado, NOW.toISOString());
});

test('ida e volta: registradores, financeiros, fluxos, programa e fita voltam iguais', () => {
  const a = cheio();
  const b = parseMemoryFile(buildMemoryFile(a, NOW).text);
  assert.deepEqual(b.state.regs, a.state.regs);
  assert.deepEqual(b.state.fin, a.state.fin);
  assert.deepEqual(b.cf.toJSON(), a.cf.toJSON());
  assert.deepEqual(b.prog, a.prog);
  assert.deepEqual(b.state.tape, a.state.tape);
  run(b, 'f pv'); // o NPV usa os fluxos restaurados
  run(a, 'f pv');
  assert.equal(b.state.stack.x, a.state.stack.x);
  run(b, '100 rs'); // o programa restaurado roda
  assert.equal(b.state.display, '75,00'); // 100 − 25%
});

test('o arquivo não leva prefixo f/g, STO/RCL pendente nem erro', () => {
  const e = run(cheio(), 'f');
  const o = JSON.parse(buildMemoryFile(e, NOW).text);
  assert.equal(o.estado.shift, null);
  assert.equal(o.estado.pending, null);
  assert.equal(o.estado.error, null);
});

test('loadInto troca o estado do motor em uso sem trocar o objeto', () => {
  const alvo = new Engine();
  const ref = alvo;
  loadInto(alvo, parseMemoryFile(buildMemoryFile(cheio(), NOW).text));
  assert.equal(alvo, ref);
  assert.equal(alvo.state.regs[3], 42);
  assert.equal(alvo.state.fin.n, 12);
});

test('arquivos inválidos são recusados com mensagem em português', () => {
  const casos = [
    ['', /JSON/], ['{', /JSON/], ['[]', /não é de memórias/], ['{"tipo":"outra-coisa","estado":{}}', /não é de memórias/],
    [JSON.stringify({ tipo: MEM_KIND, estado: { v: 99 } }), /inválido|versão/],
    [JSON.stringify({ tipo: MEM_KIND }), /não é de memórias/],
    ['x'.repeat(2000001), /grande demais/],
  ];
  for (const [txt, re] of casos) assert.throws(() => parseMemoryFile(txt), re, txt.slice(0, 30));
  assert.throws(() => parseMemoryFile(null), /ilegível/);
});

test('um estado adulterado (registrador não numérico) é recusado', () => {
  const o = JSON.parse(buildMemoryFile(cheio(), NOW).text);
  o.estado.regs[0] = 'abc';
  assert.throws(() => parseMemoryFile(JSON.stringify(o)), /inválido/);
});
