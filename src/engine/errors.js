// Condições de erro da HP 12C (Apêndice C do manual), com frase curta em português.
export const ERRORS = {
  0: 'Operação matemática inválida',
  1: 'Estouro do registro de armazenamento',
  2: 'Erro de estatística',
  3: 'IRR: informe uma estimativa',
  4: 'Erro de memória',
  5: 'Juros compostos sem solução',
  6: 'Registrador inexistente',
  7: 'IRR sem solução',
  8: 'Data inválida',
  9: 'Assistência técnica',
};

export class CalcError extends Error {
  constructor(code, message) {
    super(message ?? ERRORS[code] ?? ERRORS[9]);
    this.name = 'CalcError';
    this.code = code;
  }
}
