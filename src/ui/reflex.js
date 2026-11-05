// Reflexo leve: uma única camada de brilho que se desloca com o mouse (PC) ou a inclinação (celular).
// Só `transform` e `opacity`; no máximo uma escrita por quadro; pausa em segundo plano.
const RANGE_X = 90; // px de deslocamento máximo
const RANGE_Y = 120;
const SMOOTH_MOUSE = 0.035; // PC: acompanha o mouse bem devagar
const SMOOTH_TILT = 0.09; // celular: um pouco mais ágil, mas ainda suave
const MIN_DELTA = 0.01; // variação mínima do alvo para valer a pena atualizar
const EPS = 0.002;
const TILT_SPAN = 18; // graus de inclinação, a partir da posição neutra, que levam o reflexo ao limite
const BASE_FOLLOW = 0.004; // a posição neutra acompanha devagar como você segura o aparelho (~4 s)

export function startReflex(layer) {
  let target = { x: 0, y: 0 };
  let cur = { x: 0, y: 0 };
  let raf = 0;
  let stopped = false;
  let motionOn = false;
  let tiltSeen = false;
  let smooth = SMOOTH_MOUSE;
  let base = null; // posição neutra: a primeira leitura (e a seguinte a cada calibração)

  const sheen = document.querySelector('.sheen'); // brilho da placa metálica: mesma posição e opacidade
  const frame = () => {
    raf = 0;
    if (stopped || document.hidden) return;
    cur.x += (target.x - cur.x) * smooth;
    cur.y += (target.y - cur.y) * smooth;
    const done = Math.abs(target.x - cur.x) < EPS && Math.abs(target.y - cur.y) < EPS;
    if (done) cur = { ...target };
    layer.style.transform = `translate3d(${(cur.x * RANGE_X).toFixed(2)}px, ${(cur.y * RANGE_Y).toFixed(2)}px, 0)`;
    const op = String((0.5 + 0.2 * Math.abs(cur.x)).toFixed(3));
    layer.style.opacity = op;
    if (sheen) {
      sheen.style.transform = layer.style.transform;
      sheen.style.opacity = op;
    }
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

  // só o mouse (PC) move o reflexo; toque e caneta não interferem
  const onMouse = (e) => e.pointerType && e.pointerType !== 'mouse' ? undefined : (smooth = SMOOTH_MOUSE, aim((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1));
  const onTilt = (e) => {
    if (e.gamma == null && e.beta == null) return;
    tiltSeen = true;
    smooth = SMOOTH_TILT;
    const g = e.gamma ?? 0;
    const b = e.beta ?? 50;
    if (!base) base = { g, b }; // calibração automática: o jeito atual de segurar vira o "centro"
    base.g += (g - base.g) * BASE_FOLLOW;
    base.b += (b - base.b) * BASE_FOLLOW;
    let dx = g - base.g;
    let dy = b - base.b;
    // em paisagem os eixos do sensor giram junto com a tela
    const ang = ((window.screen?.orientation?.angle ?? 0) + 360) % 360;
    if (ang === 90) [dx, dy] = [dy, -dx];
    else if (ang === 270) [dx, dy] = [-dy, dx];
    else if (ang === 180) [dx, dy] = [-dx, -dy];
    aim(dx / TILT_SPAN, dy / TILT_SPAN);
  };
  const onVisibility = () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  // mouse no PC; no celular vale só a inclinação (e a deriva lenta do CSS)
  document.addEventListener('pointermove', onMouse);
  document.addEventListener('pointerdown', onMouse);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    // No iPhone o sensor exige permissão, pedida num toque do usuário. Negada → brilho fixo.
    get tiltSeen() {
      return tiltSeen;
    },
    get needsPermission() {
      return typeof window.DeviceOrientationEvent?.requestPermission === 'function';
    },
    // recalibra: o jeito como você segura o aparelho agora passa a ser o centro
    calibrate() {
      base = null;
    },
    async enableMotion() {
      if (stopped) return false;
      base = null;
      if (motionOn) return true;
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
      document.removeEventListener('pointermove', onMouse);
      document.removeEventListener('pointerdown', onMouse);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('deviceorientation', onTilt);
    },
  };
}
