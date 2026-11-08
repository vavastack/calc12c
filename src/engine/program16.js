// Programação da HP-16C: tabela de códigos de tecla, formato das linhas, testes e memória.
// Uma linha de programa é UMA instrução: a lista de teclas que a formam (ex.: ['g','gto','3'] = LBL 3, ['sto','dot','5'] = STO .5).
import { toSigned } from './intmath.js';

export const MAX_LINES = 203; // 203 bytes de memória, 1 linha = 1 byte
export const MAX_RETURNS = 4; // sub-rotinas aninhadas (a 5ª dá Error 5)

export const MESSAGES_16C = {
  0: 'Operação matemática inválida',
  1: 'Flag, janela ou dígito fora da faixa',
  2: 'Número de bit fora da faixa',
  3: 'Registrador inexistente',
  4: 'Rótulo ou linha inexistente (ou memória cheia)',
  5: 'Sub-rotinas aninhadas demais (máximo 4)',
  6: 'Conteúdo inválido para o modo decimal',
  9: 'Assistência técnica',
};

// Código de duas casas de cada tecla (linha 1-4, coluna 1-9 e 0), como no manual: f = 42, g = 43, GSB = 21, GTO = 22.
const CODES = {
  da: 11, db: 12, dc: 13, dd: 14, de: 15, df: 16, divide: 10,
  gsb: 21, gto: 22, hex: 23, dec: 24, oct: 25, bin: 26, times: 20,
  rs: 31, sst: 32, rdown: 33, xy: 34, bsp: 35, enter: 36, minus: 30,
  on: 41, f: 42, g: 43, sto: 44, rcl: 45, dot: 48, chs: 49, plus: 40,
};
export const keyCode = (id) => (/^[0-9]$/.test(id) ? Number(id) : CODES[id]);

export const isPrefix = (id) => id === 'f' || id === 'g';
export const digitKey = (id) => /^[0-9]$/.test(id) || /^d[a-f]$/.test(id);
export const labelKey = (n) => (n < 10 ? String(n) : 'd' + 'abcdef'[n - 10]);

// A linha já está completa? (STO e RCL pedem registrador; GSB/GTO/LBL pedem rótulo; SB, CB, SF, CF, B?, F?, WINDOW, FLOAT pedem dígito)
export function lineDone(rec) {
  const pre = isPrefix(rec[0]) ? rec[0] : null;
  const k = pre ? rec[1] : rec[0];
  if (k === undefined) return false;
  const rest = rec.slice(pre ? 2 : 1);
  if (!pre && (k === 'sto' || k === 'rcl')) {
    if (rest.length === 0) return false;
    return rest[0] === 'dot' ? rest.length >= 2 : true; // dígito, .dígito, I ou (i)
  }
  if (!pre && (k === 'gsb' || k === 'gto')) return rest.length >= 1;
  if (pre === 'g' && (k === 'gto' || k === '4' || k === '5' || k === '6')) return rest.length >= 1;
  if (pre === 'f' && (k === '4' || k === '5' || k === '6')) {
    if (rest.length === 0) return false;
    return rest[0] === 'dot' ? rest.length >= 2 : true;
  }
  if (pre === 'f' && k === 'enter') return rest.length >= 1;
  if (pre === 'f' && k === 'rcl') return rest.length >= 1; // FLOAT n ou FLOAT . (científico)
  return true;
}

const argText = (id) => (id === 'dot' ? '.' : id === 'sst' ? 'I' : id === 'rs' ? '(i)' : /^d[a-f]$/.test(id) ? id[1].toUpperCase() : id);

// "003- 43,22, 1": prefixo e tecla com vírgula, argumento depois; dígito sozinho aparece como o próprio dígito.
export function lineText(n, line) {
  const tag = String(n).padStart(3, '0') + '-';
  const pre = isPrefix(line[0]) ? line[0] : null;
  const head = pre ? [keyCode(pre), keyCode(line[1])] : [keyCode(line[0])];
  const args = line.slice(pre ? 2 : 1);
  if (!pre && args.length === 0 && /^[0-9]$/.test(line[0])) return `${tag}  ${line[0]}`;
  return `${tag} ${head.join(',')}${args.length ? ', ' + args.map(argText).join('') : ''}`;
}

// Testes (g + tecla): recebem X e Y já lidos conforme o complemento; em UNSGN tudo é positivo.
export const TESTS = {
  1: (x, y) => x <= y,
  2: (x) => x < 0n,
  3: (x, y) => x > y,
  minus: (x) => x > 0n,
  0: (x, y) => x !== y,
  dot: (x) => x !== 0n,
  chs: (x, y) => x === y,
  plus: (x) => x === 0n,
};
export const runTest = (id, xRaw, yRaw, ws, cmp) => TESTS[id](toSigned(xRaw, ws, cmp), toSigned(yRaw, ws, cmp));

// f MEM: B = linhas que cabem antes de outros 7 bytes; r = registradores que sobram (as linhas viram memória de 7 em 7 bytes).
export function memInfo(lines, ws) {
  const used = 7 * Math.ceil(lines / 7);
  const b = used - lines;
  const bits = 4 * Math.ceil(ws / 4);
  return { b, r: Math.floor(((MAX_LINES - used) * 8) / bits) };
}
