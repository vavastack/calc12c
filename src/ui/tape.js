// Gaveta do visor: fita de cálculo e memória viva (n, i, PV, PMT, FV, R0–R9, pilha).
import { formatNumber } from '../engine/number.js';
import { clearAll } from './storage.js';

const FIN_CARDS = [['n', 'n'], ['i', 'i'], ['pv', 'PV'], ['pmt', 'PMT'], ['fv', 'FV']];
const STACK_REGS = [['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['t', 'T']];
const SWIPE_PX = 40;

const cell = (cls, attr, label, value) =>
  `<div class="${cls}" ${attr}><span class="k">${label}</span><span class="v">${value}</span></div>`;

export function mountDrawer(ctx) {
  const { calc, top, display, engine } = ctx;
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'drawer-handle';
  handle.setAttribute('aria-expanded', 'false');
  handle.setAttribute('aria-label', 'Abrir ou fechar a fita e a memória');
  const drawer = document.createElement('section');
  drawer.className = 'drawer';
  drawer.dataset.open = 'false';
  drawer.innerHTML =
    '<div class="mem"></div><div class="tape-wrap"><ol class="tape"></ol>' +
    '<button type="button" class="clear-all">Limpar tudo</button></div>' +
    '<div class="confirm" hidden role="alertdialog" aria-label="Confirmar">' +
    '<p>Limpar fita e memória? Isso não pode ser desfeito.</p>' +
    '<button type="button" class="cancel">Cancelar</button><button type="button" class="ok">Limpar</button></div>';
  top.append(handle);
  calc.append(drawer);

  const set = (open) => {
    drawer.style.top = top.offsetTop + top.offsetHeight + 2 + 'px'; // logo abaixo da alça
    drawer.dataset.open = String(open);
    handle.setAttribute('aria-expanded', String(open));
  };
  handle.addEventListener('click', () => set(drawer.dataset.open !== 'true'));

  // Puxar o visor para baixo abre; para cima fecha.
  let y0 = null;
  top.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.fmt-toggle')) y0 = e.clientY;
  });
  const end = (e) => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    if (dy > SWIPE_PX) set(true);
    else if (dy < -SWIPE_PX) set(false);
  };
  // o dedo sai do visor durante o gesto: ouvir no documento inteiro
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', () => (y0 = null));

  const fmt = (v, s) => formatNumber(v, s.decimals, s.locale);
  const mem = drawer.querySelector('.mem');
  const tapeEl = drawer.querySelector('.tape');

  ctx.listeners.push((_c, s) => {
    mem.innerHTML =
      '<div class="cards">' + FIN_CARDS.map(([id, l]) => cell('card', `data-fin="${id}"`, l, fmt(s.fin[id], s))).join('') + '</div>' +
      '<div class="regs">' + s.regs.map((v, n) => cell('reg', `data-reg="${n}"`, 'R' + n, fmt(v, s))).join('') + '</div>' +
      '<div class="stack">' + STACK_REGS.map(([id, l]) => cell('stk', `data-stk="${id}"`, l, fmt(s.stack[id], s))).join('') + '</div>';
    tapeEl.innerHTML = '';
    s.tape.forEach((line, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.i = i;
      const k = document.createElement('span');
      k.className = 'keys-txt';
      k.textContent = line.keys;
      const v = document.createElement('b');
      v.textContent = line.text;
      b.append(k, v);
      li.append(b);
      tapeEl.append(li);
    });
    tapeEl.scrollTop = tapeEl.scrollHeight;
  });

  tapeEl.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    engine.loadValue(engine.tape[Number(b.dataset.i)].value);
    ctx.render();
  });

  const confirm = drawer.querySelector('.confirm');
  drawer.querySelector('.clear-all').addEventListener('click', () => (confirm.hidden = false));
  confirm.querySelector('.cancel').addEventListener('click', () => (confirm.hidden = true));
  confirm.querySelector('.ok').addEventListener('click', () => {
    confirm.hidden = true;
    engine.reset();
    clearAll(engine.profile);
    ctx.render();
  });
  return { open: () => set(true), close: () => set(false) };
}
