/**
 * Spectrum service worker.
 *
 * Strategy:
 * - Precache shell pages + critical static assets on install.
 * - /api/* — network-only (telemetry, AI). Не пытаемся отвечать из кэша.
 * - same-origin GET (HTML / CSS / JS / JSON / images) — stale-while-revalidate
 *   so app works offline immediately and updates in background.
 * - Navigation fallback to cached `/` when offline.
 *
 * Bump CACHE_VERSION on every release to force re-fetch of assets.
 */
const CACHE_VERSION = 'spectrum-v27-2026-05-30';
const SHELL_CACHE = 'shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'runtime-' + CACHE_VERSION;

const SHELL_URLS = [
  '/',
  '/aac',
  '/day',
  '/emotions',
  '/mood',
  '/stories',
  '/parent',
  '/onboarding',
  '/static/css/tokens.css',
  '/static/css/index.css',
  '/static/css/aac.css',
  '/static/css/day.css',
  '/static/css/emotions.css',
  '/static/css/mood.css',
  '/static/css/stories.css',
  '/static/css/parent.css',
  '/static/css/onboarding.css',
  '/static/js/telegram.js',
  '/static/js/telemetry.js',
  '/static/js/tts.js',
  '/static/js/voice_storage.js',
  '/static/js/voice_recorder.js',
  '/static/js/aac.js',
  '/static/js/day.js',
  '/static/js/emotions.js',
  '/static/js/mood.js',
  '/static/js/stories.js',
  '/static/js/parent.js',
  '/static/js/onboarding.js',
  '/static/js/pwa.js',
  '/static/js/sensory.js',
  '/static/js/bugreport.js',
  '/static/js/suggestion.js',
  '/static/js/tour.js',
  '/static/data/core_vocabulary.json',
  '/static/data/day_activities.json',
  '/static/data/routine_templates.json',
  '/static/data/emotion_levels.json',
  '/static/data/mood_data.json',
  '/static/data/sensory_questionnaire.json',
  '/static/data/parent_tips.json',
  '/static/manifest.webmanifest',
  '/static/assets/icon-192.png',
  '/static/assets/icon-512.png',
  '/static/assets/icon.svg',
  '/static/assets/wordmark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Кэшируем по одному, чтобы один промах не положил весь install.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(url).catch((err) => console.warn('SW precache failed:', url, err))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // /api/* — network-only
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin (Telegram SDK etc) — let browser handle directly
  if (url.origin !== self.location.origin) return;

  event.respondWith(handle(req));
});

async function handle(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);

  const networkFetch = fetch(req)
    .then((res) => {
      // Cache successful basic responses only
      if (res && res.status === 200 && res.type === 'basic') {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    // stale-while-revalidate
    networkFetch.catch(() => {});
    return cached;
  }

  const fresh = await networkFetch;
  if (fresh) return fresh;

  // Navigation fallback: cached '/' is better than offline error
  if (req.mode === 'navigate') {
    const shell = await caches.open(SHELL_CACHE);
    const fallback = await shell.match('/');
    if (fallback) return fallback;
  }

  return new Response('Offline', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// Allow page to trigger immediate activation after update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
