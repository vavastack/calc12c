// Extras das configurações: som de tecla (Web Audio) e "não dormir" (Screen Wake Lock). Tudo opcional e sem rede.

// Clique curto e discreto. O contexto de áudio só nasce no primeiro toque (o navegador exige um gesto do usuário).
export function makeClick() {
  let ac = null;
  return () => {
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      ac ??= new AC();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1900, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.025);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.07, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.035);
    } catch {
      /* sem áudio: o app segue funcionando */
    }
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
