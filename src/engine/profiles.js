// Perfis de calculadora. Cada perfil define o que muda de um modelo para outro: identidade, mapa de teclas,
// modos de cálculo, indicadores do visor e as linhas de ligação (colchetes) do teclado.
// O motor (engine.js) consulta o perfil pelo id; a interface monta o teclado a partir dele.
import { KEYS, KEY_BY_ID, KEYS_PLATINUM, KEY_BY_ID_PLATINUM, KEYS_16C, KEY_BY_ID_16C } from './keymap.js';

export const DEFAULT_PROFILE = '12c';

// Colchetes impressos acima das teclas: posição no retrato (r, c0..c1) e na paisagem (hr, hc0..hc1)
const BRACKETS_12C = [
  { label: 'BOND', r: 1, c0: 0, c1: 1, hr: 1, hc0: 0, hc1: 1 },
  { label: 'DEPRECIATION', r: 1, c0: 2, c1: 4, hr: 1, hc0: 2, hc1: 4 },
  { label: 'CLEAR', r: 2, c0: 1, c1: 4, hr: 2, hc0: 1, hc1: 5 },
  { label: '', r: 6, c0: 0, c1: 0, hr: 2, hc0: 5, hc1: 5, cls: 'pfx' }, // PREFIX: no retrato tem a linha própria; na paisagem a do CLEAR já a cobre
];

// Limites e comportamentos que variam entre os modelos (a clássica é o padrão):
// maxLines = linhas de programa; maxFlows = fluxos CFj além do CFo; regCount = registradores (10 = R0-R9, 20 = + .0-.9);
// kind = tipo de motor ('dec' = decimal das HP 10C a 12C; 'int' = inteiros de largura fixa da 16C);
// undo = teclas g ← (Backspace) e g Undo; clearPrgmKeepsPc = f CLEAR PRGM em RUN não leva à linha 00.
const LIMITS_12C = { kind: 'dec', maxLines: 99, maxFlows: 20, regCount: 10, undo: false, clearPrgmKeepsPc: false };

const PROFILES = new Map();

// Temas: 'retro' = placa dourada (marca Gold), 'platinum' = prata (marca Platinum), 'moderno' = Retro (vidro). Na lista aparece
// "Padrão" para a placa do próprio modelo; Gold e Platinum são as marcas dos modelos e só aparecem como opção no modo desenvolvedor. O Retro vale para todos; o modo desenvolvedor libera todos em qualquer perfil.
export const ALL_THEMES = ['retro', 'platinum', 'moderno'];

// Perfil: { id, name (título no topo), title (opcional: duas linhas), label (nome na lista), model (selo), keys, keyById,
//   modes, defaultMode, indicators, brackets, themes, defaultTheme }
export function registerProfile(p) {
  for (const f of ['id', 'name', 'model', 'keys', 'keyById', 'modes', 'indicators', 'brackets', 'themes', 'defaultTheme']) {
    if (p[f] === undefined) throw new Error(`perfil sem ${f}`);
  }
  PROFILES.set(p.id, { defaultMode: p.modes[0], label: p.name, ...LIMITS_12C, ...p });
}

export function hasProfile(id) {
  return PROFILES.has(id);
}

export function getProfile(id) {
  const p = PROFILES.get(id);
  if (!p) throw new Error('perfil desconhecido: ' + id);
  return p;
}

export function listProfiles() {
  return [...PROFILES.values()];
}

// Temas que o perfil oferece (todos, no modo desenvolvedor).
export function allowedThemes(id, dev = false) {
  return dev ? [...ALL_THEMES] : [...getProfile(id).themes];
}

// Tema que vale de fato: a escolha da pessoa, se o perfil a oferece; senão o tema padrão do perfil.
export function themeFor(id, chosen, dev = false) {
  return allowedThemes(id, dev).includes(chosen) ? chosen : getProfile(id).defaultTheme;
}

const INDICATORS_CLASSIC = ['f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM'];

// HP 12C clássica: só RPN, placa dourada.
registerProfile({
  id: '12c',
  name: 'Calc 12c',
  label: 'Calc 12c Gold',
  title: ['Gold', 'Calc 12c'],
  model: '12C',
  keys: KEYS,
  keyById: KEY_BY_ID,
  modes: ['rpn'],
  indicators: INDICATORS_CLASSIC,
  brackets: BRACKETS_12C,
  themes: ['retro', 'moderno'],
  defaultTheme: 'retro',
});

// HP 12C Platinum: RPN e ALG, placa prateada, título "Platinum" com "12c" embaixo.
registerProfile({
  id: '12cp',
  name: 'Calc 12c Platinum',
  label: 'Calc 12c Platinum',
  title: ['Platinum', 'Calc 12c'],
  model: '12C',
  keys: KEYS_PLATINUM,
  keyById: KEY_BY_ID_PLATINUM,
  modes: ['rpn', 'alg'],
  indicators: ['RPN', 'ALG', '( )', 'UNDO', ...INDICATORS_CLASSIC],
  maxLines: 400,
  maxFlows: 30,
  regCount: 20,
  undo: true,
  clearPrgmKeepsPc: true,
  brackets: BRACKETS_12C,
  themes: ['platinum', 'moderno'],
  defaultTheme: 'platinum',
});

// HP-16C "Computer Scientist": motor de inteiros de largura fixa (engine16.js). Só RPN, sem programação nesta etapa.
// Indicadores: C = carry (flag 4), G = fora da faixa (flag 5).
registerProfile({
  id: '16c',
  name: 'Calc 16c',
  label: 'Calc 16c (programador)',
  model: '16C',
  kind: 'int',
  keys: KEYS_16C,
  keyById: KEY_BY_ID_16C,
  modes: ['rpn'],
  indicators: ['f', 'g', 'C', 'G', 'PRGM'],
  brackets: [
    { label: 'SHOW', r: 1, c0: 2, c1: 4, hr: 1, hc0: 2, hc1: 5 },
    { label: '', r: 5, c0: 0, c1: 0, cls: 'pfx' }, // BIN também é SHOW: no retrato fica na outra metade
    { label: 'CLEAR', r: 2, c0: 2, c1: 4, hr: 2, hc0: 2, hc1: 4 },
    { label: 'SET COMPL', r: 6, c0: 1, c1: 3, hr: 2, hc0: 6, hc1: 8 },
  ],
  themes: ['retro', 'moderno'],
  defaultTheme: 'retro',
  regCount: 32,
});
