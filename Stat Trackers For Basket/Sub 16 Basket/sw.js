/* Service Worker — Sub 16 Tracker */
const CACHE = 'sub16-v1';
const CORE  = [
  './', './index.html', './style.css', './app.js',
  './manifest.json', './icon-192.svg', './icon-512.svg',
];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(CORE.map(url => c.add(url)))
    ).then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Archivos locales: network-first */
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* CDN (SheetJS): network-first, cache como fallback offline */
  if (url.hostname.includes('sheetjs') || url.hostname.includes('cdnjs')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
