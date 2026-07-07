const CACHE_NAME = "neurodirect-flat-v28.0.0";

const APP_FILES = [
  "./",
  "./index.html",
  "./teen.html?v=28",
  "./teen.html",
  "./parent.html?v=28",
  "./parent.html",
  "./style.css?v=28",
  "./style.css",
  "./teen-app.js?v=28",
  "./teen-app.js",
  "./parent-app.js?v=28",
  "./parent-app.js",
  "./firebase-config.js?v=28",
  "./firebase-config.js",
  "./manifest-teen.json?v=28",
  "./manifest-teen.json",
  "./manifest-parent.json?v=28",
  "./manifest-parent.json",
  "./logo.png?v=28",
  "./logo.png",
  "./icon-192.png?v=28",
  "./icon-192.png",
  "./icon-512.png?v=28",
  "./icon-512.png",
  "./apple-touch-icon.png?v=28",
  "./apple-touch-icon.png",
  "./favicon.ico?v=28",
  "./favicon.ico"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isHtml = event.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
