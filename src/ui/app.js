import { createEngine } from '../engine/engines.js';
import { getProfile } from '../engine/profiles.js';
import { renderDisplay, bindKeyboard } from './display.js';
import { mountDrawer } from './tape.js';
import { loadState, saveState, saveActiveProfile } from './storage.js';
import { loadInto } from './memories.js';
import { mountSettings } from './settings.js';
import { startReflex } from './reflex.js';
import { mountVerso } from './verso.js';
import { makeSound } from './extras.js';
import { initSplash } from './splash.js';

const NOTICE_MS = 2200;

// Posição no layout horizontal (4 × 10): metade de baixo do vertical vai para as colunas 6 a 10.
const hpos = (k) => (k.row < 4 ? { r: k.row, c: k.col } : { r: k.row - 4, c: k.col + 5 });

// As linhas de ligação das funções agrupadas (BOND, DEPRECIATION, CLEAR, PREFIX) vêm do perfil (profiles.js).
function makeBracket(b) {
  const el = document.createElement('span');
  el.className = 'bracket' + (b.cls ? ' ' + b.cls : '');
  el.setAttribute('aria-hidden', 'true');
  for (const [k, v] of Object.entries({ r: b.r, c0: b.c0, c1: b.c1, hr: b.hr, hc0: b.hc0, hc1: b.hc1 })) el.style.setProperty('--' + k, v);
  el.innerHTML = b.label ? `<i></i><b>${b.label}</b><i></i>` : '<i></i>';
  return el;
}

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
    `<span class="face" aria-hidden="true"></span><span class="lf">${k.f ?? ''}</span><span class="lm">${k.label}</span><span class="lg">${k.g ?? ''}</span>`;
  return b;
}

export function mountApp(root, engine = createEngine()) {
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
  const top = document.createElement('div');
  top.className = 'top';
  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '<span class="name"><b class="title"></b></span><span class="rule" aria-hidden="true"></span>' +
    '<span class="badge" aria-hidden="true"><span class="mw"><svg viewBox="0 0 44 28" preserveAspectRatio="xMidYMid meet" focusable="false"><circle cx="22" cy="14" r="11" class="disc"/><g transform="translate(2.6 0) skewX(-11)" fill="none" stroke-width="2.3" stroke-linejoin="miter" stroke-miterlimit="4" class="lit"><polyline points="14,19.4 14,8.6 17.6,15.4 21.2,8.6 21.2,19.4"/><polyline points="22.7,8.6 24.6,19.4 26.7,12.6 28.8,19.4 30.6,8.6"/></g></svg></span><span class="model">RPN</span></span>';
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

  const ctx = { root, calc, top, display, keys, notice, engine, showNotice, listeners: [], vibrate: false, sounder: makeSound(), profile: getProfile(engine.profile) };
  // teclado do perfil: teclas e linhas de ligação
  const buildKeys = () => {
    keys.replaceChildren();
    for (const k of ctx.profile.keys) keys.append(makeKey(k));
    for (const b of ctx.profile.brackets) keys.append(makeBracket(b));
    bindOnKey();
  };
  // título e selo do topo seguem o perfil e o modo (RPN/ALG só nos perfis que têm os dois)
  const paintBrand = (s) => {
    const p = ctx.profile;
    const modeLabel = p.model; // o selo mostra o modelo (12C ou 16C); RPN e ALG ficam nos indicadores do visor
    const title = brand.querySelector('.title');
    if (title.dataset.profile !== p.id) { // o título muda só quando o perfil muda
      title.dataset.profile = p.id;
      document.documentElement.setAttribute('data-model', p.id); // o tema Retro usa prata na Platinum
      title.classList.toggle('two', !!p.title);
      if (p.title) title.innerHTML = `<span class="l1">${p.title[0]}</span><small class="l2">${p.title[1]}</small>`; // ex.: Platinum com 12c embaixo
      else title.textContent = p.name;
    }
    brand.querySelector('.model').textContent = modeLabel;
    brand.setAttribute('aria-label', `${p.name}, calculadora ${p.kind === 'int' ? 'de programador' : 'financeira'} ${modeLabel}`);
  };
  ctx.render = () => {
    const s = engine.state;
    paintBrand(s);
    renderDisplay(display, s);
    calc.dataset.shift = s.shift ?? '';
    ctx.listeners.forEach((fn) => fn(ctx, s));
  };
  display.addEventListener('click', (ev) => {
    if (!ev.target.closest('.fmt-toggle')) return;
    engine.setLocale(engine.locale === 'br' ? 'us' : 'br');
    ctx.render();
  });
  // Alguns navegadores só liberam a vibração depois que o toque termina (ativação do usuário): se a do "encostar" for
  // recusada, a tecla vibra ao soltar. `ctx.hapticOk` guarda se a vibração já funcionou neste toque.
  const haptic = (ms) => (ctx.vibrate && navigator.vibrate ? navigator.vibrate(ms) : false);
  // efeito do toque: realce só dentro da tecla, a partir de onde o dedo encostou (ou do centro, quando vem de um exemplo)
  const tapFx = (b, x = 50, y = 50) => {
    b.style.setProperty('--tx', x.toFixed(1) + '%');
    b.style.setProperty('--ty', y.toFixed(1) + '%');
    b.classList.remove('touch');
    void b.offsetWidth;
    b.classList.add('touch');
    b.addEventListener('animationend', () => b.classList.remove('touch'), { once: true });
  };
  const kindOf = (id) => (id === 'enter' ? 'enter' : id === 'f' || id === 'g' ? 'fg' : /^\d$|^dot$|^d[a-f]$/.test(id) ? 'num' : 'fn');
  // a tecla afunda ao encostar e volta ao soltar; o som acompanha os dois momentos
  let pressed = null;
  const keyDown = (b) => {
    b.classList.add('down');
    ctx.sounder.play(kindOf(b.dataset.id), 'down');
  };
  const keyUp = (b) => {
    b.classList.remove('down');
    ctx.sounder.play(kindOf(b.dataset.id), 'up');
  };
  keys.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('button.key');
    const k = b && ctx.profile.keys.find((x) => x.id === b.dataset.id);
    if (!k?.enabled) return;
    const r = b.getBoundingClientRect();
    tapFx(b, ((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100);
    if (pressed) pressed.classList.remove('down');
    pressed = b;
    keyDown(b);
    ctx.hapticOk = k.id === 'on' || haptic(12); // vibra já ao encostar, como uma tecla de verdade
  });
  const release = () => {
    if (!pressed) return;
    keyUp(pressed);
    pressed = null;
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', release);
  // aperta uma tecla do motor (usada pelo teclado da tela e pelos exemplos do verso)
  ctx.pressKey = (id) => {
    const b = keys.querySelector(`button.key[data-id="${id}"]`);
    if (id === 'f' || id === 'g') {
      // brilho curto da tecla f/g; reinicia a animação a cada toque
      b.classList.remove('flash');
      void b.offsetWidth;
      b.classList.add('flash');
      b.addEventListener('animationend', () => b.classList.remove('flash'), { once: true });
    }
    clearTimeout(ctx.pauseTimer); // qualquer tecla interrompe as pausas (PSE) em andamento
    engine.press(id);
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
  };
  ctx.tapFx = (id) => {
    // usado pelos exemplos do verso: a tecla afunda e volta sozinha, com o mesmo som do toque
    const b = keys.querySelector(`button.key[data-id="${id}"]`);
    if (!b) return;
    tapFx(b);
    keyDown(b);
    setTimeout(() => keyUp(b), 90);
  };
  // tecla ON: um toque abre/fecha as configurações; segurar abre/fecha o verso (guia de fórmulas)
  const HOLD_MS = 500;
  let holdTimer;
  let held = false;
  const getOnKey = () => keys.querySelector('button.key[data-id="on"]');
  function bindOnKey() { // a tecla é refeita quando o perfil muda: os ouvintes dela são ligados a cada montagem
    const onKey = getOnKey();
    onKey.addEventListener('pointerdown', () => {
      held = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        held = true;
        haptic(20);
        ctx.verso.toggle();
      }, HOLD_MS);
    });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) onKey.addEventListener(t, () => clearTimeout(holdTimer));
    onKey.addEventListener('contextmenu', (ev) => ev.preventDefault()); // o menu de "segurar" do celular não deve abrir
  }
  // rótulo da tecla ON: "≡" (menu) ou "ON"; sem o "OFF" impresso, já que a tecla agora abre as configurações
  ctx.setOnStyle = (style) => {
    const onKey = getOnKey();
    const menu = style !== 'on';
    onKey.querySelector('.lm').textContent = menu ? '≡' : 'ON';
    onKey.querySelector('.lf').textContent = menu ? '' : 'OFF'; // no estilo ON mantém o rótulo impresso da HP
    onKey.classList.toggle('menu-key', menu);
    onKey.setAttribute('aria-label', (menu ? 'Menu' : 'ON') + ': toque para as configurações, segure para o verso');
  };
  buildKeys();
  ctx.setOnStyle('on');
  ctx.onTap = () => {
    if (ctx.verso.isOpen()) ctx.verso.close();
    else ctx.settings.toggle();
  };
  keys.addEventListener('click', (ev) => {
    const b = ev.target.closest('button.key');
    if (!b) return;
    const k = ctx.profile.keys.find((x) => x.id === b.dataset.id);
    if (k.id === 'on') {
      if (held) held = false; // o segurar já abriu o verso; o clique que vem ao soltar não faz mais nada
      else {
        haptic(12);
        ctx.onTap();
      }
      ctx.hapticOk = false;
      return;
    }
    if (!k.enabled) {
      showNotice('Programação e estatística: não disponível nesta versão.');
      return;
    }
    if (!ctx.hapticOk) haptic(12);
    ctx.hapticOk = false;
    ctx.pressKey(k.id);
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
  ctx.verso = mountVerso(ctx);
  // Troca de perfil: guarda o estado do atual, carrega o do novo (cada perfil tem o seu) e refaz teclado, selo e verso.
  // `adoptProfile` também serve quando um arquivo de memórias de outro perfil é aberto.
  ctx.adoptProfile = () => {
    if (engine.profile === ctx.profile.id) return false;
    ctx.profile = getProfile(engine.profile);
    saveActiveProfile(engine.profile);
    buildKeys();
    ctx.setOnStyle(ctx.settings?.get().onStyle ?? 'on');
    ctx.verso.el.remove();
    ctx.verso = mountVerso(ctx);
    ctx.settings?.refresh(); // o tema depende do perfil
    ctx.render();
    return true;
  };
  ctx.setProfile = (id) => {
    if (id === engine.profile) return;
    saveState(engine);
    loadInto(engine, loadState(id));
    ctx.adoptProfile();
  };
  ctx.settings = mountSettings(ctx);
  initSplash();
  ctx.listeners.push(() => saveState(engine)); // salvamento automático
  ctx.render();
  return ctx;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return; // file:// não tem service worker
  navigator.serviceWorker.register('./sw.js').catch(() => {}); // sem SW o app segue funcionando
}

// Altura real da área visível: em alguns celulares (tela cheia, PWA, barra de status) o 100dvh vem maior que a janela
// e as últimas fileiras de teclas ficam para fora. Medimos a janela de verdade e deixamos o CSS usar o menor valor.
function trackViewportHeight() {
  const set = () => {
    const h = Math.round(Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity));
    if (h > 0) document.documentElement.style.setProperty('--app-h', h + 'px');
  };
  set();
  window.addEventListener('resize', set);
  window.visualViewport?.addEventListener('resize', set);
  window.addEventListener('orientationchange', () => setTimeout(set, 250));
  // entrar/sair da tela cheia anima: mede de novo quando o navegador termina
  document.addEventListener('fullscreenchange', () => [100, 350, 900].forEach((ms) => setTimeout(set, ms)));
}

const root = document.getElementById('app');
if (root) {
  trackViewportHeight();
  window.calc12c = mountApp(root, loadState());
  registerServiceWorker();
}
