// Temas e configurações. Só variáveis de cor mudam; o teclado e o motor nunca.
const KEY = 'calc12c.settings';
const THEMES = ['retro', 'moderno'];
const MODES = ['auto', 'escuro', 'claro'];

const lowEnd = () => (navigator.hardwareConcurrency ?? 8) <= 2 || (navigator.deviceMemory ?? 8) <= 2 ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  if (reduce && el) (el.closest('.reflex-clip') ?? el).remove();
  if (!reduce && !el) {
    const clip = document.createElement('div');
    clip.className = 'reflex-clip';
    clip.setAttribute('aria-hidden', 'true');
    const d = document.createElement('div');
    d.className = 'reflex';
    clip.append(d);
    keys.append(clip);
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
    '<header class="settings-head"><span class="settings-title">Configurações</span>' +
    '<button type="button" class="settings-close" aria-label="Fechar configurações">✕</button></header>' +
    '<section class="group"><h3 class="group-title">Aparência</h3>' +
    '<label class="row"><span class="txt">Tema<small>Clássico tem relevo e visor luminoso; Retro é de vidro</small></span>' +
    '<select name="theme"><option value="retro">Clássico</option><option value="moderno">Retro</option></select></label>' +
    '<label class="row"><span class="txt">Modo<small>Automático segue o sistema; o Clássico é sempre escuro</small></span>' +
    '<select name="mode"><option value="auto">Automático</option><option value="escuro">Escuro</option><option value="claro">Claro</option></select></label></section>' +
    '<section class="group"><h3 class="group-title">Efeitos</h3>' +
    '<label class="row"><span class="txt">Reduzir efeitos<small>Vidro sólido e sem reflexo: poupa bateria</small></span>' +
    '<input type="checkbox" name="reduce" role="switch"></label>' +
    '<label class="row"><span class="txt">Vibração leve ao tocar<small>Só em aparelhos que permitem vibrar</small></span>' +
    '<input type="checkbox" name="vibrate" role="switch"></label></section>' +
    '<section class="group"><h3 class="group-title">Brilho</h3>' +
    '<button type="button" class="motion">Testar movimento do aparelho</button>' +
    '<small class="motion-status" role="status"></small></section>';
  ctx.top.append(btn);
  // tela cheia: só aparece onde o navegador permite e o app ainda não está em tela cheia (PWA instalado)
  const fsOk = document.fullscreenEnabled && !window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (fsOk) {
    const fs = document.createElement('button');
    fs.type = 'button';
    fs.className = 'fs-btn';
    const paint = () => {
      const on = !!document.fullscreenElement;
      fs.textContent = on ? '⤡' : '⛶';
      fs.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
      fs.setAttribute('aria-pressed', String(on));
    };
    fs.addEventListener('click', () => {
      const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      r?.catch(() => {});
    });
    document.addEventListener('fullscreenchange', paint);
    paint();
    ctx.top.append(fs);
  }
  ctx.calc.append(panel);
  // o tema Clássico é sempre escuro: a escolha de modo fica inativa
  const lockMode = () => {
    const off = s.theme === 'retro';
    const sel = panel.querySelector('[name=mode]');
    sel.disabled = off;
    sel.closest('.row').classList.toggle('off', off);
  };
  const sync = () => {
    panel.querySelector('[name=theme]').value = s.theme;
    panel.querySelector('[name=mode]').value = s.mode;
    lockMode();
    panel.querySelector('[name=reduce]').checked = effectiveReduce(s);
    panel.querySelector('[name=vibrate]').checked = s.vibrate;
  };
  panel.querySelector('.settings-close').addEventListener('click', () => (panel.hidden = true));
  const status = panel.querySelector('.motion-status');
  panel.querySelector('.motion').addEventListener('click', async () => {
    status.textContent = 'Inclinando o aparelho…';
    const ok = await ctx.enableMotion?.();
    if (!ok) {
      status.textContent = 'Sem permissão ou sensor. O brilho segue o toque e se move sozinho.';
      return;
    }
    // o Chrome só envia a inclinação em páginas seguras (https); em arquivo local pode não chegar nada
    await new Promise((r) => setTimeout(r, 1500));
    status.textContent = ctx.reflex?.tiltSeen
      ? 'Movimento ativo: incline o aparelho.'
      : 'Este modo de abertura não envia a inclinação (precisa de https). O brilho segue o toque e se move sozinho.';
  });
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    sync();
  });
  panel.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'theme' || n === 'mode') s[n] = e.target.value;
    else s[n] = e.target.checked; // reduce, vibrate
    saveSettings(s);
    lockMode();
    apply();
  });
  apply();
  return { get: () => ({ ...s }) };
}
