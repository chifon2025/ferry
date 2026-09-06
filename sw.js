/* 《渡》離線快取。發布新版本時只需遞增 CACHE_VERSION。 */
"use strict";

const CACHE_PREFIX = "du-ferry:" + self.registration.scope + ":";
const CACHE_VERSION = CACHE_PREFIX + "daily-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./audio.js",
  "./game.js",
  "./practice.css",
  "./practice-data.js",
  "./practice-core.js",
  "./practice.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      // 等舊分頁關閉再更新，避免新舊故事引擎混用。
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION &&
          (key.startsWith(CACHE_PREFIX) || /^du-ferry-v[123]$/.test(key)))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
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
