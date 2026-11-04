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
  top.append(display);
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
  keys.addEventListener('click', (ev) => {
    const b = ev.target.closest('button.key');
    if (!b) return;
    const k = KEYS.find((x) => x.id === b.dataset.id);
    if (!k.enabled) {
      showNotice('Programação e estatística: não disponível nesta versão.');
      return;
    }
    if (ctx.vibrate && navigator.vibrate) navigator.vibrate(8);
    engine.press(k.id);
    ctx.render();
  });
  bindKeyboard(engine, ctx.render);
  ctx.drawer = mountDrawer(ctx);
  // o reflexo liga e desliga junto com "reduzir efeitos"
  let motion = false;
  document.addEventListener('calc12c:effects', (e) => {
    ctx.reflex?.stop();
    ctx.reflex = null;
    const layer = keys.querySelector('.reflex');
    if (!e.detail.reduce && layer) {
      ctx.reflex = startReflex(layer);
      if (motion) ctx.reflex.enableMotion();
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
