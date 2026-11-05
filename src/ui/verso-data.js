// Guia do verso: exemplos de uso (sequências de teclas) escritos para este app, em português.
// `keys` usa os ids do motor (ver keymap.js); números entram dígito a dígito, com "." para a vírgula decimal.
// `ready:false` = função ainda não implementada (aparece como "em breve").

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
        id: 'amort-1', title: 'Financiamento de 50.000 em 30 anos a 5,25% a.a.', text: 'Juros e principal pagos nas 12 primeiras parcelas.', ready: false,
        variants: [
          { label: 'Prepara', keys: 'f xy 30 g n 5.25 g i 50000 pv pmt 0 n' },
          { label: 'Juros pagos', keys: '12 f n' },
          { label: 'Principal pago', keys: '12 f n xy' },
        ],
      },
    ],
  },
  {
    id: 'bond', tag: 'BOND', title: 'Títulos',
    items: [
      {
        id: 'bond-price', title: 'YTM 6%, cupom 4,75%, de 28/04/2004 a 15/11/2013', text: 'Preço a partir da taxa.', ready: false,
        variants: [{ label: 'D.MY', keys: 'g 4 6 i 4.75 pmt 28.042004 enter 15.112013 f yx' }],
      },
      {
        id: 'bond-ytm', title: 'Preço 99,16, cupom 4,75%, de 28/04/2004 a 15/11/2013', text: 'Taxa a partir do preço.', ready: false,
        variants: [{ label: 'D.MY', keys: 'g 4 99.16 pv 4.75 pmt 28.042004 enter 15.112013 f recip' }],
      },
    ],
  },
  {
    id: 'depr', tag: 'DEPR', title: 'Depreciação',
    items: [
      {
        id: 'depr-1', title: 'Custo 10.000, residual 500, vida 5 anos, ano 1', text: 'Linha reta, soma dos dígitos e saldo decrescente (125%).', ready: false,
        variants: [
          { label: 'Linha reta', keys: '10000 pv 500 fv 5 n 1 f pctT' },
          { label: 'Soma dos dígitos', keys: '10000 pv 500 fv 5 n 1 f dpct' },
          { label: 'Saldo decrescente', keys: '10000 pv 500 fv 5 n 125 i 1 f pct' },
        ],
      },
    ],
  },
];
