// Cache each release as a complete set so HTML, scripts and presets stay compatible.
// An updated worker waits until existing Sideline windows close before taking over.
const CACHE = "sideline-v0.4.0";
const FILES = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./presets/soccer-field.js", "./presets/soccer-9v9.js", "./presets/soccer-7v7.js",
  "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  // Bypass the HTTP cache as well as the previous worker's cache. Otherwise a new
  // release can accidentally precache old scripts that the browser considers fresh.
  const requests = FILES.map((file) => new Request(new URL(file, self.registration.scope), { cache: "reload" }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(requests)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sideline-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const shell = new Set(FILES.map((file) => new URL(file, self.registration.scope).href));
  url.search = "";
  if (req.method !== "GET" || !shell.has(url.href)) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try { return await fetch(req); }
      catch { return Response.error(); }
    }),
  );
});
