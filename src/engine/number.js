// Arredonda para 10 dígitos significativos.
export function round10(x) {
  if (!Number.isFinite(x)) return x;
  return Number(x.toPrecision(10));
}

// Formata com `decimals` casas e separadores pt-BR ('br') ou en-US ('us').
export function formatNumber(x, decimals, locale = 'br') {
  const fixed = Math.abs(x).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const thousands = locale === 'br' ? '.' : ',';
  const decimal = locale === 'br' ? ',' : '.';
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const neg = x < 0 && Number(fixed) !== 0 ? '-' : '';
  return neg + grouped + (frac !== undefined ? decimal + frac : '');
}
