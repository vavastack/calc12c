import { KEYS } from '../engine/keymap.js';
import { Engine } from '../engine/engine.js';

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
  calc.append(display, keys, notice);
  root.append(calc);

  let timer;
  const showNotice = (text) => {
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => (notice.hidden = true), NOTICE_MS);
  };

  const ctx = { root, calc, display, keys, notice, engine, showNotice, listeners: [] };
  keys.addEventListener('click', (ev) => {
    const b = ev.target.closest('button.key');
    if (!b) return;
    const k = KEYS.find((x) => x.id === b.dataset.id);
    if (!k.enabled) {
      showNotice('Modo de programação e estatística não disponíveis nesta versão.');
      return;
    }
    engine.press(k.id);
    ctx.listeners.forEach((fn) => fn(ctx));
  });
  return ctx;
}

const root = document.getElementById('app');
if (root) mountApp(root, new Engine());
