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

async function tap(page, seq) {
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    const ids = /^\d+(\.\d+)?$/.test(tok) ? [...tok].map((c) => (c === '.' ? 'dot' : c)) : [tok];
    for (const id of ids) await page.locator(`button.key[data-id="${id}"]`).click({ force: true });
  }
}
const digits = (p) => p.locator('.display .digits').innerText();
const isOpen = (p) => p.locator('.drawer').getAttribute('data-open');
const txt = (p, sel) => p.locator(sel).innerText();
async function drag(page, dy, sel = '.display .digits') {
  const b = await page.locator(sel).boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy / 2, { steps: 4 });
  await page.mouse.move(x, y + dy, { steps: 4 });
  await page.mouse.up();
}

test('puxar o visor para baixo abre a gaveta; para cima fecha', async () => {
  const app = await openApp(browser, server.url);
  assert.equal(await isOpen(app.page), 'false');
  await drag(app.page, 90);
  assert.equal(await isOpen(app.page), 'true');
  await drag(app.page, -90, '.drawer-handle'); // deslizar para cima a partir da alça
  assert.equal(await isOpen(app.page), 'false');
  await app.close();
});

test('a alça também abre e fecha (aria-expanded)', async () => {
  const app = await openApp(browser, server.url);
  const h = app.page.locator('.drawer-handle');
  assert.equal(await h.getAttribute('aria-expanded'), 'false');
  await h.click();
  assert.equal(await h.getAttribute('aria-expanded'), 'true');
  assert.equal(await isOpen(app.page), 'true');
  await h.click();
  assert.equal(await isOpen(app.page), 'false');
  await app.close();
});

test('gaveta: fita (uma linha por operação), cartões n/i/PV/PMT/FV, R0–R9 e pilha X–T', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await tap(p, '30 g n 6 g i 200000 pv pmt');
  await p.locator('.drawer-handle').click();
  assert.equal(await p.locator('.tape li').count(), 4);
  assert.match(await txt(p, '.tape li:last-child'), /PMT/);
  assert.match(await txt(p, '.tape li:last-child'), /-1\.199,10/);
  assert.equal(await txt(p, '.card[data-fin="n"] .v'), '360,00');
  assert.equal(await txt(p, '.card[data-fin="i"] .v'), '0,50');
  assert.equal(await txt(p, '.card[data-fin="pv"] .v'), '200.000,00');
  assert.equal(await txt(p, '.card[data-fin="pmt"] .v'), '-1.199,10');
  assert.equal(await txt(p, '.card[data-fin="fv"] .v'), '0,00');
  assert.equal(await p.locator('.reg').count(), 10);
  assert.equal(await p.locator('.stk').count(), 4);
  await p.locator('.drawer-handle').click();
  await tap(p, '5 sto 3');
  await p.locator('.drawer-handle').click();
  assert.equal(await txt(p, '.reg[data-reg="3"] .v'), '5,00');
  assert.equal(await txt(p, '.stk[data-stk="x"] .v'), '5,00');
  await app.close();
});

test('tocar numa linha da fita coloca o valor em X', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await tap(p, '3 enter 4 plus clx');
  assert.equal(await digits(p), '0,00');
  await p.locator('.drawer-handle').click();
  await p.locator('.tape li button').first().click();
  assert.equal(await digits(p), '7,00');
  await app.close();
});

test('vertical: memória escondida com a gaveta fechada; horizontal: painel sempre visível', async () => {
  const v = await openApp(browser, server.url);
  assert.equal(await v.page.locator('.mem').isVisible(), false);
  await v.close();
  const h = await openApp(browser, server.url, { width: 844, height: 390 });
  assert.equal(await h.page.locator('.mem').isVisible(), true);
  assert.equal(await h.page.locator('.card[data-fin="n"]').isVisible(), true);
  await h.close();
});

test('recarregar a página restaura pilha, registradores, dados financeiros e fita', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await tap(p, '30 g n 6 g i 200000 pv pmt 7 sto 4 9 enter 2');
  const antes = await digits(p);
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await digits(p), antes);
  await p.locator('.drawer-handle').click();
  assert.equal(await txt(p, '.card[data-fin="n"] .v'), '360,00');
  assert.equal(await txt(p, '.card[data-fin="pmt"] .v'), '-1.199,10');
  assert.equal(await txt(p, '.reg[data-reg="4"] .v'), '7,00');
  assert.equal(await p.locator('.tape li').count(), 5);
  await tap(p, 'plus'); // a digitação em andamento continua: 9 ENTER 2 + → 11
  assert.equal(await digits(p), '11,00');
  assert.deepEqual(app.errors, []);
  await app.close();
});

for (const [nome, lixo] of [['JSON corrompido', '{lixo'], ['versão antiga', '{"v":0,"x":1}'], ['formato errado', '[1,2,3]']]) {
  test(`Foco 5: estado salvo inválido (${nome}) → estado inicial, sem erro no console`, async () => {
    const app = await openApp(browser, server.url);
    await app.page.evaluate((v) => localStorage.setItem('calc12c.state', v), lixo);
    await app.page.reload();
    await app.page.waitForSelector('button.key');
    assert.equal(await digits(app.page), '0,00');
    await tap(app.page, '2 enter 3 plus');
    assert.equal(await digits(app.page), '5,00');
    assert.deepEqual(app.errors, []);
    await app.close();
  });
}

test('sem localStorage (bloqueado) o app abre e calcula', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(server.url + '/src/ui/index.html');
  await page.waitForSelector('button.key');
  await tap(page, '2 enter 3 plus');
  assert.equal(await digits(page), '5,00');
  assert.deepEqual(errors, []);
  await context.close();
});

test('"Limpar tudo" pede confirmação; cancelar mantém, confirmar zera fita e memória', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await tap(p, '30 g n 3 enter 4 plus 5 sto 1');
  await p.locator('.drawer-handle').click();
  await p.locator('.clear-all').click();
  await p.waitForSelector('.confirm:not([hidden])');
  await p.locator('.confirm .cancel').click();
  assert.equal(await p.locator('.confirm').isHidden(), true);
  assert.equal(await txt(p, '.card[data-fin="n"] .v'), '360,00');
  await p.locator('.clear-all').click();
  await p.locator('.confirm .ok').click();
  assert.equal(await p.locator('.tape li').count(), 0);
  assert.equal(await txt(p, '.card[data-fin="n"] .v'), '0,00');
  assert.equal(await txt(p, '.reg[data-reg="1"] .v'), '0,00');
  assert.equal(await digits(p), '0,00');
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await digits(p), '0,00');
  await app.close();
});
