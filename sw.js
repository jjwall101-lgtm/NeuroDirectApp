const CACHE_NAME = "neurodirect-cache-v5.0.0";
const APP_FILES = [
  "./",
  "./index.html?v=5",
  "./index.html",
  "./style.css?v=5",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./header-logo.png",
  "./approved-lockup.png",
  "./approved-icon.png",
  "./logo.svg",
  "./favicon.ico?v=5",
  "./favicon.ico",
  "./apple-touch-icon.png?v=5",
  "./apple-touch-icon.png",
  "./icon-48.png?v=5",
  "./icon-72.png?v=5",
  "./icon-96.png?v=5",
  "./icon-128.png?v=5",
  "./icon-144.png?v=5",
  "./icon-152.png?v=5",
  "./icon-180.png?v=5",
  "./icon-192.png?v=5",
  "./icon-384.png?v=5",
  "./icon-512.png?v=5",
  "./icon-48.png",
  "./icon-72.png",
  "./icon-96.png",
  "./icon-128.png",
  "./icon-144.png",
  "./icon-152.png",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-384.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isHtml = event.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html?v=5").then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
