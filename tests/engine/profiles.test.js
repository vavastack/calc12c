import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../src/engine/engine.js';
import { getProfile, listProfiles, registerProfile, DEFAULT_PROFILE, allowedThemes, themeFor } from '../../src/engine/profiles.js';
import { KEYS, KEYS_PLATINUM } from '../../src/engine/keymap.js';
import { buildMemoryFile, parseMemoryFile } from '../../src/ui/memories.js';

// armazenamento falso para storage.js
const mem = new Map();
globalThis.window = { localStorage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } };
const { saveState, loadState, clearAll, loadActiveProfile, saveActiveProfile, stateKey } = await import('../../src/ui/storage.js');

registerProfile({ ...getProfile('12c'), id: 'teste', name: 'Calc teste', model: 'TESTE' });
beforeEach(() => mem.clear());

const type = (e, seq) => seq.split(/\s+/).forEach((t) => [...t].forEach((c) => e.press(c === '.' ? 'dot' : c)) );

test('o perfil 12c (clássica) é o padrão: RPN só, 7 indicadores, teclas sem os rótulos da Platinum', () => {
  const p = getProfile(DEFAULT_PROFILE);
  assert.equal(p.id, '12c');
  assert.equal(p.name, 'Calc 12c');
  assert.equal(p.keys, KEYS);
  assert.equal(p.keys.length, 39);
  assert.deepEqual(p.modes, ['rpn']);
  assert.deepEqual(p.indicators, ['f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM']);
  assert.equal(p.keyById.get('chs').f, null);
  assert.equal(p.keyById.get('sto').g, null);
  assert.equal(p.title, undefined);
});

test('o perfil 12cp (Platinum): RPN e ALG, 11 indicadores, rótulos f RPN/ALG e g ( ), título em duas linhas', () => {
  const p = getProfile('12cp');
  assert.equal(p.keys, KEYS_PLATINUM);
  assert.equal(p.keys.length, 39);
  assert.deepEqual(p.modes, ['rpn', 'alg']);
  assert.deepEqual(p.indicators, ['RPN', 'ALG', '( )', 'UNDO', 'f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM']);
  assert.equal(p.keyById.get('chs').f, 'RPN');
  assert.equal(p.keyById.get('eex').f, 'ALG');
  assert.equal(p.keyById.get('sto').g, '(');
  assert.equal(p.keyById.get('rcl').g, ')');
  assert.deepEqual(p.title, ['Platinum', '12c']);
  assert.deepEqual(KEYS.map((k) => k.id), KEYS_PLATINUM.map((k) => k.id)); // mesmas teclas, só os rótulos mudam
});

test('temas por perfil: Gold na clássica, Platinum na Platinum, Retro nos dois; o modo desenvolvedor libera tudo', () => {
  assert.deepEqual(allowedThemes('12c', false), ['retro', 'moderno']);
  assert.deepEqual(allowedThemes('12cp', false), ['platinum', 'moderno']);
  assert.deepEqual(allowedThemes('12c', true), ['retro', 'platinum', 'moderno']);
  assert.deepEqual(allowedThemes('12cp', true), ['retro', 'platinum', 'moderno']);
  assert.equal(getProfile('12c').defaultTheme, 'retro');
  assert.equal(getProfile('12cp').defaultTheme, 'platinum');
  // a escolha vale se for permitida; senão volta ao tema padrão do perfil
  assert.equal(themeFor('12c', 'platinum', false), 'retro');
  assert.equal(themeFor('12cp', 'retro', false), 'platinum');
  assert.equal(themeFor('12cp', 'moderno', false), 'moderno');
  assert.equal(themeFor('12c', 'platinum', true), 'platinum');
  assert.equal(themeFor('12cp', 'retro', true), 'retro');
});

test('perfis desconhecidos são recusados; a lista traz os registrados', () => {
  assert.throws(() => getProfile('xyz'), /perfil desconhecido/);
  assert.deepEqual(listProfiles().map((p) => p.id), ['12c', '12cp', '16c', 'teste']);
});

test('o motor guarda o perfil, mantém no reset e restaura da serialização', () => {
  const e = new Engine({ profile: 'teste' });
  assert.equal(e.profile, 'teste');
  e.reset();
  assert.equal(e.profile, 'teste');
  assert.equal(Engine.restore(e.serialize()).profile, 'teste');
  assert.equal(new Engine().profile, '12c');
});

test('reset mantém o modo ALG', () => {
  const e = new Engine({ profile: '12cp' });
  e.press('f');
  e.press('eex');
  e.reset();
  assert.equal(e.state.mode, 'alg');
});

test('estado salvo sem perfil (versões anteriores) abre como 12c; perfil inexistente é recusado', () => {
  const o = JSON.parse(new Engine().serialize());
  delete o.profile;
  assert.equal(Engine.restore(JSON.stringify(o)).profile, '12c');
  o.profile = 'xyz';
  assert.throws(() => Engine.restore(JSON.stringify(o)), /inválido/);
});

test('armazenamento separado por perfil: o 12c mantém a chave antiga', () => {
  assert.equal(stateKey('12c'), 'calc12c.state');
  assert.equal(stateKey('teste'), 'calc12c.state.teste');
  const a = new Engine();
  type(a, '42');
  const b = new Engine({ profile: 'teste' });
  type(b, '7');
  saveState(a);
  saveState(b);
  assert.equal(loadState('12c').state.stack.x, 42);
  assert.equal(loadState('teste').state.stack.x, 7);
  assert.equal(loadState('teste').profile, 'teste');
  clearAll('teste');
  assert.equal(loadState('teste').state.stack.x, 0);
  assert.equal(loadState('12c').state.stack.x, 42);
});

test('perfil ativo: padrão 12c, grava e ignora valor inválido', () => {
  assert.equal(loadActiveProfile(), '12c');
  saveActiveProfile('teste');
  assert.equal(loadActiveProfile(), 'teste');
  assert.equal(loadState().profile, 'teste'); // sem argumento carrega o perfil ativo
  mem.set('calc12c.profile', 'xyz');
  assert.equal(loadActiveProfile(), '12c');
});

test('arquivo de memórias novo leva o perfil e a versão 2', () => {
  const o = JSON.parse(buildMemoryFile(new Engine({ profile: 'teste' })).text);
  assert.equal(o.versao, 2);
  assert.equal(o.perfil, 'teste');
  assert.equal(parseMemoryFile(JSON.stringify(o)).profile, 'teste');
});

test('arquivo de memórias antigo (versão 1, sem perfil) abre como 12c', () => {
  const o = JSON.parse(buildMemoryFile(new Engine()).text);
  o.versao = 1;
  delete o.perfil;
  delete o.estado.profile;
  delete o.estado.mode;
  delete o.estado.alg;
  const e = parseMemoryFile(JSON.stringify(o));
  assert.equal(e.profile, '12c');
  assert.equal(e.state.mode, 'rpn');
});

test('arquivo com perfil desconhecido é recusado com mensagem em português', () => {
  const o = JSON.parse(buildMemoryFile(new Engine()).text);
  o.perfil = 'xyz';
  o.estado.profile = 'xyz';
  assert.throws(() => parseMemoryFile(JSON.stringify(o)), /inválido|não suportada/);
});
