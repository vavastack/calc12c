# Calc 12c — estado do projeto (atualizado em 05/11/2026) — V2 FECHADA

## O que é
Calculadora financeira RPN inspirada na HP 12C, em HTML único, offline, instalável (PWA).
Uso: ferramenta diária, futuro módulo da Pista Financeira, item de portfólio e apoio de estudo (CPA/CPRO/contabilidade).
- Repositório: https://github.com/vavastack/calc12c (branch `main`, público)
- Site (GitHub Pages por Actions): https://vavastack.github.io/calc12c/
- Entrega a cada versão: `dist/calc12c-v0.1.0.html` (arquivo único, enviado ao Wanderson)

## Versões feitas
- **V1** (fechada): motor RPN completo no que cobre, 39 teclas, fita (tape), rótulos f/g, temas Gold (padrão) / Platinum / Retro (moderno escuro e claro), PWA offline, selo "MW RPN" no cabeçalho.
- **V1.1**: tecla ON (toque = configurações, segurar 500 ms = verso), linhas de conexão (BOND, DEPRECIATION, CLEAR, PREFIX), verso interativo (guia de fórmulas com exemplos executáveis), novas configurações, teclado cabe em tela cheia (`--app-h`).
- **V1.1.1**: tecla afunda ao tocar (só a face no Gold/Platinum), som em dois momentos (Desligado/Suave/Mecânico), vibração ao encostar (12 ms, reserva ao soltar), contorno de f/g só na face. Vibração só funciona fora do modo silencioso do Android (confirmado no S25).

## O que o motor já faz (src/engine)
TVM (n, i, PV, PMT, FV; BEGIN/END; períodos fracionários com C via STO EEX), INT, %, %T, Δ%, datas (D.MY/M.DY, ΔDYS, DATE), estatística (Σ+, x̄, s, x̄w, x̂,r, ŷ,r; registradores R1..R6), pilha RPN de 4 níveis + LSTx, STO/RCL, funções matemáticas (√x, yˣ, eˣ, LN, 1/x, n!, FRAC, INTG), formatação BR/US.
Arquivos: `engine.js` (despacho, F_OPS/G_OPS), `keymap.js` (ids das teclas), `tvm.js`, `dates.js`, `stats.js`, `math.js`, `stack.js`, `registers.js`, `program.js`, `errors.js`, `number.js`.
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
`app.js` (montagem, teclas, ON, colchetes `BRACKETS`, som/vibração/animação), `settings.js` (configurações em localStorage `calc12c.settings`, VERSION 3), `extras.js` (`makeSound`, wake lock), `verso.js` + `verso-data.js` (verso; exemplo com `ready:false` mostraria "Em breve", hoje nenhum), `tape.js`, `display.js`, `reflex.js`, `layout.css`, `themes.css`, `sw.js`, `manifest.webmanifest`.
Build: `node scripts/build.js` junta tudo em um HTML (o empacotador só aceita `import {…} from '…';` em uma linha e `export function/const/class/let`).

## Testes
- `npm test` → motor (170 testes). `node --test tests/ui/*.spec.js` → interface com Playwright (87). `npm run test:all` roda os dois.
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
- **V2.1 (ideia do Wanderson):** aprendizagem de programação na calculadora: ligar PRGM/R/S/SST/GTO e criar um guia passo a passo com programas de exemplo executáveis, no estilo do verso. Começar quando o app estiver estável.
- V1.2: salvar/carregar/compartilhar memórias em arquivo, editor de cores, orientação no Android.
- Perfis/arquitetura de calculadoras: Black-Scholes, 10C, 11C, 16C, 15C e modo ALG (algébrico, como na 12C Platinum: parênteses e ENTER fazendo o papel de "=") como mais uma opção de cálculo (V3).
- Integração futura como módulo da Pista Financeira.

## Cuidados conhecidos
- PWA instalado só atualiza depois de fechar por completo e reabrir (uma ou duas vezes).
- O proxy desta sessão bloqueia push de tags: a tag v0.1.0 existe só local.
- Promessas de View Transitions precisam de `.catch`.
- Teclas f/g + dígito: o chip do verso `g 4` conta como uma tecla só.
