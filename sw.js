const CACHE_NAME = 'rdo-v5';
const STATIC_ASSETS = [
  'index.html',
  'admin.html',
  'manifest.json',
  'icon.svg',
  'sw.js'
];

const FIREBASE_URLS = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const API_HOSTS = ['api.imgbb.com', 'firestore.googleapis.com'];
const DB_HOST_PATTERNS = ['firebaseio.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(STATIC_ASSETS);
      await Promise.allSettled(
        FIREBASE_URLS.map(url =>
          fetch(url).then(r => { if (r.ok) cache.put(url, r); }).catch(() => {})
        )
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;

  const host = url.hostname;

  // Fonts: cache-first (stale-while-revalidate)
  if (FONT_HOSTS.includes(host)) {
    e.respondWith(fontStrategy(e.request));
    return;
  }

  // Firebase SDK: cache-first
  if (host === 'www.gstatic.com' && url.pathname.includes('firebase')) {
    e.respondWith(cacheFirst(e.request));
    return;
  }

  // Image upload: network-only (no caching)
  if (host === 'api.imgbb.com') {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 504 })));
    return;
  }

  // Firebase DB: network-first with offline fallback
  if (host === 'firestore.googleapis.com' || DB_HOST_PATTERNS.some(p => host.includes(p))) {
    e.respondWith(networkFirstFirebase(e.request));
    return;
  }

  // Navigation requests (HTML pages): network-first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirstNavigation(e.request));
    return;
  }

  // Everything else (images, etc.): stale-while-revalidate
  e.respondWith(staleWhileRevalidate(e.request));
});

// ---------- Strategies ----------

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
    }
    return resp;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function fontStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetchAndCache(request).catch(() => {});
    return cached;
  }
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
    }
    return resp;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetchAndCache(request).catch(() => {});
  return cached || fetchPromise;
}

async function networkFirstNavigation(request) {
  try {
    const resp = await fetch(request);
    if (resp.ok) {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, clone));
    }
    return resp;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match('index.html');
    return fallback || new Response('Offline', { status: 503 });
  }
}

async function networkFirstFirebase(request) {
  try {
    const resp = await fetch(request);
    return resp;
  } catch {
    return new Response('{}', {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function fetchAndCache(request) {
  const resp = await fetch(request);
  if (resp.ok) {
    const clone = resp.clone();
    caches.open(CACHE_NAME).then(c => c.put(request, clone));
  }
  return resp;
}

// ---------- Background Sync ----------

self.addEventListener('sync', e => {
  if (e.tag === 'sync-pending') {
    e.waitUntil(syncPendingRecords());
  }
});

async function syncPendingRecords() {
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'TRIGGER_SYNC' }));
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
