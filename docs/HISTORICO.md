# Calc 12c — histórico da conversa e decisões (até 05/11/2026)

Complementa o `HANDOFF.md`: aqui ficam o caminho percorrido, as decisões do Wanderson e as especificações de design já aprovadas.

## 1. Linha do tempo
1. **Motor e interface da V1:** calculadora RPN estilo HP 12C, 39 teclas, fita, rótulos f/g, três temas, PWA offline. Fechada com "Perfeito. Fechamos a V1."
2. **Cabeçalho e selo:** "Calc 12c" à esquerda (sem RPN ao lado). À direita, selo igual à referência da HP real: moldura preta de cantos levemente arredondados, painel superior metálico com disco preto e "MW" itálico na cor do metal, painel inferior metálico com "RPN" preto em negrito. Cores por tema (Gold dourado, Platinum prateado) e o reflexo passa por cima. A ideia do "M" descendo e do "W" subindo, como na HP, foi considerada para o MW.
3. **Testes na HP real:** o Wanderson pediu a lista de testes com números para comparar. PV, n, i e FV já conferem.
4. **Análise do Touch RPN:** decidido manter o nosso layout e copiar as linhas de conexão (colchetes). A tecla ON incorpora as configurações. O verso da HP (guia de fórmulas) vira uma tela interativa.
5. **V1.1:** ON = toque abre configurações, segurar 500 ms abre o verso. Colchetes BOND, DEPRECIATION, CLEAR, PREFIX. Verso com exemplos executáveis. Rótulo da tecla segue "ON" (ele não quer o símbolo ≡ por padrão).
6. **Ajuste de tela cheia:** o teclado inteiro cabe no celular em tela cheia/PWA (confirmado "Ta perfeito!").
7. **V1.1.1:** movimento da tecla ao apertar e soltar, som discreto em dois momentos e vibração. Escolha dele: o som **mecânico** é o melhor, os dois ficaram bons, só mais baixos (já ajustado). Bug visual do contorno do g corrigido (agora só na face). Vibração: no S25 só funciona fora do modo silencioso.
8. **Documentação e virada para a V2:** `CLAUDE.md` e `docs/HANDOFF.md` publicados no GitHub; a V2 continua em uma conversa nova.

9. **V2 (05/11/2026):** fluxo de caixa, AMORT, depreciação, títulos, RND e verso liberado, tudo conferido por ele na HP real. Correção extra do `bisect` para taxas negativas. A V2 foi fechada.

10. **V2.1 e V1.2 (05/11/2026):** guia de programação no verso (5 lições executáveis) e, em seguida, memórias em arquivo, editor de cores e orientação. Pedido dele: fazer os dois em sequência depois de fechar a V2.

11. **Plano da V3 (05/11/2026):** ele quer o app completo, com todos os modelos (10C, 11C, 15C, 16C, Black-Scholes e ALG), com ênfase agora em finanças. Integração com o Pista adiada. Manual próprio e guia do código (V3.5) ao final da V3, seguidos de uma conversa de estudos. A V3.0 será feita em uma conversa nova, ligada ao projeto pelo `docs/PROMPT-V3.0.md`.

12. **Ordem e diferenciação (05/11/2026, 10:34):** a 16C sobe para V3.1; Black-Scholes V3.2; 10C/11C V3.3; 15C V3.4. Nome do modelo no topo; indicador RPN/ALG só na 12C; todos os perfis fiéis ao manual oficial, inclusive o ALG da Platinum.

13. **V3.0 (05/11/2026):** arquitetura de perfis (registro em `profiles.js`, estado salvo por perfil, memórias versão 2 com perfil, verso por perfil, seletor em Configurações > Calculadora) e modo ALG da 12C Platinum. A 12C dele é a **clássica**, então o ALG foi conferido só pelos exemplos do manual da Platinum (cadeia 456 − 75 ÷ 18,5 × 68 ÷ 1,9 = 737,07, 21,1 + 23,8 = 44,90, −75 × 7,1 = −532,50, Δ% 35,5 → 31,25 = −11,97, 200 − 25 % = 150, 8 ÷ 5 − 1 = 0,60). Descobertas do manual: f CHS = RPN e f EEX = ALG; "(" e ")" ficam em g STO e g RCL; no máximo 13 parênteses; o ALG da Platinum calcula sem hierarquia. Os exemplos do verso passaram a rodar em RPN mesmo com o ALG ligado.

14. **Clássica x Platinum e modo desenvolvedor (05/11/2026):** ele quis a Platinum como perfil próprio (título "Platinum" com "12c" menor embaixo, à esquerda) e temas fiéis à máquina: Gold só na clássica, Platinum só na Platinum, Retro nos dois. Para quem quiser misturar, criou-se um **modo desenvolvedor** ativado por cliques (7 toques na versão), que libera o editor de cores e todos os temas em qualquer modelo. Por padrão os dois modelos são distintos.

## 2. Decisões do Wanderson (valem daqui para frente)
- Seguir o nosso layout, não o do Touch RPN; copiar só as linhas de ligação das fórmulas.
- Toque na ON = configurações; segurar = verso. ON sempre escrito "ON" por padrão.
- Som padrão desligado; opções Suave e Mecânico (ele prefere o mecânico).
- 12C completa é a V2. Depois: V1.2, perfis e outras calculadoras (V3).
- ALG (modo algébrico) entrou na V3.0 só no perfil 12C Platinum (f EEX liga, f CHS volta ao RPN); RPN continua o padrão. A clássica não tem ALG.
- Temas fiéis por modelo por padrão; modo desenvolvedor (7 toques na versão) libera cores e todos os temas. A 12C dele é a clássica (não confere o ALG na máquina).
- Quer incluir a aprendizagem de programação da calculadora quando o app estiver estável (V2.1).
- App completo: todos os modelos da família, com ênfase no que importa agora (finanças). Integração com o Pista só mais à frente (link de acesso ou motor adaptado, a definir).
- Responder sempre em português; autorização antes de instalar programas ou mexer no PC; chaves de API ele digita; não aceitar compartilhamento de dados.
- Explicar direto, com o próximo passo prático; enviar o HTML a cada versão.

## 3. Especificações de design aprovadas
- **Temas:** Gold (padrão), Platinum, Retro (escuro e claro). Gold/Platinum com face escura da tecla abaixo do rótulo f e cantos de 3 px; Retro em vidro arredondado.
- **Teclas:** f dourado/prateado e g azul; rótulo ativo acende; f/g ativo ganha contorno só na face. Ao tocar: realce local a partir do dedo, face afunda 2 px com mola ao soltar; respeita "Reduzir efeitos".
- **Som:** `makeSound()` em `extras.js`; timbres por tipo (ENTER, f/g, números, funções); fase apertar e soltar.
- **Verso:** grupos date, int, amort, bond, depr; exemplo com `ready:false` mostra "Em breve" até a função existir.
- **Configurações (localStorage `calc12c.settings`, v3):** tema, modo, reduzir efeitos, vibração, som (off/soft/mech), manter tela acesa, estilo da ON, altura da banda superior, separador decimal, tela cheia, redefinir.

## 4. Resultados de referência já verificados
- Datas: 31/05/2003 + 120 dias → 28/09/2003 (domingo, 7) em D.MY e 09,28,2003 em M.DY.
- ΔDYS 03/06/2004 → 15/10/2005: 499 (exato) e 492 (base 360).
- INT 30 dias, 7%, 450: 2,63 (360) / 452,63; 2,59 (365) / 452,59.
- PV, n, i, FV: conferidos pelo Wanderson na HP real.

## 4b. Escopo da Platinum (fechado antes da V3.1)
400 linhas de programa com número de linha e GTO de 3 dígitos, 30 fluxos CFj, registradores .0-.9, Backspace (g −) e Undo (g ÷) com o indicador UNDO, f CLEAR PRGM em RUN mantendo a linha. Limites por perfil em `profiles.js`. 314 testes do motor e 122 de interface.

## 4c. V3.1 etapa 1 — HP-16C
Perfil `16c` com motor de inteiros de largura fixa (`engine16.js`, `intmath.js`), seleção do motor por perfil (`engines.js`), teclado próprio, indicadores C e G, Verso próprio. Programação e ponto flutuante ficam para a etapa 2. 339 testes do motor e 128 de interface.

## 4d. V3.1 etapa 2 — HP-16C programável
Programação completa (gravação em PRGM, GSB/GTO/RTN, LBL 0-F, DSZ/ISZ, oito testes, R/S, SST/BST, PSE, 203 linhas, 4 níveis), registrador I e (i), `x≷I`, `x≷(i)`, `GTO/GSB I`, `B?`, `F?`, `f MEM`, códigos de erro 1-5 do manual e tema próprio. Ponto flutuante ficou para a etapa 3. 354 testes do motor e 132 de interface.

## 4e. V3.1 etapa 3 — ponto flutuante da 16C
`f FLOAT n` / `f FLOAT .`: modo decimal de 10 dígitos com expoente (`float16.js`), aritmética, 1/x, √x, EEX, STO/RCL e testes em decimal, volta ao inteiro por HEX/DEC/OCT/BIN. 362 testes do motor e 133 de interface.

## 5. Próximos passos
V3.0 fechada. Ver `docs/HANDOFF.md`: V3.1 (HP-16C), V3.2 (Black-Scholes), V3.3 (10C e 11C), V3.4 (15C), V3.5 (manual próprio).