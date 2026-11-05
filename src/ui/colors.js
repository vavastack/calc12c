// Editor de cores: a partir de uma cor escolhida, gera as variáveis CSS (degradês, bordas, sombras, tinta)
// que sobrepõem as do tema. Funções puras: não tocam no DOM.
export const COLOR_KEYS = ['plate', 'f', 'g', 'display'];

export const validHex = (h) => typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h);

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

// t = 0 devolve a, t = 1 devolve b
export function mix(a, b, t) {
  const [x, y] = [rgb(a), rgb(b)];
  return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
export const lighten = (h, t) => mix(h, '#ffffff', t);
export const darken = (h, t) => mix(h, '#000000', t);

// Luminância relativa (WCAG) de 0 a 1
export function luminance(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Tinta legível sobre a cor: escura em fundos claros, branca em fundos escuros
export const inkOn = (h) => (luminance(h) > 0.4 ? '#14110a' : '#ffffff');

// colors = { plate, f, g, display }, cada uma #rrggbb ou null (null = cor do tema). Devolve { '--variável': valor }.
export function customVars(colors = {}) {
  const v = {};
  const { plate, f, g, display } = colors;
  if (validHex(plate)) {
    Object.assign(v, {
      '--plate-a': darken(plate, 0.22), '--plate-b': lighten(plate, 0.3), '--plate-c': plate,
      '--plate-edge': darken(plate, 0.45), '--plate-ink': darken(plate, 0.75),
      '--brand': plate, '--edge': darken(plate, 0.2), '--rim-a': lighten(plate, 0.15), '--rim-b': darken(plate, 0.35),
    });
  }
  if (validHex(f)) {
    Object.assign(v, {
      '--gold': f, '--keyf-bg': `linear-gradient(${lighten(f, 0.2)}, ${darken(f, 0.2)})`, '--keyf-border': lighten(f, 0.12),
      '--keyf-text': inkOn(f), '--keyf-shadow': `0 2px 0 ${darken(f, 0.65)}, inset 0 1px 0 #ffffff55`, '--flash-f': f + 'e6',
    });
  }
  if (validHex(g)) {
    Object.assign(v, {
      '--blue': g, '--keyg-bg': `linear-gradient(${lighten(g, 0.2)}, ${darken(g, 0.2)})`, '--keyg-border': lighten(g, 0.12),
      '--keyg-text': inkOn(g), '--keyg-shadow': `0 2px 0 ${darken(g, 0.65)}, inset 0 1px 0 #ffffff59`, '--flash-g': g + 'e6',
    });
  }
  if (validHex(display)) Object.assign(v, { '--display-text': display, '--display-glow': `0 0 12px ${display}8c`, '--ind-on': display });
  return v;
}
