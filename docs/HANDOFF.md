# Calc RPN (Calc 12c) — estado do projeto (atualizado em 08/11/2026) — V3.0 publicada; V3.1 (HP-16C) etapa 2 em andamento

## O que é
Calculadora financeira RPN inspirada na HP 12C, em HTML único, offline, instalável (PWA).
Uso: ferramenta diária, futuro módulo da Pista Financeira, item de portfólio e apoio de estudo (CPA/CPRO/contabilidade).
- Repositório: https://github.com/vavastack/calc12c (branch `main`, público)
- Site (GitHub Pages por Actions): https://vavastack.github.io/calc12c/
- Entrega a cada versão: `dist/calc12c-v0.1.0.html` (arquivo único, enviado ao Wanderson)

## Versões feitas
- **V1** (fechada): motor RPN completo no que cobre, 39 teclas, fita (tape), rótulos f/g, temas Gold (padrão) / Platinum / Retro (moderno escuro e claro), PWA offline, selo "MW RPN" no cabeçalho.
- **V1.1**: tecla ON (toque = configurações, segurar 500 ms = verso), linhas de conexão (BOND, DEPRECIATION, CLEAR, PREFIX), verso interativo (guia de fórmulas com exemplos executáveis), novas configurações, teclado cabe em tela cheia (`--app-h`).
- **V3.0 (05/11/2026):** arquitetura de perfis, 12C clássica e 12C Platinum como perfis separados, modo ALG (só na Platinum), temas fiéis por perfil e modo desenvolvedor (detalhes na seção "V3.0" abaixo).
- **V1.1.1**: tecla afunda ao tocar (só a face no Gold/Platinum), som em dois momentos (Desligado/Suave/Mecânico), vibração ao encostar (12 ms, reserva ao soltar), contorno de f/g só na face. Vibração só funciona fora do modo silencioso do Android (confirmado no S25).

## O que o motor já faz (src/engine)
TVM (n, i, PV, PMT, FV; BEGIN/END; períodos fracionários com C via STO EEX), INT, %, %T, Δ%, datas (D.MY/M.DY, ΔDYS, DATE), estatística (Σ+, x̄, s, x̄w, x̂,r, ŷ,r; registradores R1..R6), pilha RPN de 4 níveis + LSTx, STO/RCL, funções matemáticas (√x, yˣ, eˣ, LN, 1/x, n!, FRAC, INTG), formatação BR/US.
Arquivos: `engine.js` (despacho, F_OPS/G_OPS), `keymap.js` (teclas do perfil 12C), `profiles.js` (registro de perfis), `alg.js` (estado do modo ALG), `tvm.js`, `dates.js`, `stats.js`, `math.js`, `stack.js`, `registers.js`, `program.js`, `errors.js`, `number.js`.
**V2 (fechada em 05/11/2026; todos os blocos conferidos pelo Wanderson na HP real):**
- Fluxo de caixa (`cashflow.js`): CFo/CFj/Nj (g PV/PMT/FV), NPV (f PV), IRR (f FV). Até 20 fluxos, Nj de 1 a 99, guardados à parte de R0..R9 (não colidem com a estatística). Erro 6: 21º fluxo ou Nj inválido; Erro 7: IRR sem troca de sinal. `f CLEAR REG` apaga os fluxos; `f CLEAR FIN` não.
- AMORT (`amort.js`, `f n`): X = juros, Y = principal, Z = nº de prestações; PV vira o novo saldo e n soma as prestações. Juros e PMT arredondados às casas do visor a cada período. Em BEGIN a primeira prestação (após mexer em n/i/PV/PMT/FV) não paga juros.
- Depreciação (`depreciation.js`): SL (`f %T`), SOYD (`f Δ%`), DB (`f %`). n = vida, PV = custo, FV = residual, i = fator do DB em % (200 = dobrado), X = ano inteiro 1..n (senão Erro 5). Saída: X = depreciação, Y = valor depreciável restante. DB nunca desce abaixo do residual.
- Títulos (`bonds.js`): PRICE (`f yˣ`) e YTM (`f 1/x`). Cupom anual em PMT, taxa em i, preço limpo por 100 de face em PV, liquidação em Y, vencimento em X, no formato de data atual. Cupons semestrais, base 30/360 com E = 180; datas de cupom contadas para trás a partir do vencimento (fim de mês acompanha fim de mês). PRICE devolve preço em X e juros acumulados em Y; YTM devolve a taxa anual em X. Testes ancorados em exemplos PRICE/YIELD do Excel (30/360).
- RND (`f PMT`): arredonda X às casas do visor (meio para longe de zero); LSTx guarda o valor anterior.
- Verso: todos os exemplos liberados (amort, bond, depr), cada um completo a partir da calculadora limpa; resultados na tabela ESPERADO de `tests/engine/verso.test.js`.
- Correção: `bisect` do `tvm.js` estava errado para taxas negativas (intervalo invertido).
**Ainda NÃO implementado:** programação (PRGM, R/S, SST, GTO...) e estatística avançada estão desabilitadas na V1 (teclas mostram aviso).

## UI (src/ui)
`app.js` (montagem, teclas, ON, colchetes `BRACKETS`, som/vibração/animação), `settings.js` (configurações em localStorage `calc12c.settings`, VERSION 4: cores e orientação), `colors.js` (editor de cores: funções puras que geram as variáveis CSS), `memories.js` (memórias em arquivo), `extras.js` (`makeSound`, wake lock), `verso.js` + `verso-data.js` (verso; exemplo com `ready:false` mostraria "Em breve", hoje nenhum), `tape.js`, `display.js`, `reflex.js`, `layout.css`, `themes.css`, `sw.js`, `manifest.webmanifest`.
Build: `node scripts/build.js` junta tudo em um HTML (o empacotador só aceita `import {…} from '…';` em uma linha e `export function/const/class/let`).

## Testes
- `npm test` → motor (339 testes). `node --test tests/ui/*.spec.js` → interface com Playwright (128). `npm run test:all` roda os dois (cerca de 1 min 30).
- Tudo passa na versão atual. `tests/engine/verso.test.js` tem a tabela ESPERADO dos exemplos do verso.

## Plano da V2 — "12C completa"
Ordem combinada, com números de teste para o Wanderson conferir na HP real depois de cada bloco:
1. ✅ (conferido) Fluxo de caixa: CFo, CFj, Nj (g PV/PMT/FV), NPV (f PV), IRR (f FV). Até 20 fluxos; Nj repete.
2. ✅ (conferido) AMORT (f n): amortização por intervalo, mostrando juros, principal e saldo.
3. ✅ (conferido) Depreciação: SL (f %T), SOYD (f Δ%), DB (f %).
4. ✅ (conferido) Títulos: PRICE (f yᵡ), YTM (f 1/x) — datas no modo atual (D.MY/M.DY).
5. ✅ (feito) RND (f PMT). ALG foi adiado para a V3.
6. ✅ (feito) Liberar os exemplos "Em breve" do verso (grupos amort, bond, depr) e cobrir com testes.
Critério de pronto: testes verdes e resultados idênticos aos da HP 12C real que o Wanderson tem em mãos.

## Depois da V2
- **V2.1 (feita em 05/11/2026):** grupo "Programação" (tag PRGM) no verso com 5 lições executáveis: dobro, custo líquido do manual, média, prestação com teclas financeiras e soma 1..n com laço (GTO e x=0). Variantes com `pre` gravam o programa rápido e depois animam a execução; `fullKeys` em `verso-data.js` junta as teclas; o verso sai do modo PRGM antes de rodar; cada lição mostra a listagem das linhas (`listing`). Resultados na tabela ESPERADO.
- **V1.2 (feita em 05/11/2026):** (a) Memórias em arquivo: Configurações > Memórias salva/abre/compartilha um JSON (`tipo: calc12c-memorias`) com registradores, financeiros, fluxos de caixa, programa, pilha e fita; abrir valida tudo e recusa arquivo inválido sem mexer na calculadora; compartilhar usa `navigator.share` com arquivo e, sem suporte, baixa. (b) Editor de cores: 4 cores (placa/destaque, tecla f, tecla g, visor) viram variáveis CSS inline no `<html>` e valem para qualquer tema; "Restaurar" volta ao tema. (c) Orientação: automática/em pé/deitado via `screen.orientation.lock`, reaplicada ao abrir; no Android costuma exigir o app instalado ou tela cheia (não testado em aparelho real; o painel avisa quando o navegador recusa).
- **V3 (plano atualizado em 05/11/2026, 10:34):** app completo, com todos os modelos, ênfase no que importa agora. Descrição de cada calculadora em `docs/CALCULADORAS.md`. Nova ordem (a 16C subiu porque é independente das demais):
  - ✅ V3.0 arquitetura de perfis + ALG fiel à 12C Platinum (feita em 05/11/2026).
  - 🚧 V3.1 HP-16C: **etapa 1 feita** (teclado, motor de inteiros, bases, verso); etapas 2 e 3 feitas (programação, I e (i), B?/F?, f MEM, tema, ponto flutuante); falta a conferência fina com o manual. Ver "V3.1 — HP-16C" abaixo.
  - V3.2 Black-Scholes, perfil com formulário (cerca de 1 h).
  - V3.3 HP-10C e 11C, base científica RPN comum (2 a 3 h).
  - V3.4 HP-15C: complexos, matrizes, SOLVE, integração; pode ser partida em duas (4 a 6 h).
  - Gargalo: só há HP 12C real para conferir; nos demais perfis o critério de pronto são os exemplos dos manuais oficiais (https://literature.hpcalc.org/).
  - **Diferenciação entre modelos (decidido):** cada perfil tem seu mapa de teclas, com legendas próprias das teclas e das funções f/g (o formato físico da série é parecido). O nome do modelo aparece no topo da calculadora, trocando conforme o perfil (12C, 10C, 11C, 15C, 16C). O indicador RPN/ALG só existe no perfil 12C, pois a Platinum é a única da família com os dois modos; as demais são só RPN e não mostram indicador. Cada perfil deve seguir o manual oficial do modelo com fidelidade (inclusive o ALG da Platinum). Cores de teclas continuam globais (editor de cores). Usar sempre "inspirada", sem logotipos nem marcas da HP.
- **V3.5 — Manual próprio da Calc 12c (pedido do Wanderson):** ao final da V3 e antes da integração. Conteúdo: manual de uso com referência às versões (V1, V1.1, V1.1.1, V2, V2.1, V1.2, V3.x), guia de programação da calculadora (PRGM) e guia do código (arquitetura, como o motor funciona, como acrescentar uma função, testes). Formato a definir (doc editável + PDF). Depois dele, uma conversa de estudos para o Wanderson aprofundar no projeto e em projetos futuros.
- **Integração com o Pista Financeira (adiada, decidir mais à frente):** definir o que faz sentido levar do projeto amplo para o Pista de forma simples: um link de acesso (o PWA continua separado) ou a inclusão do motor de cálculo adaptado à plataforma do Pista. O motor (`src/engine`) já é independente da interface, então os dois caminhos são possíveis.

## V3.0 — perfis e modo ALG (feita em 05/11/2026)
**Perfis (`src/engine/profiles.js`):** cada perfil tem `id`, `name` (título no topo), `model`, `keys` e `keyById` (mapa de teclas), `modes` (`['rpn','alg']` na 12C), `indicators` do visor e `brackets` (linhas de ligação). `registerProfile` / `getProfile` / `listProfiles` / `hasProfile`. Hoje há dois: `12c` (clássica: só RPN, tema Gold, 7 indicadores, sem rótulos RPN/ALG e g ( )) e `12cp` (Platinum: RPN e ALG, tema Platinum, 10 indicadores, rótulos f RPN/f ALG e g ( ) em `KEYS_PLATINUM`, título em duas linhas "Platinum" / "12c" via `title`). Um perfil novo é registrar um objeto desses (e dados de verso em `VERSO_BY_PROFILE`, em `verso-data.js`).
- O `Engine` recebe `{ profile, mode }`, guarda os dois (`engine.profile`, `engine.mode`), mantém no `reset()` e na serialização. Estado salvo antigo, sem `profile`/`mode`/`alg`, abre como 12C em RPN.
- Armazenamento por perfil (`storage.js`): 12C continua em `calc12c.state` (nada se perde); os outros em `calc12c.state.<id>`; perfil em uso em `calc12c.profile`. Troca de perfil nas Configurações > Calculadora: guarda o estado do atual, carrega o do novo e refaz teclado, título, selo, indicadores e verso (`ctx.setProfile`, `ctx.adoptProfile`). Temas e cores continuam globais.
- Memórias em arquivo: `versao: 2` com `perfil`; arquivo da versão 1 (sem perfil) abre como 12C; arquivo de outro perfil troca para ele; perfil desconhecido é recusado.
- `program.js` ainda usa o mapa de teclas da 12C para listar linhas (ok enquanto só há a 12C; passa a depender do perfil quando entrar o 2º perfil programável).
**Temas por perfil (fiéis por padrão):** cada perfil tem `themes` e `defaultTheme` (`allowedThemes`, `themeFor` em `profiles.js`): Gold na clássica, Platinum na Platinum, Retro (vidro) nos dois. `settings.theme` é `null` até a pessoa escolher um tema; sem escolha vale o padrão do perfil, e escolha que o perfil não oferece volta ao padrão dele.
**Modo desenvolvedor (settings VERSION 5, campo `dev`):** liga com 7 toques seguidos (até 2 s entre eles) na linha "Versão" em Configurações > Mais; a contagem aparece a partir do 3º toque. Libera: grupo **Cores** (editor de cores; sem o modo desenvolvedor as cores salvas não valem, mas ficam guardadas) e **todos os temas em qualquer modelo** (Gold e Platinum nos dois). Grupo "Desenvolvedor" com botão Desativar; "Redefinir configurações" também desliga. API para testes: `window.calc12c.settings.setDev(bool)`.
**Escopo da Platinum (fechado):** os limites e comportamentos que variam por modelo ficam no perfil (`profiles.js`, `LIMITS_12C` como padrão): `maxLines` 99 / **400**, `maxFlows` 20 / **30** (CFo + 30 CFj), `regCount` 10 / **20** (R0-R9 + .0-.9 = índices 10 a 19; `STO . d`, `RCL . d`, `STO + . d`; estado pendente `'sto.'`/`'rcl.'`/`'stoop.'`), `undo` (**g − = ←** Backspace e **g ÷ = Undo**, indicador `UNDO` no visor), `clearPrgmKeepsPc` (f CLEAR PRGM em RUN mantém a linha atual; em PRGM apaga e vai a 000 nos dois). Linha do programa e GTO têm 3 dígitos na Platinum (`engine.lineWidth`); no verso os exemplos de programa ganham um zero no GTO (`forPlatinum` em `verso-data.js`). f RPN / f ALG gravam-se como 42 16 / 42 26 e rodam. Estados salvos da Platinum com 10 registradores abrem com 20.
- **Undo:** só desfaz limpezas (CLx, g ←, f CLEAR REG / Σ / FIN), como o manual diz; `press()` tira um instantâneo (`serialize`) antes da limpeza e `g Undo` o restaura (`_undo`); qualquer outra tecla, exceto f e g sozinhos, apaga a chance (`state.undo`). Não desfaz conta aritmética. Em PRGM, g ← e g Undo são ignoradas (não gravam linha).
- **A confirmar na Platinum real:** g ← em modo PRGM (aqui ignorada; a máquina pode apagar a linha); o texto de g MEM com mais de 99 linhas (aqui só não quebra); mapa de memória da Platinum (os registradores são independentes das linhas; não há o compartilhamento da clássica). A clássica tem R.0-R.9 de verdade, mas aqui continua só com R0-R9 (diferença conhecida).
**ALG (`alg.js` guarda o estado; a lógica está em `engine.js`, métodos `_alg*`):** Só no perfil Platinum: f EEX = ALG, f CHS = RPN (rótulos dourados nas teclas); g STO = "(", g RCL = ")". Visor da Platinum ganhou RPN, ALG e ( ); o selo do topo mostra RPN ou ALG. Na clássica essas teclas não fazem nada. Regras, todas do Apêndice B do manual da Platinum:
- Contas da esquerda para a direita, **sem hierarquia** (1 + 2 × 3 = 9; 456 − 75 ÷ 18,5 × 68 ÷ 1,9 = 737,07 com 381,00 / 20,59 / 1.400,43 no caminho). Dois operadores seguidos: vale o último.
- ENTER é "=": com conta pendente calcula e fecha os parênteses; sem conta pendente é o ENTER da pilha (por isso `A ENTER B Δ%` e as funções de datas/títulos funcionam igual ao RPN).
- Parênteses até 13 abertos (o 14º dá Error 4 — **código do erro a confirmar**); ")" sem "(" é ignorado.
- %: com + ou − pendente dá o valor líquido (200 − 25 % = 150); com × ou ÷ usa o número ÷ 100 (200 × 25 % = 50); sem conta só divide por 100. Δ% e %T usam o número antes do operador pendente como Y e ignoram o operador.
- CLx apaga o número; CLx duas vezes cancela as operações pendentes. Erro cancela as pendentes. Trocar de modo, f CLEAR REG e f CLEAR Σ também.
- LAST X no ALG: g LSTx troca X com LAST X sem elevar a pilha; o visor vai para LAST X quando se começa a digitar um número novo. Resultados concluídos sobem pela pilha de histórico (x≷y e R↓ mexem nela).
- Programas gravados em RPN rodam em ALG como a máquina faria (25 ENTER 3 ÷ dá 3 em ALG e 8,33 em RPN, caso do fórum do HP Museum).
- Verso: grupo ALG com 5 exemplos executáveis (só na Platinum, via `VERSO_BY_PROFILE`); exemplos dos outros grupos passam a calculadora para RPN antes de rodar (aviso na tela).
- **Pontos a confirmar** (o manual da Platinum só pôde ser lido em resumo; o Wanderson tem a 12C clássica e não confere o ALG na máquina): código de erro do 14º parêntese; display exato do % com + e − (o app mostra o líquido na hora); detalhes do LAST X e do histórico no ALG (manual, p. 239).

## V3.1 — HP-16C (etapa 1)
Perfil `16c` (`kind: 'int'` em `profiles.js`) com motor próprio **`engine16.js`** (`Engine16`) e aritmética em **`intmath.js`**. `engines.js` escolhe o motor pelo perfil (`createEngine`, `restoreEngine`); a interface usa só essas duas funções. `loadInto` (memories.js) troca também o protótipo, porque o mesmo objeto de motor passa de `Engine` para `Engine16` ao trocar de modelo.
- **Valores:** BigInt "crus" (padrão de bits, 0 a 2^ws − 1); o complemento (`'2'`, `'1'`, `'u'`) só decide como o padrão é lido. Palavra de 1 a 64 bits (`f WSIZE`, 0 = 64), base HEX/DEC/OCT/BIN, flags 0 a 5 (C = flag 4, G = flag 5). Liga em DEC, 16 bits, complemento de 2. `state` traz textos prontos (`texts`) e valores como strings.
- **Teclado** (`KEYS_16C`, ids `da`..`df` para A-F): + − × ÷, RMD, AND/OR/XOR/NOT, SL SR RL RR RLn RRn RLC RRC RLCn RRCn ASR LJ, MASKL MASKR, #B, SB CB, SF CF, ABS, √x, 1/x inteiros, DBL× DBL÷ DBLR, SHOW (f + base), STATUS, WINDOW e g < >, 1's 2's UNSGN, STO/RCL 0-F e .0-.F (32 registradores), pilha completa, LSTx, BSP. GSB GTO R/S SST ligadas na etapa 2 (ver abaixo).
- **Visor:** base em letra no fim (`FF h`), janelas de 8 dígitos (16 em BIN), zeros à esquerda com flag 3; indicadores C e G; selo do topo mostra o modelo. Fita/gaveta mostram pilha e registradores na base atual (sem n/i/PV/PMT/FV).
- **Conferido contra o manual (exemplos):** 32767 × 2 → 32766 com G (guarda sinal e os bits baixos da grandeza); 66 ÷ 7 → E com C, E ÷ 2 → 7 sem C; 50 CHS em 8 bits = CE h, −50 d, −49 d em complemento de 1; STATUS "2-16-0000".
- **Verso da 16C:** 3 grupos (bases, lógica de bits, carry e estouro), 16 variantes, testadas em `ESPERADO_16C`.
- **Etapa 2 (feita em 08/11/2026):** programação em `program16.js` (códigos de tecla, `lineDone`, `lineText`, testes, `memInfo`) e `engine16.js` (`_recordPress` grava em PRGM; `_control` trata GSB/GTO/RTN/LBL/DSZ/ISZ/testes/R/S/SST/BST/PSE/B?/F?/MEM; `_run` com limite de 200000 passos). Cada linha é a lista de teclas da instrução e a execução reaproveita `_pressRaw`, então o programa faz exatamente o que o teclado faz. Limites: 203 linhas (Error 4), 4 sub-rotinas (Error 5). Registrador I (`STO/RCL f SST`), (i) (`STO/RCL f R/S`), `x≷I`, `x≷(i)`, `GTO/GSB I` (I = rótulo 0-F). Códigos de erro: flag/janela 1, bit 2, registrador 3, rótulo/linha/memória 4, aninhamento 5. Tema próprio `[data-model="16c"]` (grafite, f laranja, g azul). Estado serializado ganhou prog, pc, prgm, ret, idx (compatível com salvos antigos).
- **Ponto flutuante (etapa 3, 08/11/2026):** `float16.js` (arredondamento a 10 dígitos, formato fixo 0-9 e científico, Y×2^X ao entrar, truncamento ao voltar) e, no `engine16.js`, `fmode`/`fst`/`fregs`/`fent`. `f FLOAT n` (ou `.` para científico) entra no modo decimal; HEX/DEC/OCT/BIN voltam ao inteiro. Em decimal funcionam dígitos, `.`, `f CHS` (EEX), CHS, BSP, ENTER, x≷y, R↓/R↑, + − × ÷, 1/x, √x, LSTx, CLx, STO/RCL, testes e programas; o resto (bits, bases, janelas) não age. Estouro vai a ±9,999999999e99 com flag 5; divisão por zero e √ de negativo dão Error 0; RCL de registrador com inteiro não nulo dá Error 6. Segundo o manual: carry (flag 4) não muda em decimal e CHS não encerra a digitação decimal.
- **GTO . nnn** (3 dígitos, RUN e PRGM, não programável, Error 4 se a linha não existe) feito em 08/11/2026. **Pendente da 16C:** Desfazer, formato exato do visor de `f MEM`, erro de WSIZE > 64 (hoje Error 3). **Confirmado no manual:** em inteiro, CHS encerra a digitação (só em decimal ela continua); janela de 8 dígitos. **Suposições a conferir no aparelho/manual (texto do capítulo 5 não obtido):** volta ao inteiro zera Y/Z/T e fixa no extremo se estourar (flag 5), Last X zera ao entrar no decimal, registradores nunca gravados contam como 0 em decimal, tamanho da janela em BIN (16), carry de ×/÷ e de 1's complement, DBL×/DBL÷, 1/x inteiro, estado ao ligar.

## Próximo passo
**Marcas e temas (feito):** Gold e Platinum são as marcas dos modelos. Título em duas linhas nos dois: "Gold" / "Platinum" grande e "Calc 12c" pequeno embaixo. Em Configurações o tema da placa do próprio modelo se chama **Padrão** (dourada na clássica, prateada na Platinum) e o outro é **Retro**; no modo desenvolvedor a lista também mostra a placa da outra marca ("Platinum" na clássica, "Gold" na Platinum). Lista de modelos: "Calc 12c Gold", "Calc 12c Platinum", "Calc 16c Dev" (marca da 16C: **Dev** grande e "Calc 16c" pequeno embaixo; combinar com tema próprio escuro, f laranja e g azul).

**Retomada (V3.1 etapa 4, 16C):** conferir os pontos "a confirmar" com o manual. Prompt: "Projeto Calc 12c: https://github.com/vavastack/calc12c. Leia CLAUDE.md, docs/HANDOFF.md e docs/HISTORICO.md. Continue a V3.1 (etapa 4 da HP-16C: conferências e polimento) pela seção 'V3.1 — HP-16C'. Responda em português."

V3.1 — HP-16C (bases, bits, motor de inteiros de largura fixa), em uma conversa nova. Ela será o 2º perfil: registrar em `profiles.js` com mapa de teclas próprio (sem `modes` ALG, `indicators` próprios), engine de inteiros e verso próprio. Prompt curto sugerido: "Projeto Calc 12c: https://github.com/vavastack/calc12c. Leia CLAUDE.md, docs/HANDOFF.md, docs/HISTORICO.md e docs/CALCULADORAS.md. Depois execute a V3.1 (HP-16C) conforme o plano da V3 no HANDOFF. Responda em português."

## Cuidados conhecidos
- PWA instalado só atualiza depois de fechar por completo e reabrir (uma ou duas vezes).
- O proxy desta sessão bloqueia push de tags: a tag v0.1.0 existe só local.
- Promessas de View Transitions precisam de `.catch`.
- Teclas f/g + dígito: o chip do verso `g 4` conta como uma tecla só.
