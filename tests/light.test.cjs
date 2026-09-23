'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../light-core.js'),L=require('../cards-layout.js'),KEY='du_ferry_light_v1';
function finish(chapter,a,r){let s=C.create(chapter,false);s=C.transition(s,{type:'choose',id:a});return C.transition(s,{type:'choose',id:r});}
test('light journey has twelve ordered chapters, 48 distinct routes and no emotional scores',()=>{
  assert.deepEqual(C.chapters.map(c=>c.title),['來到世界','習慣','與自然相處','鏡子裡的我','逍遙','良知','知而行','兩種力量','兩條路','回到生命','最後的鏡子','順流成真']);
  const ends=new Set();let count=0;
  for(const ch of C.chapters){assert.ok(ch.event.text.length>40);assert.ok(ch.mirror.want.length>9);assert.ok(ch.mirror.avoid.length>9);assert.ok(ch.carry.length>12);
    assert.equal(ch.paths.length,2);
    for(const p of ch.paths){assert.equal(p.replies.length,2);for(const r of p.replies){
      const s=finish(ch.id,p.id,r.id);assert.equal(C.valid(s),true);assert.equal(s.phase,'ending');assert.equal(C.sceneFor(s).text,r.end.text);assert.ok(r.end.text.length>35);
      assert.deepEqual(Object.keys(s).sort(),['action','chapter','phase','reply','v']);ends.add(r.end.title);count++;
    }}
  }
  assert.equal(count,48);assert.equal(ends.size,48);
});
test('invalid saves and premature or repeated transitions fail safely without mutating state',()=>{
  const initial=C.create(),initialRaw=JSON.stringify(initial);
  for(const e of [null,{type:'next'},{type:'choose',id:'a0'},{type:'aside'}])assert.equal(C.transition(initial,e),initial);
  let s=C.transition(initial,{type:'start'});assert.equal(JSON.stringify(initial),initialRaw);
  s=C.transition(s,{type:'choose',id:'a1'});const responseRaw=JSON.stringify(s);
  for(const e of [{type:'choose',id:'a1'},{type:'next'},{type:'start'},{type:'choose',id:'__proto__'}])assert.equal(C.transition(s,e),s);
  assert.equal(JSON.stringify(s),responseRaw);
  for(const invalid of [null,{},[],{...initial,v:2},{...initial,chapter:'__proto__'},{...initial,chapter:'habits'},{...initial,phase:'response'},{...s,reply:'r0'},{...s,action:'missing'},{...s,extra:true},{...s,phase:'complete',reply:'r0'}])assert.equal(C.valid(invalid),false);
  assert.throws(()=>C.create('unknown'),/Unknown chapter/);assert.throws(()=>C.transition({},{}),/Invalid state/);
});
test('sequential play ends in the epilogue, not a ranking or an automatic restart',()=>{
  let s=C.transition(C.create(),{type:'start'});
  for(const ch of C.chapters){assert.equal(s.chapter,ch.id);for(const id of ['a0','r1'])s=C.transition(s,{type:'choose',id});s=C.transition(s,{type:'next'});assert.ok(C.valid(s));}
  assert.equal(s.phase,'complete');assert.equal(C.sceneFor(s).title,'光，一直都在');assert.equal(C.transition(s,{type:'next'}),s);
});
test('all narrative, choice and outcome text is losslessly paginated at small phone capacities',()=>{
  const texts=[];const walk=v=>{if(typeof v==='string')texts.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk({chapters:C.chapters,prologue:C.prologue,epilogue:C.epilogue});
  for(const text of texts)for(const cap of [1,9,27,60,180]){const pages=L.paginate(text,t=>Array.from(t).length<=cap);assert.equal(pages.map(p=>p.text).join(''),text);assert.ok(pages.every(p=>Array.from(p.text).length<=cap));}
});
test('retired light journey remains independently loadable with local dependencies and traditional text',()=>{
  const context={};vm.createContext(context);
  const scripts=['light-story.js','light-core.js','cards-layout.js','light.js','pwa-update.js'];
  for(const file of scripts.slice(0,3))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  assert.deepEqual(Array.from(context.FerryLightCore.ids),C.ids);
  for(const file of ['light-story.js','light-core.js','light.js','index.html'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/[没现离还写给开满们处独这来后为会说时从变]/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'light-story.js'),'utf8'),/localStorage|fetch\(|https?:|innerHTML|eval\(/);
});
function setup(values={},options={}){
  const events=()=>({handlers:{},addEventListener(k,f){(this.handlers[k]??=[]).push(f);},async emit(k,e={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},...e});}});
  let active;function element(){const classes=new Set();return Object.assign(events(),{children:[],attrs:{},dataset:{},textContent:'',hidden:false,disabled:false,
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains:n=>classes.has(n)},
    style:{values:{},setProperty(k,v){this.values[k]=v;}},setAttribute(k,v){this.attrs[k]=v;},append(...kids){this.children.push(...kids);},replaceChildren(...kids){this.children=kids;},focus(){active=this;},showModal(){this.open=true;},close(){this.open=false;}});}
  const elements={},html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements[id]=element();
  elements.reader.clientHeight=options.readerHeight||160;
  Object.defineProperty(elements.storyText,'scrollHeight',{get(){return Math.ceil(Array.from(this.textContent).length/(options.lineChars||18))*26;}});
  const data=new Map(Object.entries(values)),reads=[],writes=[],timers=new Map();let timer=0;
  const localStorage={getItem(k){reads.push(k);if(options.readFails)throw new Error('blocked');return data.get(k)??null;},setItem(k,v){if(options.writeFails)throw new Error('quota');writes.push([k,v]);data.set(k,v);}};
  const document=Object.assign(events(),{getElementById:id=>elements[id],createElement:element}),window=Object.assign(events(),{FerryLightCore:C,FerryCardLayout:L,innerHeight:options.innerHeight});
  if(options.visualHeight)window.visualViewport=Object.assign(events(),{height:options.visualHeight,scale:1});
  vm.runInNewContext(fs.readFileSync(path.join(root,'light.js'),'utf8'),{window,document,localStorage,navigator:{userAgent:options.ua||'iPhone'},setTimeout:f=>{timers.set(++timer,f);return timer;},clearTimeout:i=>timers.delete(i)});
  return {elements,data,reads,writes,window,timers,get active(){return active;},async choose(i){await elements.hand.children[i].emit('click');await elements.confirm.emit('click');},async readAll(){let text=elements.storyText.textContent;while(!elements.pageNext.disabled){await elements.pageNext.emit('click');text+=elements.storyText.textContent;}return text;}};
}
test('all 48 UI routes restore each stage and preserve old flower and audio records byte for byte',async()=>{
  for(const ch of C.chapters)for(const a of [0,1])for(const r of [0,1]){
    const original={du_ferry_cards_v1:'{"old":"flower"}',du_ferry_save_v1:'legacy',du_ferry_audio_v2:'off',[KEY]:JSON.stringify(C.create(ch.id,false))};
    const s=setup(original);assert.equal(s.elements.chapterChoice.children.length,12);assert.equal(s.writes.length,0);
    await s.elements.hand.children[a].emit('click');assert.equal(s.writes.length,0);await s.elements.backStory.emit('click');assert.equal(s.elements.confirm.disabled,false);
    await s.elements.confirm.emit('click');let copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.sceneTitle.textContent,ch.paths[a].after.title);
    await s.choose(r);copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.sceneTitle.textContent,ch.paths[a].replies[r].end.title);
    assert.equal(JSON.parse(s.data.get(KEY)).phase,'ending');await s.elements.rest.emit('click');assert.match(await s.readAll(),/可以關閉/);await s.elements.confirm.emit('click');
    await s.elements.confirm.emit('click');const next=JSON.parse(s.data.get(KEY));assert.equal(next.phase,ch.id==='flow'?'complete':'scene');
    for(const [k,v]of Object.entries(original))if(k!==KEY)assert.equal(s.data.get(k),v);
    assert.ok(s.reads.every(k=>k===KEY));assert.ok(s.writes.every(([k])=>k===KEY));
  }
});
test('reflection and time views preserve selected cards, never save answers and can be skipped in every chapter',async()=>{
  for(const ch of C.chapters)for(const phase of ['scene','response'])for(const kind of ['mirror','timeLens']){
    let state=C.create(ch.id,false);if(phase==='response')state=C.transition(state,{type:'choose',id:'a1'});
    const raw=JSON.stringify(state),s=setup({[KEY]:raw});await s.elements.hand.children[1].emit('click');await s.elements[kind].emit('click');
    assert.equal(s.elements.choicesArea.hidden,true);assert.equal(s.elements[kind].attrs['aria-pressed'],'true');
    const text=await s.readAll();assert.match(text,kind==='mirror'?/不需要|不用消滅感覺/:/十年之後，這件事還會在我心裡嗎/);
    await s.elements.confirm.emit('click');assert.equal(s.elements.hand.children[1].attrs['aria-pressed'],'true');assert.equal(s.elements.confirm.disabled,false);
    assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,0);await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY))[phase==='scene'?'action':'reply'],phase==='scene'?'a1':'r1');
  }
});
test('prologue, epilogue, rest, replay and chapter picker work without automatic jumps',async()=>{
  const s=setup();assert.equal(s.elements.sceneTitle.textContent,'一盞燈的旅程');assert.equal(s.elements.reflectionTools.hidden,true);
  await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).phase,'scene');
  await s.elements.menuOpen.emit('click');s.elements.chapterChoice.value='flow';const before=s.data.get(KEY);assert.equal(s.data.get(KEY),before);
  await s.elements.chapterStart.emit('click');assert.equal(s.elements.menu.open,false);await s.choose(0);await s.choose(0);await s.elements.confirm.emit('click');
  assert.equal(s.elements.sceneTitle.textContent,'光，一直都在');await s.elements.confirm.emit('click');assert.equal(s.elements.sceneTitle.textContent,'今天先走到這裡');assert.equal(JSON.parse(s.data.get(KEY)).phase,'complete');
  await s.elements.backStory.emit('click');await s.elements.replay.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).phase,'scene');assert.equal(JSON.parse(s.data.get(KEY)).chapter,'flow');
});
test('unknown, empty and corrupt progress stays untouched while read-only temporary play is possible',async()=>{
  for(const bad of ['', 'null','{broken',JSON.stringify({...C.create(),v:2}),JSON.stringify({...C.create(),chapter:'missing'})]){
    const s=setup({[KEY]:bad});await s.elements.confirm.emit('click');await s.choose(0);await s.choose(1);assert.equal(s.data.get(KEY),bad);assert.equal(s.writes.length,0);assert.match(s.elements.footerNote.textContent,/暫不保存/);
  }
  for(const options of [{readFails:true},{writeFails:true}]){const s=setup({},options);await s.elements.confirm.emit('click');await s.choose(0);assert.equal(s.elements.hand.children.length,2);assert.equal(s.data.has(KEY),false);}
});
test('concurrent saves block all progress changes until a fresh read; old-story storage events do not block',async()=>{
  const s=setup();await s.elements.confirm.emit('click');await s.window.emit('storage',{key:'du_ferry_cards_v1'});await s.elements.hand.children[0].emit('click');
  const remote=JSON.stringify(C.create('mirror',false));s.data.set(KEY,remote);await s.elements.confirm.emit('click');assert.equal(s.data.get(KEY),remote);assert.equal(s.elements.loadLatest.hidden,false);
  await s.elements.menuOpen.emit('click');s.elements.chapterChoice.value='flow';await s.elements.chapterStart.emit('click');assert.equal(s.data.get(KEY),remote);
  await s.elements.loadLatest.emit('click');assert.equal(s.elements.sceneTitle.textContent,C.chapters[3].event.title);await s.elements.mirror.emit('click');
  await s.window.emit('storage',{key:KEY});await s.elements.confirm.emit('click');await s.choose(0);assert.equal(s.data.get(KEY),remote);
});
test('viewport resize, reading arrows and pending selection do not write progress or cut the text',async()=>{
  const s=setup({}, {readerHeight:52,lineChars:9});assert.equal(await s.readAll(),C.prologue.text);assert.equal(s.writes.length,0);
  await s.elements.confirm.emit('click');await s.elements.hand.children[1].emit('click');const raw=s.data.get(KEY);
  s.elements.reader.clientHeight=26;await s.window.emit('resize');for(const fn of s.timers.values())fn();assert.ok(Array.from(s.elements.storyText.textContent).length<=9);
  assert.equal(s.data.get(KEY),raw);assert.equal(s.elements.confirm.disabled,false);await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).action,'a1');
});
test('visible mobile height, return from background and rotation resize layout without saving or shrinking pinch zoom',async()=>{
  const s=setup({}, {innerHeight:844,visualHeight:620});
  assert.equal(s.elements.game.style.values['--app-height'],'620px');assert.equal(s.elements.menu.style.values['--app-height'],'620px');assert.equal(s.elements.game.dataset.compact,'true');
  await s.elements.confirm.emit('click');await s.elements.hand.children[1].emit('click');const raw=s.data.get(KEY),writes=s.writes.length;
  s.window.visualViewport.height=500;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(s.elements.game.style.values['--app-height'],'500px');
  s.window.visualViewport.scale=2;s.window.visualViewport.height=250;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(s.elements.game.style.values['--app-height'],'500px');
  s.window.visualViewport.scale=1;s.window.visualViewport.height=760;await s.window.emit('pageshow');for(const fn of s.timers.values())fn();assert.equal(s.elements.game.style.values['--app-height'],'760px');assert.equal(s.elements.game.dataset.compact,'false');
  s.window.innerHeight=390;await s.window.emit('orientationchange');for(const fn of s.timers.values())fn();assert.equal(s.elements.game.style.values['--app-height'],'390px');
  assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,writes);assert.equal(s.elements.confirm.disabled,false);
  const fallback=setup({}, {innerHeight:568});assert.equal(fallback.elements.game.style.values['--app-height'],'568px');
});
test('PWA install prompt and iPhone/Android fallbacks remain available',async()=>{
  for(const ua of ['iPhone','Android']){const s=setup({}, {ua});await s.elements.install.emit('click');assert.match(s.elements.installStatus.textContent,ua==='iPhone'?/Safari/:/Chrome/);}
  const s=setup();let prompted=0;await s.window.emit('beforeinstallprompt',{prompt:async()=>prompted++,userChoice:Promise.resolve({outcome:'accepted'})});await s.elements.install.emit('click');assert.equal(prompted,1);assert.match(s.elements.installStatus.textContent,/正在加入/);
});
