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

// Toca nas teclas: números viram dígitos, o resto são ids de tecla.
async function tap(page, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    const ids = /^\d+(\.\d+)?$/.test(tok) ? [...tok].map((c) => (c === '.' ? 'dot' : c)) : [tok];
    for (const id of ids) await page.locator(`button.key[data-id="${id}"]`).click({ force: true });
  }
}
const digits = (page) => page.locator('.display .digits').innerText();
const lit = (page, ind) => page.locator(`.display [data-ind="${ind}"]`).evaluate((e) => e.classList.contains('on'));

test('3 ENTER 4 + mostra 7,00 (2 casas, como a HP)', async () => {
  const app = await openApp(browser, server.url);
  await tap(app.page, '3 enter 4 plus');
  assert.equal(await digits(app.page), '7,00');
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('indicadores: f e g acendem e apagam; BEGIN segue g 7 / g 8', async () => {
  const app = await openApp(browser, server.url);
  assert.equal(await lit(app.page, 'f'), false);
  await tap(app.page, 'f');
  assert.equal(await lit(app.page, 'f'), true);
  assert.equal(await lit(app.page, 'g'), false);
  await tap(app.page, 'g');
  assert.equal(await lit(app.page, 'f'), false);
  assert.equal(await lit(app.page, 'g'), true);
  await tap(app.page, '7');
  assert.equal(await lit(app.page, 'g'), false);
  assert.equal(await lit(app.page, 'BEGIN'), true);
  await tap(app.page, 'g 8');
  assert.equal(await lit(app.page, 'BEGIN'), false);
  await app.close();
});

test('os indicadores da 12C Platinum existem (RPN, ALG, parênteses, f, g, BEGIN, D.MY, C, USER, PRGM)', async () => {
  const app = await openApp(browser, server.url);
  const names = await app.page.locator('.display [data-ind]').evaluateAll((els) => els.map((e) => e.dataset.ind));
  assert.deepEqual(names, ['RPN', 'ALG', '( )', 'f', 'g', 'BEGIN', 'D.MY', 'C', 'USER', 'PRGM']);
  assert.equal(await lit(app.page, 'RPN'), true); // o padrão é RPN
  assert.equal(await lit(app.page, 'ALG'), false);
  assert.equal(await lit(app.page, 'PRGM'), false);
  await app.close();
});

test('f acende os rótulos dourados e apaga os azuis; g faz o contrário', async () => {
  const app = await openApp(browser, server.url);
  const op = (sel) => app.page.locator(`button.key[data-id="n"] ${sel}`).evaluate((e) => Number(getComputedStyle(e).opacity));
  const base = [await op('.lf'), await op('.lg')];
  await tap(app.page, 'f');
  await app.page.waitForTimeout(700); // fim da transição
  const f = [await op('.lf'), await op('.lg')];
  assert.ok(f[0] >= 1 && f[1] < 0.5, `f: ${f}`);
  await tap(app.page, 'g');
  await app.page.waitForTimeout(700); // fim da transição
  const g = [await op('.lf'), await op('.lg')];
  assert.ok(g[1] >= 1 && g[0] < 0.5, `g: ${g}`);
  assert.ok(base[0] > 0.5 && base[1] > 0.5, `repouso: ${base}`);
  await app.close();
});

test('erro mostra Error 0 e frase em português; a próxima tecla limpa', async () => {
  const app = await openApp(browser, server.url);
  await tap(app.page, '1 enter 0 divide');
  assert.equal(await digits(app.page), 'Error 0');
  assert.match(await app.page.locator('.display .msg').innerText(), /matem|inválid/i);
  await tap(app.page, '5');
  assert.notEqual(await digits(app.page), 'Error 0');
  assert.equal(await app.page.locator('.display .msg').innerText(), '');
  await app.close();
});

test('teclado do PC: 0-9 , . Enter + - * / Backspace acionam o motor', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.keyboard.type('12,5');
  assert.equal(await digits(p), '12,5');
  await p.keyboard.press('Backspace');
  assert.equal(await digits(p), '12,');
  await p.keyboard.type('5');
  await p.keyboard.press('Enter');
  await p.keyboard.type('2');
  await p.keyboard.press('*');
  assert.equal(await digits(p), '25,00');
  await p.keyboard.type('5');
  await p.keyboard.press('/');
  assert.equal(await digits(p), '5,00');
  await p.keyboard.type('1.5');
  await p.keyboard.press('-');
  assert.equal(await digits(p), '3,50');
  await p.keyboard.type('1');
  await p.keyboard.press('+');
  assert.equal(await digits(p), '4,50');
  await app.close();
});

test('a fonte do visor encolhe: 10 dígitos cabem em 390 px', async () => {
  const app = await openApp(browser, server.url);
  await tap(app.page, '1234567890');
  const { sw, cw, fs } = await app.page.locator('.display .digits').evaluate((e) => ({
    sw: e.scrollWidth, cw: e.clientWidth, fs: parseFloat(getComputedStyle(e).fontSize),
  }));
  assert.ok(sw <= cw, `estourou: ${sw} > ${cw}`);
  assert.ok(fs >= 16, `fonte pequena demais: ${fs}`);
  assert.equal(await digits(app.page), '1.234.567.890');
  await app.close();
});

test('alternar o formato pt-BR/en-US muda o visor', async () => {
  const app = await openApp(browser, server.url);
  await tap(app.page, '12580 enter 1 plus');
  assert.equal(await digits(app.page), '12.581,00');
  await app.page.locator('.fmt-toggle').click();
  assert.equal(await digits(app.page), '12,581.00');
  await app.page.locator('.fmt-toggle').click();
  assert.equal(await digits(app.page), '12.581,00');
  await app.close();
});

test('duplo toque não dá zoom (viewport travado e touch-action: manipulation)', async () => {
  const app = await openApp(browser, server.url);
  const meta = await app.page.locator('meta[name=viewport]').getAttribute('content');
  assert.match(meta, /user-scalable=no/);
  assert.equal(await app.page.evaluate(() => getComputedStyle(document.body).touchAction), 'manipulation');
  await app.close();
});

test('vibração leve só quando ligada', async () => {
  const app = await openApp(browser, server.url);
  await app.page.evaluate(() => { window.calc12c.vibrate = false; window.__vib = 0; navigator.vibrate = () => { window.__vib++; return true; }; });
  await tap(app.page, '5');
  assert.equal(await app.page.evaluate(() => window.__vib), 0);
  await app.page.evaluate(() => { window.calc12c.vibrate = true; });
  await tap(app.page, '6');
  assert.equal(await app.page.evaluate(() => window.__vib), 1);
  await app.close();
});
