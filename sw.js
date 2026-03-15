const CACHE = 'celestialforge-v4';
const CDN_CACHE = 'celestialforge-cdn-v4';

// Scope-aware asset list — works under both / and /forge/
const BASE_ASSETS = ['', 'index.html', 'manifest.json', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Resolve assets relative to SW scope (/ or /forge/)
      const scope = self.registration.scope;
      const assets = BASE_ASSETS.map(a => scope + a);
      return c.addAll(assets);
    }).then(() => self.skipWaiting())
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

  // API calls: let the browser handle directly.
  // Covers Anthropic, DeepSeek, custom endpoints, and Creative Studio Flask routes.
  if (url.hostname === 'api.anthropic.com') return;
  if (url.hostname === 'api.deepseek.com') return;
  if (url.pathname.includes('/v1/') || url.pathname.includes('/chat/')) return;
  if (url.pathname.startsWith('/api/')) return; // Creative Studio Flask API

  // CDN resources — network first, cache fallback
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
