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

const tf = (p) => p.locator('.reflex').evaluate((e) => e.style.transform || getComputedStyle(e).transform);
const modern = (p, reduce = false) =>
  p.evaluate(async (r) => (await import('/src/ui/settings.js')).applyTheme('moderno', 'escuro', r), reduce);

test('no PC, mover o mouse altera o transform da camada de reflexo', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p);
  const antes = await tf(p);
  await p.mouse.move(40, 300);
  await p.mouse.move(350, 700, { steps: 5 });
  await p.waitForFunction((a) => (document.querySelector('.reflex').style.transform || '') !== a, antes);
  assert.notEqual(await tf(p), antes);
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('só transform e opacity são animados pela camada', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p);
  await p.mouse.move(100, 400);
  await p.mouse.move(300, 600, { steps: 5 });
  await p.waitForTimeout(100);
  const props = await p.locator('.reflex').evaluate((e) => [...e.style].filter((x) => x !== 'transform' && x !== 'opacity'));
  assert.deepEqual(props.filter((x) => !x.startsWith('--')), []);
  await app.close();
});

test('no máximo uma atualização por quadro (requestAnimationFrame)', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p);
  const r = await p.evaluate(async () => {
    const layer = document.querySelector('.reflex');
    let writes = 0;
    const desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'transform');
    Object.defineProperty(layer.style, 'transform', { configurable: true, get() { return desc.get.call(this); }, set(v) { writes++; desc.set.call(this, v); } });
    let frames = 0;
    const count = () => { frames++; requestAnimationFrame(count); };
    requestAnimationFrame(count);
    // 200 eventos de mouse sintéticos num mesmo instante
    for (let i = 0; i < 200; i++) document.dispatchEvent(new PointerEvent('pointermove', { clientX: i * 2, clientY: 300 + i, bubbles: true }));
    await new Promise((ok) => setTimeout(ok, 120));
    return { writes, frames };
  });
  assert.ok(r.writes >= 1, 'deveria ter atualizado');
  assert.ok(r.writes <= r.frames, `${r.writes} escritas em ${r.frames} quadros`);
  assert.ok(r.writes <= 12, `escritas demais: ${r.writes}`);
  await app.close();
});

test('pausa com a página em segundo plano (document.hidden) e volta ao ficar visível', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p);
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const parado = await tf(p);
  await p.mouse.move(50, 300);
  await p.mouse.move(340, 720, { steps: 6 });
  await p.waitForTimeout(150);
  assert.equal(await tf(p), parado, 'não deveria atualizar em segundo plano');
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.mouse.move(60, 310);
  await p.mouse.move(330, 700, { steps: 6 });
  await p.waitForFunction((a) => document.querySelector('.reflex').style.transform !== a, parado);
  await app.close();
});

test('com a permissão de movimento negada o brilho fica fixo e o app segue funcionando', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.DeviceOrientationEvent = class extends Event {
      static requestPermission() { return Promise.reject(new Error('negado')); }
    };
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(server.url + '/src/ui/index.html');
  await page.waitForSelector('button.key');
  await modern(page);
  await page.locator('.key[data-id="on"]').click();
  await page.locator('.settings button.motion').click(); // toque do usuário pede a permissão
  await page.waitForTimeout(700); // o mouse do clique também move o brilho; espera assentar
  const fixo = await tf(page);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 30, beta: 40 })));
  await page.waitForTimeout(100);
  const nums = (t) => t.match(/-?\d+(\.\d+)?/g).map(Number);
  const [a, b] = [nums(fixo), nums(await tf(page))];
  // a inclinação (gamma 30) moveria dezenas de px; só sobra o fim do amortecimento do mouse
  assert.ok(Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1, `brilho deveria ficar fixo: ${fixo} → ${b}`);
  await page.locator('.settings-close').click(); // fecha o painel para tocar nas teclas
  await page.locator('button.key[data-id="5"]').click();
  assert.equal(await page.locator('.digits').innerText(), '5');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('com a permissão concedida, a inclinação do aparelho move a camada', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.DeviceOrientationEvent = class extends Event {
      static requestPermission() { return Promise.resolve('granted'); }
    };
  });
  const page = await ctx.newPage();
  await page.goto(server.url + '/src/ui/index.html');
  await page.waitForSelector('button.key');
  await modern(page);
  await page.locator('.key[data-id="on"]').click();
  await page.locator('.settings button.motion').click();
  await page.waitForTimeout(100);
  const antes = await tf(page);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 0, beta: 50 })));
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 35, beta: 50 })));
  await page.waitForFunction((a) => document.querySelector('.reflex').style.transform !== a, antes);
  await ctx.close();
});

test('com "reduzir efeitos" a camada não existe e nada é animado', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p, true);
  assert.equal(await p.locator('.reflex').count(), 0);
  await p.mouse.move(100, 400);
  await p.mouse.move(300, 600, { steps: 4 });
  assert.deepEqual(app.errors, []);
  await app.close();
});

test('ao ligar de novo os efeitos, o reflexo volta a reagir', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p, true);
  await modern(p, false);
  assert.equal(await p.locator('.reflex').count(), 1);
  const antes = await tf(p);
  await p.mouse.move(30, 280);
  await p.mouse.move(360, 760, { steps: 6 });
  await p.waitForFunction((a) => document.querySelector('.reflex').style.transform !== a, antes);
  await app.close();
});

test('no celular o toque NÃO move o reflexo', async () => {
  const app = await openApp(browser, server.url, undefined, { hasTouch: true });
  const p = app.page;
  await modern(p);
  const antes = await p.locator('.reflex').evaluate((e) => e.style.transform);
  await p.locator('button.key[data-id="9"]').tap();
  await p.waitForTimeout(700);
  const depois = await p.locator('.reflex').evaluate((e) => e.style.transform);
  assert.equal(antes, depois);
  await app.close();
});

test('a placa metálica também recebe o brilho, na mesma posição do teclado', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p);
  assert.equal(await p.locator('.sheen').count(), 1);
  assert.equal(await p.locator('.calc > .reflex-clip').count(), 1); // uma camada só, cobrindo todo o vidro
  await p.mouse.move(40, 600);
  await p.mouse.move(350, 300);
  await p.waitForTimeout(700);
  const [a, b] = await p.evaluate(() => [document.querySelector('.reflex').style.transform, document.querySelector('.sheen').style.transform]);
  assert.notEqual(a, '');
  assert.equal(a, b);
  await app.close();
});

test('o sensor de inclinação liga sozinho (ou no primeiro toque, se o sistema exigir permissão) e move o reflexo', async () => {
  const app = await openApp(browser, server.url);
  const p = app.page;
  await modern(p);
  await p.locator('.brand').click(); // um toque basta para quem precisa de permissão
  await p.waitForTimeout(150);
  await p.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 0, beta: 50 })));
  await p.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 20, beta: 70 })));
  await p.waitForTimeout(700);
  const t = await p.locator('.reflex').evaluate((e) => e.style.transform);
  assert.notEqual(t, '');
  assert.notEqual(t, 'translate3d(0.00px, 0.00px, 0)');
  await app.close();
});

for (const [t, m] of [['retro', 'auto'], ['moderno', 'escuro'], ['moderno', 'claro']]) {
  test(`o reflexo é visível e nunca fica parado, sem sensor nem toque — ${t}/${m}`, async () => {
    const app = await openApp(browser, server.url);
    const p = app.page;
    await p.evaluate(async ([a, b]) => (await import('/src/ui/settings.js')).applyTheme(a, b, false), [t, m]);
    const r = await p.locator('.reflex').evaluate((e) => {
      const cs = getComputedStyle(e, '::before');
      return { bg: cs.backgroundImage, anim: cs.animationName, estado: e.getAnimations({ subtree: true }).map((a) => a.playState) };
    });
    assert.match(r.bg, /linear-gradient/);
    assert.equal(r.anim, 'reflex-drift');
    assert.ok(r.estado.includes('running'));
    const antes = await p.locator('.reflex').evaluate((e) => getComputedStyle(e, '::before').transform);
    await p.waitForTimeout(1500);
    const depois = await p.locator('.reflex').evaluate((e) => getComputedStyle(e, '::before').transform);
    assert.notEqual(antes, depois);
    await app.close();
  });
}

test('calibração: a primeira leitura vira o centro, qualquer que seja o jeito de segurar', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.DeviceOrientationEvent = class extends Event {
      static requestPermission() { return Promise.resolve('granted'); }
    };
  });
  const p = await ctx.newPage();
  await p.goto(server.url + '/src/ui/index.html');
  await p.waitForSelector('button.key');
  await modern(p);
  await p.locator('.key[data-id="on"]').click();
  await p.locator('.settings button.motion').click();
  await p.waitForTimeout(100);
  const tilt = (g, b) => p.evaluate(([g, b]) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: g, beta: b })), [g, b]);
  const pos = () => p.locator('.reflex').evaluate((e) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(e).transform);
    return [m.m41, m.m42];
  });
  await tilt(12, 75); // segurando bem inclinado: não pode empurrar o reflexo para o limite
  await p.waitForTimeout(700);
  const [x0, y0] = await pos();
  assert.ok(Math.abs(x0) < 5 && Math.abs(y0) < 5, `centro esperado, veio ${x0},${y0}`);
  await tilt(30, 75); // +18° para o lado: vai ao limite horizontal
  await p.waitForTimeout(900);
  const [x1] = await pos();
  assert.ok(x1 > 60, `deveria deslocar para o lado, veio ${x1}`);
  await ctx.close();
});
