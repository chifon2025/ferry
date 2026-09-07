'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),C=require('../boat-core.js');
function simulate(steer,seconds=60){let s=C.create();for(let i=0;i<seconds*30&&!s.arrived;i++)s=C.step(s,steer(s),1/30);return s;}
test('letting go moves with current but never auto-steers to the destination',()=>{
  const s=simulate(()=>0,120);assert.ok(s.y<C.create().y);assert.equal(s.arrived,false);assert.ok(Math.abs(s.x-C.goal.x)>.068);
  const start=C.create(),s2=C.step(start,0,.04);assert.notEqual(s2.x,start.x);assert.ok(s2.y<start.y);assert.equal(start.t,0);
});
test('continued steering and a mix of steering and drifting can both reach the landing',()=>{
  const policy=s=>Math.max(-1,Math.min(1,(C.goal.x-s.x)*10-C.current(s.t,s.y)/.105));
  assert.equal(simulate(policy).arrived,true);
  assert.equal(simulate(s=>s.t<7?0:policy(s)).arrived,true);
});
test('current does not reward release and input does not affect forward speed',()=>{
  const s={...C.create(),t:5};const a=C.step(s,0,.04),b=C.step(s,1,.04),c=C.step(s,-1,.04);
  assert.equal(a.y,b.y);assert.equal(b.y,c.y);assert.ok(b.x>a.x&&a.x>c.x);
  assert.equal(C.current(a.t,a.y),C.current(b.t,b.y));
});
test('edges, large elapsed time and invalid inputs remain bounded and recoverable',()=>{
  const s=simulate(()=>1);assert.ok(s.x<=.90);const recovered=C.step(s,-1,.05);assert.ok(Number.isFinite(recovered.x));
  const next=C.step(C.create(),Infinity,5000);assert.equal(next.t,.05);assert.ok(next.y>.84);
  const invalid=C.step(C.create(),NaN,NaN);assert.equal(invalid.t,0);
  const done={...C.create(),arrived:true};assert.deepEqual(C.step(done,1,.03),done);
});
function setup(values={},options={}){
  const elements={},events=()=>({handlers:{},addEventListener(n,fn){(this.handlers[n]??=[]).push(fn);},emit(n,e={}){for(const fn of this.handlers[n]||[])fn({preventDefault(){},...e});}});
  const html=fs.readFileSync(path.join(root,'boat.html'),'utf8');
  for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements[id]=Object.assign(events(),{
    style:{},attrs:{},hidden:false,textContent:'',value:'45',disabled:false,captures:new Set(),
    setAttribute(k,v){this.attrs[k]=v;},getBoundingClientRect(){return {left:70,width:id==='helm'?200:320,height:400};},
    focus(){},setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);},
    getContext(){return {setTransform(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};},showModal(){this.open=true;},close(){this.open=false;this.emit('close');},
    pause(){this.paused=true;},play(){this.plays=(this.plays||0)+1;this.paused=false;return options.playPromise||Promise.resolve();}
  });
  let now=0,next=0;const frames=new Map(),data=new Map(Object.entries(values)),writes=[];
  const document=Object.assign(events(),{hidden:false,getElementById:id=>elements[id],querySelector:()=>({style:{}})});
  const window=Object.assign(events(),{FerryBoatCore:C,devicePixelRatio:1,matchMedia:()=>({matches:!!options.reduce})});
  const localStorage={getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v);}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'boat.js'),'utf8'),{window,document,localStorage,navigator:{userAgent:'iPhone'},performance:{now:()=>now},
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),console});
  function advance(ms){for(let i=0;i<Math.ceil(ms/40);i++){now+=40;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}}
  return {elements,document,window,data,writes,frames,advance};
}
const touch={pointerId:1,isPrimary:true,button:0,clientX:230};
test('start, drag, release and secondary pointer are isolated and restart remains usable',()=>{
  const s=setup(),h=s.elements.helm;h.emit('pointerdown',touch);assert.equal(h.captures.size,0);
  s.elements.begin.emit('click');h.emit('pointerdown',touch);assert.equal(h.captures.size,1);assert.ok(Number(h.attrs['aria-valuenow'])>0);
  h.emit('pointerdown',{...touch,pointerId:2,isPrimary:false,clientX:0});assert.ok(Number(h.attrs['aria-valuenow'])>0);
  h.emit('pointerup',{...touch,pointerId:2});assert.equal(h.captures.size,1);
  s.advance(400);h.emit('pointerup',touch);assert.equal(h.captures.size,0);assert.equal(h.attrs['aria-valuenow'],'0');
  s.elements.again.emit('click');assert.equal(s.elements.skiff.style.left,'25%');assert.equal(s.frames.size,1);
});
test('cancel, capture loss, blur, resize and background clear the helm safely',()=>{
  for(const cause of ['pointercancel','lostpointercapture','blur','resize','hidden']){
    const s=setup(),h=s.elements.helm;s.elements.begin.emit('click');h.emit('pointerdown',touch);
    if(cause==='hidden'){s.document.hidden=true;s.document.emit('visibilitychange');}
    else if(['blur','resize'].includes(cause))s.window.emit(cause);else h.emit(cause,touch);
    assert.equal(h.attrs['aria-valuenow'],'0',cause);assert.equal(h.captures.size,0,cause);
    if(['blur','hidden'].includes(cause))assert.equal(s.frames.size,0);
  }
});
test('keyboard release and tap buttons work without a sustained touch',()=>{
  const s=setup(),h=s.elements.helm;s.elements.begin.emit('click');h.emit('keydown',{key:'ArrowLeft'});assert.equal(h.attrs['aria-valuenow'],'-100');
  h.emit('keyup',{key:'ArrowLeft'});assert.equal(h.attrs['aria-valuenow'],'0');
  s.elements.right.emit('click');assert.equal(h.attrs['aria-valuenow'],'100');s.advance(1000);assert.equal(h.attrs['aria-valuenow'],'0');
  h.emit('keydown',{key:'ArrowLeft'});h.emit('keydown',{key:'Escape'});assert.equal(h.attrs['aria-valuenow'],'0');
});
test('menu freezes simulation and resume does not jump or duplicate loops',()=>{
  const s=setup();s.elements.begin.emit('click');s.advance(800);s.elements.menuOpen.emit('click');
  const pos=s.elements.skiff.style.top;s.advance(10000);assert.equal(s.elements.skiff.style.top,pos);assert.equal(s.frames.size,0);
  s.elements.resume.emit('click');s.window.emit('focus');assert.equal(s.frames.size,1);s.advance(40);assert.equal(s.elements.skiff.style.top,pos);
});
test('a full UI voyage reaches the landing, stops the loop and can restart',()=>{
  const s=setup(),h=s.elements.helm;s.elements.begin.emit('click');
  h.emit('pointerdown',touch);
  for(let i=0;i<900&&s.elements.arrival.hidden;i++){
    const x=parseFloat(s.elements.skiff.style.left)/100;
    const steer=Math.max(-1,Math.min(1,(C.goal.x-x)*12));
    h.emit('pointermove',{...touch,clientX:170+steer*73});s.advance(40);
  }
  assert.equal(s.elements.arrival.hidden,false);assert.equal(s.elements.left.disabled,true);assert.equal(s.frames.size,0);
  assert.equal(h.captures.size,0);s.elements.again.emit('click');assert.equal(s.elements.arrival.hidden,true);assert.equal(s.elements.left.disabled,false);
});
test('all old mute values and quiet-only preference remain quiet; old saves untouched',()=>{
  for(const flag of ['0','off','false']){
    const s=setup({du_ferry_save_v1:'private',du_ferry_sound:flag});s.elements.begin.emit('click');assert.equal(s.elements.music.plays,undefined);assert.deepEqual(s.writes,[]);assert.equal(s.data.get('du_ferry_save_v1'),'private');
  }
  const quiet=setup({du_ferry_audio_v2:'{"riverOnly":true,"custom":42}'});quiet.elements.begin.emit('click');assert.equal(quiet.elements.music.plays,undefined);
  quiet.elements.sound.emit('click');assert.equal(JSON.parse(quiet.data.get('du_ferry_audio_v2')).custom,42);
});
test('pending audio cannot restart after backgrounding; reduced motion removes rotation',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const s=setup({}, {playPromise:pending,reduce:true});
  s.elements.begin.emit('click');s.elements.right.emit('click');s.advance(400);assert.match(s.elements.skiff.style.transform,/rotate\(0rad\)/);
  s.document.hidden=true;s.document.emit('visibilitychange');resolve();await pending;await Promise.resolve();assert.equal(s.elements.music.paused,true);
});
test('asset references exist and independent route is precached without changing app identity',async()=>{
  const html=fs.readFileSync(path.join(root,'boat.html'),'utf8');
  for(const [,url]of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g))assert.ok(fs.existsSync(path.join(root,url)),url);
  const handlers={},scope='https://example.com/ferry/';let requested,matched;
  const self={registration:{scope},location:{origin:'https://example.com'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{self,URL,Headers,Response,Request:class{constructor(url){this.url=url;}},caches:{open:async()=>({addAll:async list=>requested=list,match:async key=>{matched=key;return new Response('cached boat');}})}});
  let promise;handlers.install({waitUntil:p=>promise=p});await promise;assert.ok(requested.some(r=>r.url==='./boat.html'));
  handlers.fetch({request:{method:'GET',mode:'navigate',url:scope+'boat.html?trial=1',headers:new Headers()},respondWith:p=>promise=p});assert.equal(await(await promise).text(),'cached boat');assert.equal(matched,'./boat.html');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8')).start_url,'./');
});
