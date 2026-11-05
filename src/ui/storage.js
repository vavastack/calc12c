// Salvamento automático no aparelho (localStorage). Nada sai do dispositivo.
import { createEngine, restoreEngine } from '../engine/engines.js';
import { DEFAULT_PROFILE, hasProfile } from '../engine/profiles.js';

export const STORAGE_KEY = 'calc12c.state'; // estado do perfil 12C (chave mantida para não perder o que já estava salvo)
export const PROFILE_KEY = 'calc12c.profile'; // perfil em uso

// Cada perfil tem o seu estado salvo à parte.
export const stateKey = (id) => (id === DEFAULT_PROFILE ? STORAGE_KEY : `${STORAGE_KEY}.${id}`);

function store() {
  try {
    return window.localStorage; // pode lançar (bloqueado) ou ser nulo
  } catch {
    return null;
  }
}

export function saveState(engine) {
  try {
    store()?.setItem(stateKey(engine.profile), engine.serialize());
  } catch {
    /* sem armazenamento: o app segue funcionando */
  }
}

// Perfil em uso: ausente ou desconhecido → 12C.
export function loadActiveProfile() {
  try {
    const id = store()?.getItem(PROFILE_KEY);
    if (id && hasProfile(id)) return id;
  } catch {
    /* usa o padrão */
  }
  return DEFAULT_PROFILE;
}

export function saveActiveProfile(id) {
  try {
    store()?.setItem(PROFILE_KEY, id);
  } catch {
    /* sem armazenamento: o app segue funcionando */
  }
}

// Estado salvo do perfil (o ativo, se não for dito) ausente, corrompido ou de versão antiga → motor novo (sem erro).
export function loadState(profile = loadActiveProfile()) {
  try {
    const raw = store()?.getItem(stateKey(profile));
    if (raw) {
      const e = restoreEngine(raw);
      if (e.profile === profile) return e;
    }
  } catch {
    /* cai no estado inicial */
  }
  return createEngine({ profile });
}

export function clearAll(profile = DEFAULT_PROFILE) {
  try {
    store()?.removeItem(stateKey(profile));
  } catch {
    /* ignora */
  }
}
