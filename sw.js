// Bump CACHE when you change shell files so clients pick them up.
const CACHE = "myoldgames-v1";

// App shell — paths are relative to the service-worker scope (works under
// any GitHub Pages subpath, e.g. /myoldgames/).
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/app.js",
  "js/config.js",
  "js/catalog.js",
  "js/player.js",
  "js/controls.js",
  "js/keycodes.js",
  "icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first with background fill. Game bundles (.jsdos) and the cross-origin
// js-dos runtime get cached on first use so the app works offline afterwards.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const ok = res && (res.status === 200 || res.type === "opaque");
        if (ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
