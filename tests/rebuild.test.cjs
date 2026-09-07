'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),scope='https://example.com/ferry/',prefix='du-ferry:'+scope+':';
function worker(options={}){
  const handlers={},deleted=[],navigated=[],fetched=[];let precached=[],claimed=false,skipped=false;
  const cache={addAll:async list=>{if(options.failInstall)throw new Error('offline');precached=list;},match:async key=>typeof key==='string'&&key==='./index.html'?new Response('rebuild'):undefined};
  const self={registration:{scope},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;},matchAll:async()=>
    [scope+'boat.html',scope+'legacy.html','https://example.com/other/','https://example.com/ferry-other/','https://outside.example/ferry/'].map(url=>({url,navigate:to=>{navigated.push({url,to});return new Promise(()=>{});}}))}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{self,URL,Response,Request:class{constructor(url,options){this.url=url;this.options=options;}},
    caches:{open:async()=>cache,keys:async()=>options.keys||[],delete:async key=>deleted.push(key)},fetch:async request=>{fetched.push(request);return new Response('network');}});
  return {handlers,deleted,navigated,fetched,get precached(){return precached;},get skipped(){return skipped;},get claimed(){return claimed;}};
}
test('original card page replaces maintenance without resurrecting old games or audio',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/一直沒開門的花店/);assert.doesNotMatch(html,/<audio|<canvas|heartlight|boat\.js|game\.js/);
  for(const [,file]of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g))assert.ok(fs.existsSync(path.join(root,file)),file);
  for(const file of ['game.js','heartlight.js','boat.js','practice.js','river.js','audio.js','art/boat-river.webp','music/heartlight-warm-strings.mp3'])assert.equal(fs.existsSync(path.join(root,file)),false,file);
});
test('PWA keeps identity and removes old shortcut descriptions',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  for(const key of ['id','start_url','scope'])assert.equal(m[key],'./');
  assert.equal(m.orientation,'portrait');assert.equal(m.shortcuts,undefined);
  for(const icon of m.icons)assert.ok(fs.existsSync(path.join(root,icon.src)));
});
test('old entry URLs are navigation-only stubs',()=>{
  for(const file of ['boat.html','legacy.html']){const html=fs.readFileSync(path.join(root,file),'utf8');assert.match(html,/http-equiv="refresh" content="0;url=\.\/"/);assert.doesNotMatch(html,/<script|<audio|<canvas/);}
});
test('complete card shell is fetched fresh before activation',async()=>{
  const w=worker();let done;w.handlers.install({waitUntil:p=>done=p});await done;
  assert.equal(w.skipped,true);assert.equal(w.precached.length,11);
  for(const r of w.precached){assert.equal(r.options.cache,'reload');assert.ok(fs.existsSync(path.join(root,r.url==='./'?'index.html':r.url.slice(2))));}
  const bad=worker({failInstall:true});bad.handlers.install({waitUntil:p=>done=p});await assert.rejects(done,/offline/);assert.equal(bad.skipped,false);
});
test('activation removes only old scoped caches and redirects only ferry tabs without deadlock',async()=>{
  const keys=[prefix+'boat-v1',prefix+'rebuild-v1',prefix+'cards-v2','du-ferry:https://example.com/other/:boat-v1','unrelated-cache'];
  const w=worker({keys});let done;w.handlers.activate({waitUntil:p=>done=p});await done;
  assert.deepEqual(w.deleted,keys.slice(0,2));assert.equal(w.claimed,true);assert.equal(w.navigated.length,2);
  assert.ok(w.navigated.every(v=>v.to===scope));
});
test('fresh install and future card updates do not force-navigation of current story tabs',async()=>{
  for(const keys of [[prefix+'cards-v2'],[prefix+'cards-v1',prefix+'cards-v2']]){
    const w=worker({keys});let done;w.handlers.activate({waitUntil:p=>done=p});await done;assert.deepEqual(w.navigated,[]);assert.deepEqual(w.deleted,keys.filter(k=>k!==prefix+'cards-v2'));
  }
});
test('all in-scope navigations serve the new shell offline and never fetch an old game',async()=>{
  const w=worker();for(const file of ['', 'index.html','boat.html','legacy.html?old=true']){
    let done;w.handlers.fetch({request:{method:'GET',mode:'navigate',url:scope+file},respondWith:p=>done=p});assert.equal(await(await done).text(),'rebuild');
  }assert.equal(w.fetched.length,0);
});
test('out-of-scope requests are untouched and player storage is never accessed',()=>{
  const w=worker();for(const url of ['https://example.com/other/game.js','https://example.com/ferry-other/','https://outside.example/ferry/']){
    let handled=false;w.handlers.fetch({request:{method:'GET',mode:'navigate',url},respondWith:()=>handled=true});assert.equal(handled,false);
  }
  for(const file of ['sw.js','pwa-update.js','index.html'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/localStorage|indexedDB|sessionStorage/);
});
