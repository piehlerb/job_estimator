// Cache version - UPDATE THIS WITH EACH DEPLOYMENT
const CACHE_VERSION = '1.5.3';
const CACHE_NAME = `estimation-app-v${CACHE_VERSION}`;
const BASE_PATH = '/job_estimator';

// Only cache the shell - not hashed assets (Vite adds hashes to JS/CSS)
const urlsToCache = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`
];

self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        console.log('[SW] Some assets could not be cached');
      });
    })
  );
  // Force the waiting service worker to become active
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache Supabase requests - always fetch fresh
  if (url.hostname.includes('supabase.co') ||
      url.pathname.includes('/auth/') ||
      url.pathname.includes('/rest/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For API requests, use network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For hashed assets (JS/CSS with hash in filename), use cache-first with background update
  // These files have unique names per build, so cached versions are safe to serve
  const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css)$/i.test(url.pathname);

  if (isHashedAsset) {
    // Cache-first for hashed assets (instant offline loading)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Serve from cache immediately if available
        if (cachedResponse) {
          // Update cache in background for next time
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {/* Ignore network errors */});
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // For index.html and other HTML files, use cache-first with background update
  // This ensures instant offline loading while keeping content fresh
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Serve from cache immediately if available
        if (cachedResponse) {
          // Update cache in background for next time
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {/* Ignore network errors */});
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // For other static assets (images, fonts, etc.), use cache-first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((fetchResponse) => {
        const responseToCache = fetchResponse.clone();

        if (fetchResponse && fetchResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchResponse;
      });
    })
  );
});
