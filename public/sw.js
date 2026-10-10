// Online-only service worker. Registered so the app is installable as a
// PWA, but the fetch handler always hits the network and never caches, so
// users always get the latest data.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle everything normally; no offline fallback.
  event.respondWith(fetch(event.request));
});