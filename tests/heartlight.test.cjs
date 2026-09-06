const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');

function setup(values = {}, options = {}) {
  class Target {
    constructor(){this.events = {};this.dataset={};this.attrs={};this.captures=new Set();this.hidden=false;this.paused=true;this.plays=0;}
    addEventListener(name, fn){(this.events[name] ||= []).push(fn);}
    async emit(name, data={}){const event={target:this,preventDefault(){},...data};for(const fn of this.events[name]||[])await fn(event);}
    setAttribute(key,value){this.attrs[key]=value;}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
    play(){this.plays++;this.paused=false;return options.pendingPlay || Promise.resolve();}
    pause(){this.paused=true;}
    focus(){this.focused=true;}
    showModal(){this.open=true;}
    close(){this.open=false;this.emit('close');}
  }
  const elements={};
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const [,id] of html.matchAll(/id="([^"]+)"/g)) elements[id]=new Target();
  const document=new Target(), window=new Target(), data=new Map(Object.entries(values)), writes=[];
  document.getElementById=id=>{assert.ok(elements[id],`missing HTML element ${id}`);return elements[id];};
  const timers=new Map();let serial=0;
  const context={window,document,navigator:{userAgent:options.ua||'',platform:'',maxTouchPoints:1},
    matchMedia:()=>({matches:false}),console,
    localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(options.storageFails)throw Error('quota');writes.push(key);data.set(key,value);}},
    setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(fs.readFileSync(path.join(root,'heartlight.js'),'utf8'),context);
  return {elements,document,window,data,writes,timers,context};
}
const touch=(id=1)=>({pointerId:id,isPrimary:true,pointerType:'touch',button:0});

test('press-release is immediate, ignores extra fingers and accepts a quick repeat',async()=>{
  const s=setup(), h=s.elements.heart;
  await h.emit('pointerdown',touch());assert.equal(s.elements.garden.dataset.state,'held');
  await h.emit('pointerdown',{...touch(2),isPrimary:false});
  await h.emit('pointerup',touch(2));assert.equal(s.elements.garden.dataset.state,'held');
  await h.emit('pointerup',touch());assert.equal(s.elements.garden.dataset.state,'released');
  await h.emit('pointerdown',touch(3));
  for(const fn of s.timers.values())fn();
  assert.equal(s.elements.garden.dataset.state,'held');
  await h.emit('pointerup',touch(3));assert.equal(s.elements.garden.dataset.state,'released');
});
test('cancel, lost capture, background and menu leave no pressed state',async()=>{
  for(const cause of ['pointercancel','lostpointercapture','hidden','menu']){
    const s=setup(),h=s.elements.heart;
    await h.emit('pointerdown',touch());
    if(cause==='hidden'){s.document.hidden=true;await s.document.emit('visibilitychange');}
    else if(cause==='menu')await s.elements.btnMenu.emit('click');
    else await h.emit(cause,touch());
    assert.equal(s.elements.garden.dataset.state,'rest',cause);
    assert.equal(h.attrs['aria-pressed'],'false',cause);
    assert.equal(h.captures.size,0,cause);
  }
});
test('tap mode, keyboard hold and assistive click offer equivalent gestures',async()=>{
  const s=setup(),h=s.elements.heart;
  await h.emit('keydown',{key:' ',repeat:false});
  assert.equal(s.elements.garden.dataset.state,'held');
  await h.emit('keyup',{key:' '});assert.equal(s.elements.garden.dataset.state,'released');
  s.elements.tapMode.checked=true;await s.elements.tapMode.emit('change');
  await h.emit('click',{detail:1});assert.equal(s.elements.garden.dataset.state,'held');
  await h.emit('click',{detail:1});assert.equal(s.elements.garden.dataset.state,'released');
  const at=setup();await at.elements.heart.emit('click',{detail:0});assert.equal(at.elements.garden.dataset.state,'released');
});
test('old saves remain byte-identical and all historical mute values stay quiet',async()=>{
  const original='{"letters":["a"],"nightSeed":{"text":"private"},"future":99}';
  for(const mute of ['0','off','false']){
    const s=setup({du_ferry_save_v1:original,du_ferry_sound:mute});
    await s.elements.heart.emit('pointerdown',touch());await s.elements.heart.emit('pointerup',touch());
    assert.equal(s.elements.music.plays,0);assert.equal(s.data.get('du_ferry_save_v1'),original);
    assert.deepEqual(s.writes,[]);
  }
  const quiet=setup({du_ferry_audio_v2:'{"riverOnly":true,"music":0.7,"ambience":0.3,"custom":"keep"}'});
  await quiet.elements.heart.emit('pointerdown',touch());assert.equal(quiet.elements.music.plays,0);
  await quiet.elements.btnSound.emit('click');assert.equal(quiet.elements.music.plays,1);
  const saved=JSON.parse(quiet.data.get('du_ferry_audio_v2'));
  assert.equal(saved.ambience,.3);assert.equal(saved.custom,'keep');assert.equal(saved.riverOnly,false);
});
test('an unresolved play cannot restart sound after mute or background',async()=>{
  let resolve;const pendingPlay=new Promise(r=>resolve=r);
  const s=setup({}, {pendingPlay});
  await s.elements.heart.emit('pointerdown',touch());
  await s.elements.btnSound.emit('click');resolve();await pendingPlay;await Promise.resolve();
  assert.equal(s.elements.music.paused,true);
  const b=setup();await b.elements.heart.emit('pointerdown',touch());
  b.document.hidden=true;await b.document.emit('visibilitychange');assert.equal(b.elements.music.paused,true);
});
test('preferences survive reload; storage failure and cross-tab mute remain usable',async()=>{
  const s=setup();s.elements.reminderMode.checked=false;await s.elements.reminderMode.emit('change');
  const next=setup(Object.fromEntries(s.data));assert.equal(next.elements.heartMessage.hidden,true);
  await next.elements.heart.emit('pointerdown',touch());
  await next.window.emit('storage',{key:'du_ferry_sound',newValue:'off'});assert.equal(next.elements.music.paused,true);
  const bad=setup({}, {storageFails:true});bad.elements.tapMode.checked=true;await bad.elements.tapMode.emit('change');
  assert.match(bad.elements.soundStatus.textContent,/無法記住/);
  await bad.elements.heart.emit('click',{detail:1});assert.equal(bad.elements.garden.dataset.state,'held');
});
test('install entry invokes a native prompt and has iPhone/Android fallback',async()=>{
  const s=setup();let prompts=0;
  await s.window.emit('beforeinstallprompt',{prompt:async()=>{prompts++;},userChoice:Promise.resolve({outcome:'dismissed'})});
  await s.elements.btnMenuInstall.emit('click');assert.equal(prompts,1);
  await s.window.emit('appinstalled');assert.match(s.elements.installStatus.textContent,/已可/);
  for(const [ua,term] of [['iPhone','Safari'],['Android','Chrome']]){
    const fallback=setup({}, {ua});await fallback.elements.btnMenuInstall.emit('click');
    assert.equal(fallback.elements.installGuide.hidden,false);assert.match(fallback.elements.installText.textContent,new RegExp(term));
  }
});
test('updater can safely finish a held gesture without touching the save',async()=>{
  const s=setup({du_ferry_save_v1:'untouched'});
  await s.elements.heart.emit('pointerdown',touch());assert.equal(s.window.FerryHeartlight.prepareUpdate(),true);
  assert.equal(s.elements.garden.dataset.state,'rest');assert.equal(s.data.get('du_ferry_save_v1'),'untouched');
});

function worker(cache) {
  const handlers={};
  const self={registration:{scope:'https://test.example/ferry/'},location:{origin:'https://test.example'},
    addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  const context={self,caches:{open:async()=>cache},Request,Response,Headers,URL};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
  return {handlers,context};
}
test('every pre-cached app resource exists, including offline music and legacy page',async()=>{
  let requests;
  const w=worker({addAll:async list=>{requests=list;}});
  // Node Request does not resolve relative URLs as a ServiceWorker does.
  w.context.Request=class {constructor(url){this.url=url;}};
  let done;w.handlers.install({waitUntil:promise=>done=promise});await done;
  for(const request of requests){const p=request.url==='./'?'index.html':request.url.slice(2);assert.ok(fs.existsSync(path.join(root,p)),p);}
  assert.ok(requests.some(r=>r.url.endsWith('.mp3')));assert.ok(requests.some(r=>r.url.endsWith('legacy.html')));
});
test('offline navigation distinguishes saved original ferry from new heartlight',async()=>{
  const matched=[];const w=worker({match:async request=>{matched.push(request);return new Response('cached');}});
  for(const file of ['','legacy.html?classic=1']){
    let response;w.handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://test.example/ferry/'+file,headers:new Headers()},respondWith:r=>response=r});
    assert.equal(await (await response).text(),'cached');
  }
  assert.deepEqual(matched,['./index.html','./legacy.html']);
});
test('cached audio supports prefix, suffix and invalid byte ranges for mobile playback',async()=>{
  const bytes=Uint8Array.from({length:100},(_,i)=>i),w=worker({});
  for(const [range,status,length,first] of [['bytes=0-9',206,10,0],['bytes=90-',206,10,90],['bytes=-8',206,8,92],['bytes=200-',416,0,undefined]]){
    const response=await w.context.mediaRange(new Request('https://test.example/a.mp3',{headers:{Range:range}}),new Response(bytes,{headers:{'Content-Type':'audio/mpeg'}}));
    assert.equal(response.status,status);const out=new Uint8Array(await response.arrayBuffer());assert.equal(out.length,length);assert.equal(out[0],first);
  }
});
