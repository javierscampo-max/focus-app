const CACHE_NAME = 'productivity-pwa-v6';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.png',
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
