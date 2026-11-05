# Calc 12c — leia isto primeiro

Calculadora financeira offline inspirada na HP 12C (HTML único + PWA). Responda **sempre em português**.
O estado completo do projeto, as decisões e o plano da V2 estão em **docs/HANDOFF.md**; o histórico de decisões está em **docs/HISTORICO.md**. Leia os dois antes de qualquer coisa.

Regras fixas do Wanderson (dono do projeto):
- Pedir autorização antes de instalar programas ou mexer em configurações do PC.
- Chaves de API ele mesmo digita. Não aceitar por ele compartilhamento de dados/analytics.
- Explicar direto, com o próximo passo prático.
- Rodar `npm run test:all` e confirmar que passa **antes** de dar push.
- Depois de cada versão: `node scripts/build.js` e enviar `dist/calc12c-v0.1.0.html` a ele.
- Commits terminam com as duas linhas de atribuição da sessão (Co-Authored-By e Claude-Session).
- Rodadas longas e silenciosas o incomodam: rode as suítes em um comando só e avise o andamento.
