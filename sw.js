// Admin web shell asset cache (production only — registered by main.js on
// https, never on localhost so dev cannot serve stale hashed runtime assets).
const CACHE_NAME = 'admin-shell-v1';
const SHELL_URLS = [
    './index.html',
    './app.css',
    './main.js',
    './favicon.ico',
    './admin-indexeddb-store.js',
    './browser-url.js',
];

self.addEventListener('install', (event) =>
{
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_URLS))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) =>
{
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) =>
{
    const request = event.request;
    if (request.method !== 'GET')
    {
        return;
    }

    const url = new URL(request.url);
    if (url.origin !== self.location.origin)
    {
        return;
    }

    // Hashed, immutable runtime assets (_framework/*.wasm/.js/.dat): cache-first.
    // Old builds never reuse hashes, so a stale cache entry cannot be served for
    // a new build.
    if (url.pathname.includes('/_framework/'))
    {
        event.respondWith(
            caches.match(request).then((cached) =>
                cached || fetch(request).then((response) =>
                {
                    const copy = response.clone();
                    void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })),
        );
        return;
    }

    // App shell navigation: network-first, cache fallback (works offline after
    // the first load, and reloads always pick up a fresh index.html).
    if (request.mode === 'navigate')
    {
        event.respondWith(
            fetch(request)
                .then((response) =>
                {
                    const copy = response.clone();
                    void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    return response;
                })
                .catch(() =>
                    caches.match(request).then((cached) => cached || caches.match('./index.html'))),
        );
        return;
    }

    // Other static assets: stale-while-revalidate.
    event.respondWith(
        caches.match(request).then((cached) =>
        {
            const refresh = fetch(request).then((response) =>
            {
                const copy = response.clone();
                void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                return response;
            }).catch(() => cached);
            return cached || refresh;
        }),
    );
});
