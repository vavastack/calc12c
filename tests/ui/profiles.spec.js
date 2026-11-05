import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, startServer, openApp } from './helpers.js';

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

// ---------- modo ALG pela tela ----------
test('f ALG acende ALG, apaga RPN e troca o selo; f RPN volta', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
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
  await tap(p, 'f eex 2 plus 3 enter');
  assert.equal(await digits(p), '5,00');
  await tap(p, 'clx clx 4 5 6 minus 7 5 divide 1 8 dot 5 times 6 8 divide 1 dot 9 enter');
  assert.equal(await digits(p), '737,07');
  await app.close();
});

test('o indicador ( ) acende com parêntese aberto e g ( g ) aparecem nas teclas STO e RCL', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
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
  await tap(p, 'f eex 5 plus 3');
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await on(p, 'ALG'), true);
  await tap(p, 'enter');
  assert.equal(await digits(p), '8,00');
  await app.close();
});

test('os dez indicadores cabem no visor e a página não ganha rolagem lateral em telas estreitas', async () => {
  for (const width of [320, 360, 390]) {
    const app = await openApp(browser, server.url, { width, height: 740 });
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
  assert.deepEqual(await sel.locator('option').allTextContents(), ['Calc 12c']);
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
