/* 《渡》離線快取。發布新版本時只需遞增 CACHE_VERSION。 */
"use strict";

const CACHE_PREFIX = "du-ferry:" + self.registration.scope + ":";
const CACHE_VERSION = CACHE_PREFIX + "daily-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./audio.js",
  "./sound-core.js",
  "./game.js",
  "./practice.css",
  "./practice-data.js",
  "./practice-core.js",
  "./practice.js",
  "./river-core.js",
  "./river.js",
  "./river.css",
  "./art/river-portrait.webp",
  "./art/ferryman.webp",
  "./pwa-update.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL.map(url => new Request(url, {cache:"reload"}))))
      // 完整下載成功才接手；離線或下載失敗時保留原版。
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(async (keys) => {
        // 舊頁沒有 controllerchange 處理器，只在首次遷移時重新開啟。
        const legacy = keys.some(key => key.startsWith(CACHE_PREFIX) && /:daily-v[123]$/.test(key) || /^du-ferry-v[123]$/.test(key));
        await Promise.all(
        keys.filter((key) => key !== CACHE_VERSION &&
          (key.startsWith(CACHE_PREFIX) || /^du-ferry-v[123]$/.test(key)))
          .map((key) => caches.delete(key))
        );
        await self.clients.claim();
        if (legacy) {
          const clients = await self.clients.matchAll({type:"window"});
          clients.filter(client => {
            const url = new URL(client.url), root = new URL(self.registration.scope);
            return url.origin === root.origin && (url.pathname === root.pathname || url.pathname === root.pathname + "index.html");
          }).forEach(client => { client.navigate(client.url).catch(() => {}); });
          // 不等待導覽：導覽的 fetch 會等 activate 完成，等待它會互相阻塞。
        }
      })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request.mode === "navigate" ? "./index.html" : request);
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => {
        if (request.mode === "navigate") return cache.match("./index.html");
        throw new Error("offline and resource is not cached");
      });
    })
  );
});
