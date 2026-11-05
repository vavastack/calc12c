import { KEYS } from '../engine/keymap.js';
import { Engine } from '../engine/engine.js';
import { renderDisplay, bindKeyboard } from './display.js';
import { mountDrawer } from './tape.js';
import { loadState, saveState } from './storage.js';
import { mountSettings } from './settings.js';
import { startReflex } from './reflex.js';

const NOTICE_MS = 2200;

// Posição no layout horizontal (4 × 10): metade de baixo do vertical vai para as colunas 6 a 10.
const hpos = (k) => (k.row < 4 ? { r: k.row, c: k.col } : { r: k.row - 4, c: k.col + 5 });

function ariaLabel(k) {
  const parts = [k.label];
  if (k.f) parts.push('f ' + k.f);
  if (k.g) parts.push('g ' + k.g);
  return parts.join('; ');
}

function makeKey(k) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key';
  const g = k.label.length;
  if (/^[0-9.]$/.test(k.label) || ['÷', '×', '−', '+'].includes(k.label)) b.classList.add('big');
  else if (k.id === 'enter') b.classList.add('small');
  else if (g > 3 && k.id !== 'f' && k.id !== 'g') b.classList.add('small');
  b.dataset.id = k.id;
  if (k.id === 'f' || k.id === 'g') b.classList.add('prefix-' + k.id);
  const h = hpos(k);
  b.style.setProperty('--r', k.row);
  b.style.setProperty('--c', k.col);
  b.style.setProperty('--hr', h.r);
  b.style.setProperty('--hc', h.c);
  b.style.setProperty('--rs', k.rowSpan ?? 1);
  b.setAttribute('aria-label', ariaLabel(k));
  if (!k.enabled) b.setAttribute('aria-disabled', 'true');
  b.innerHTML =
    `<span class="lf">${k.f ?? ''}</span><span class="lm">${k.label}</span><span class="lg">${k.g ?? ''}</span>`;
  return b;
}

export function mountApp(root, engine = new Engine()) {
  root.innerHTML = '';
  const calc = document.createElement('main');
  calc.className = 'calc';
  const display = document.createElement('section');
  display.className = 'display';
  display.setAttribute('aria-live', 'polite');
  const keys = document.createElement('section');
  keys.className = 'keys';
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.hidden = true;
  notice.setAttribute('role', 'status');
  for (const k of KEYS) keys.append(makeKey(k));
  const top = document.createElement('div');
  top.className = 'top';
  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '<span class="name">Calc <i>12c</i></span><span class="rule" aria-hidden="true"></span><span class="sub">RPN</span>';
  top.append(brand, display);
  calc.append(top, keys, notice);
  root.append(calc);

  let timer;
  const showNotice = (text) => {
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (notice.hidden = true), NOTICE_MS);
  };

  const ctx = { root, calc, top, display, keys, notice, engine, showNotice, listeners: [], vibrate: false };
  ctx.render = () => {
    const s = engine.state;
    renderDisplay(display, s);
    calc.dataset.shift = s.shift ?? '';
    ctx.listeners.forEach((fn) => fn(ctx, s));
  };
  display.addEventListener('click', (ev) => {
    if (!ev.target.closest('.fmt-toggle')) return;
    engine.setLocale(engine.locale === 'br' ? 'us' : 'br');
    ctx.render();
  });
  // efeito do toque: realce só dentro da tecla, a partir de onde o dedo encostou
  keys.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('button.key');
    if (!b || !KEYS.find((x) => x.id === b.dataset.id)?.enabled) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--tx', (((ev.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
    b.style.setProperty('--ty', (((ev.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    b.classList.remove('touch');
    void b.offsetWidth;
    b.classList.add('touch');
    b.addEventListener('animationend', () => b.classList.remove('touch'), { once: true });
  });
  keys.addEventListener('click', (ev) => {
    const b = ev.target.closest('button.key');
    if (!b) return;
    const k = KEYS.find((x) => x.id === b.dataset.id);
    if (!k.enabled) {
      showNotice('Programação e estatística: não disponível nesta versão.');
      return;
    }
    if (ctx.vibrate && navigator.vibrate) navigator.vibrate(8);
    if (k.id === 'f' || k.id === 'g') {
      // brilho curto da tecla f/g; reinicia a animação a cada toque
      b.classList.remove('flash');
      void b.offsetWidth;
      b.classList.add('flash');
      b.addEventListener('animationend', () => b.classList.remove('flash'), { once: true });
    }
    clearTimeout(ctx.pauseTimer); // qualquer tecla interrompe as pausas (PSE) em andamento
    engine.press(k.id);
    ctx.render();
    const pauses = engine.takePauses();
    if (pauses.length) {
      // PSE: mostra cada resultado intermediário por cerca de 1 segundo antes do resultado final
      let i = 0;
      const step = () => {
        if (i < pauses.length) {
          display.querySelector('.digits').textContent = pauses[i++];
          ctx.pauseTimer = setTimeout(step, 1000);
        } else ctx.render();
      };
      step();
    }
  });
  bindKeyboard(engine, ctx.render);
  ctx.drawer = mountDrawer(ctx);
  // o reflexo liga e desliga junto com "reduzir efeitos"
  let motion = false;
  document.addEventListener('calc12c:effects', (e) => {
    ctx.reflex?.stop();
    ctx.reflex = null;
    const layer = calc.querySelector('.reflex');
    if (!e.detail.reduce && layer) {
      ctx.reflex = startReflex(layer);
      if (motion) ctx.reflex.enableMotion();
      else if (!ctx.reflex.needsPermission) ctx.enableMotion(); // Android e PC: sensor liga sozinho
      else {
        // iPhone: o sensor pede permissão, e ela só pode ser pedida num toque do usuário
        document.addEventListener('pointerup', () => ctx.enableMotion(), { once: true });
      }
    }
  });
  ctx.enableMotion = async () => {
    motion = (await ctx.reflex?.enableMotion()) ?? false;
    return motion;
  };
  ctx.settings = mountSettings(ctx);
  ctx.listeners.push(() => saveState(engine)); // salvamento automático
  ctx.render();
  return ctx;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return; // file:// não tem service worker
  navigator.serviceWorker.register('./sw.js').catch(() => {}); // sem SW o app segue funcionando
}

const root = document.getElementById('app');
if (root) {
  window.calc12c = mountApp(root, loadState());
  registerServiceWorker();
}
