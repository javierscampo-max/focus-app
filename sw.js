const CACHE_NAME = 'productivity-pwa-v2'; // Bumped version to force update
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
});

// Fetch Event: Serve from Cache or Fetch from Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Network request
                return fetch(event.request).catch(() => {
                    // Start of offline fallback
                    // If we are offline and these requests fail, just return nothing 
                    // (prevents 'Turn off Airplane Mode' popup some of the time)
                    console.log('Offline fetch failed:', event.request.url);
                });
            })
    );
});
