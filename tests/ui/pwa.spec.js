import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, startServer, openApp } from './helpers.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = ROOT + 'dist/calc12c-v0.1.0.html';
let server, browser;
before(async () => {
  server = await startServer();
  browser = await chromium.launch();
  execFileSync('node', ['scripts/build.js'], { cwd: ROOT, stdio: 'pipe' });
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

test('área segura: viewport-fit=cover e env(safe-area-inset-*) nos quatro lados', async () => {
  const html = readFileSync(ROOT + 'src/ui/index.html', 'utf8');
  assert.match(html, /viewport-fit=cover/);
  const css = readFileSync(ROOT + 'src/ui/layout.css', 'utf8');
  for (const lado of ['top', 'right', 'bottom', 'left']) assert.match(css, new RegExp(`env\\(safe-area-inset-${lado}`));
});

test('manifest: nome Calc RPN, tela cheia, sem "HP", ícones existentes', async () => {
  const m = JSON.parse(readFileSync(ROOT + 'src/ui/manifest.webmanifest', 'utf8'));
  assert.equal(m.name, 'Calc RPN');
  assert.equal(m.display, 'standalone');
  assert.ok(!/\bHP\b/i.test(JSON.stringify(m)), 'o nome "HP" não pode aparecer');
  assert.ok(m.icons.length >= 2);
  for (const ic of m.icons) assert.ok(existsSync(ROOT + 'src/ui/' + ic.src), ic.src);
});

test('PWA: com a rede desligada o app abre e calcula (service worker)', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload(); // agora controlada pelo service worker
  await p.waitForSelector('button.key');
  await app.context.setOffline(true);
  await p.reload();
  await p.waitForSelector('button.key');
  await tap(p, '2 enter 3 plus');
  assert.equal(await digits(p), '5,00');
  assert.deepEqual(app.errors.filter((e) => !/net::ERR|Failed to load/i.test(e)), []);
  await app.close();
});

test('build: gera dist/calc12c-v0.1.0.html único, sem módulos externos nem rede', async () => {
  assert.ok(existsSync(DIST));
  const html = readFileSync(DIST, 'utf8');
  assert.ok(!/<script[^>]+src=/i.test(html), 'script externo');
  assert.ok(!/<link[^>]+rel=["']stylesheet/i.test(html), 'css externo');
  assert.ok(!/^\s*import\s.+from/m.test(html), 'import residual');
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(html), 'URL de rede no HTML');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /rel="manifest"/);
  assert.ok(statSync(DIST).size < 460_000, 'arquivo grande demais');
});

test('arquivo gerado abre por file:// e passa o cenário do financiamento, sem usar a rede', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  const rede = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => !/^(file|data|blob):/.test(r.url()) && rede.push(r.url()));
  await page.goto(pathToFileURL(DIST).href);
  await page.waitForSelector('button.key');
  await tap(page, 'f xy g 8 30 g n 6 g i 200000 pv pmt');
  assert.equal(await digits(page), '-1.199,10');
  await tap(page, 'g 7 pmt');
  assert.equal(await digits(page), '-1.193,14'); // BEGIN não interrompe o 'acabou de guardar': recalcula com pagamento antecipado
  assert.deepEqual(errors, []);
  assert.deepEqual(rede, []);
  await ctx.close();
});

test('arquivo gerado funciona com a rede desligada e em horizontal', async () => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, offline: true });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(DIST).href);
  await page.waitForSelector('button.key');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.keys')).gridTemplateColumns.split(' ').length);
  assert.equal(cols, 10);
  await tap(page, '3 enter 4 plus');
  assert.equal(await digits(page), '7,00');
  assert.equal(await page.locator('.mem').isVisible(), true);
  await ctx.close();
});

test('arquivo gerado abre por file:// e calcula na 16C (inteiros de 64 bits, sem erro de módulo)', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(DIST).href);
  await page.waitForFunction(() => window.calc12c);
  await page.evaluate(() => window.calc12c.setProfile('16c'));
  await tap(page, '2 5 5 hex');
  assert.equal(await digits(page), 'FF h');
  await tap(page, 'dec 3 2 7 6 7 enter 2 times');
  assert.equal(await digits(page), '32766 d');
  assert.deepEqual(errors, []);
  await ctx.close();
});
