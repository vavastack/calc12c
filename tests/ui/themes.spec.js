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

const apply = (page, theme, mode, reduce = false) =>
  page.evaluate(async ([t, m, r]) => {
    const mod = await import('/src/ui/settings.js');
    mod.applyTheme(t, m, r);
  }, [theme, mode, reduce]);
const attr = (page, a) => page.evaluate((n) => document.documentElement.getAttribute(n), a);
const cssVar = (page, v) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), v);

test('três combinações aplicam o tema esperado (Retro é sempre escuro)', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  const vistos = {};
  for (const [t, m, esperado] of [
    ['retro', 'escuro', 'retro'], ['retro', 'claro', 'retro'], ['retro', 'auto', 'retro'],
    ['moderno', 'escuro', 'moderno-escuro'], ['moderno', 'claro', 'moderno-claro'],
  ]) {
    await apply(p, t, m);
    assert.equal(await attr(p, 'data-theme'), esperado, `${t}/${m}`);
    vistos[esperado] = await cssVar(p, '--key-flat');
  }
  assert.equal(new Set(Object.values(vistos)).size, 3, 'cada tema tem a sua cor de tecla');
  await app.close();
});

test('auto segue prefers-color-scheme, inclusive ao vivo', async () => {
  const app = await openApp(browser, server.url, undefined, { colorScheme: 'light' });
  const p = app.page;
  await apply(p, 'moderno', 'auto');
  assert.equal(await attr(p, 'data-theme'), 'moderno-claro');
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'moderno-escuro');
  await app.close();
});

test('theme-color acompanha o tema', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  for (const [t, m] of [['retro', 'auto'], ['moderno', 'escuro'], ['moderno', 'claro']]) {
    await apply(p, t, m);
    const meta = await p.locator('meta[name=theme-color]').getAttribute('content');
    assert.equal(meta, await cssVar(p, '--bg'), `${t}/${m}`);
  }
  await app.close();
});

test('reduzir efeitos: vidro vira cor sólida e o reflexo some', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await apply(p, 'moderno', 'escuro', false);
  assert.equal(await p.locator('.reflex').count(), 1);
  assert.notEqual(await p.locator('.calc').evaluate((e) => getComputedStyle(e).backdropFilter), 'none');
  await apply(p, 'moderno', 'escuro', true);
  assert.equal(await attr(p, 'data-reduce'), 'true');
  assert.equal(await p.locator('.reflex').count(), 0);
  const bf = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).backdropFilter !== 'none').length);
  assert.equal(bf, 0);
  const bg = await p.locator('.calc').evaluate((e) => getComputedStyle(e).backgroundColor);
  assert.ok(!/rgba\(.*,\s*0?\.\d+\)$/.test(bg), `fundo ainda translúcido: ${bg}`);
  await apply(p, 'moderno', 'escuro', false);
  assert.equal(await p.locator('.reflex').count(), 1);
  await app.close();
});

test('backdrop-filter existe só no corpo e no visor', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  for (const [t, m] of [['moderno', 'escuro'], ['moderno', 'claro'], ['retro', 'auto']]) {
    await apply(p, t, m, false);
    const donos = await p.evaluate(() =>
      [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).backdropFilter !== 'none')
        .map((e) => e.className || e.tagName));
    for (const d of donos) assert.match(String(d), /^(calc|display)\b/, `${t}/${m}: ${d}`);
  }
  await app.close();
});

const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s); return [+m[1], +m[2], +m[3]]; };

for (const [t, m] of [['retro', 'auto'], ['moderno', 'escuro'], ['moderno', 'claro']]) {
  test(`contraste mínimo 4,5:1 dos rótulos f e g sobre a tecla — ${t}/${m}`, async () => {
    const app = await openApp(browser, server.url);
    const p = app.page;
    await apply(p, t, m);
    const flat = rgb(await p.evaluate(() => {
      const d = document.createElement('i');
      d.style.color = getComputedStyle(document.documentElement).getPropertyValue('--key-flat');
      document.body.append(d);
      const c = getComputedStyle(d).color;
      d.remove();
      return c;
    }));
    const cor = async (sel) => rgb(await p.locator(`button.key[data-id="n"] ${sel}`).evaluate((e) => getComputedStyle(e).color));
    const rf = ratio(await cor('.lf'), flat);
    const rg = ratio(await cor('.lg'), flat);
    const rm = ratio(await cor('.lm'), flat);
    assert.ok(rf >= 4.5, `f ${rf.toFixed(2)}`);
    assert.ok(rg >= 4.5, `g ${rg.toFixed(2)}`);
    assert.ok(rm >= 4.5, `rótulo principal ${rm.toFixed(2)}`);
    await app.close();
  });
}

test('configurações pela tela: escolher tema/modo/efeitos e vibração; a escolha fica salva', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.locator('.settings-btn').click();
  await p.locator('.settings select[name="theme"]').selectOption('moderno');
  await p.locator('.settings select[name="mode"]').selectOption('claro');
  await p.locator('.settings input[name="reduce"]').check();
  await p.locator('.settings input[name="vibrate"]').check();
  assert.equal(await attr(p, 'data-theme'), 'moderno-claro');
  assert.equal(await attr(p, 'data-reduce'), 'true');
  assert.equal(await p.evaluate(() => window.calc12c.vibrate), true);
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await attr(p, 'data-theme'), 'moderno-claro');
  assert.equal(await attr(p, 'data-reduce'), 'true');
  assert.equal(await p.evaluate(() => window.calc12c.vibrate), true);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('em aparelho simples (≤ 4 núcleos) "reduzir efeitos" liga sozinho; a escolha do usuário vence', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const page = await ctx.newPage();
  await page.goto(server.url + '/src/ui/index.html');
  await page.waitForSelector('button.key');
  assert.equal(await attr(page, 'data-reduce'), 'true');
  await page.locator('.settings-btn').click();
  await page.locator('.settings input[name="reduce"]').uncheck();
  await page.reload();
  await page.waitForSelector('button.key');
  assert.equal(await attr(page, 'data-reduce'), 'false');
  await ctx.close();
});

test('configurações corrompidas no armazenamento caem nos padrões, sem erro', async () => {
  const app = await openApp(browser, server.url);
  await app.page.evaluate(() => localStorage.setItem('calc12c.settings', '{lixo'));
  await app.page.reload();
  await app.page.waitForSelector('button.key');
  assert.equal(await attr(app.page, 'data-theme'), 'retro');
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('painel de configurações: cabeçalho, grupos, interruptores e botão fechar', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await p.locator('.settings-btn').click();
  assert.equal(await p.locator('.settings-title').innerText(), 'Configurações');
  assert.deepEqual((await p.locator('.group-title').allTextContents()).map((t) => t.toLowerCase()), ['aparência', 'efeitos', 'brilho']);
  const w = await p.locator('input[name="vibrate"]').evaluate((e) => e.getBoundingClientRect().width);
  assert.ok(w >= 40, `interruptor largo o bastante para o toque (${w}px)`);
  await p.locator('input[name="vibrate"]').check();
  assert.equal(await p.locator('input[name="vibrate"]').isChecked(), true);
  const painel = await p.locator('.settings').boundingBox();
  assert.ok(painel.x >= 0 && painel.x + painel.width <= 390, 'painel cabe na largura da tela');
  await p.locator('.settings-close').click();
  assert.equal(await p.locator('.settings').isHidden(), true);
  await app.close();
});
