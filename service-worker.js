const CACHE_NAME = 'productivity-pwa-v5'; // Bump to v5 - Navigation Fallback
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png', // Restored (Verified it exists)
    './mobile-drag-drop.min.js',
    './scroll-behaviour.min.js'
];

// Install Event: Cache Files
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
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
        caches.match(event.request)
            .then((response) => {
                // 1. Cache hit
                if (response) {
                    return response;
                }

                // 2. Network request
                return fetch(event.request).catch((error) => {
                    console.log('Fetch failed:', error);

                    // 3. Offline Fallback for Navigation (The blank screen fix)
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }

                    // 4. Silent failure for other assets (The popup fix)
                    return new Response('', { status: 200, statusText: 'Offline' });
                });
            })
    );
});
