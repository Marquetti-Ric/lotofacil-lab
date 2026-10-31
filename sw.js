const CACHE = "lflab-v7";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Resultados: sempre da rede (o app já guarda o que baixou)
  if (url.hostname.includes("herokuapp.com") || url.hostname.includes("caixa.gov.br") || url.hostname.includes("anthropic.com")) return;
  // Resultados publicados com o site: sempre da rede, com o cache como reserva offline
  if (url.pathname.includes("/data/")) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }
  // App e fontes: cache primeiro, atualiza em segundo plano
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then((r) => { if (r.ok || r.type === "opaque") c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
