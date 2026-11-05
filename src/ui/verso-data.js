// Guia do verso: exemplos de uso (sequências de teclas) escritos para este app, em português.
// `keys` usa os ids do motor (ver keymap.js); números entram dígito a dígito, com "." para a vírgula decimal.
// `ready:false` = exemplo ainda sem função correspondente (aparece como "em breve"); na V2 todos estão prontos.

export const SIGMA_MAP = [
  ['n', 'R1'], ['Σx', 'R2'], ['Σx²', 'R3'], ['Σy', 'R4'], ['Σy²', 'R5'], ['Σxy', 'R6'],
];

export const VERSO = [
  {
    id: 'date', tag: 'DATE', title: 'Datas',
    items: [
      {
        id: 'date-add', title: '31/05/2003 + 120 dias', text: 'Data futura e dia da semana (1 = segunda … 7 = domingo).', ready: true,
        variants: [
          { label: 'D.MY', keys: 'g 4 31.052003 enter 120 g chs' },
          { label: 'M.DY', keys: 'g 5 5.312003 enter 120 g chs' },
        ],
      },
      {
        id: 'date-diff', title: 'De 03/06/2004 a 15/10/2005', text: 'Dias exatos (ΔDYS) e, com x≷y, dias no ano comercial de 360.', ready: true,
        variants: [
          { label: 'D.MY · dias exatos', keys: 'g 4 3.062004 enter 15.102005 g eex' },
          { label: 'D.MY · base 360', keys: 'g 4 3.062004 enter 15.102005 g eex xy' },
          { label: 'M.DY · dias exatos', keys: 'g 5 6.032004 enter 10.152005 g eex' },
          { label: 'M.DY · base 360', keys: 'g 5 6.032004 enter 10.152005 g eex xy' },
        ],
      },
    ],
  },
  {
    id: 'int', tag: 'INT', title: 'Juros simples',
    items: [
      {
        id: 'int-simple', title: '30 dias, 7% ao ano, principal 450', text: 'Juros simples no ano de 360 e de 365 dias, e o total (principal + juros).', ready: true,
        variants: [
          { label: 'Juros (360)', keys: 'f xy 30 n 7 i 450 chs pv f i' },
          { label: 'Principal + juros (360)', keys: 'f xy 30 n 7 i 450 chs pv f i plus' },
          { label: 'Juros (365)', keys: 'f xy 30 n 7 i 450 chs pv f i rdown xy' },
          { label: 'Principal + juros (365)', keys: 'f xy 30 n 7 i 450 chs pv f i rdown plus' },
        ],
      },
    ],
  },
  {
    id: 'amort', tag: 'AMORT', title: 'Amortização',
    items: [
      {
        id: 'amort-1', title: 'Financiamento de 50.000 em 30 anos a 5,25% a.a.', text: 'Prestação e, nas 12 primeiras parcelas, juros, principal e saldo. Repetir 12 f AMORT segue para o 2º ano.', ready: true,
        variants: [
          { label: 'Prestação', keys: 'f xy 30 g n 5.25 g i 50000 pv pmt' },
          { label: 'Juros pagos', keys: 'f xy 30 g n 5.25 g i 50000 pv pmt 0 n 12 f n' },
          { label: 'Principal pago', keys: 'f xy 30 g n 5.25 g i 50000 pv pmt 0 n 12 f n xy' },
          { label: 'Saldo devedor', keys: 'f xy 30 g n 5.25 g i 50000 pv pmt 0 n 12 f n rcl pv' },
        ],
      },
    ],
  },
  {
    id: 'bond', tag: 'BOND', title: 'Títulos',
    items: [
      {
        id: 'bond-price', title: 'Taxa 6%, cupom 4,75%, de 28/04/2004 a 15/11/2013', text: 'Preço (sem juros acumulados) por 100 de face e, com x≷y, os juros acumulados.', ready: true,
        variants: [
          { label: 'D.MY · preço', keys: 'g 4 6 i 4.75 pmt 28.042004 enter 15.112013 f yx' },
          { label: 'D.MY · juros acumulados', keys: 'g 4 6 i 4.75 pmt 28.042004 enter 15.112013 f yx xy' },
          { label: 'M.DY · preço', keys: 'g 5 6 i 4.75 pmt 4.282004 enter 11.152013 f yx' },
        ],
      },
      {
        id: 'bond-ytm', title: 'Preço 99,16, cupom 4,75%, de 28/04/2004 a 15/11/2013', text: 'Taxa anual a partir do preço.', ready: true,
        variants: [{ label: 'D.MY', keys: 'g 4 99.16 pv 4.75 pmt 28.042004 enter 15.112013 f recip' }],
      },
    ],
  },
  {
    id: 'depr', tag: 'DEPR', title: 'Depreciação',
    items: [
      {
        id: 'depr-1', title: 'Custo 10.000, residual 500, vida 5 anos, ano 1', text: 'Linha reta, soma dos dígitos e saldo decrescente (125%).', ready: true,
        variants: [
          { label: 'Linha reta', keys: '10000 pv 500 fv 5 n 1 f pctT' },
          { label: 'Soma dos dígitos', keys: '10000 pv 500 fv 5 n 1 f dpct' },
          { label: 'Saldo decrescente', keys: '10000 pv 500 fv 5 n 125 i 1 f pct' },
        ],
      },
    ],
  },
  {
    id: 'alg', tag: 'ALG', title: 'Modo algébrico (ALG)',
    note: 'Só na 12C Platinum. f ALG liga e f RPN desliga (teclas EEX e CHS). No ALG o ENTER faz o papel de "=", as contas são feitas na ordem em que são digitadas (1 + 2 × 3 = 9, sem hierarquia) e g ( / g ) abrem e fecham parênteses. As teclas financeiras funcionam igual nos dois modos. Os exemplos ligam o ALG sozinhos; para voltar, f RPN.',
    items: [
      {
        id: 'alg-soma', title: '21,1 + 23,8', text: 'Digite o primeiro número, o operador, o segundo e ENTER (o "=").', ready: true,
        variants: [{ label: 'Soma', keys: 'f eex 21.1 plus 23.8 enter' }],
      },
      {
        id: 'alg-cadeia', title: '456 − 75 ÷ 18,5 × 68 ÷ 1,9', text: 'Cada operador faz a conta pendente: 381, 20,59, 1.400,43 e, no fim, o resultado.', ready: true,
        variants: [
          { label: 'Cadeia', keys: 'f eex 456 minus 75 divide 18.5 times 68 divide 1.9 enter' },
          { label: 'Sem hierarquia · 1 + 2 × 3', keys: 'f eex 1 plus 2 times 3 enter' },
        ],
      },
      {
        id: 'alg-paren', title: '8 ÷ 5 − 1 e 8 ÷ (5 − 1)', text: 'Sem parênteses a divisão vem primeiro; com g ( e g ) a subtração é feita antes. O indicador ( ) acende enquanto houver parêntese aberto.', ready: true,
        variants: [
          { label: 'Sem parênteses', keys: 'f eex 8 divide 5 minus 1 enter' },
          { label: 'Com parênteses', keys: 'f eex 8 divide g sto 5 minus 1 g rcl enter' },
        ],
      },
      {
        id: 'alg-pct', title: 'Porcentagem em 200', text: 'Depois de × ou ÷ o % usa o número dividido por 100; depois de + ou − dá o valor líquido na hora.', ready: true,
        variants: [
          { label: '25% de 200', keys: 'f eex 200 times 25 pct' },
          { label: '200 reduzido em 25%', keys: 'f eex 200 minus 25 pct' },
        ],
      },
      {
        id: 'alg-delta', title: 'Variação de 35,5 para 31,25', text: 'Δ% também usa ENTER entre os dois números: o valor base primeiro.', ready: true,
        variants: [{ label: 'Δ%', keys: 'f eex 35.5 enter 31.25 dpct' }],
      },
    ],
  },
  {
    id: 'prog', tag: 'PRGM', title: 'Programação',
    note: 'Gravar: f P/R liga o modo de programação (PRGM), f CLEAR PRGM limpa, depois aperte as teclas do cálculo; cada tecla vira uma linha (número de dois dígitos = duas linhas). f P/R sai. Rodar: digite os números e aperte R/S. SST executa uma linha de cada vez. Os exemplos gravam o programa sozinhos e apagam o que estava na memória de programa.',
    items: [
      {
        id: 'prog-dobro', title: '1. Dobrar um número', text: 'O programa mais curto: multiplica X por 2. Rodar com 5 deixa 10; com SST dá para ver cada linha.', ready: true,
        listing: ['01 · 2', '02 · ×'],
        variants: [
          { label: 'Gravar', keys: 'f rs f rdown 2 times f rs' },
          { label: 'Rodar com 5', pre: 'Gravar', keys: '5 rs' },
          { label: 'Linha 1 (SST)', pre: 'Gravar', keys: '5 sst' },
          { label: 'Linhas 1 e 2 (SST)', pre: 'Gravar', keys: '5 sst sst' },
        ],
      },
      {
        id: 'prog-custo', title: '2. Custo líquido (manual da HP)', text: 'Preço menos 25% mais 5 de envio. ENTER guarda o preço para a função % usar.', ready: true,
        listing: ['01 · ENTER', '02 · 2', '03 · 5', '04 · %', '05 · −', '06 · 5', '07 · +'],
        variants: [
          { label: 'Gravar', keys: 'f rs f rdown enter 2 5 pct minus 5 plus f rs' },
          { label: 'Rodar com 625', pre: 'Gravar', keys: '625 rs' },
          { label: 'Rodar com 159', pre: 'Gravar', keys: '159 rs' },
        ],
      },
      {
        id: 'prog-media', title: '3. Média de dois números', text: 'Dois valores na pilha (ENTER entre eles): soma e divide por 2.', ready: true,
        listing: ['01 · +', '02 · 2', '03 · ÷'],
        variants: [
          { label: 'Gravar', keys: 'f rs f rdown plus 2 divide f rs' },
          { label: 'Rodar com 8 e 6', pre: 'Gravar', keys: '8 enter 6 rs' },
        ],
      },
      {
        id: 'prog-fin', title: '4. Prestação de 12 meses a 1% a.m.', text: 'Usa as teclas financeiras: o valor em X vira PV e o programa calcula PMT. Altera n, i e PV.', ready: true,
        listing: ['01 · PV', '02 · 1', '03 · 2', '04 · n', '05 · 1', '06 · i', '07 · PMT'],
        variants: [
          { label: 'Gravar', keys: 'f rs f rdown pv 1 2 n 1 i pmt f rs' },
          { label: 'Rodar com 1000', pre: 'Gravar', keys: '1000 rs' },
        ],
      },
      {
        id: 'prog-soma', title: '5. Soma de 1 até n (laço com GTO)', text: 'R0 conta de n até 1 e R1 acumula a soma. O teste x=0 pula a linha 10 enquanto R0 não zerou; então GTO 04 repete. Quando zera, GTO 12 sai do laço. Usa R0 e R1.', ready: true,
        listing: ['01 · STO 0', '02 · 0', '03 · STO 1', '04 · RCL 0', '05 · STO + 1', '06 · 1', '07 · STO − 0', '08 · RCL 0', '09 · g x=0', '10 · GTO 12', '11 · GTO 04', '12 · RCL 1'],
        variants: [
          { label: 'Gravar', keys: 'f rs f rdown sto 0 0 sto 1 rcl 0 sto plus 1 1 sto minus 0 rcl 0 g clx g rdown 1 2 g rdown 0 4 rcl 1 f rs' },
          { label: 'Rodar com 5', pre: 'Gravar', keys: '5 rs' },
          { label: 'Rodar com 100', pre: 'Gravar', keys: '100 rs' },
        ],
      },
    ],
  },
];

// Guia do verso de cada perfil.
// O grupo ALG só existe na Platinum.
// Na Platinum o GTO tem 3 dígitos (400 linhas): os exemplos de programa ganham um zero (GTO 04 → GTO 004).
const widenGto = (str) => str.replace(/(g rdown) (\d) (\d)(?!\d)/g, '$1 0 $2 $3').replace(/GTO (\d\d)(?!\d)/g, 'GTO 0$1');
const forPlatinum = (groups) => groups.map((g) => (g.id !== 'prog' ? g : {
  ...g,
  items: g.items.map((it) => ({
    ...it,
    text: widenGto(it.text),
    listing: it.listing?.map(widenGto),
    variants: it.variants.map((v) => ({ ...v, keys: widenGto(v.keys) })),
  })),
}));

export const VERSO_BY_PROFILE = {
  '12c': { sections: VERSO.filter((g) => g.id !== 'alg'), sigma: SIGMA_MAP },
  '12cp': { sections: forPlatinum(VERSO), sigma: SIGMA_MAP },
};

// Uma variante pode depender da gravação do programa: `pre` é o rótulo de outra variante do mesmo exemplo,
// cujas teclas são apertadas antes (rápido, sem animação). Devolve só essas teclas prévias.
export function preKeys(item, variant) {
  if (!variant.pre) return '';
  const base = item.variants.find((v) => v.label === variant.pre);
  if (!base) throw new Error(`variante prévia inexistente: ${variant.pre}`);
  return base.keys;
}

// Sequência completa de teclas de uma variante (prévia + própria).
export const fullKeys = (item, variant) => [preKeys(item, variant), variant.keys].filter(Boolean).join(' ');
