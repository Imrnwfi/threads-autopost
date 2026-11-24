// Service worker: buka luar talian, sentiasa ambil versi terkini, dan sokong butang "Kemas kini".
const VERSION = '__BUILD__'; // diganti semasa deploy
const CACHE = `tpg-${VERSION}`;
const SHELL = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/app.js', './js/pages.js', './js/ai.js', './js/store.js', './js/util.js', './js/data.js',
  './js/imagecard.js', './js/sync.js', './js/icons.js', './js/update.js', './js/version.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // Tidak skipWaiting secara automatik — app akan tanya pengguna (butang Kemas kini)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return; // API AI, Google Drive dll. tidak dicache
  if (sameOrigin && url.pathname.endsWith('/version.json')) return; // sentiasa dari rangkaian

  if (isFont) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  // Network-first (sahkan semula dengan pelayan), fallback ke cache bila luar talian
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
