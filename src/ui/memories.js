// Memórias em arquivo: salvar, abrir e compartilhar o estado da calculadora (registradores, financeiros,
// fluxos de caixa, programa, pilha e fita). A versão 2 leva também o perfil e o modo (RPN/ALG); arquivos da versão 1 abrem como 12C. O arquivo só sai do aparelho se a pessoa o compartilhar.
import { restoreEngine } from '../engine/engines.js';

export const MEM_KIND = 'calc12c-memorias';
const MAX_CHARS = 2000000;

export function buildMemoryFile(engine, now = new Date()) {
  const estado = JSON.parse(engine.serialize());
  estado.shift = null; // nada pendente: o arquivo guarda só o que a pessoa calculou
  estado.pending = null;
  estado.error = null;
  const text = JSON.stringify({ app: 'Calc 12c', tipo: MEM_KIND, versao: 2, perfil: engine.profile, criado: now.toISOString(), estado }, null, 2);
  return { name: `calc12c-memorias-${now.toISOString().slice(0, 10)}.json`, text };
}

// Texto do arquivo → motor novo; lança Error com mensagem em português se o arquivo não servir.
export function parseMemoryFile(text) {
  if (typeof text !== 'string' || text.length > MAX_CHARS) throw new Error('Arquivo ilegível ou grande demais.');
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (!o || o.tipo !== MEM_KIND || !o.estado || typeof o.estado !== 'object') throw new Error('Este arquivo não é de memórias da Calc 12c.');
  try {
    return restoreEngine(JSON.stringify(o.estado));
  } catch {
    throw new Error('O conteúdo do arquivo está inválido ou é de uma versão não suportada.');
  }
}

// Troca o estado do motor em uso pelo do motor lido (as referências ao motor continuam valendo).
// O motor lido pode ser de outro tipo (12C ↔ 16C): troca também o protótipo, que carrega os métodos.
export function loadInto(engine, loaded) {
  for (const k of Object.keys(engine)) delete engine[k];
  Object.setPrototypeOf(engine, Object.getPrototypeOf(loaded));
  Object.assign(engine, loaded);
}
