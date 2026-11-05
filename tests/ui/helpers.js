// Utilitários dos testes de interface: servidor estático local + Playwright já instalado.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
};

export async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
      if (!file.startsWith(ROOT)) throw new Error('fora da raiz');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('não encontrado');
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, close: () => new Promise((ok) => server.close(ok)) };
}

// Liga o modo desenvolvedor (libera cores e temas Gold/Platinum em qualquer modelo).
export const enableDev = (page) => page.evaluate(() => window.calc12c.settings.setDev(true));

// Abre o app numa página nova com o tamanho pedido; devolve { page, errors, close }.
export async function openApp(browser, url, viewport = { width: 390, height: 844 }, ctxOpts = {}) {
  const context = await browser.newContext({ viewport, ...ctxOpts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url + '/src/ui/index.html');
  await page.waitForSelector('button.key', { timeout: 5000 });
  return { page, context, errors, close: () => context.close() };
}
