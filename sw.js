// Baleadenn — fonctionnement hors ligne.
// Changer VERSION à chaque mise à jour de l'appli pour forcer le rafraîchissement.
const VERSION = "baleadenn-v3";
const SHELL = ["./", "index.html", "app.js", "places.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "leaflet.js", "leaflet.css"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Météo et fonds de carte : toujours en ligne (la météo est mémorisée par l'appli).
  if (url.hostname.includes("open-meteo") || url.hostname.includes("tile.openstreetmap")) return;
  // Fichiers de l'appli : réseau d'abord (pour avoir les mises à jour), cache si hors ligne.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  // Polices : cache d'abord.
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
    if (res.ok || res.type === "opaque") { const c = res.clone(); caches.open(VERSION).then(ca => ca.put(req, c)); }
    return res;
  })));
});
