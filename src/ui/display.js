// Visor: indicadores, dígitos com ajuste de fonte, mensagem de erro e teclado do PC.
export const INDICATORS = ['f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM'];

function ensureStructure(el) {
  if (el.querySelector('.digits')) return;
  el.innerHTML =
    '<div class="indicators">' + INDICATORS.map((i) => `<span data-ind="${i}">${i}</span>`).join('') +
    '<button type="button" class="fmt-toggle" aria-label="Alternar formato dos números (pt-BR / en-US)"></button></div>' +
    '<div class="digits" role="status"></div><div class="msg"></div>';
}

// Reduz a fonte até o texto caber na largura do visor.
function fit(digits) {
  digits.style.fontSize = '';
  let size = parseFloat(getComputedStyle(digits).fontSize);
  while (digits.scrollWidth > digits.clientWidth && size > 14) {
    size -= 2;
    digits.style.fontSize = size + 'px';
  }
}

export function renderDisplay(el, s) {
  ensureStructure(el);
  const lit = { f: s.shift === 'f', g: s.shift === 'g', BEGIN: s.begin, C: s.compound, 'D.MY': s.dmy, PRGM: s.prgm };
  for (const span of el.querySelectorAll('[data-ind]')) {
    span.classList.toggle('on', !!lit[span.dataset.ind]);
  }
  el.querySelector('.fmt-toggle').textContent = s.locale === 'br' ? 'BR' : 'US';
  el.querySelector('.digits').textContent = s.display;
  el.querySelector('.msg').textContent = s.error ? s.error.message : '';
  fit(el.querySelector('.digits'));
}

const KEY_TO_ID = {
  ',': 'dot', '.': 'dot', Enter: 'enter', '+': 'plus', '-': 'minus', '*': 'times', x: 'times', '/': 'divide',
};

// Teclado do PC: dígitos, vírgula/ponto, Enter, + − × ÷ e Backspace.
export function bindKeyboard(engine, onChange = () => {}, target = window) {
  const handler = (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'Backspace') {
      ev.preventDefault();
      engine.backspace();
    } else {
      const id = /^[0-9]$/.test(ev.key) ? ev.key : KEY_TO_ID[ev.key];
      if (!id) return;
      ev.preventDefault();
      engine.press(id);
    }
    onChange();
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}
