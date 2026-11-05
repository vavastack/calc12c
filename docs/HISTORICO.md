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

## 2. Decisões do Wanderson (valem daqui para frente)
- Seguir o nosso layout, não o do Touch RPN; copiar só as linhas de ligação das fórmulas.
- Toque na ON = configurações; segurar = verso. ON sempre escrito "ON" por padrão.
- Som padrão desligado; opções Suave e Mecânico (ele prefere o mecânico).
- 12C completa é a V2. Depois: V1.2, perfis e outras calculadoras (V3).
- ALG (modo algébrico) fica para a V3, como mais uma opção de cálculo; a V2 é só RPN.
- Quer incluir a aprendizagem de programação da calculadora quando o app estiver estável (V2.1).
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

## 5. Próximos passos
V2 fechada. Ver `docs/HANDOFF.md`: V2.1 (aprendizagem de programação), V1.2 e V3 (perfis e ALG).
