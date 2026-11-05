import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp, enableDev } from './helpers.js';

let server, browser;
before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

const tap = async (p, seq) => {
  for (const id of seq.split(' ')) await p.locator(`button.key[data-id="${id}"]`).click();
};
const on = (p, ind) => p.locator(`.display [data-ind="${ind}"]`).evaluate((e) => e.classList.contains('on'));
const digits = (p) => p.locator('.digits').innerText();
const platinum = (p) => p.evaluate(() => window.calc12c.setProfile('12cp'));

// ---------- modo ALG pela tela ----------
test('f ALG acende ALG, apaga RPN e troca o selo; f RPN volta', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  assert.equal(await on(p, 'RPN'), true);
  assert.equal((await p.locator('.brand .badge .model').innerText()).trim(), 'RPN');
  await tap(p, 'f eex');
  assert.equal(await on(p, 'ALG'), true);
  assert.equal(await on(p, 'RPN'), false);
  assert.equal((await p.locator('.brand .badge .model').innerText()).trim(), 'ALG');
  await tap(p, 'f chs');
  assert.equal(await on(p, 'RPN'), true);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('ALG pela tela: 2 + 3 ENTER = 5 e a cadeia do manual dá 737,07', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  await tap(p, 'f eex 2 plus 3 enter');
  assert.equal(await digits(p), '5,00');
  await tap(p, 'clx clx 4 5 6 minus 7 5 divide 1 8 dot 5 times 6 8 divide 1 dot 9 enter');
  assert.equal(await digits(p), '737,07');
  await app.close();
});

test('o indicador ( ) acende com parêntese aberto e g ( g ) aparecem nas teclas STO e RCL', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  assert.equal(await p.locator('button.key[data-id="sto"] .lg').innerText(), '(');
  assert.equal(await p.locator('button.key[data-id="rcl"] .lg').innerText(), ')');
  assert.equal(await p.locator('button.key[data-id="chs"] .lf').innerText(), 'RPN');
  assert.equal(await p.locator('button.key[data-id="eex"] .lf').innerText(), 'ALG');
  await tap(p, 'f eex 8 divide g sto 5');
  assert.equal(await on(p, '( )'), true);
  await tap(p, 'minus 1 g rcl');
  assert.equal(await on(p, '( )'), false);
  await tap(p, 'enter');
  assert.equal(await digits(p), '2,00');
  await app.close();
});

test('o modo ALG e a conta pendente sobrevivem a recarregar a página', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  await tap(p, 'f eex 5 plus 3');
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await on(p, 'ALG'), true);
  await tap(p, 'enter');
  assert.equal(await digits(p), '8,00');
  await app.close();
});

test('os onze indicadores cabem no visor e a página não ganha rolagem lateral em telas estreitas', async () => {
  for (const width of [320, 360, 390]) {
    const app = await openApp(browser, server.url, { width, height: 740 });
    await platinum(app.page);
    const r = await app.page.evaluate(() => {
      const d = document.querySelector('.display').getBoundingClientRect();
      const last = [...document.querySelectorAll('.display [data-ind], .display .fmt-toggle')].map((e) => e.getBoundingClientRect().right);
      return { page: document.documentElement.scrollWidth, view: innerWidth, display: d.right, lastInd: Math.max(...last) };
    });
    assert.ok(r.page <= r.view, `página mais larga que a tela a ${width}px (${r.page} > ${r.view})`);
    assert.ok(r.display <= r.view, `visor passa da tela a ${width}px`);
    assert.ok(r.lastInd <= r.display, `indicadores passam do visor a ${width}px`);
    await app.close();
  }
});

test('o verso roda os exemplos em RPN mesmo com a calculadora em ALG, e o grupo ALG liga o ALG', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  await p.evaluate(() => { window.calc12c.fast = true; });
  await tap(p, 'f eex');
  assert.equal(await on(p, 'ALG'), true);
  await p.evaluate(() => window.calc12c.verso.open());
  await p.locator('[data-sec="int"] [data-run]').first().click();
  await p.waitForFunction(() => document.querySelector('.notice')?.textContent.startsWith('Exemplo executado'));
  assert.equal(await on(p, 'RPN'), true);
  assert.equal(await digits(p), '2,63');
  await p.evaluate(() => window.calc12c.verso.open());
  await p.locator('[data-sec="alg"] [data-run]').first().click();
  await p.waitForFunction(() => document.querySelector('.notice')?.textContent.includes('21,1'));
  assert.equal(await on(p, 'ALG'), true);
  assert.equal(await digits(p), '44,90');
  assert.deepEqual(app.errors, []);
  await app.close();
});

// ---------- perfis ----------
test('Configurações traz o seletor de modelo com a 12C selecionada', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.locator('.key[data-id="on"]').click();
  const sel = p.locator('.settings select[name="profile"]');
  assert.equal(await sel.inputValue(), '12c');
  assert.deepEqual(await sel.locator('option').allTextContents(), ['Calc 12c (clássica)', 'Calc 12c Platinum']);
  assert.equal(await p.locator('.brand .title').innerText(), 'Calc 12c');
  await app.close();
});

// registra um segundo perfil dentro da página (mesmos módulos do app) para testar a troca
const registrarTeste = (p) =>
  p.evaluate(async () => {
    const { getProfile, registerProfile } = await import('/src/engine/profiles.js');
    const base = getProfile('12c');
    registerProfile({ ...base, id: 'teste', name: 'Calc teste', model: 'TESTE', modes: ['rpn'], indicators: ['f', 'g', 'PRGM'], brackets: [] });
  });

test('trocar de modelo refaz título, teclado e indicadores e guarda a memória de cada um', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await registrarTeste(p);
  await tap(p, '4 2 enter');
  await p.evaluate(() => window.calc12c.settings.open());
  await p.locator('.settings select[name="profile"]').selectOption('teste');
  assert.equal(await p.locator('.brand .title').innerText(), 'Calc teste');
  assert.deepEqual(await p.locator('.display [data-ind]').evaluateAll((els) => els.map((e) => e.dataset.ind)), ['f', 'g', 'PRGM']);
  assert.equal((await p.locator('.brand .badge .model').innerText()).trim(), 'RPN'); // perfil de um modo só
  assert.equal(await p.locator('button.key').count(), 39);
  assert.equal(await p.locator('.bracket').count(), 0);
  assert.equal(await digits(p), '0,00'); // memória própria do novo modelo
  assert.equal(await p.evaluate(() => localStorage.getItem('calc12c.profile')), 'teste');
  await p.evaluate(() => window.calc12c.settings.close());
  await tap(p, '7');
  // volta à 12C: o 42 continua lá
  await p.evaluate(() => window.calc12c.settings.open());
  await p.locator('.settings select[name="profile"]').selectOption('12c');
  assert.equal(await p.locator('.brand .title').innerText(), 'Calc 12c');
  assert.equal(await digits(p), '42,00');
  assert.equal(await p.locator('.bracket').count() > 0, true);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('depois de trocar de modelo a tecla ON continua abrindo as configurações e segurar abre o verso', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await registrarTeste(p);
  await p.evaluate(() => window.calc12c.settings.open());
  await p.locator('.settings select[name="profile"]').selectOption('teste');
  await p.locator('.settings-close').click();
  await p.locator('.key[data-id="on"]').click();
  assert.equal(await p.evaluate(() => window.calc12c.settings.isOpen()), true);
  await p.locator('.settings-close').click();
  const box = await p.locator('.key[data-id="on"]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(700);
  await p.mouse.up();
  assert.equal(await p.evaluate(() => window.calc12c.verso.isOpen()), true);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('abrir um arquivo de memórias de outro modelo troca para esse modelo', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await registrarTeste(p);
  const texto = await p.evaluate(async () => {
    const { Engine } = await import('/src/engine/engine.js');
    const { buildMemoryFile } = await import('/src/ui/memories.js');
    const e = new Engine({ profile: 'teste' });
    e.press('9');
    return buildMemoryFile(e).text;
  });
  await p.evaluate(() => window.calc12c.settings.open());
  await p.locator('.settings input.mem-file').setInputFiles({ name: 'm.json', mimeType: 'application/json', buffer: Buffer.from(texto) });
  await p.waitForFunction(() => document.querySelector('.brand .title').textContent === 'Calc teste');
  assert.equal(await digits(p), '9'); // o 9 ainda estava sendo digitado
  await app.close();
});

// ---------- 12C clássica x Platinum ----------
test('a clássica é o padrão: 7 indicadores, título numa linha, sem os rótulos RPN/ALG e g ( )', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  assert.deepEqual(await p.locator('.display [data-ind]').evaluateAll((els) => els.map((e) => e.dataset.ind)), ['f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM']);
  assert.equal(await p.locator('.brand .title').innerText(), 'Calc 12c');
  assert.equal(await p.locator('.brand .title .l2').count(), 0);
  assert.equal(await p.locator('button.key[data-id="chs"] .lf').innerText(), '');
  assert.equal(await p.locator('button.key[data-id="sto"] .lg').innerText(), '');
  await tap(p, 'f eex 2 plus 3 enter'); // sem ALG: f EEX não faz nada e a conta é RPN
  assert.equal(await digits(p), '3,00');
  assert.equal((await p.locator('.brand .badge .model').innerText()).trim(), 'RPN');
  await app.close();
});

test('a Platinum mostra "Platinum" com "12c" menor embaixo, à esquerda, e o selo segue o modo', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  assert.equal(await p.locator('.brand .title .l1').innerText(), 'Platinum');
  assert.equal(await p.locator('.brand .title .l2').innerText(), '12c');
  const r = await p.evaluate(() => {
    const a = document.querySelector('.title .l1').getBoundingClientRect();
    const b = document.querySelector('.title .l2').getBoundingClientRect();
    return { l1: a, l2: b, f1: parseFloat(getComputedStyle(document.querySelector('.title .l1')).fontSize), f2: parseFloat(getComputedStyle(document.querySelector('.title .l2')).fontSize) };
  });
  assert.ok(r.l2.top >= r.l1.bottom - 1, '12c fica embaixo de Platinum');
  assert.ok(r.f2 < r.f1 * 0.7, '12c é menor');
  assert.ok(Math.abs(r.l2.left - r.l1.left) < 4, 'alinhados à esquerda');
  assert.equal(await p.locator('.brand .badge .model').innerText().then((t) => t.trim()), 'RPN');
  await tap(p, 'f eex');
  assert.equal(await p.locator('.brand .badge .model').innerText().then((t) => t.trim()), 'ALG');
  await app.close();
});

test('temas fiéis por padrão: Gold na clássica, Platinum na Platinum, Retro nos dois', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  const tema = () => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const opcoes = async () => {
    await p.evaluate(() => window.calc12c.settings.open());
    return p.locator('.settings select[name="theme"] option').allTextContents();
  };
  assert.equal(await tema(), 'retro'); // Gold
  assert.deepEqual(await opcoes(), ['Gold', 'Retro']);
  await platinum(p);
  assert.equal(await tema(), 'platinum');
  assert.deepEqual(await opcoes(), ['Platinum', 'Retro']);
  // o Retro (vidro) escolhido numa vale na outra
  await p.locator('.settings select[name="theme"]').selectOption('moderno');
  await p.waitForFunction(() => document.documentElement.getAttribute('data-theme').startsWith('moderno'));
  await p.evaluate(() => window.calc12c.setProfile('12c'));
  assert.ok((await tema()).startsWith('moderno'));
  await p.locator('.settings select[name="theme"]').selectOption('retro');
  await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'retro');
  await p.evaluate(() => window.calc12c.setProfile('12cp')); // Gold não existe na Platinum: volta ao padrão dela
  assert.equal(await tema(), 'platinum');
  assert.deepEqual(app.errors, []);
  await app.close();
});

// ---------- modo desenvolvedor ----------
const abrirConfig = (p) => p.evaluate(() => window.calc12c.settings.open());

test('o grupo Cores e o Desenvolvedor ficam ocultos por padrão e as cores salvas não valem', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.evaluate(() => localStorage.setItem('calc12c.settings', JSON.stringify({ v: 5, colors: { f: '#ff0000' } })));
  await p.reload();
  await p.waitForSelector('button.key');
  await abrirConfig(p);
  assert.equal(await p.locator('.settings input[name="color-f"]').isVisible(), false);
  assert.equal(await p.locator('.settings .dev-off').isVisible(), false);
  assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue('--gold')), '');
  await app.close();
});

test('7 toques na versão ligam o modo desenvolvedor (com contagem a partir do 3º) e ele fica salvo', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await abrirConfig(p);
  const nota = p.locator('.settings .ver-note');
  assert.match(await nota.innerText(), /V3\.0/);
  const row = p.locator('.settings .ver-row');
  for (let i = 0; i < 2; i++) await row.click();
  assert.match(await nota.innerText(), /V3\.0/); // até o 2º toque, nada aparece
  await row.click();
  assert.match(await nota.innerText(), /Faltam 4 toques/);
  for (let i = 0; i < 3; i++) await row.click();
  assert.match(await nota.innerText(), /Faltam 1 toque/);
  assert.equal(await p.evaluate(() => window.calc12c.settings.get().dev), false);
  await row.click();
  assert.match(await nota.innerText(), /ativado/);
  assert.equal(await p.evaluate(() => window.calc12c.settings.get().dev), true);
  assert.equal(await p.locator('.settings input[name="color-f"]').isVisible(), true);
  assert.equal(await p.locator('.settings .dev-off').isVisible(), true);
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await p.evaluate(() => window.calc12c.settings.get().dev), true);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('toques espaçados demais não contam para o modo desenvolvedor', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await abrirConfig(p);
  const row = p.locator('.settings .ver-row');
  for (let i = 0; i < 4; i++) await row.click();
  await p.waitForTimeout(2200);
  for (let i = 0; i < 4; i++) await row.click();
  assert.equal(await p.evaluate(() => window.calc12c.settings.get().dev), false);
  await app.close();
});

test('no modo desenvolvedor: todos os temas em qualquer modelo, cores valem, e Desativar volta ao padrão fiel', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await enableDev(p);
  await abrirConfig(p);
  assert.deepEqual(await p.locator('.settings select[name="theme"] option').allTextContents(), ['Gold', 'Platinum', 'Retro']);
  await p.locator('.settings select[name="theme"]').selectOption('platinum'); // Platinum na clássica
  await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'platinum');
  await platinum(p);
  await p.locator('.settings select[name="theme"]').selectOption('retro'); // Gold na Platinum
  await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'retro');
  await p.locator('.settings input[name="color-f"]').fill('#ff0000');
  assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue('--gold')), '#ff0000');
  await p.locator('.settings .dev-off').click();
  await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'platinum'); // padrão da Platinum
  assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue('--gold')), '');
  assert.deepEqual(await p.locator('.settings select[name="theme"] option').allTextContents(), ['Platinum', 'Retro']);
  assert.equal(await p.locator('.settings input[name="color-f"]').isVisible(), false);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('ligar o modo desenvolvedor não troca o tema: o padrão de cada modelo continua valendo até a pessoa escolher', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  const tema = () => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await platinum(p);
  assert.equal(await tema(), 'platinum');
  await enableDev(p);
  assert.equal(await tema(), 'platinum');
  assert.equal(await p.evaluate(() => window.calc12c.settings.get().theme), null);
  await p.evaluate(() => window.calc12c.setProfile('12c'));
  assert.equal(await tema(), 'retro');
  await app.close();
});

// ---------- escopo da Platinum: Undo, Backspace, registradores .0-.9, linhas de 3 dígitos ----------
test('Platinum: indicador UNDO acende depois de CLx e g Undo recupera o número', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  assert.equal(await on(p, 'UNDO'), false);
  await tap(p, '4 2 enter clx');
  assert.equal(await on(p, 'UNDO'), true);
  assert.equal(await digits(p), '0,00');
  await tap(p, 'g divide');
  assert.equal(await digits(p), '42,00');
  assert.equal(await on(p, 'UNDO'), false);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('Platinum: g − apaga o último dígito e as teclas mostram ← e UNDO em azul', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  assert.equal(await p.locator('button.key[data-id="minus"] .lg').innerText(), '←');
  assert.equal(await p.locator('button.key[data-id="divide"] .lg').innerText(), 'UNDO');
  await tap(p, '1 2 3 g minus');
  assert.equal(await digits(p), '12');
  await app.close();
});

test('clássica: sem indicador UNDO e sem rótulos ← e UNDO', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  assert.equal(await p.locator('.display [data-ind="UNDO"]').count(), 0);
  assert.equal(await p.locator('button.key[data-id="minus"] .lg').innerText(), '');
  await app.close();
});

test('Platinum: a lista de registradores da fita mostra R0-R9 e R.0-R.9', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  await tap(p, '9 sto dot 5');
  assert.equal(await p.locator('.reg').count(), 20);
  assert.equal(await p.locator('.reg[data-reg="15"] .k').innerText(), 'R.5');
  assert.equal(await p.locator('.reg[data-reg="15"] .v').innerText(), '9,00');
  await app.close();
});

test('Platinum: linha do programa com 3 dígitos no visor', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await platinum(p);
  await tap(p, 'f rs f rdown 5');
  assert.match(await digits(p), /^001–/);
  await app.close();
});

test('Platinum com 11 indicadores cabe em 320 px sem rolagem horizontal', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.setViewportSize({ width: 320, height: 640 });
  await platinum(p);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 0, 'sobra ' + over + 'px');
  const ind = await p.locator('.display .indicators').evaluate((e) => e.getBoundingClientRect().right);
  const disp = await p.locator('.display').evaluate((e) => e.getBoundingClientRect().right);
  assert.ok(ind <= disp + 0.5, 'indicadores passam do visor');
  await app.close();
});
