// Persephone service worker: network first, cached app shell as fallback.
const CACHE = "persephone-v1";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/app")))
  );
});
