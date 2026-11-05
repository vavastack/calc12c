// Extras das configurações: som de tecla (Web Audio) e "não dormir" (Screen Wake Lock). Tudo opcional e sem rede.

// Som das teclas, sintetizado no navegador (sem arquivos de áudio, tudo offline). Dois momentos: ao apertar e ao soltar.
// Modos: 'soft' = clique macio; 'mech' = estalo de tecla mecânica com um "toc" grave. O contexto de áudio só nasce no primeiro toque.
export function makeSound() {
  let ac = null;
  let noise = null;
  let mode = 'off';
  const PERFIL = { enter: { f: 0.72, g: 1.25 }, fg: { f: 0.85, g: 0.75 }, num: { f: 1, g: 1 }, fn: { f: 1.08, g: 1 } };
  const prepare = () => {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return false;
    if (!ac) {
      ac = new AC();
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.06), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  };
  const env = (g, t, peak, dur) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  return {
    get mode() {
      return mode;
    },
    set(m) {
      mode = m === 'soft' || m === 'mech' ? m : 'off';
    },
    // kind: enter | fg | num | fn   phase: down | up
    play(kind = 'num', phase = 'down') {
      if (mode === 'off') return;
      try {
        if (!prepare()) return;
        const { f, g } = PERFIL[kind] ?? PERFIL.num;
        const down = phase === 'down';
        const t = ac.currentTime;
        if (mode === 'soft') {
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime((down ? 1900 : 2300) * f, t);
          osc.frequency.exponentialRampToValueAtTime((down ? 700 : 1100) * f, t + 0.025);
          env(gain, t, (down ? 0.035 : 0.015) * g, 0.03);
          osc.connect(gain).connect(ac.destination);
          osc.start(t);
          osc.stop(t + 0.04);
          return;
        }
        // mecânico: estalo filtrado (ruído) + toc grave só ao apertar
        const src = ac.createBufferSource();
        const bp = ac.createBiquadFilter();
        const gn = ac.createGain();
        src.buffer = noise;
        bp.type = 'bandpass';
        bp.frequency.value = (down ? 2600 : 3600) * f;
        bp.Q.value = 1.3;
        env(gn, t, (down ? 0.09 : 0.04) * g, down ? 0.025 : 0.018);
        src.connect(bp).connect(gn).connect(ac.destination);
        src.start(t);
        src.stop(t + 0.05);
        if (down) {
          const th = ac.createOscillator();
          const tg = ac.createGain();
          th.type = 'sine';
          th.frequency.setValueAtTime(170 * f, t);
          th.frequency.exponentialRampToValueAtTime(80 * f, t + 0.045);
          env(tg, t, 0.07 * g, 0.05);
          th.connect(tg).connect(ac.destination);
          th.start(t);
          th.stop(t + 0.06);
        }
      } catch {
        /* sem áudio: o app segue funcionando */
      }
    },
  };
}

export const wakeSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

// Mantém a tela acesa enquanto o app estiver visível; o navegador solta o bloqueio ao esconder a aba, então pedimos de novo ao voltar.
export function makeWake() {
  let lock = null;
  let want = false;
  const request = async () => {
    if (!want || !wakeSupported() || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } catch {
      lock = null; // bateria fraca, economia de energia etc.: tenta de novo na próxima vez
    }
  };
  document.addEventListener('visibilitychange', request);
  return async (on) => {
    want = on;
    if (on) await request();
    else {
      try {
        await lock?.release();
      } catch {
        /* já solto */
      }
      lock = null;
    }
  };
}
