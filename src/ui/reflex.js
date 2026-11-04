// Reflexo leve: uma única camada de brilho que se desloca com o mouse (PC) ou a inclinação (celular).
// Só `transform` e `opacity`; no máximo uma escrita por quadro; pausa em segundo plano.
const RANGE_X = 60; // px de deslocamento máximo
const RANGE_Y = 80;
const SMOOTH = 0.18; // amortecimento por quadro
const MIN_DELTA = 0.01; // variação mínima do alvo para valer a pena atualizar
const EPS = 0.002;

export function startReflex(layer) {
  let target = { x: 0, y: 0 };
  let cur = { x: 0, y: 0 };
  let raf = 0;
  let stopped = false;
  let motionOn = false;

  const frame = () => {
    raf = 0;
    if (stopped || document.hidden) return;
    cur.x += (target.x - cur.x) * SMOOTH;
    cur.y += (target.y - cur.y) * SMOOTH;
    const done = Math.abs(target.x - cur.x) < EPS && Math.abs(target.y - cur.y) < EPS;
    if (done) cur = { ...target };
    layer.style.transform = `translate3d(${(cur.x * RANGE_X).toFixed(2)}px, ${(cur.y * RANGE_Y).toFixed(2)}px, 0)`;
    layer.style.opacity = String((0.55 + 0.25 * Math.abs(cur.x)).toFixed(3));
    if (!done) raf = requestAnimationFrame(frame);
  };

  const aim = (x, y) => {
    if (stopped || document.hidden) return;
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    if (Math.abs(x - target.x) < MIN_DELTA && Math.abs(y - target.y) < MIN_DELTA) return;
    target = { x, y };
    if (!raf) raf = requestAnimationFrame(frame); // várias entradas no mesmo quadro = 1 escrita
  };

  const onMouse = (e) => aim((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  const onTilt = (e) => {
    if (e.gamma == null && e.beta == null) return;
    aim((e.gamma ?? 0) / 45, ((e.beta ?? 45) - 45) / 45);
  };
  const onVisibility = () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  document.addEventListener('mousemove', onMouse);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    // No iPhone o sensor exige permissão, pedida num toque do usuário. Negada → brilho fixo.
    async enableMotion() {
      if (motionOn || stopped) return false;
      const D = window.DeviceOrientationEvent;
      if (!D) return false;
      try {
        if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') return false;
      } catch {
        return false;
      }
      window.addEventListener('deviceorientation', onTilt);
      motionOn = true;
      return true;
    },
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('deviceorientation', onTilt);
    },
  };
}
