const CACHE = 'celestialforge-v5';
const CDN_CACHE = 'celestialforge-cdn-v5';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting()) // skipWaiting inside waitUntil chain
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE && k !== CDN_CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: let the browser handle these directly (no respondWith).
  // The bare return is intentional — calling respondWith would intercept the request.
  // Covers Anthropic, DeepSeek, and any custom endpoints.
  if (url.hostname === 'api.anthropic.com') return;
  if (url.hostname === 'api.deepseek.com') return;
  if (url.pathname.includes('/v1/') || url.pathname.includes('/chat/')) return;

  // CDN resources — network first, cache fallback, separate cache with version
  if (url.hostname !== location.hostname) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CDN_CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Local assets — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }))
  );
});
