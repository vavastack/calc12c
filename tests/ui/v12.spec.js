import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const openSettings = async (p) => {
  await p.evaluate(() => window.calc12c.settings.open());
};
const rootVar = (p, v) => p.evaluate((n) => document.documentElement.style.getPropertyValue(n).trim(), v);
const press = (p, seq) => p.evaluate((s) => s.split(' ').forEach((id) => window.calc12c.engine.press(id)), seq);

// ---------- cores ----------
test('cores: escolher a cor da tecla f muda as variáveis, persiste ao reabrir e "Restaurar" volta ao tema', async () => {
  const { page: p, context, errors, close } = await openApp(browser, server.url);
  await enableDev(p);
  await openSettings(p);
  await p.locator('.settings input[name="color-f"]').fill('#ff0000');
  assert.equal(await rootVar(p, '--gold'), '#ff0000');
  assert.match(await rootVar(p, '--keyf-bg'), /linear-gradient/);
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('calc12c.settings')).colors.f), '#ff0000');
  // reabrir a página: a cor continua
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await rootVar(p, '--gold'), '#ff0000');
  await openSettings(p);
  assert.equal(await p.locator('.settings input[name="color-f"]').inputValue(), '#ff0000');
  await p.locator('.settings .reset-colors').click();
  assert.equal(await rootVar(p, '--gold'), '');
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('calc12c.settings')).colors.f), null);
  assert.deepEqual(errors, []);
  await close();
});

test('cores: as quatro cores aplicam as variáveis esperadas e a troca de tema não as apaga', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await enableDev(p);
  await openSettings(p);
  for (const [k, c] of [['plate', '#336699'], ['f', '#ff8800'], ['g', '#00aa55'], ['display', '#ffee00']]) await p.locator(`.settings input[name="color-${k}"]`).fill(c);
  assert.equal(await rootVar(p, '--brand'), '#336699');
  assert.equal(await rootVar(p, '--blue'), '#00aa55');
  assert.equal(await rootVar(p, '--display-text'), '#ffee00');
  await p.locator('.settings select[name="theme"]').selectOption('platinum');
  assert.equal(await rootVar(p, '--gold'), '#ff8800');
  await close();
});

test('cores: valores salvos inválidos são ignorados ao carregar', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await p.evaluate(() => localStorage.setItem('calc12c.settings', JSON.stringify({ v: 5, dev: true, colors: { f: 'vermelho', g: '#zzz', plate: '#112233', display: 5 } })));
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await rootVar(p, '--gold'), '');
  assert.equal(await rootVar(p, '--blue'), '');
  assert.equal(await rootVar(p, '--brand'), '#112233');
  await close();
});

// ---------- memórias em arquivo ----------
test('memórias: salvar baixa o arquivo, e abrir devolve o estado depois de a calculadora ser alterada', async () => {
  const { page: p, errors, close } = await openApp(browser, server.url, undefined, { acceptDownloads: true });
  await press(p, 'f clx 1 2 n 1 i 1 0 0 0 pv pmt 4 2 sto 3');
  await openSettings(p);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.settings .mem-save').click()]);
  assert.match(dl.suggestedFilename(), /^calc12c-memorias-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await dl.path();
  const texto = await readFile(path, 'utf8');
  assert.equal(JSON.parse(texto).tipo, 'calc12c-memorias');
  // mexe na calculadora e depois abre o arquivo
  await press(p, 'f clx');
  assert.equal(await p.evaluate(() => window.calc12c.engine.state.regs[3]), 0);
  await p.locator('.settings .mem-file').setInputFiles(path);
  await p.waitForFunction(() => window.calc12c.engine.state.regs[3] === 42);
  assert.equal(await p.evaluate(() => window.calc12c.engine.state.fin.n), 12);
  assert.match(await p.locator('.notice').innerText(), /Memórias carregadas/);
  assert.deepEqual(errors, []);
  await close();
});

test('memórias: arquivo inválido mostra o aviso e não mexe na calculadora', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await press(p, '7 sto 5');
  await openSettings(p);
  await p.locator('.settings .mem-file').setInputFiles({ name: 'lixo.json', mimeType: 'application/json', buffer: Buffer.from('{"oi":1}') });
  await p.waitForFunction(() => /não é de memórias/.test(document.querySelector('.notice').textContent));
  assert.equal(await p.evaluate(() => window.calc12c.engine.state.regs[5]), 7);
  await close();
});

test('memórias: compartilhar usa o compartilhamento do aparelho; sem ele, baixa o arquivo', async () => {
  const { page: p, close } = await openApp(browser, server.url, undefined, { acceptDownloads: true });
  await openSettings(p);
  await p.evaluate(() => {
    window.__shared = null;
    navigator.canShare = () => true;
    navigator.share = async (d) => { window.__shared = d.files.map((f) => f.name); };
  });
  await p.locator('.settings .mem-share').click();
  await p.waitForFunction(() => window.__shared);
  assert.match(await p.evaluate(() => window.__shared[0]), /^calc12c-memorias-.*\.json$/);
  await p.evaluate(() => { navigator.canShare = undefined; });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.settings .mem-share').click()]);
  assert.match(dl.suggestedFilename(), /\.json$/);
  await close();
});

// ---------- orientação ----------
test('orientação: escolher "Deitado" trava, voltar a "Automática" libera, e a escolha fica guardada', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await p.evaluate(() => {
    window.__ori = [];
    Object.defineProperty(screen, 'orientation', { configurable: true, value: { lock: async (m) => { window.__ori.push('lock:' + m); }, unlock: () => window.__ori.push('unlock') } });
  });
  await openSettings(p);
  await p.locator('.settings select[name="orient"]').selectOption('landscape');
  await p.waitForFunction(() => window.__ori.includes('lock:landscape'));
  assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('calc12c.settings')).orient), 'landscape');
  await p.locator('.settings select[name="orient"]').selectOption('auto');
  await p.waitForFunction(() => window.__ori.includes('unlock'));
  await close();
});

test('orientação: quando o navegador recusa a trava, aparece a orientação para instalar ou usar tela cheia', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await p.evaluate(() => Object.defineProperty(screen, 'orientation', { configurable: true, value: { lock: async () => { throw new Error('NotSupportedError'); }, unlock() {} } }));
  await openSettings(p);
  await p.locator('.settings select[name="orient"]').selectOption('portrait');
  await p.waitForFunction(() => /instale o app/.test(document.querySelector('.orient-note').textContent));
  await close();
});

test('orientação: a trava guardada é reaplicada ao abrir o app', async () => {
  const { page: p, context, close } = await openApp(browser, server.url);
  await p.evaluate(() => localStorage.setItem('calc12c.settings', JSON.stringify({ v: 4, orient: 'portrait' })));
  await p.addInitScript(() => {
    window.__ori = [];
    Object.defineProperty(screen, 'orientation', { configurable: true, value: { lock: async (m) => { window.__ori.push('lock:' + m); }, unlock() {} } });
  });
  await p.reload();
  await p.waitForSelector('button.key');
  await p.waitForFunction(() => window.__ori.includes('lock:portrait'));
  await close();
});
