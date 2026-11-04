// Gera dist/calc12c-vX.Y.Z.html: motor + interface + CSS + manifest + ícones num único arquivo,
// e dist/sw.js + dist/manifest.webmanifest + ícones para quem hospedar (instalação como app).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UI = ROOT + 'src/ui/';
const DIST = ROOT + 'dist/';
const version = JSON.parse(readFileSync(ROOT + 'package.json', 'utf8')).version;
const name = `calc12c-v${version}.html`;
const read = (p) => readFileSync(p, 'utf8');

// ---- junta os módulos ES num só script (sem bundler) ----
const IMPORT = /^import\s+\{([^}]+)\}\s+from\s+'([^']+)';?[ \t]*$/gm;
const EXPORT = /^export\s+(?:async\s+)?(function|class|const|let)\s+([A-Za-z0-9_$]+)/gm;
const seen = new Set();
const order = []; // módulos na ordem de dependência (dependências primeiro)

function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = read(file);
  const deps = [...src.matchAll(IMPORT)].map((m) => resolve(dirname(file), m[2]));
  deps.forEach(visit);
  const id = '__m_' + basename(file, '.js').replace(/\W/g, '_');
  const names = [];
  let code = src.replace(IMPORT, (_, list, from) => {
    const dep = '__m_' + basename(from, '.js').replace(/\W/g, '_');
    return `const { ${list.trim()} } = ${dep};`;
  });
  code = code.replace(EXPORT, (_, kind, n) => {
    names.push(n);
    return src.includes('async function ' + n) ? `async ${kind} ${n}` : `${kind} ${n}`;
  });
  if (/^export\s/m.test(code)) throw new Error('export não suportado pelo build em ' + file);
  order.push({ id, code: `const ${id} = (() => {\n${code}\nreturn { ${names.join(', ')} };\n})();` });
}
visit(UI + 'app.js');
const script = order.map((m) => m.code).join('\n\n').replace(/<\/script/gi, '<\\/script');

// ---- manifest e ícones embutidos ----
const b64 = (f) => readFileSync(UI + f).toString('base64');
const icon192 = 'data:image/png;base64,' + b64('icon-192.png');
const icon512 = 'data:image/png;base64,' + b64('icon-512.png');
const manifest = JSON.parse(read(UI + 'manifest.webmanifest'));
delete manifest.start_url; // numa URL data: o caminho relativo não resolveria
delete manifest.scope;
manifest.icons = [
  { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
];
const manifestUrl = 'data:application/manifest+json;base64,' + Buffer.from(JSON.stringify(manifest)).toString('base64');

// ---- HTML ----
let html = read(UI + 'index.html');
const css = read(UI + 'themes.css') + '\n' + read(UI + 'layout.css');
html = html
  .replace(/<link rel="manifest"[^>]*>/, `<link rel="manifest" href="${manifestUrl}">`)
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon192}">`)
  .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${icon192}">`)
  .replace(/<link rel="stylesheet" href="\.\/themes\.css">\s*/, '')
  .replace(/<link rel="stylesheet" href="\.\/layout\.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="\.\/app\.js"><\/script>/, () => `<script>\n${script}\n</script>`);
if (/<script[^>]+src=|rel="stylesheet"/.test(html)) throw new Error('sobrou referência externa no HTML');

mkdirSync(DIST, { recursive: true });
writeFileSync(DIST + name, html);

// ---- arquivos para hospedagem (opcional): service worker, manifest e ícones ----
const sw = read(UI + 'sw.js')
  .replace(/const CACHE = '[^']*';/, `const CACHE = 'calc12c-v${version}';`)
  .replace(/\/\*FILES\*\/[\s\S]*?\]; \/\*FILES-END\*\//, `/*FILES*/ ['./', './${name}', './manifest.webmanifest', './icon-192.png', './icon-512.png']; /*FILES-END*/`);
writeFileSync(DIST + 'sw.js', sw);
const hosted = JSON.parse(read(UI + 'manifest.webmanifest'));
hosted.icons = hosted.icons.filter((i) => i.type === 'image/png');
hosted.start_url = './' + name;
writeFileSync(DIST + 'manifest.webmanifest', JSON.stringify(hosted, null, 2));
for (const f of ['icon-192.png', 'icon-512.png']) copyFileSync(UI + f, DIST + f);

console.log(`ok: dist/${name} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
