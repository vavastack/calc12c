// Escolhe o motor pelo tipo do perfil: decimal (HP 10C a 12C) ou inteiros de largura fixa (HP-16C).
import { Engine } from './engine.js';
import { Engine16 } from './engine16.js';
import { DEFAULT_PROFILE, getProfile, hasProfile } from './profiles.js';

export function createEngine(opts = {}) {
  const profile = opts.profile ?? DEFAULT_PROFILE;
  return getProfile(profile).kind === 'int' ? new Engine16({ ...opts, profile }) : new Engine({ ...opts, profile });
}

export function restoreEngine(json) {
  const o = JSON.parse(json);
  const id = o && typeof o === 'object' ? o.profile : undefined;
  if (typeof id === 'string' && hasProfile(id) && getProfile(id).kind === 'int') return Engine16.restore(json);
  return Engine.restore(json);
}
