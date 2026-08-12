// Recess app-shell service worker.
//
// Minimal by design: precaches the app shell (icons, manifest, index) so the
// installed app boots instantly, and runtime-caches static assets. Navigations
// are network-first so the app never serves a stale shell, and cache entries
// are bumped via the CACHE_NAME version.
const CACHE_NAME = "recess-shell-v1";

const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo.svg",
  "/og-image.png",
  "/og-app.png",
  "/og-tic-tac-toe.png",
  "/og-rock-paper-scissors.png",
  "/og-red-or-black.png",
  "/og-pong.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: always try the network first, fall back to the cached shell
  // so the installed app opens instantly even fully offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Static assets: cache-first; cache new (hashed) assets on first use.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (
            response.ok &&
            (url.pathname.startsWith("/assets/") ||
              url.pathname.startsWith("/icons/") ||
              url.pathname === "/logo.svg" ||
              url.pathname === "/og-image.png" ||
              url.pathname.startsWith("/og-") ||
              url.pathname === "/manifest.json")
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
