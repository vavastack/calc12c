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

const key = (p, id) => p.locator(`button.key[data-id="${id}"]`);
const anim = (loc, pseudo) => loc.evaluate((e, ps) => getComputedStyle(e, ps).animationName, pseudo ?? null);
const reduce = (p, on) => p.evaluate(async (r) => (await import('/src/ui/settings.js')).applyTheme('moderno', 'escuro', r), on);
// o app liga "reduzir efeitos" sozinho em aparelhos de poucos núcleos; os testes de brilho forçam o modo completo
const full = (p) => reduce(p, false);

test('tocar em f faz a tecla brilhar e os rótulos dourados pulsarem; o brilho some sozinho', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await full(p);
  assert.equal(await anim(key(p, 'f'), '::after'), 'none');
  await key(p, 'f').click();
  assert.equal(await anim(key(p, 'f'), '::after'), 'glow-key');
  assert.equal(await anim(key(p, 'n').locator('.lf')), 'glow-label');
  assert.equal(await anim(key(p, 'n').locator('.lg')), 'none');
  await p.waitForTimeout(700);
  assert.equal(await anim(key(p, 'f'), '::after'), 'none');
  await app.close();
});

test('tocar em g faz o brilho azul: tecla g e rótulos azuis; f continua sem brilho', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await full(p);
  await key(p, 'g').click();
  assert.equal(await anim(key(p, 'g'), '::after'), 'glow-key');
  assert.equal(await anim(key(p, 'n').locator('.lg')), 'glow-label');
  assert.equal(await anim(key(p, 'f'), '::after'), 'none');
  await app.close();
});

test('o brilho usa só opacidade (sem transform) e continua com "reduzir efeitos"; o sistema com movimento reduzido o desliga', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await full(p);
  const css = await p.evaluate(() => [...document.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.name === 'glow-key' || r.name === 'glow-label').map((r) => r.cssText).join(' '));
  assert.ok(css.includes('opacity') && !/transform|filter|box-shadow/.test(css), css);
  await reduce(p, true);
  await key(p, 'f').click();
  assert.equal(await anim(key(p, 'f'), '::before'), 'glow-key');
  assert.equal(await anim(key(p, 'n').locator('.lf')), 'glow-label');
  await app.close();
  const sem = await openApp(browser, server.url, undefined, { reducedMotion: 'reduce' });
  await key(sem.page, 'f').click();
  assert.equal(await anim(key(sem.page, 'f'), '::after'), 'none');
  assert.equal(await anim(key(sem.page, 'n').locator('.lf')), 'none');
  await sem.close();
});

test('cabeçalho Calc 12C, dica da gaveta e teclas f e g coloridas', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  assert.equal((await p.locator('.brand .title').innerText()).replace(/\s+/g, ' '), 'Gold Calc RPN'); // nome à esquerda
  assert.equal(await p.locator('.brand .rpn').count(), 0); // sem RPN solto na esquerda
  assert.equal((await p.locator('.brand .badge').innerText()).replace(/\s+/g, ''), '12C'); // selo à direita: MW em SVG e barra com o modelo
  assert.equal(await p.locator('.brand .badge .mw svg').count(), 1);
  const [xr, xb] = await p.evaluate(() => [document.querySelector('.brand .name').getBoundingClientRect().x, document.querySelector('.brand .badge').getBoundingClientRect().x]);
  assert.ok(xr < xb);
  const hint = await p.locator('.drawer-handle').evaluate((e) => getComputedStyle(e, '::before').content);
  assert.match(hint, /Puxe para ver a fita e a memória/);
  const bg = (id) => key(p, id).locator('.face').evaluate((e) => getComputedStyle(e).backgroundImage); // a face da tecla carrega a cor
  assert.notEqual(await bg('f'), await bg('g'));
  assert.notEqual(await bg('f'), await bg('n'));
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.top, .keys')].map((e) => getComputedStyle(e).zIndex)), ['auto', '1']); // o visor (z 4) e a placa (z 1) ficam por cima do vidro do corpo
  await app.close();
});

test('o visor usa a fonte Share Tech Mono embutida (carrega sem rede)', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  const ok = await p.evaluate(async () => { await document.fonts.load('44px "Share Tech Mono"'); return document.fonts.check('44px "Share Tech Mono"'); });
  assert.equal(ok, true);
  assert.match(await p.locator('.digits').evaluate((e) => getComputedStyle(e).fontFamily), /Share Tech Mono/);
  await app.close();
});

test('toque: realce só na tecla tocada, a partir do ponto do dedo, sem mexer no reflexo', async () => {
  const app = await openApp(browser, server.url, undefined, { hasTouch: true });
  const p = app.page;
  await full(p);
  const antes = await p.locator('.reflex').evaluate((e) => e.style.transform);
  await p.locator('button.key[data-id="7"]').dispatchEvent('pointerdown', { clientX: 60, clientY: 500, pointerType: 'touch' });
  assert.equal(await anim(key(p, '7'), '::after'), 'glow-touch');
  assert.equal(await p.locator('button.key.touch').count(), 1); // só uma tecla acende
  assert.equal(await anim(key(p, '8'), '::after'), 'none');
  await p.waitForTimeout(700);
  assert.equal(await p.locator('.reflex').evaluate((e) => e.style.transform), antes);
  assert.equal(await p.locator('button.key.touch').count(), 0);
  await app.close();
});
