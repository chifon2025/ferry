/* 《渡》離線快取。發布新版本時只需遞增 CACHE_VERSION。 */
"use strict";

const CACHE_PREFIX = "du-ferry:" + self.registration.scope + ":";
const CACHE_VERSION = CACHE_PREFIX + "boat-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./boat.html",
  "./boat.css",
  "./boat-core.js",
  "./boat.js",
  "./art/boat-river.webp",
  "./art/boat-skiff.webp",
  "./heartlight.css",
  "./heartlight.js",
  "./art/heartlight-garden.webp",
  "./music/heartlight-warm-strings.mp3",
  "./legacy.html",
  "./icons/heartlight-192.png",
  "./icons/heartlight-512.png",
  "./icons/heartlight-maskable-512.png",
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

async function mediaRange(request, response) {
  const range = request.headers.get('range');
  if (!range || !response) return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return response;
  const bytes = await response.arrayBuffer(), size = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0,size-Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]),size-1) : size-1;
  if (start > end || start >= size) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  const headers = new Headers(response.headers);
  headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
  headers.set('Content-Length',String(end-start+1));
  headers.set('Accept-Ranges','bytes');
  return new Response(bytes.slice(start,end+1),{status:206,headers});
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const navigation = ['./legacy.html','./boat.html'].find(page => url.pathname === new URL(page,self.registration.scope).pathname) || './index.html';
      const cached = await cache.match(request.mode === "navigate" ? navigation : request);
      if (cached) return mediaRange(request,cached);

      return fetch(request).then((response) => {
        if (response && response.ok && response.status !== 206) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => {
        if (request.mode === "navigate") return cache.match(navigation);
        throw new Error("offline and resource is not cached");
      });
    })
  );
});
