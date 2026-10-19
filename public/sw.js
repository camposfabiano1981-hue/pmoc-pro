// Service worker simples: "network-first" para funcionar offline em campo.
// A página (index.html) e o version.json são sempre buscados sem cache do navegador,
// para que uma nova publicação apareça assim que a página é recarregada.
const CACHE = 'pmoc-pro-v2';
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // sempre direto da rede
  const pagina = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  e.respondWith(
    (pagina ? fetch(url.href, { cache: 'no-store', credentials: 'same-origin' }) : fetch(req))
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
