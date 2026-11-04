// Salvamento automático no aparelho (localStorage). Nada sai do dispositivo.
import { Engine } from '../engine/engine.js';

export const STORAGE_KEY = 'calc12c.state';

function store() {
  try {
    return window.localStorage; // pode lançar (bloqueado) ou ser nulo
  } catch {
    return null;
  }
}

export function saveState(engine) {
  try {
    store()?.setItem(STORAGE_KEY, engine.serialize());
  } catch {
    /* sem armazenamento: o app segue funcionando */
  }
}

// Estado salvo ausente, corrompido ou de versão antiga → motor novo (sem erro).
export function loadState() {
  try {
    const raw = store()?.getItem(STORAGE_KEY);
    if (raw) return Engine.restore(raw);
  } catch {
    /* cai no estado inicial */
  }
  return new Engine();
}

export function clearAll() {
  try {
    store()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignora */
  }
}
