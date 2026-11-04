// Mapa único do teclado (39 teclas). Posição no layout vertical: 5 colunas × 8 linhas.
// Metade de cima = colunas 1 a 5 da HP 12C original; metade de baixo = colunas 6 a 10.
// `f` (dourado) e `g` (azul) são os rótulos oficiais; `enabled:false` = fora do escopo (PRGM, estatística).
const k = (id, label, f, g, row, col, extra = {}) => ({ id, label, f, g, row, col, enabled: true, ...extra });

export const KEYS = [
  // linha 0
  k('n', 'n', 'AMORT', '12×', 0, 0),
  k('i', 'i', 'INT', '12÷', 0, 1),
  k('pv', 'PV', 'NPV', 'CFo', 0, 2),
  k('pmt', 'PMT', 'RND', 'CFj', 0, 3),
  k('fv', 'FV', 'IRR', 'Nj', 0, 4),
  // linha 1
  k('yx', 'yˣ', 'PRICE', '√x', 1, 0),
  k('recip', '1/x', 'YTM', 'eˣ', 1, 1),
  k('pctT', '%T', 'SL', 'LN', 1, 2),
  k('dpct', 'Δ%', 'SOYD', 'FRAC', 1, 3),
  k('pct', '%', 'DB', 'INTG', 1, 4),
  // linha 2
  k('rs', 'R/S', 'P/R', 'PSE', 2, 0, { enabled: false }),
  k('sst', 'SST', 'Σ', 'BST', 2, 1, { enabled: false }),
  k('rdown', 'R↓', 'PRGM', 'GTO', 2, 2),
  k('xy', 'x≷y', 'FIN', 'x≤y', 2, 3),
  k('clx', 'CLx', 'REG', 'x=0', 2, 4),
  // linha 3
  k('on', 'ON', null, null, 3, 0),
  k('f', 'f', null, null, 3, 1),
  k('g', 'g', null, null, 3, 2),
  k('sto', 'STO', null, null, 3, 3),
  k('rcl', 'RCL', null, null, 3, 4),
  // linha 4
  k('chs', 'CHS', null, 'DATE', 4, 0),
  k('7', '7', null, 'BEG', 4, 1),
  k('8', '8', null, 'END', 4, 2),
  k('9', '9', null, 'MEM', 4, 3),
  k('divide', '÷', null, null, 4, 4),
  // linha 5
  k('eex', 'EEX', null, 'ΔDYS', 5, 0),
  k('4', '4', null, 'D.MY', 5, 1),
  k('5', '5', null, 'M.DY', 5, 2),
  k('6', '6', null, 'x̄w', 5, 3),
  k('times', '×', null, null, 5, 4),
  // linhas 6-7 (ENTER ocupa as duas)
  k('enter', 'ENTER', 'PREFIX', 'LSTx', 6, 0, { rowSpan: 2 }),
  k('1', '1', null, 'ŷ,r', 6, 1),
  k('2', '2', null, 'x̂,r', 6, 2),
  k('3', '3', null, 'n!', 6, 3),
  k('minus', '−', null, null, 6, 4),
  k('0', '0', null, 'x̄', 7, 1),
  k('dot', '.', null, 's', 7, 2),
  k('sigma', 'Σ+', null, 'Σ−', 7, 3, { enabled: false }),
  k('plus', '+', null, null, 7, 4),
];

export const KEY_BY_ID = new Map(KEYS.map((x) => [x.id, x]));
