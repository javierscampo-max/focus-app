const CACHE_NAME = 'productivity-pwa-v7'; // v7: Resilient Caching
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './main.css',
    './app.js',
    './manifest.json',
    './icon.png',
    './mobile-drag-drop.min.js',
    './scroll-behaviour.min.js'
];

// Install Event: Cache Files (Resilient Strategy)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // "Resilient" caching:
            // Instead of crashing if one file fails (cache.addAll),
            // we try to cache them one by one.
            return Promise.all(
                ASSETS_TO_CACHE.map(url => {
                    return cache.add(url).catch(err => {
                        console.error('Failed to cache:', url, err);
                        // We swallow the error so installation CONTINUES
                    });
                })
            );
        })
    );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Serve from Cache -> Network -> Offline Fallback
self.addEventListener('fetch', (event) => {
    // 1. Strict Offline Check (Blocks "Turn off Airplane Mode" popup)
    if (!navigator.onLine && event.request.url.startsWith('http')) {
        // If it's a navigation (HTML), try cache then fallback
        if (event.request.mode === 'navigate') {
            event.respondWith(
                caches.match(event.request).then(response => {
                    return response || caches.match('./index.html');
                })
            );
            return;
        }
        // Otherwise (images, api), just kill it silently
        event.respondWith(new Response('', { status: 200, statusText: 'Offline' }));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit
                if (response) {
                    return response;
                }

                // Network request
                return fetch(event.request).catch((error) => {
                    console.log('Fetch failed:', error);
                    // Offline Fallback for Navigation
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    // Silent failure for assets
                    return new Response('', { status: 200, statusText: 'Offline' });
                });
            })
    );
});
