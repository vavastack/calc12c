// Gera icon-192.png e icon-512.png a partir de src/ui/icon.svg (usa o Playwright já instalado).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const UI = fileURLToPath(new URL('../src/ui/', import.meta.url));
const svg = readFileSync(UI + 'icon.svg', 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  writeFileSync(UI + `icon-${size}.png`, await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
