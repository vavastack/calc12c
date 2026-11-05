// Verso: guia de fórmulas com exemplos que podem ser executados na própria calculadora.
import { KEY_BY_ID } from '../engine/keymap.js';
import { VERSO_BY_PROFILE, preKeys } from './verso-data.js';

const STEP_MS = 140; // intervalo entre as teclas quando um exemplo é executado

const HEX_TOK = /^[0-9A-F]*[A-F][0-9A-F]*$/; // número com letras maiúsculas A-F (HEX da 16C)
const isNumTok = (t) => /^\d+(\.\d+)?$/.test(t) || HEX_TOK.test(t);

// "31.052003" → "31,052003"; ids do motor → rótulo impresso na tecla; f/g + tecla viram um chip só (ex.: "g ΔDYS")
export function chipsOf(keys, keyById = KEY_BY_ID) {
  const out = [];
  const t = keys.split(/\s+/).filter(Boolean);
  for (let i = 0; i < t.length; i++) {
    const id = t[i];
    if (isNumTok(id)) out.push({ text: id.replace('.', ','), kind: 'num' });
    else if ((id === 'f' || id === 'g') && t[i + 1] && !/^\d.+/.test(t[i + 1])) { // f/g + tecla (um dígito sozinho é tecla, ex.: g 4)
      const next = keyById.get(t[++i]);
      out.push({ text: `${id} ${next[id] ?? next.label}`, kind: id });
    } else out.push({ text: keyById.get(id)?.label ?? id, kind: 'fn' });
  }
  return out;
}

// Quebra a sequência em teclas do motor: cada número vira dígitos (e "." vira a tecla da vírgula)
export function expandKeys(keys) {
  const ids = [];
  for (const tok of keys.split(/\s+/).filter(Boolean)) {
    if (HEX_TOK.test(tok)) for (const c of tok) ids.push(/\d/.test(c) ? c : 'd' + c.toLowerCase()); // 16C: F0F → F, 0, F
    else if (/^\d+(\.\d+)?$/.test(tok)) for (const c of tok) ids.push(c === '.' ? 'dot' : c);
    else ids.push(tok);
  }
  return ids;
}

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function variantHtml(v, ready, key, keyById) {
  const chips = chipsOf(v.keys, keyById).map((c) => `<span class="chip ${c.kind}">${esc(c.text)}</span>`).join('');
  const btn = ready
    ? `<button type="button" class="run" data-run="${key}">Executar</button>`
    : '<button type="button" class="run" disabled>Em breve</button>';
  return `<div class="variant"><span class="v-label">${esc(v.label)}</span><div class="chips">${chips}</div>${btn}</div>`;
}

export function mountVerso(ctx) {
  const el = document.createElement('section');
  el.className = 'verso';
  el.hidden = true;
  el.setAttribute('aria-label', 'Verso da calculadora: guia de fórmulas');
  const data = VERSO_BY_PROFILE[ctx.profile.id] ?? { sections: [], sigma: [] }; // cada perfil tem o seu guia
  const keyById = ctx.profile.keyById;
  const sigma = data.sigma.map(([a, b]) => `<span class="sg">${esc(a)}</span><span class="ar">→</span><span class="sr">${esc(b)}</span>`).join('');
  const runs = new Map();
  let n = 0;
  const secs = data.sections.map((g) => {
    const items = g.items.map((it) => {
      const vs = it.variants.map((v) => {
        const key = 'r' + n++;
        runs.set(key, { it, v });
        return variantHtml(v, it.ready, key, keyById);
      }).join('');
      const lst = it.listing ? `<ol class="listing">${it.listing.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : '';
      return `<article class="v-item"><h4>${esc(it.title)}</h4><p>${esc(it.text)}</p>${lst}${vs}</article>`;
    }).join('');
    return `<section class="v-sec" data-sec="${g.id}"><span class="v-tag" aria-hidden="true">${esc(g.tag)}</span><div class="v-body"><h3>${esc(g.title)}</h3>${g.note ? `<p class="v-note">${esc(g.note)}</p>` : ''}${items}</div></section>`;
  }).join('');
  el.innerHTML =
    '<header class="verso-head"><span class="verso-title">Verso · guia rápido</span>' +
    '<button type="button" class="verso-close" aria-label="Voltar à frente da calculadora">✕</button></header>' +
    '<p class="verso-hint">Os exemplos usam a pilha RPN: digite o número, ENTER, e depois a função (se a calculadora estiver em ALG, ela passa para RPN ao executar; os exemplos do grupo ALG ligam o ALG sozinhos). Toque em Executar para ver as teclas sendo apertadas.</p>' +
    (data.sigma.length ? `<section class="v-sec sigma"><span class="v-tag sigma-tag" aria-hidden="true">Σ</span><div class="v-body"><h3>Estatística: onde ficam os totais</h3><div class="sigma-map">${sigma}</div></div></section>` : '') +
    secs;
  ctx.calc.append(el);

  let busy = 0; // identifica a execução em andamento (outra execução ou fechar cancela a anterior)
  const open = () => {
    ctx.settings?.close?.();
    el.hidden = false;
    el.classList.remove('flip');
    void el.offsetWidth;
    el.classList.add('flip');
    el.scrollTop = 0;
  };
  const close = () => {
    el.hidden = true;
  };
  const run = async (keys, label, pre = '') => {
    const my = ++busy;
    close();
    const e = ctx.engine;
    e.shift = null; // começa limpo: sem prefixo f/g pendente nem erro na tela
    e.pending = null;
    e.error = null;
    if (e.prgm) { // os exemplos supõem o modo de execução
      ctx.pressKey('f');
      ctx.pressKey('rs');
    }
    if (e.mode !== 'rpn') { // os exemplos supõem a pilha RPN
      ctx.pressKey('f');
      ctx.pressKey('chs');
    }
    for (const id of expandKeys(pre)) ctx.pressKey(id); // gravação do programa: rápida, sem animação
    for (const id of expandKeys(keys)) {
      if (my !== busy) return;
      ctx.tapFx(id);
      ctx.pressKey(id);
      await new Promise((r) => setTimeout(r, ctx.fast ? 0 : STEP_MS));
    }
    if (my === busy) ctx.showNotice(`Exemplo executado: ${label}`);
  };
  el.addEventListener('click', (ev) => {
    if (ev.target.closest('.verso-close')) return close();
    const b = ev.target.closest('[data-run]');
    if (!b) return;
    const r = runs.get(b.dataset.run);
    run(r.v.keys, `${r.it.title} (${r.v.label})`, preKeys(r.it, r.v));
  });
  return { el, open, close, isOpen: () => !el.hidden, toggle: () => (el.hidden ? open() : close()), run };
}
