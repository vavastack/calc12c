# Calc 12c — referência das calculadoras da família (para o plano V3 e para o manual)

Escrito em 05/11/2026 a partir de fontes públicas (lista no fim). Serve de base para os perfis da V3 e para o manual próprio (V3.5). Onde há dúvida, está marcado "a confirmar".

## Visão geral: a série HP Voyager
Cinco modelos quase idênticos por fora, cada um com um público: HP-10C (científica básica, 1982–1984), HP-11C (científica intermediária, 1981–1989), HP-12C (financeira, 1981 até hoje), HP-15C (científica avançada, 1982–1989, relançada em 2011 e 2023) e HP-16C (programador, 1982–1989). Todas usam RPN, display de 10 dígitos e pilha de 4 níveis. O que as diferencia é principalmente a programação e as funções especiais.

## HP-12C Platinum e o modo ALG (V3.0)
- A Platinum tem 400 linhas de programa (a 12C clássica tem 99) e permite alternar entre RPN e ALG (algébrico).
- Em ALG, a tecla ENTER funciona como "=". Há parênteses, acessados com g + STO e g + RCL (a confirmar no manual, Apêndice B).
- Relatos de usuários dizem que o ALG da Platinum calcula em cadeia, da esquerda para a direita, sem hierarquia de operações (1 + 2 × 3 daria 9). **Decidido:** seguir a Platinum à risca, conforme o manual (Apêndice B), inclusive nos casos em que difere da precedência matemática.
- Cálculos financeiros (n, i, PV, PMT, FV, NPV, IRR etc.) seguem as mesmas teclas nos dois modos.

## Black-Scholes (V3.2) — não é uma HP
Modelo de precificação de opções europeias (Black–Scholes–Merton). Entradas: preço do ativo (S), preço de exercício (K), prazo (T), taxa livre de risco (r), volatilidade (σ) e, opcionalmente, dividendos (q). Saídas: prêmio da call e da put, mais as "gregas" (delta, gama, vega, teta, rô). Não tem teclado RPN: seria um perfil com formulário, no mesmo app. Pode incluir paridade put-call e volatilidade implícita como extras.

## HP-10C (V3.3)
- Científica básica programável: 79 linhas de programa e até 10 registradores, que dividem a mesma memória (a memória começa com 9 linhas e os registradores do topo viram linhas de programa conforme o programa cresce).
- Funções: trigonometria, logaritmos, estatística básica (Σ+), conversões polar/retangular, hora/graus.
- Programação limitada: só desvios condicionais x≤y e x=0, sem subrotinas por rótulo avançadas.
- No app: base comum com a 11C; quase tudo da 10C cabe na 11C.

## HP-11C (V3.3)
- Científica avançada para a época: 63 linhas permanentes e até 203 linhas; 20 registradores (+ registrador I) em memória compartilhada (cada registrador vale 7 linhas).
- Programação de verdade: rótulos (A–E e 0–9), subrotinas, testes condicionais, laços com ISG/DSE, endereçamento indireto (registrador I).
- Funções a mais que a 10C: hiperbólicas, fatorial/gama, gerador de números aleatórios, tecla de apagar dígito (backspace).
- Não tem números complexos, matrizes, SOLVE nem integração (isso é da 15C).

## HP-15C (V3.4, a maior)
- Até 448 linhas e até 66 registradores numerados, com programação avançada.
- Quatro recursos que a 11C não tem: **números complexos** (pilha complexa, em que cada nível guarda parte real e imaginária), **matrizes** (até cinco, A–E, com 64 elementos no total: inversa, transposta, determinante, resolver AX = B), **SOLVE** (acha raízes de uma equação) e **integração numérica**.
- Por isso é a mais pesada de implementar. Como estende a 11C, deve vir depois dela, e pode ser dividida em duas partes: complexos + SOLVE + integração, e depois matrizes.

## HP-16C (V3.1)
- A "Computer Scientist": calculadora de programador, feita para depurar programas.
- Bases hexadecimal, decimal, octal e binária, com conversão entre elas; tamanho de palavra configurável de 1 a 64 bits; aritmética inteira sem sinal, em complemento de 1 ou de 2.
- Operações lógicas (AND, OR, XOR, NOT), deslocamentos e rotações de bits, máscaras; o display "rola" (janelas) para mostrar números longos.
- Programável (até 203 linhas, rótulos 0–9 e A–F). Também faz aritmética decimal com ponto flutuante.
- No app: o motor é diferente (inteiros de largura fixa), por isso é independente das outras e pode vir por último ou em qualquer ordem.

## Fontes
- Visão geral da série: https://en.wikipedia.org/wiki/HP_Voyager
- "Series 10 at a Glance" (material de marketing da HP): https://literature.hpcalc.org/community/series10-marketing.pdf
- HP-10C: https://hpmuseum.org/hp10c.htm e https://hpmuseum.org/features/10cf.htm
- HP-11C: https://hpmuseum.org/hp11c.htm e https://computinghistory.org.uk/det/38131/HP-11C/
- HP-15C: https://en.wikipedia.org/wiki/HP-15C e https://Hpmuseum.org/hp15.htm
- HP-16C: https://en.wikipedia.org/wiki/HP-16C e https://hpmuseum.org/hp16.htm
- 12C Platinum, modo ALG: manual (Apêndice B) em https://www.manualslib.com/manual/257000/Hp-12c.html e fórum https://www.hpmuseum.org/cgi-bin/archv012.cgi?read=33862
- Manuais oficiais dos modelos (critério de pronto dos perfis): https://literature.hpcalc.org/
