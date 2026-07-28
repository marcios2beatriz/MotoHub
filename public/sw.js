const CACHE_NAME = 'motohub-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through para requisições em tempo real de GPS e banco de dados
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});