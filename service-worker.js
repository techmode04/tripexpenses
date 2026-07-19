// Version control - bumped to v2 to trigger old cache removal instantly for the new UI
const CACHE_NAME = 'trip-expense-v2-premium';

// Added html2pdf and specific font weights matching the new index.html
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
];

// Perform install & cache setup
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching premium app shell assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate & purge old version caches safely
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheKeys => {
      return Promise.all(
        cacheKeys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting obsolete cache version:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Smart Fetching: Cache-First for assets, strict bypass for Google Apps Scripts/Post Syncs
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // CRITICAL BYPASS: Absolutely do not cache Google Script API endpoints or POST writes
  if (url.hostname.includes('script.google') || event.request.method !== 'GET') {
    return; // Pass through to real live network directly
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Return resource from cache instantly for speed, updating cache state silently
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* handle silent offline error silently */});

        return cachedResponse;
      }

      // Otherwise fall back to real network
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const cacheClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, cacheClone);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback scenario for direct offline page navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Listener to force update transition reload on user request
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
