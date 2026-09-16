self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('annsetu-assets-v1').then((cache) => cache.addAll(['/'])));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open('annsetu-assets-v1').then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});
