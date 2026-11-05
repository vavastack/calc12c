// Temas e configurações. Só variáveis de cor mudam; o teclado e o motor nunca.
const KEY = 'calc12c.settings';
const THEMES = ['retro', 'platinum', 'moderno']; // 'retro' = Gold (padrão), 'platinum' = prata, 'moderno' = Retro (vidro)
const VERSION = 2; // v2: a vibração ao tocar passou a vir ligada
const MODES = ['auto', 'escuro', 'claro'];

const lowEnd = () => (navigator.hardwareConcurrency ?? 8) <= 2 || (navigator.deviceMemory ?? 8) <= 2 ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export function defaultSettings() {
  // reduce: null = automático (liga sozinho em aparelhos simples); true/false = escolha do usuário
  return { v: VERSION, theme: 'retro', mode: 'auto', reduce: null, vibrate: true };
}

export function loadSettings() {
  const d = defaultSettings();
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (!o || typeof o !== 'object') return d;
    return {
      v: VERSION,
      theme: THEMES.includes(o.theme) ? o.theme : d.theme,
      mode: MODES.includes(o.mode) ? o.mode : d.mode,
      reduce: typeof o.reduce === 'boolean' ? o.reduce : null,
      // quem salvou antes da versão 2 passa a ter a vibração ligada (dá para desligar nas configurações)
      vibrate: (o.v ?? 1) < VERSION ? true : o.vibrate === true,
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

// Uma única camada de brilho cobre todo o vidro (placa, visor e teclado); a .sheen reforça só a placa metálica
function ensureReflexLayer(reduce) {
  const calc = document.querySelector('.calc');
  if (!calc) return;
  const clip = calc.querySelector(':scope > .reflex-clip');
  if (reduce) {
    clip?.remove();
    return;
  }
  if (clip) return;
  const c = document.createElement('div');
  c.className = 'reflex-clip';
  c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<div class="reflex"></div><div class="sheen-clip"><div class="sheen"></div></div>';
  calc.append(c);
}

export function applyTheme(theme, mode, reduceEffects) {
  last = { theme, mode, reduce: !!reduceEffects };
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'moderno' ? 'moderno-' + (mode === 'auto' ? (dark ? 'escuro' : 'claro') : mode) : theme;
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
    '<label class="row"><span class="txt">Tema<small>Gold e Platinum são metálicos e sempre escuros; Retro é de vidro</small></span>' +
    '<select name="theme"><option value="retro">Gold</option><option value="platinum">Platinum</option><option value="moderno">Retro</option></select></label>' +
    '<label class="row"><span class="txt">Modo<small>Automático segue o sistema; só vale no Retro</small></span>' +
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
  // altura da placa metálica: o brilho de ênfase fica restrito a ela
  const plate = ctx.top.querySelector('.brand');
  if (plate) {
    const setPlate = () => ctx.calc.style.setProperty('--plate-h', plate.offsetHeight + 'px');
    setPlate();
    if (typeof ResizeObserver === 'function') new ResizeObserver(setPlate).observe(plate);
  }
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
    const off = s.theme !== 'moderno';
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
      status.textContent = 'Sem permissão ou sensor. O brilho se move sozinho, devagar.';
      return;
    }
    // o Chrome só envia a inclinação em páginas seguras (https); em arquivo local pode não chegar nada
    await new Promise((r) => setTimeout(r, 1500));
    status.textContent = ctx.reflex?.tiltSeen
      ? 'Movimento ativo e calibrado na posição atual: incline o aparelho.'
      : 'Este modo de abertura não envia a inclinação (precisa de https). O brilho se move sozinho, devagar.';
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
    // troca de tema com fusão suave (View Transitions); sem suporte ou com movimento reduzido, troca direto
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && n !== 'vibrate') {
      const vt = document.startViewTransition(() => apply());
      // trocas rápidas cancelam a transição anterior; isso é esperado, não é erro
      for (const k of ['ready', 'finished', 'updateCallbackDone']) vt[k] && vt[k].catch(() => {});
    } else {
      apply();
    }
  });
  apply();
  return { get: () => ({ ...s }) };
}
