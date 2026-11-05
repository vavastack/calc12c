// Perfis de calculadora. Cada perfil define o que muda de um modelo para outro: identidade, mapa de teclas,
// modos de cálculo, indicadores do visor e as linhas de ligação (colchetes) do teclado.
// O motor (engine.js) consulta o perfil pelo id; a interface monta o teclado a partir dele.
import { KEYS, KEY_BY_ID } from './keymap.js';

export const DEFAULT_PROFILE = '12c';

// Colchetes impressos acima das teclas: posição no retrato (r, c0..c1) e na paisagem (hr, hc0..hc1)
const BRACKETS_12C = [
  { label: 'BOND', r: 1, c0: 0, c1: 1, hr: 1, hc0: 0, hc1: 1 },
  { label: 'DEPRECIATION', r: 1, c0: 2, c1: 4, hr: 1, hc0: 2, hc1: 4 },
  { label: 'CLEAR', r: 2, c0: 1, c1: 4, hr: 2, hc0: 1, hc1: 5 },
  { label: '', r: 6, c0: 0, c1: 0, hr: 2, hc0: 5, hc1: 5, cls: 'pfx' }, // PREFIX: no retrato tem a linha própria; na paisagem a do CLEAR já a cobre
];

const PROFILES = new Map();

// Perfil: { id, name (título no topo), model (selo), keys, keyById, modes, defaultMode, indicators, brackets }
export function registerProfile(p) {
  for (const f of ['id', 'name', 'model', 'keys', 'keyById', 'modes', 'indicators', 'brackets']) {
    if (p[f] === undefined) throw new Error(`perfil sem ${f}`);
  }
  PROFILES.set(p.id, { defaultMode: p.modes[0], ...p });
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

registerProfile({
  id: '12c',
  name: 'Calc 12c',
  model: '12C',
  keys: KEYS,
  keyById: KEY_BY_ID,
  modes: ['rpn', 'alg'], // a Platinum é a única da família com os dois modos
  indicators: ['RPN', 'ALG', '( )', 'f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM'],
  brackets: BRACKETS_12C,
});
