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

const tracks = (page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.keys'));
    return { cols: cs.gridTemplateColumns.split(' ').length, rows: cs.gridTemplateRows.split(' ').length };
  });
const box = (page, id) => page.locator(`button.key[data-id="${id}"]`).boundingBox();

test('vertical 390×844: 39 botões, grade 5 × 8', async () => {
  const app = await openApp(browser, server.url);
  assert.equal(await app.page.locator('button.key').count(), 39);
  assert.deepEqual(await tracks(app.page), { cols: 5, rows: 8 });
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('horizontal 844×390: grade 10 × 4', async () => {
  const app = await openApp(browser, server.url, { width: 844, height: 390 });
  assert.equal(await app.page.locator('button.key').count(), 39);
  assert.deepEqual(await tracks(app.page), { cols: 10, rows: 4 });
  await app.close();
});

for (const [nome, vp] of [['vertical', { width: 390, height: 844 }], ['horizontal', { width: 844, height: 390 }]]) {
  test(`${nome}: ENTER ocupa 2 linhas`, async () => {
    const app = await openApp(browser, server.url, vp);
    const enter = await box(app.page, 'enter');
    const um = await box(app.page, '1');
    assert.ok(enter.height > um.height * 1.9, `ENTER ${enter.height} vs tecla ${um.height}`);
    assert.ok(Math.abs(enter.width - um.width) < 2);
    await app.close();
  });
}

test('vertical: posições seguem o layout (n no topo à esquerda, + embaixo à direita)', async () => {
  const app = await openApp(browser, server.url);
  const n = await box(app.page, 'n');
  const plus = await box(app.page, 'plus');
  const chs = await box(app.page, 'chs');
  assert.ok(n.y < chs.y && Math.abs(n.x - chs.x) < 2);
  assert.ok(plus.x > n.x && plus.y > n.y);
  await app.close();
});

test('horizontal: ordem original da HP (n, i, PV… e CHS ao lado de FV; ENTER na coluna 6)', async () => {
  const app = await openApp(browser, server.url, { width: 844, height: 390 });
  const fv = await box(app.page, 'fv');
  const chs = await box(app.page, 'chs');
  const enter = await box(app.page, 'enter');
  const sto = await box(app.page, 'sto');
  assert.ok(Math.abs(fv.y - chs.y) < 2 && chs.x > fv.x);
  assert.ok(enter.x > sto.x && Math.abs(enter.x - chs.x) < 2);
  await app.close();
});

test('cada botão tem aria-label com a tecla e as funções f e g', async () => {
  const app = await openApp(browser, server.url);
  const lab = (id) => app.page.locator(`button.key[data-id="${id}"]`).getAttribute('aria-label');
  assert.equal(await lab('n'), 'n; f AMORT; g 12×');
  assert.equal(await lab('7'), '7; g BEG');
  assert.equal(await lab('plus'), '+');
  await app.close();
});

test('todas as teclas estão ativas: nenhuma tem aria-disabled', async () => {
  const app = await openApp(browser, server.url);
  assert.equal(await app.page.locator('button.key[aria-disabled="true"]').count(), 0);
  await app.close();
});

test('programa pela tela: f P/R, gravar, executar com R/S e PRGM aceso só no modo de programação', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  const tap = async (...ids) => { for (const id of ids) await p.locator(`button.key[data-id="${id}"]`).click(); };
  await tap('f', 'rs');
  assert.equal(await p.locator('.display [data-ind="PRGM"]').evaluate((e) => e.classList.contains('on')), true);
  await tap('f', 'rdown', 'enter', '2', '5', 'pct', 'minus', '5', 'plus');
  assert.match(await p.locator('.digits').innerText(), /^07/);
  await tap('f', 'rs');
  assert.equal(await p.locator('.display [data-ind="PRGM"]').evaluate((e) => e.classList.contains('on')), false);
  await tap('6', '2', '5', 'rs');
  assert.equal(await p.locator('.digits').innerText(), '473,75');
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('os rótulos f (dourado) e g (azul) aparecem na tecla', async () => {
  const app = await openApp(browser, server.url);
  const k = app.page.locator('button.key[data-id="n"]');
  assert.equal(await k.locator('.lf').innerText(), 'AMORT');
  assert.equal(await k.locator('.lg').innerText(), '12×');
  await app.close();
});
