self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('gozaride-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/_next/static/js/bundle.js',
        '/_next/static/css/app.css',
        '/manifest.json',
        '/favicon.ico',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});