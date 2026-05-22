/**
 * Road Safety AI — Service Worker v3
 * ════════════════════════════════════════════════════════════════════════
 * Strategy matrix:
 *
 *  Route pattern                      | Strategy
 *  ──────────────────────────────────────────────────────────────────────
 *  Static assets (_next/static/*)     | Cache-First  (long TTL, versioned)
 *  App pages (/, /chat, …)            | Stale-While-Revalidate
 *  violations.json, manifest.json,
 *    icons/*, *.onnx, *.bin           | Cache-First  (never change mid-session)
 *  /api/* fetch calls                 | Network-First, 3s timeout → cache fallback
 *  /offline                           | Always from cache
 *  Google Fonts                       | Stale-While-Revalidate (separate cache)
 *  ONNX/bin model files               | Cache-First with explicit model version key
 * ════════════════════════════════════════════════════════════════════════
 */

// ── Cache names ───────────────────────────────────────────────────────────────
const _d = new Date();
const STATIC_VERSION = `v-${_d.getFullYear()}${String(_d.getMonth()+1).padStart(2,'0')}${String(_d.getDate()).padStart(2,'0')}-${String(_d.getHours()).padStart(2,'0')}${String(_d.getMinutes()).padStart(2,'0')}`;

// Model cache uses a separate key so model updates can be versioned independently
// without busting the whole static cache. Bump MODEL_VERSION when you ship a new model.
const MODEL_VERSION = 'v1';

const CACHES = {
  static:  `roadsafety-static-${STATIC_VERSION}`,
  pages:   `roadsafety-pages-${STATIC_VERSION}`,
  data:    `roadsafety-data-${STATIC_VERSION}`,
  fonts:   `roadsafety-fonts-${STATIC_VERSION}`,
  images:  `roadsafety-images-${STATIC_VERSION}`,
  models:  `roadsafety-models-${MODEL_VERSION}`,  // ONNX + bin — explicit versioning
};

// ── Assets to pre-cache on install ───────────────────────────────────────────
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/',
  '/chat',
  '/emergency',
  '/report',
  '/history',
  '/settings',
];

// ── Offline API fallback responses ───────────────────────────────────────────
const OFFLINE_CHAT_RESPONSE = JSON.stringify({
  intent: 'Offline',
  confidence: 1.0,
  response:
    "You're currently offline. Emergency numbers: India 112 | Bangladesh 999 | Nepal 100. " +
    "Your query has been saved and will be processed when connectivity is restored.",
  source: 'offline-cache',
});

const OFFLINE_EMERGENCY_RESPONSE = JSON.stringify({
  status: 'offline',
  message: 'No internet connection. Call 112 for immediate emergency assistance.',
  results: [
    { name: 'National Emergency', distance_m: 0, lat: 0, lon: 0, type: 'emergency', phone: '112' },
    { name: 'Ambulance',          distance_m: 0, lat: 0, lon: 0, type: 'ambulance', phone: '108' },
    { name: 'Police',             distance_m: 0, lat: 0, lon: 0, type: 'police',    phone: '100' },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL — pre-cache critical shell
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHES.pages).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (ok in dev):', err);
      })
    ).then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE — clean stale caches
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = new Set(Object.values(CACHES));
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.has(key))
          .map((key) => {
            console.log('[SW] Deleting stale cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH — route-based strategies
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' && request.destination !== 'document') return;

  // ── Google Fonts ─────────────────────────────────────────────────────────
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, CACHES.fonts));
    return;
  }

  // ── Next.js static assets — Cache-First (long TTL, hash-versioned by Next) ─
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, CACHES.static, { maxAge: 365 * 24 * 3600 }));
    return;
  }

  // ── Next.js image optimization — Cache-First with 7d TTL ─────────────────
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(cacheFirst(request, CACHES.images, { maxAge: 7 * 24 * 3600 }));
    return;
  }

  // ── ONNX model files + binary weights — Cache-First, explicit model version ─
  // These are large and must never be fetched during inference. Version bumping
  // the MODEL_VERSION constant above invalidates this cache for model updates.
  if (url.pathname.endsWith('.onnx') || url.pathname.endsWith('.bin')) {
    event.respondWith(cacheFirst(request, CACHES.models, { maxAge: Infinity }));
    return;
  }

  // ── Static data: violations.json, manifest.json, icons — Cache-First ──────
  // These never change mid-session; safe to serve stale indefinitely.
  if (
    url.pathname === '/violations.json' ||
    url.pathname === '/manifest.json'   ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(cacheFirst(request, CACHES.data, { maxAge: 7 * 24 * 3600 }));
    return;
  }

  // ── Backend API — Network-First with 3s timeout, fallback to cache ────────
  if (isApiRequest(url)) {
    event.respondWith(networkFirstWithFallback(request, url));
    return;
  }

  // ── All Next.js page routes — Stale-While-Revalidate ─────────────────────
  if (request.destination === 'document' || url.pathname.startsWith('/')) {
    event.respondWith(staleWhileRevalidate(request, CACHES.pages));
    return;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Cache-First: serve from cache if fresh, otherwise fetch and update cache. */
async function cacheFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const age = getCacheAge(cached);
    const maxAge = options.maxAge || Infinity;
    if (age < maxAge) return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (cached) return cached;
    return offlineFallback(request);
  }
}

/** Stale-While-Revalidate: serve cache immediately, update in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || offlineFallback(request);
}

/** Network-First: 3s timeout, fall back to cache, then typed offline response. */
async function networkFirstWithFallback(request, url) {
  try {
    // 3-second timeout — tight enough to feel responsive on slow connections
    const response = await fetch(request, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const cache = await caches.open(CACHES.data);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHES.data);
    const cached = await cache.match(request);
    if (cached) return cached;

    return buildOfflineApiResponse(url);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isApiRequest(url) {
  return (
    url.port === '8000' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('roadsafety-api') ||
    url.hostname.includes('railway.app') ||
    url.hostname.includes('render.com')
  );
}

function getCacheAge(response) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return 0;
  return (Date.now() - new Date(dateHeader).getTime()) / 1000;
}

function buildOfflineApiResponse(url) {
  const path = url.pathname;

  if (path.includes('/chat')) {
    return new Response(OFFLINE_CHAT_RESPONSE, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
    });
  }

  if (path.includes('/emergency')) {
    return new Response(OFFLINE_EMERGENCY_RESPONSE, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
    });
  }

  return new Response(
    JSON.stringify({ error: 'offline', message: 'Service unavailable offline' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  );
}

function offlineFallback(request) {
  if (request.destination === 'document') {
    return caches.match('/offline.html');
  }
  return new Response('', { status: 503 });
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND SYNC — queue failed reports for retry
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-road-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) =>
    client.postMessage({ type: 'SYNC_REPORTS', timestamp: Date.now() })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Road Safety Alert', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Road Safety AI', {
      body: data.body || 'New road safety update',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'roadsafety-alert',
      renotify: true,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      data: { url: data.url || '/emergency' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
