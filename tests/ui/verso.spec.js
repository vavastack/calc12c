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

const ON = '.key[data-id="on"]';
const visible = (p, sel) => p.locator(sel).isVisible();
async function hold(p, ms = 700) {
  const b = await p.locator(ON).boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(ms);
  await p.mouse.up();
}

test('tecla ON: um toque abre as configurações (o ✕ fecha); não abre o verso', async () => {
  const { page: p, errors, close } = await openApp(browser, server.url);
  assert.equal(await p.locator(`${ON} .lm`).innerText(), 'ON'); // o rótulo padrão é ON
  assert.equal(await p.locator(`${ON} .lf`).innerText(), 'OFF');
  await p.locator(ON).click();
  assert.equal(await visible(p, '.settings'), true);
  assert.equal(await visible(p, '.verso'), false);
  await p.locator('.settings-close').click(); // no retrato o painel cobre a tecla ON; o ✕ fecha
  assert.equal(await visible(p, '.settings'), false);
  assert.deepEqual(errors, []);
  await close();
});

test('tecla ON: segurar abre o verso (e só ele); soltar não abre as configurações; ON fecha o verso', async () => {
  const { page: p, errors, close } = await openApp(browser, server.url);
  await hold(p);
  assert.equal(await visible(p, '.verso'), true);
  assert.equal(await visible(p, '.settings'), false);
  assert.equal(await p.evaluate(() => window.calc12c.engine.state.display), '0,00'); // ON nunca digita nada
  await p.locator('.verso-close').click();
  assert.equal(await visible(p, '.verso'), false);
  await hold(p);
  assert.equal(await visible(p, '.verso'), true);
  await p.keyboard.press('Escape');
  await p.locator('.verso-close').click();
  assert.deepEqual(errors, []);
  await close();
});

test('tecla ON: toque curto (abaixo de meio segundo) não abre o verso', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await hold(p, 150);
  assert.equal(await visible(p, '.verso'), false);
  assert.equal(await visible(p, '.settings'), true);
  await close();
});

test('verso: Executar digita as teclas e deixa o resultado no visor', async () => {
  const { page: p, errors, close } = await openApp(browser, server.url);
  await p.evaluate(() => (window.calc12c.fast = true));
  await hold(p);
  await p.locator('.verso [data-run]').first().click(); // 31/05/2003 + 120 dias, D.MY
  await p.waitForFunction(() => window.calc12c.engine.state.display === '28,09,2003 7');
  assert.equal(await visible(p, '.verso'), false); // volta à frente da calculadora
  // juros simples (365): usa f CLEAR FIN antes e termina com R↓ x≷y
  await hold(p);
  const idx = await p.evaluate(() => [...document.querySelectorAll('.verso [data-run]:not([disabled])')].findIndex((b) => b.closest('.variant').querySelector('.v-label').textContent === 'Juros (365)'));
  await p.locator('.verso [data-run]:not([disabled])').nth(idx).click();
  await p.waitForFunction(() => window.calc12c.engine.state.display === '2,59');
  assert.deepEqual(errors, []);
  await close();
});

test('verso: exemplos de funções ainda não implementadas aparecem como "em breve" e não executam', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await hold(p);
  const off = p.locator('.verso .run:disabled');
  assert.ok((await off.count()) >= 5);
  assert.equal(await off.first().innerText(), 'Em breve');
  await close();
});

test('colchetes: BOND, DEPRECIATION, CLEAR e PREFIX alinhados às teclas certas (retrato)', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  const r = await p.evaluate(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top }; };
    const br = [...document.querySelectorAll('.bracket')].map((b) => ({ txt: b.textContent, ...box(b), shown: getComputedStyle(b).display !== 'none' }));
    const key = (id) => box(document.querySelector(`.key[data-id="${id}"]`));
    return { br, pv: key('pv'), fv: key('fv'), yx: key('yx'), recip: key('recip'), sst: key('sst'), clx: key('clx'), enter: key('enter') };
  });
  const by = (t) => r.br.find((b) => b.txt === t);
  assert.ok(Math.abs(by('BOND').l - r.yx.l) < 6 && Math.abs(by('BOND').r - r.recip.r) < 6);
  assert.ok(Math.abs(by('DEPRECIATION').r - r.fv.r) < 6);
  assert.ok(Math.abs(by('CLEAR').l - r.sst.l) < 6 && Math.abs(by('CLEAR').r - r.clx.r) < 6);
  const pfx = r.br.find((b) => b.txt === '' && b.shown);
  assert.ok(pfx && Math.abs(pfx.l - r.enter.l) < 6);
  await close();
});

test('colchetes na paisagem: o CLEAR cobre também o PREFIX e nada vaza da tela', async () => {
  const { page: p, close } = await openApp(browser, server.url, { width: 844, height: 390 });
  const r = await p.evaluate(() => {
    const br = [...document.querySelectorAll('.bracket')].filter((b) => getComputedStyle(b).display !== 'none');
    const clear = br.find((b) => b.textContent === 'CLEAR').getBoundingClientRect();
    const enter = document.querySelector('.key[data-id="enter"]').getBoundingClientRect();
    return { n: br.length, clearR: clear.right, enterR: enter.right, w: innerWidth };
  });
  assert.equal(r.n, 3);
  assert.ok(Math.abs(r.clearR - r.enterR) < 6);
  assert.ok(r.clearR <= r.w);
  await close();
});

test('configurações novas: estilo da tecla ON, separador decimal, som, não dormir, banda superior e redefinir', async () => {
  const { page: p, errors, close } = await openApp(browser, server.url);
  await p.locator(ON).click();
  await p.selectOption('[name=onStyle]', 'menu');
  assert.equal(await p.locator(`${ON} .lm`).innerText(), '≡');
  await p.selectOption('[name=onStyle]', 'on');
  assert.equal(await p.locator(`${ON} .lm`).innerText(), 'ON');
  await p.selectOption('[name=locale]', 'us');
  assert.equal(await p.evaluate(() => window.calc12c.engine.locale), 'us');
  await p.selectOption('[name=locale]', 'br');
  await p.selectOption('[name=sound]', 'mech');
  assert.equal(await p.evaluate(() => window.calc12c.sounder.mode), 'mech');
  await p.locator('[name=topPad]').fill('20');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.calc')).getPropertyValue('--top-extra').trim()), '20px');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('calc12c.settings')));
  assert.equal(saved.sound, 'mech');
  assert.equal(saved.topPad, 20);
  assert.equal(saved.v, 3);
  // redefinir: dois toques, volta ao padrão e mantém a memória da calculadora
  await p.locator('.reset-settings').click();
  assert.equal(await p.locator('.reset-settings').innerText(), 'Toque de novo');
  await p.locator('.reset-settings').click();
  assert.equal(await p.evaluate(() => window.calc12c.sounder.mode), 'off');
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.calc')).getPropertyValue('--top-extra').trim()), '0px');
  assert.deepEqual(errors, []);
  await close();
});

test('configurações v2 salvas continuam valendo: a vibração desligada não volta a ligar', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await p.evaluate(() => localStorage.setItem('calc12c.settings', JSON.stringify({ v: 2, theme: 'platinum', mode: 'auto', reduce: false, vibrate: false })));
  await p.reload();
  await p.waitForSelector('button.key');
  const s = await p.evaluate(() => window.calc12c.settings.get());
  assert.equal(s.theme, 'platinum');
  assert.equal(s.vibrate, false);
  assert.equal(s.sound, 'off');
  assert.equal(s.onStyle, 'on');
  await close();
});

test('a tecla afunda ao encostar e volta ao soltar; som antigo ligado vira suave', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  const b = p.locator('.key[data-id="7"]');
  const box = await b.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  assert.equal(await b.evaluate((e) => e.classList.contains('down')), true);
  await p.mouse.up();
  assert.equal(await b.evaluate((e) => e.classList.contains('down')), false);
  assert.equal(await p.locator('.display').innerText().then((t) => t.includes('7')), true);
  await p.evaluate(() => localStorage.setItem('calc12c.settings', JSON.stringify({ v: 3, theme: 'retro', mode: 'auto', sound: true })));
  await p.reload();
  await p.waitForSelector('button.key');
  assert.equal(await p.evaluate(() => window.calc12c.sounder.mode), 'soft');
  await close();
});

test('vibração: vibra ao encostar e, se o navegador recusar, vibra ao soltar', async () => {
  const { page: p, close } = await openApp(browser, server.url);
  await p.evaluate(() => {
    window.__v = [];
    window.__ok = true;
    navigator.vibrate = (ms) => (window.__ok ? (window.__v.push(ms), true) : false);
  });
  const b = p.locator('.key[data-id="7"]');
  const box = await b.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  assert.equal(await p.evaluate(() => window.__v.length), 1);
  await p.mouse.up();
  assert.equal(await p.evaluate(() => window.__v.length), 1);
  await p.evaluate(() => (window.__ok = false));
  await p.mouse.down();
  await p.evaluate(() => (window.__ok = true));
  await p.mouse.up();
  assert.equal(await p.evaluate(() => window.__v.length), 2);
  await close();
});
