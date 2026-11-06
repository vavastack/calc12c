// Service worker: guarda os arquivos locais para o app abrir offline. Nenhum dado sai do aparelho.
const CACHE = 'calc12c-v0.1.0-b140dd07'; /*CACHE*/
const FILES = [/*FILES*/ ['./', './calc12c-v0.1.0.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']; /*FILES-END*/

self.addEventListener('install', (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())));

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            if (res.ok && new URL(e.request.url).origin === self.location.origin) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match('./index.html'))));
});
