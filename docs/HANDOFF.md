# Calc 12c — estado do projeto (atualizado em 05/11/2026)

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
**Ainda NÃO implementado:** AMORT, NPV, IRR, CFo/CFj/Nj, SL/SOYD/DB, PRICE/YTM, RND. Programação (PRGM, R/S, SST, GTO...) e estatística avançada estão desabilitadas na V1 (teclas mostram aviso).

## UI (src/ui)
`app.js` (montagem, teclas, ON, colchetes `BRACKETS`, som/vibração/animação), `settings.js` (configurações em localStorage `calc12c.settings`, VERSION 3), `extras.js` (`makeSound`, wake lock), `verso.js` + `verso-data.js` (verso; exemplos com `ready:false` mostram "Em breve"), `tape.js`, `display.js`, `reflex.js`, `layout.css`, `themes.css`, `sw.js`, `manifest.webmanifest`.
Build: `node scripts/build.js` junta tudo em um HTML (o empacotador só aceita `import {…} from '…';` em uma linha e `export function/const/class/let`).

## Testes
- `npm test` → motor (170 testes). `node --test tests/ui/*.spec.js` → interface com Playwright (87). `npm run test:all` roda os dois.
- Tudo passa na versão atual. `tests/engine/verso.test.js` tem a tabela ESPERADO dos exemplos do verso.

## Plano da V2 — "12C completa"
Ordem combinada, com números de teste para o Wanderson conferir na HP real depois de cada bloco:
1. Fluxo de caixa: CFo, CFj, Nj (g PV/PMT/FV), NPV (f PV), IRR (f FV). Até 20 fluxos; Nj repete.
2. AMORT (f n): amortização por intervalo, mostrando juros, principal e saldo.
3. Depreciação: SL (f %T), SOYD (f Δ%), DB (f %).
4. Títulos: PRICE (f yᵡ), YTM (f 1/x) — datas no modo atual (D.MY/M.DY).
5. RND (f PMT); depois ALG se couber.
6. Liberar os exemplos "Em breve" do verso (grupos amort, bond, depr) e cobrir com testes.
Critério de pronto: testes verdes e resultados idênticos aos da HP 12C real que o Wanderson tem em mãos.

## Depois da V2
- V1.2: salvar/carregar/compartilhar memórias em arquivo, editor de cores, orientação no Android.
- Perfis/arquitetura de calculadoras: Black-Scholes, 10C, 11C, 16C, 15C (V3).
- Integração futura como módulo da Pista Financeira.

## Cuidados conhecidos
- PWA instalado só atualiza depois de fechar por completo e reabrir (uma ou duas vezes).
- O proxy desta sessão bloqueia push de tags: a tag v0.1.0 existe só local.
- Promessas de View Transitions precisam de `.catch`.
- Teclas f/g + dígito: o chip do verso `g 4` conta como uma tecla só.
