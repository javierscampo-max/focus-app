const CACHE_NAME = 'productivity-pwa-v4'; // Bump to v4 (Fixing installation crash)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    // './icon.png', // REMOVED: File does not exist, caused SW install to crash!
    './mobile-drag-drop.min.js',
    './scroll-behaviour.min.js'
];

// Install Event: Cache Files
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force activation immediately
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
    self.clients.claim(); // Take control of all clients immediately
});

// Fetch Event: Serve from Cache or Fetch from Network
self.addEventListener('fetch', (event) => {
    // Ignore Google Analytics or other external non-critical stuff if offline
    if (event.request.url.startsWith('http') && !navigator.onLine) {
        // Return empty response immediately to prevent "Network Error" popup
        return new Response('', { status: 200, statusText: 'Offline' });
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // If we are completely offline, do NOT try to fetch
                if (!navigator.onLine) {
                    return new Response('', { status: 200, statusText: 'Offline' });
                }

                // Network request
                return fetch(event.request).catch(() => {
                    // Fallback for failed fetches
                    return new Response('', { status: 200, statusText: 'Offline' });
                });
            })
    );
});
