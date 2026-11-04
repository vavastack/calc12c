// Temas e configurações. Só variáveis de cor mudam; o teclado e o motor nunca.
const KEY = 'calc12c.settings';
const THEMES = ['retro', 'moderno'];
const MODES = ['auto', 'escuro', 'claro'];

const lowEnd = () => (navigator.hardwareConcurrency ?? 8) <= 4;

export function defaultSettings() {
  // reduce: null = automático (liga sozinho em aparelhos simples); true/false = escolha do usuário
  return { theme: 'retro', mode: 'auto', reduce: null, vibrate: false };
}

export function loadSettings() {
  const d = defaultSettings();
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (!o || typeof o !== 'object') return d;
    return {
      theme: THEMES.includes(o.theme) ? o.theme : d.theme,
      mode: MODES.includes(o.mode) ? o.mode : d.mode,
      reduce: typeof o.reduce === 'boolean' ? o.reduce : null,
      vibrate: o.vibrate === true,
    };
  } catch {
    return d; // ausente, corrompido ou armazenamento bloqueado
  }
}

export function saveSettings(s) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: segue funcionando */
  }
}

const effectiveReduce = (s) => (s.reduce === null ? lowEnd() : s.reduce);

let last = { theme: 'retro', mode: 'auto', reduce: false };
let mq;

function ensureReflexLayer(reduce) {
  const keys = document.querySelector('.keys');
  if (!keys) return;
  const el = keys.querySelector('.reflex');
  if (reduce && el) el.remove();
  if (!reduce && !el) {
    const d = document.createElement('div');
    d.className = 'reflex';
    d.setAttribute('aria-hidden', 'true');
    keys.append(d);
  }
}

export function applyTheme(theme, mode, reduceEffects) {
  last = { theme, mode, reduce: !!reduceEffects };
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'retro' ? 'retro' : 'moderno-' + (mode === 'auto' ? (dark ? 'escuro' : 'claro') : mode);
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-reduce', String(!!reduceEffects));
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
  ensureReflexLayer(!!reduceEffects);
  document.dispatchEvent(new CustomEvent('calc12c:effects', { detail: { reduce: !!reduceEffects } }));
  if (!mq) {
    mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => last.mode === 'auto' && applyTheme(last.theme, last.mode, last.reduce));
  }
}

export function mountSettings(ctx) {
  let s = loadSettings();
  const apply = () => {
    applyTheme(s.theme, s.mode, effectiveReduce(s));
    ctx.vibrate = s.vibrate;
  };
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'settings-btn';
  btn.setAttribute('aria-label', 'Configurações');
  btn.textContent = '⚙';
  const panel = document.createElement('section');
  panel.className = 'settings';
  panel.hidden = true;
  panel.innerHTML =
    '<label>Tema <select name="theme"><option value="retro">Retro</option><option value="moderno">Moderno</option></select></label>' +
    '<label>Modo <select name="mode"><option value="auto">Automático</option><option value="escuro">Escuro</option><option value="claro">Claro</option></select></label>' +
    '<label>Reduzir efeitos <input type="checkbox" name="reduce"></label>' +
    '<label>Vibração leve ao tocar <input type="checkbox" name="vibrate"></label>' +
    '<button type="button" class="motion">Ativar movimento do aparelho (brilho)</button>';
  ctx.top.append(btn);
  ctx.calc.append(panel);
  const sync = () => {
    panel.querySelector('[name=theme]').value = s.theme;
    panel.querySelector('[name=mode]').value = s.mode;
    panel.querySelector('[name=reduce]').checked = effectiveReduce(s);
    panel.querySelector('[name=vibrate]').checked = s.vibrate;
  };
  panel.querySelector('.motion').addEventListener('click', () => ctx.enableMotion?.());
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    sync();
  });
  panel.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'theme' || n === 'mode') s[n] = e.target.value;
    else s[n] = e.target.checked; // reduce, vibrate
    saveSettings(s);
    apply();
  });
  apply();
  return { get: () => ({ ...s }) };
}
