// Temas e configurações. Só variáveis de cor mudam; o teclado e o motor nunca.
import { makeWake, wakeSupported } from './extras.js';
import { COLOR_KEYS, validHex, customVars } from './colors.js';
import { buildMemoryFile, parseMemoryFile, loadInto } from './memories.js';
import { listProfiles, allowedThemes, themeFor } from '../engine/profiles.js';
const KEY = 'calc12c.settings';
const THEMES = ['retro', 'platinum', 'moderno']; // 'retro' = Gold (padrão), 'platinum' = prata, 'moderno' = Retro (vidro)
const VERSION = 5; // v2: a vibração ao tocar passou a vir ligada; v3: som, não dormir, estilo da tecla ON e banda superior; v4: cores e orientação; v5: modo desenvolvedor
const APP_VERSION = 'V3.1';
const DEV_TAPS = 7; // toques na versão para ligar o modo desenvolvedor
const DEV_GAP_MS = 2000; // intervalo máximo entre dois toques
const MODES = ['auto', 'escuro', 'claro'];
const ON_STYLES = ['menu', 'on'];
const ORIENTS = ['auto', 'portrait', 'landscape'];
const noColors = () => ({ plate: null, f: null, g: null, display: null });

const lowEnd = () => (navigator.hardwareConcurrency ?? 8) <= 2 || (navigator.deviceMemory ?? 8) <= 2 ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export function defaultSettings() {
  // reduce: null = automático (liga sozinho em aparelhos simples); true/false = escolha do usuário
  return { v: VERSION, theme: null, mode: 'auto', reduce: null, vibrate: true, sound: 'off', wake: false, onStyle: 'on', topPad: 0, colors: noColors(), orient: 'auto', dev: false };
}

export function loadSettings() {
  const d = defaultSettings();
  try {
    const o = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (!o || typeof o !== 'object') return d;
    return {
      v: VERSION,
      theme: THEMES.includes(o.theme) ? o.theme : null, // null = o tema padrão do perfil, até a pessoa escolher outro
      mode: MODES.includes(o.mode) ? o.mode : d.mode,
      reduce: typeof o.reduce === 'boolean' ? o.reduce : null,
      // quem salvou antes da versão 2 passa a ter a vibração ligada (dá para desligar nas configurações)
      vibrate: (o.v ?? 1) < 2 ? true : o.vibrate === true,
      // antes era liga/desliga: quem tinha ligado fica no som suave
      sound: o.sound === true ? 'soft' : SOUNDS.includes(o.sound) ? o.sound : 'off',
      wake: o.wake === true,
      onStyle: ON_STYLES.includes(o.onStyle) ? o.onStyle : d.onStyle,
      topPad: Number.isFinite(o.topPad) ? Math.min(32, Math.max(0, Math.round(o.topPad))) : 0,
      colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, validHex(o.colors?.[k]) ? o.colors[k].toLowerCase() : null])),
      orient: ORIENTS.includes(o.orient) ? o.orient : 'auto',
      dev: o.dev === true,
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

const SOUNDS = ['off', 'soft', 'mech'];

// Cores personalizadas ficam como estilo direto no <html> e vencem as do tema; sem cor escolhida, a variável some.
let appliedColors = [];
export function applyColors(colors) {
  const root = document.documentElement;
  const vars = customVars(colors);
  for (const name of appliedColors) if (!(name in vars)) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  appliedColors = Object.keys(vars);
}

// Trava (ou libera) a orientação da tela. No Android costuma exigir o app instalado ou a tela cheia.
export async function lockOrientation(mode) {
  const so = window.screen?.orientation;
  if (!so?.lock) return 'unsupported';
  try {
    if (mode === 'auto') so.unlock?.();
    else await so.lock(mode);
    return 'ok';
  } catch {
    return 'blocked';
  }
}

export function mountSettings(ctx) {
  let s = loadSettings();
  const wake = makeWake();
  // tema que vale: a escolha, se o perfil em uso a oferece (ou o modo desenvolvedor); senão o padrão do perfil
  const effTheme = () => themeFor(ctx.profile.id, s.theme, s.dev);
  const apply = () => {
    applyTheme(effTheme(), s.mode, effectiveReduce(s));
    ctx.vibrate = s.vibrate;
    ctx.sounder.set(s.sound);
    ctx.setOnStyle?.(s.onStyle);
    ctx.calc.style.setProperty('--top-extra', s.topPad + 'px');
    wake(s.wake && wakeSupported());
    applyColors(s.dev ? s.colors : noColors()); // as cores só valem no modo desenvolvedor
  };
  const fsOk = !!document.fullscreenEnabled && !window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const panel = document.createElement('section');
  panel.className = 'settings';
  panel.hidden = true;
  panel.innerHTML =
    '<header class="settings-head"><span class="settings-title">Configurações</span>' +
    '<button type="button" class="settings-close" aria-label="Fechar configurações">✕</button></header>' +
    '<section class="group"><h3 class="group-title">Calculadora</h3>' +
    '<label class="row"><span class="txt">Modelo<small>Cada modelo guarda a sua própria memória; o RPN/ALG da 12C troca em f CHS e f EEX</small></span>' +
    '<select name="profile"></select></label></section>' +
    '<section class="group"><h3 class="group-title">Aparência</h3>' +
    '<label class="row"><span class="txt">Tema<small>Gold e Platinum são metálicos e sempre escuros; Retro é de vidro</small></span>' +
    '<select name="theme"></select></label>' +
    '<label class="row"><span class="txt">Modo<small>Automático segue o sistema; só vale no Retro</small></span>' +
    '<select name="mode"><option value="auto">Automático</option><option value="escuro">Escuro</option><option value="claro">Claro</option></select></label>' +
    '<label class="row"><span class="txt">Tecla ON<small>Um toque abre estas configurações; segurar abre o verso</small></span>' +
    '<select name="onStyle"><option value="on">ON</option><option value="menu">Menu (≡)</option></select></label>' +
    '<label class="row"><span class="txt">Altura da banda superior<small>Desce a placa metálica (notch ou barra de status)</small></span>' +
    '<input type="range" name="topPad" min="0" max="32" step="2"></label></section>' +
    '<section class="group dev-only" hidden><h3 class="group-title">Cores</h3>' +
    '<label class="row"><span class="txt">Placa e destaque<small>Faixa metálica, título e bordas</small></span><input type="color" name="color-plate"></label>' +
    '<label class="row"><span class="txt">Tecla f<small>Teclas e rótulos dourados</small></span><input type="color" name="color-f"></label>' +
    '<label class="row"><span class="txt">Tecla g<small>Teclas e rótulos azuis</small></span><input type="color" name="color-g"></label>' +
    '<label class="row"><span class="txt">Visor<small>Cor dos números e dos indicadores</small></span><input type="color" name="color-display"></label>' +
    '<div class="row"><span class="txt">Voltar às cores do tema<small>As cores escolhidas valem para qualquer tema</small></span>' +
    '<button type="button" class="mini reset-colors">Restaurar</button></div></section>' +
    '<section class="group"><h3 class="group-title">Números e teclas</h3>' +
    '<label class="row"><span class="txt">Separador decimal<small>Como os números aparecem no visor</small></span>' +
    '<select name="locale"><option value="br">1.234,56 (pt-BR)</option><option value="us">1,234.56 (en-US)</option></select></label>' +
    '<label class="row"><span class="txt">Vibração leve ao tocar<small>Só em aparelhos que permitem vibrar</small></span>' +
    '<input type="checkbox" name="vibrate" role="switch"></label>' +
    '<label class="row"><span class="txt">Som de tecla<small>Um som ao apertar e outro ao soltar</small></span>' +
    '<select name="sound"><option value="off">Desligado</option><option value="soft">Suave</option><option value="mech">Mecânico</option></select></label></section>' +
    '<section class="group"><h3 class="group-title">Tela</h3>' +
    (fsOk ? '<div class="row"><span class="txt">Tela cheia</span><button type="button" class="mini fs-btn" aria-pressed="false">Entrar</button></div>' : '') +
    '<label class="row"><span class="txt">Orientação<small class="orient-note">Automática gira com o aparelho; travar funciona no app instalado ou em tela cheia</small></span>' +
    '<select name="orient"><option value="auto">Automática</option><option value="portrait">Em pé</option><option value="landscape">Deitado</option></select></label>' +
    '<label class="row"><span class="txt">Manter a tela acesa<small class="wake-note">Evita que a tela apague enquanto você usa</small></span>' +
    '<input type="checkbox" name="wake" role="switch"></label>' +
    '<label class="row"><span class="txt">Reduzir efeitos<small>Vidro sólido e sem reflexo: poupa bateria</small></span>' +
    '<input type="checkbox" name="reduce" role="switch"></label></section>' +
    '<section class="group"><h3 class="group-title">Memórias</h3>' +
    '<div class="row"><span class="txt">Salvar em arquivo<small>Registradores, financeiros, fluxos de caixa, programa e fita</small></span>' +
    '<button type="button" class="mini mem-save">Salvar</button></div>' +
    '<div class="row"><span class="txt">Abrir arquivo<small>Substitui o que está na calculadora</small></span>' +
    '<button type="button" class="mini mem-open">Abrir</button><input type="file" class="mem-file" accept=".json,application/json" hidden></div>' +
    '<div class="row"><span class="txt">Compartilhar<small>Envia o arquivo por um app do aparelho</small></span>' +
    '<button type="button" class="mini mem-share">Enviar</button></div></section>' +
    '<section class="group"><h3 class="group-title">Brilho</h3>' +
    '<button type="button" class="motion">Testar movimento do aparelho</button>' +
    '<small class="motion-status" role="status"></small></section>' +
    '<section class="group"><h3 class="group-title">Mais</h3>' +
    '<div class="row"><span class="txt">Verso da calculadora<small>Guia de fórmulas com exemplos (ou segure a tecla ON)</small></span>' +
    '<button type="button" class="mini open-verso">Abrir</button></div>' +
    '<div class="row"><span class="txt">Redefinir configurações<small>Volta ao padrão; não apaga a memória da calculadora</small></span>' +
    '<button type="button" class="mini reset-settings">Redefinir</button></div>' +
    `<div class="row ver-row" role="button" tabindex="0"><span class="txt">Versão<small class="ver-note">Calc 12c ${APP_VERSION}</small></span></div></section>` +
    '<section class="group dev-only" hidden><h3 class="group-title">Desenvolvedor</h3>' +
    '<div class="row"><span class="txt">Modo desenvolvedor ativo<small>Libera as cores e os temas Gold e Platinum em qualquer modelo</small></span>' +
    '<button type="button" class="mini dev-off">Desativar</button></div></section>';
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
    const off = effTheme() !== 'moderno';
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
    const sel = panel.querySelector('[name=profile]');
    sel.innerHTML = listProfiles().map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
    sel.value = ctx.engine.profile;
    const THEME_NAMES = { retro: 'Gold', platinum: 'Platinum', moderno: 'Retro' };
    const themeSel = panel.querySelector('[name=theme]');
    themeSel.innerHTML = allowedThemes(ctx.profile.id, s.dev).map((t) => `<option value="${t}">${THEME_NAMES[t]}</option>`).join('');
    themeSel.value = effTheme();
    for (const g of panel.querySelectorAll('.dev-only')) g.hidden = !s.dev;
    panel.querySelector('[name=mode]').value = s.mode;
    panel.querySelector('[name=onStyle]').value = s.onStyle;
    panel.querySelector('[name=topPad]').value = s.topPad;
    panel.querySelector('[name=locale]').value = ctx.engine.locale;
    lockMode();
    panel.querySelector('[name=reduce]').checked = effectiveReduce(s);
    panel.querySelector('[name=vibrate]').checked = s.vibrate;
    panel.querySelector('[name=sound]').value = s.sound;
    panel.querySelector('[name=orient]').value = s.orient;
    const cs = getComputedStyle(document.documentElement);
    const fallback = { plate: '--brand', f: '--gold', g: '--blue', display: '--display-text' };
    for (const k of COLOR_KEYS) {
      const shown = s.colors[k] ?? cs.getPropertyValue(fallback[k]).trim();
      panel.querySelector(`[name=color-${k}]`).value = validHex(shown) ? shown.toLowerCase() : '#888888';
    }
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
  // ---- cores ----
  const onColor = (e) => {
    const k = e.target.name.slice(6);
    if (!COLOR_KEYS.includes(k) || !validHex(e.target.value)) return;
    s.colors[k] = e.target.value.toLowerCase();
    saveSettings(s);
    applyColors(s.colors);
  };
  panel.querySelector('.reset-colors').addEventListener('click', () => {
    s.colors = noColors();
    saveSettings(s);
    applyColors(s.colors);
    sync();
  });
  // ---- orientação ----
  const orientNote = panel.querySelector('.orient-note');
  const orientDefault = orientNote.textContent;
  const setOrient = async (mode, fromUser) => {
    const r = await lockOrientation(mode);
    if (r === 'ok' || mode === 'auto') orientNote.textContent = orientDefault;
    else if (fromUser) orientNote.textContent = r === 'unsupported' ? 'Este navegador não permite travar a orientação.' : 'Não foi possível travar aqui: instale o app ou entre em tela cheia e tente de novo.';
  };
  // ---- memórias em arquivo ----
  const fileInput = panel.querySelector('.mem-file');
  const asFile = () => {
    const { name, text } = buildMemoryFile(ctx.engine);
    return new File([text], name, { type: 'application/json' });
  };
  const download = (file) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  panel.querySelector('.mem-save').addEventListener('click', () => {
    const f = asFile();
    download(f);
    ctx.showNotice(`Memórias salvas: ${f.name}`);
  });
  panel.querySelector('.mem-share').addEventListener('click', async () => {
    const f = asFile();
    try {
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: 'Memórias da Calc 12c' });
      else {
        download(f); // sem compartilhamento neste navegador: baixa o arquivo
        ctx.showNotice(`Compartilhar não está disponível aqui; arquivo baixado: ${f.name}`);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') ctx.showNotice('Não foi possível compartilhar as memórias.');
    }
  });
  panel.querySelector('.mem-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    try {
      loadInto(ctx.engine, parseMemoryFile(await f.text()));
      if (!ctx.adoptProfile?.()) ctx.render(); // o arquivo pode ser de outro modelo

      sync();
      ctx.showNotice(`Memórias carregadas: ${f.name}`);
    } catch (err) {
      ctx.showNotice(err.message);
    }
  });

  // ---- modo desenvolvedor: 7 toques seguidos na versão ----
  let taps = 0;
  let lastTap = 0;
  const verNote = panel.querySelector('.ver-note');
  const setDev = (on) => {
    s.dev = on;
    saveSettings(s);
    taps = 0;
    apply();
    sync();
  };
  const tapVersion = () => {
    const now = Date.now();
    taps = now - lastTap > DEV_GAP_MS ? 1 : taps + 1;
    lastTap = now;
    if (s.dev) verNote.textContent = 'O modo desenvolvedor já está ativo';
    else if (taps >= DEV_TAPS) {
      setDev(true);
      verNote.textContent = 'Modo desenvolvedor ativado';
    } else if (taps >= 3) verNote.textContent = `Faltam ${DEV_TAPS - taps} toques para o modo desenvolvedor`;
  };
  const verRow = panel.querySelector('.ver-row');
  verRow.addEventListener('click', tapVersion);
  verRow.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapVersion()));
  panel.querySelector('.dev-off').addEventListener('click', () => {
    setDev(false);
    verNote.textContent = `Calc 12c ${APP_VERSION}`;
  });

  const themeless = new Set(['vibrate', 'sound', 'wake', 'onStyle', 'topPad', 'orient']);
  const onInput = (e) => {
    const n = e.target.name;
    if (n?.startsWith('color-')) return; // tratado por onColor
    if (n === 'orient') {
      s.orient = e.target.value;
      saveSettings(s);
      setOrient(s.orient, true);
      return;
    }
    if (n === 'profile') {
      ctx.setProfile(e.target.value);
      sync();
      return;
    }
    if (n === 'locale') {
      ctx.engine.setLocale(e.target.value);
      ctx.render();
      return;
    }
    if (n === 'theme' || n === 'mode' || n === 'onStyle' || n === 'sound') s[n] = e.target.value;
    else if (n === 'topPad') s.topPad = Number(e.target.value);
    else s[n] = e.target.checked; // reduce, vibrate, wake
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
  panel.addEventListener('input', (e) => (e.target.name?.startsWith('color-') ? onColor(e) : e.target.name === 'topPad' && onInput(e))); // a banda sobe e desce enquanto arrasta
  apply();
  if (s.orient !== 'auto') setOrient(s.orient, false); // reaplica a trava guardada
  return { get: () => ({ ...s }), setDev, refresh: () => { sync(); apply(); }, open, close, toggle: () => (panel.hidden ? open() : close()), isOpen: () => !panel.hidden };
}
