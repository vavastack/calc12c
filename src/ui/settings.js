// Temas e configurações. Só variáveis de cor mudam; o teclado e o motor nunca.
import { makeWake, wakeSupported } from './extras.js';
const KEY = 'calc12c.settings';
const THEMES = ['retro', 'platinum', 'moderno']; // 'retro' = Gold (padrão), 'platinum' = prata, 'moderno' = Retro (vidro)
const VERSION = 3; // v2: a vibração ao tocar passou a vir ligada; v3: som, não dormir, estilo da tecla ON e banda superior
const MODES = ['auto', 'escuro', 'claro'];
const ON_STYLES = ['menu', 'on'];

const lowEnd = () => (navigator.hardwareConcurrency ?? 8) <= 2 || (navigator.deviceMemory ?? 8) <= 2 ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export function defaultSettings() {
  // reduce: null = automático (liga sozinho em aparelhos simples); true/false = escolha do usuário
  return { v: VERSION, theme: 'retro', mode: 'auto', reduce: null, vibrate: true, sound: false, wake: false, onStyle: 'on', topPad: 0 };
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
      vibrate: (o.v ?? 1) < 2 ? true : o.vibrate === true,
      sound: o.sound === true,
      wake: o.wake === true,
      onStyle: ON_STYLES.includes(o.onStyle) ? o.onStyle : d.onStyle,
      topPad: Number.isFinite(o.topPad) ? Math.min(32, Math.max(0, Math.round(o.topPad))) : 0,
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
  const wake = makeWake();
  const apply = () => {
    applyTheme(s.theme, s.mode, effectiveReduce(s));
    ctx.vibrate = s.vibrate;
    ctx.sound = s.sound;
    ctx.setOnStyle?.(s.onStyle);
    ctx.calc.style.setProperty('--top-extra', s.topPad + 'px');
    wake(s.wake && wakeSupported());
  };
  const fsOk = !!document.fullscreenEnabled && !window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
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
    '<select name="mode"><option value="auto">Automático</option><option value="escuro">Escuro</option><option value="claro">Claro</option></select></label>' +
    '<label class="row"><span class="txt">Tecla ON<small>Um toque abre estas configurações; segurar abre o verso</small></span>' +
    '<select name="onStyle"><option value="on">ON</option><option value="menu">Menu (≡)</option></select></label>' +
    '<label class="row"><span class="txt">Altura da banda superior<small>Desce a placa metálica (notch ou barra de status)</small></span>' +
    '<input type="range" name="topPad" min="0" max="32" step="2"></label></section>' +
    '<section class="group"><h3 class="group-title">Números e teclas</h3>' +
    '<label class="row"><span class="txt">Separador decimal<small>Como os números aparecem no visor</small></span>' +
    '<select name="locale"><option value="br">1.234,56 (pt-BR)</option><option value="us">1,234.56 (en-US)</option></select></label>' +
    '<label class="row"><span class="txt">Vibração leve ao tocar<small>Só em aparelhos que permitem vibrar</small></span>' +
    '<input type="checkbox" name="vibrate" role="switch"></label>' +
    '<label class="row"><span class="txt">Som de tecla<small>Clique curto a cada toque</small></span>' +
    '<input type="checkbox" name="sound" role="switch"></label></section>' +
    '<section class="group"><h3 class="group-title">Tela</h3>' +
    (fsOk ? '<div class="row"><span class="txt">Tela cheia</span><button type="button" class="mini fs-btn" aria-pressed="false">Entrar</button></div>' : '') +
    '<label class="row"><span class="txt">Manter a tela acesa<small class="wake-note">Evita que a tela apague enquanto você usa</small></span>' +
    '<input type="checkbox" name="wake" role="switch"></label>' +
    '<label class="row"><span class="txt">Reduzir efeitos<small>Vidro sólido e sem reflexo: poupa bateria</small></span>' +
    '<input type="checkbox" name="reduce" role="switch"></label></section>' +
    '<section class="group"><h3 class="group-title">Brilho</h3>' +
    '<button type="button" class="motion">Testar movimento do aparelho</button>' +
    '<small class="motion-status" role="status"></small></section>' +
    '<section class="group"><h3 class="group-title">Mais</h3>' +
    '<div class="row"><span class="txt">Verso da calculadora<small>Guia de fórmulas com exemplos (ou segure a tecla ON)</small></span>' +
    '<button type="button" class="mini open-verso">Abrir</button></div>' +
    '<div class="row"><span class="txt">Redefinir configurações<small>Volta ao padrão; não apaga a memória da calculadora</small></span>' +
    '<button type="button" class="mini reset-settings">Redefinir</button></div></section>';
  // altura da placa metálica: o brilho de ênfase fica restrito a ela
  const plate = ctx.top.querySelector('.brand');
  if (plate) {
    const setPlate = () => ctx.calc.style.setProperty('--plate-h', plate.offsetHeight + 'px');
    setPlate();
    if (typeof ResizeObserver === 'function') new ResizeObserver(setPlate).observe(plate);
  }
  ctx.calc.append(panel);
  // os temas Gold e Platinum são sempre escuros: a escolha de modo fica inativa
  const lockMode = () => {
    const off = s.theme !== 'moderno';
    const sel = panel.querySelector('[name=mode]');
    sel.disabled = off;
    sel.closest('.row').classList.toggle('off', off);
  };
  const fs = panel.querySelector('.fs-btn');
  const paintFs = () => {
    if (!fs) return;
    const on = !!document.fullscreenElement;
    fs.textContent = on ? 'Sair' : 'Entrar';
    fs.setAttribute('aria-pressed', String(on));
  };
  const wakeOk = wakeSupported();
  const sync = () => {
    panel.querySelector('[name=theme]').value = s.theme;
    panel.querySelector('[name=mode]').value = s.mode;
    panel.querySelector('[name=onStyle]').value = s.onStyle;
    panel.querySelector('[name=topPad]').value = s.topPad;
    panel.querySelector('[name=locale]').value = ctx.engine.locale;
    lockMode();
    panel.querySelector('[name=reduce]').checked = effectiveReduce(s);
    panel.querySelector('[name=vibrate]').checked = s.vibrate;
    panel.querySelector('[name=sound]').checked = s.sound;
    const w = panel.querySelector('[name=wake]');
    w.checked = s.wake && wakeOk;
    w.disabled = !wakeOk;
    w.closest('.row').classList.toggle('off', !wakeOk);
    if (!wakeOk) panel.querySelector('.wake-note').textContent = 'Este navegador não permite manter a tela acesa';
    paintFs();
  };
  const close = () => (panel.hidden = true);
  const open = () => {
    ctx.verso?.close();
    sync();
    panel.hidden = false;
  };
  panel.querySelector('.settings-close').addEventListener('click', close);
  if (fs) {
    fs.addEventListener('click', () => {
      const r = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      r?.catch(() => {});
    });
    document.addEventListener('fullscreenchange', paintFs);
  }
  panel.querySelector('.open-verso').addEventListener('click', () => {
    close();
    ctx.verso.open();
  });
  const reset = panel.querySelector('.reset-settings');
  let armed;
  reset.addEventListener('click', () => {
    if (!armed) {
      // confirmação em dois toques, sem janela do navegador
      reset.textContent = 'Toque de novo';
      armed = setTimeout(() => {
        armed = null;
        reset.textContent = 'Redefinir';
      }, 3000);
      return;
    }
    clearTimeout(armed);
    armed = null;
    reset.textContent = 'Redefinir';
    s = defaultSettings();
    saveSettings(s);
    sync();
    apply();
  });
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
  const themeless = new Set(['vibrate', 'sound', 'wake', 'onStyle', 'topPad']);
  const onInput = (e) => {
    const n = e.target.name;
    if (n === 'locale') {
      ctx.engine.setLocale(e.target.value);
      ctx.render();
      return;
    }
    if (n === 'theme' || n === 'mode' || n === 'onStyle') s[n] = e.target.value;
    else if (n === 'topPad') s.topPad = Number(e.target.value);
    else s[n] = e.target.checked; // reduce, vibrate, sound, wake
    saveSettings(s);
    lockMode();
    // troca de tema com fusão suave (View Transitions); sem suporte ou com movimento reduzido, troca direto
    if (!themeless.has(n) && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const vt = document.startViewTransition(() => apply());
      // trocas rápidas cancelam a transição anterior; isso é esperado, não é erro
      for (const k of ['ready', 'finished', 'updateCallbackDone']) vt[k] && vt[k].catch(() => {});
    } else {
      apply();
    }
  };
  panel.addEventListener('change', onInput);
  panel.addEventListener('input', (e) => e.target.name === 'topPad' && onInput(e)); // a banda sobe e desce enquanto arrasta
  apply();
  return { get: () => ({ ...s }), open, close, toggle: () => (panel.hidden ? open() : close()), isOpen: () => !panel.hidden };
}
