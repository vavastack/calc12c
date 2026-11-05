import { KEY_BY_ID } from './keymap.js';

// Códigos de tecla da HP 12C: linha (1 a 4, de cima) e posição na linha (1 a 9; 0 = décima), como no manual.
// Dígitos têm como código o próprio dígito. O teclado vertical (5×8) é a HP original (4×10) dobrada ao meio.
export const MAX_LINES = 99; // padrão (clássica); a Platinum tem 400 (profiles.js)

export function keyCode(id) {
  if (/^[0-9]$/.test(id)) return Number(id);
  const k = KEY_BY_ID.get(id);
  const r = k.row < 4 ? k.row : k.row - 4;
  const c = k.row < 4 ? k.col : k.col + 5;
  return (r + 1) * 10 + ((c + 1) % 10);
}

const OP_CODE = { plus: 40, minus: 30, times: 20, divide: 10 };

// Linha de programa: { s: null|'f'|'g', id, arg?, op? }
export function lineCodes(line, width = 2) {
  if (!line) return ['43', '33', '0'.repeat(width)]; // linha vazia = GTO 00
  if (line.id === 'sto' || line.id === 'rcl') {
    const out = [line.id === 'sto' ? 44 : 45];
    if (line.op) out.push(OP_CODE[line.op]);
    if (/^\.[0-9]$/.test(line.arg)) out.push(48, line.arg[1]); // registrador .d: código da tecla "." (48) e o dígito
    else out.push(/^[0-9]$/.test(line.arg) ? line.arg : keyCode(line.arg));
    return out.map(String);
  }
  if (line.s === 'g' && line.id === 'rdown') return ['43', '33', String(line.arg ?? '0'.repeat(width))];
  const out = [];
  if (line.s === 'f') out.push(42);
  if (line.s === 'g') out.push(43);
  out.push(keyCode(line.id));
  return out.map(String);
}

export function lineText(n, line, width = 2) {
  const nn = String(n).padStart(width, '0');
  if (n === 0) return nn + '–';
  const c = lineCodes(line, width);
  const body = c[0] === '43' && c[1] === '33' ? `43, 33 ${c[2]}` : c.join(' ');
  return `${nn}–  ${body}`;
}

// Linhas e registradores mostrados por g MEM: a memória cresce de 7 em 7 linhas (cada 7 linhas = 1 registrador).
export function memoryText(count) {
  const lines = count <= 8 ? 8 : 8 + 7 * Math.ceil((count - 8) / 7);
  const regs = Math.max(0, 20 - (lines - 8) / 7);
  return `P-${String(lines).padStart(2, '0')} r-${String(regs).padStart(2, '0')}`;
}

export function validLine(l) {
  if (l === null) return true;
  if (!l || typeof l !== 'object' || !KEY_BY_ID.has(l.id)) return false;
  if (![null, 'f', 'g'].includes(l.s ?? null)) return false;
  if (l.op !== undefined && !(l.op in OP_CODE)) return false;
  if (l.arg !== undefined && typeof l.arg !== 'string') return false;
  return true;
}
