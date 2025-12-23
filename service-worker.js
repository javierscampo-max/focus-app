const CACHE_NAME = 'productivity-pwa-v16'; // v16: Fresh Mode Identity
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-v2.png',
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


    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
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
                    // AGGRESSIVE FALLBACK: Return empty 200 OK for everything else (images, icons, etc)
                    // This creates a "ghost" file instead of an error, silencing the OS popup.
                    return new Response('', { status: 200, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
                });
            })
    );
});
