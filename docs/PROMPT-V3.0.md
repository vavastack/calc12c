# Prompt de realização — V3.0 (arquitetura de perfis + modo ALG)

Use este arquivo como instrução para a próxima conversa. Ela deve abrir o repositório https://github.com/vavastack/calc12c (branch `main`), ler `CLAUDE.md`, `docs/HANDOFF.md`, `docs/HISTORICO.md` e `docs/CALCULADORAS.md`, e então executar o que está abaixo. Responder sempre em português.

## Objetivo
Transformar a Calc 12c em um app com **perfis de calculadora** (hoje há só a 12C) e entregar, dentro do perfil 12C, o **modo ALG** (algébrico) como opção ao lado do RPN. É a base de tudo o que vem depois (Black-Scholes, 10C, 11C, 15C, 16C). Ênfase do Wanderson: o que importa agora é finanças; as outras calculadoras vêm no futuro próximo, mas a arquitetura deve nascer pensando em todas.

## Ponto de partida (05/11/2026)
- V1, V1.1, V1.1.1, V2 (12C completa), V2.1 (lições de programação no verso) e V1.2 (memórias em arquivo, cores, orientação) estão prontas e publicadas na `main`.
- Testes: `npm test` (motor, 234) e `npm run test:ui` (interface, 98) passam; `npm run test:all` roda os dois.
- O motor (`src/engine`) é independente da interface (`src/ui`). Hoje há um único mapa de teclas (`keymap.js`, 39 teclas), um despacho único em `engine.js` e uma única interface de teclado.

## Escopo da V3.0
1. **Perfis.** Definir uma interface de perfil (por exemplo: id, nome, mapa de teclas, fábrica do motor, dados do verso, regras de layout). O perfil `12c` deve se comportar exatamente como hoje (nenhum resultado muda). Incluir: seletor de perfil nas Configurações, estado salvo por perfil (localStorage separado), perfil gravado nos arquivos de memórias (versão do arquivo sobe, arquivos antigos continuam abrindo como `12c`), verso por perfil. Temas e cores continuam globais.
2. **Modo ALG na 12C.** Seguir a 12C Platinum à risca, conforme o manual (decisão do Wanderson, 05/11/2026), sem trocar o comportamento por precedência matemática: indicador RPN/ALG no visor, ENTER funcionando como "=", parênteses, funções financeiras iguais nos dois modos. Pesquisar o Apêndice B do manual da 12C Platinum antes de implementar (https://www.manualslib.com/manual/257000/Hp-12c.html) e usar seus exemplos como casos de teste. RPN continua sendo o padrão.
3. **Não quebrar nada.** Todos os testes atuais continuam passando, e os números de referência já conferidos na HP real não podem mudar.

## Diferenciação entre modelos (já decidida)
- Cada perfil tem mapa de teclas e legendas próprios; o nome do modelo aparece no topo da calculadora e troca conforme o perfil.
- O indicador RPN/ALG só existe no perfil 12C. 10C, 11C, 15C e 16C são só RPN e não mostram indicador.
- Cada perfil segue o manual oficial do modelo. Usar "inspirada", sem logotipos nem marcas da HP.

## Pergunta a fazer ao Wanderson no início (só esta)
A HP 12C dele é a clássica ou a Platinum? Se for a clássica, o critério de pronto do ALG são os exemplos do manual da Platinum, pois ele não consegue conferir o ALG na máquina.

## Critério de pronto
- Testes novos para perfis (troca de perfil, estado separado, arquivo de memórias antigo abre como 12c) e para o ALG (exemplos do manual, parênteses, encadeamento, mistura com teclas financeiras e fita).
- `npm run test:all` verde antes de qualquer push.
- `node scripts/build.js` e envio de `dist/calc12c-v0.1.0.html` ao Wanderson.
- HANDOFF e HISTÓRICO atualizados; no fim, uma lista curta de números de teste para ele conferir.

## Regras fixas do Wanderson
- Pedir autorização antes de instalar programas ou mexer em configurações do PC.
- Chaves de API ele digita; não aceitar por ele compartilhamento de dados ou analytics.
- Explicar de forma direta, com o próximo passo prático.
- Rodar as suítes em um comando só e avisar o andamento (rodadas longas e silenciosas o incomodam).
- Commits terminam com as duas linhas de atribuição da sessão.

## Depois da V3.0
Nova ordem: V3.1 HP-16C (independente das demais), V3.2 Black-Scholes (perfil com formulário), V3.3 HP-10C e 11C, V3.4 HP-15C, V3.5 manual próprio e guia do código, e só depois a integração com o Pista Financeira (a decidir). Ver `docs/HANDOFF.md`.
