const cacheName = "mitt-skolschema-v2";
const appFiles = ["./", "./index.html", "./styles.css?v=16", "./app.js?v=16", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(appFiles)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => { if (event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { const copy = response.clone(); if (new URL(event.request.url).origin === location.origin) caches.open(cacheName).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match("./index.html")))); });
