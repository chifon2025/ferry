/* Rebuild shell only. Never read or clear player storage. */
'use strict';
const CACHE_PREFIX='du-ferry:'+self.registration.scope+':';
const CACHE_VERSION=CACHE_PREFIX+'rebuild-v1';
const APP_SHELL=['./','./index.html','./rebuild.css','./pwa-update.js','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_VERSION)
    .then(cache=>cache.addAll(APP_SHELL.map(url=>new Request(url,{cache:'reload'}))))
    .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    const retired=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_VERSION);
    await Promise.all(retired.map(key=>caches.delete(key)));
    await self.clients.claim();
    if(retired.length){
      const clients=await self.clients.matchAll({type:'window'});
      const root=new URL(self.registration.scope);
      for(const client of clients){
        const url=new URL(client.url);
        if(url.origin===root.origin&&url.pathname.startsWith(root.pathname)){
          // Do not await navigation: its fetch waits for activation to finish.
          client.navigate(root.href).catch(()=>{});
        }
      }
    }
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),root=new URL(self.registration.scope);
  if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_VERSION);
    if(request.mode==='navigate')return (await cache.match('./index.html'))||fetch(new URL('./index.html',root));
    const cached=await cache.match(request);
    return cached||fetch(request);
  })());
});
