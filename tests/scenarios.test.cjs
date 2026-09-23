'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../scenario-core.js'),L=require('../cards-layout.js'),KEY='du_ferry_scenarios_v1';
const initial=id=>({v:1,caseId:id,phase:'scene',filter:'all',seen:[id],action:null,reply:null});
test('vivid rewrite keeps all 500 identities and facts stable with short authored openings',()=>{
  const seeds=require('../scenario-seeds.js').groups,crypto=require('node:crypto');
  const identity=seeds.map(g=>[g.id,g.rows.trim().split('\n').map(row=>{const [title,opening,fact]=row.split('|');assert.ok(opening.length>=30&&opening.length<=80,title+' reading budget');return [title,fact.trim()];})]);
  // Changing this fingerprint means a scenario identity or original decision premise changed.
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex'),'f2612f4b8abae39dc5ab1487001dd92e85cc68ca2ba830f31ca35624bc73283e');
  for(const c of C.scenarios)for(const p of c.paths){assert.ok(p.after.text.length>50);for(const r of p.replies)assert.ok(r.end.text.startsWith(r.text+'\n\n'));}
});
test('500 unique situations across 25 categories expose 2000 valid distinct context-bound routes',()=>{
  assert.equal(C.scenarios.length,500);assert.equal(C.categories.length,25);
  assert.equal(new Set(C.scenarios.map(s=>s.title)).size,500);
  assert.equal(new Set(C.scenarios.map(s=>s.event.text)).size,500);
  const ends=new Set();let count=0;
  for(const group of C.categories)assert.equal(C.scenarios.filter(s=>s.category===group.id).length,20);
  for(const c of C.scenarios){
    assert.ok(c.event.text.length>25);assert.match(c.event.text,/\n\n目前知道的是：.+/);assert.ok(c.mirror.want.length>10);assert.ok(c.mirror.avoid.length>10);
    assert.equal(c.paths.length,2);assert.notEqual(c.paths[0].after.text,c.paths[1].after.text);
    for(const p of c.paths){assert.equal(p.replies.length,2);for(const r of p.replies){
      let s=initial(c.id);const before=JSON.stringify(s);s=C.transition(s,{type:'choose',id:p.id});assert.ok(C.valid(s));
      assert.equal(C.sceneFor(s).text,p.after.text);s=C.transition(s,{type:'choose',id:r.id});assert.ok(C.valid(s));
      assert.equal(s.phase,'ending');assert.equal(C.choicesFor(s).length,0);assert.equal(C.sceneFor(s).text,r.end.text);
      assert.notEqual(JSON.stringify(s),before);assert.match(r.end.text,/回看起初的線索/);ends.add(r.end.text);count++;
    }}
  }
  assert.equal(count,2000);assert.equal(ends.size,2000);
});
test('a full random cycle draws all 500 without repeats, survives reload, and never immediately repeats on rollover',()=>{
  let seed=123456;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  let s=C.create('all',random);const visited=new Set([s.caseId]),order=[s.caseId];
  for(let i=1;i<500;i++){s=C.draw(JSON.parse(JSON.stringify(s)),'all',random);assert.ok(C.valid(s));assert.ok(!visited.has(s.caseId));visited.add(s.caseId);order.push(s.caseId);}
  assert.equal(visited.size,500);assert.equal(s.seen.length,500);assert.notDeepEqual(order,C.ids);
  const last=s.caseId,next=C.draw(s,'all',random);assert.notEqual(next.caseId,last);assert.equal(next.seen.length,1);
  assert.equal(s.seen.length,500,'draw must not mutate previous state');
  for(const value of [-1,0,1,Infinity,NaN,99])assert.ok(C.valid(C.create('all',()=>value)));
});
test('category filters preserve other categories and reset only an exhausted selected category',()=>{
  let s=initial('s001');s=C.draw(s,'changes',()=>0);const visited=new Set([s.caseId]);
  for(let i=1;i<20;i++){s=C.draw(s,'changes',()=>0);assert.ok(!visited.has(s.caseId));visited.add(s.caseId);assert.equal(C.caseFor(s).category,'changes');}
  assert.equal(s.seen.length,21);const last=s.caseId;s=C.draw(s,'changes',()=>0);
  assert.ok(s.seen.includes('s001'));assert.equal(s.seen.length,2);assert.notEqual(s.caseId,last);
  const before=[...s.seen];s=C.draw(s,'all',()=>0);assert.ok(!before.includes(s.caseId));assert.deepEqual(s.seen.slice(0,-1),before);
  for(const cat of C.categories)assert.equal(C.caseFor(C.create(cat.id)).category,cat.id);
});
test('strict state validation rejects inconsistent, future, corrupt and prototype-shaped saves',()=>{
  const s=initial('s001'),response=C.transition(s,{type:'choose',id:'a0'}),ending=C.transition(response,{type:'choose',id:'r1'});
  for(const bad of [null,{},[],{...s,v:2},{...s,extra:true},{...s,caseId:'__proto__'},{...s,filter:'__proto__'},{...s,filter:'money'},{...s,seen:[]},{...s,seen:['s001','s001']},{...s,seen:['s001','bad']},{...s,seen:'s001'},{...s,action:'a0'},{...s,reply:'r0'},{...s,phase:'complete'},{...response,reply:'r0'},{...ending,reply:'bad'},{...ending,action:'bad'}])assert.equal(C.valid(bad),false,JSON.stringify(bad));
  const missing={...s};delete missing.reply;assert.equal(C.valid(missing),false);
  assert.throws(()=>C.draw({},'all'),/Invalid state/);assert.throws(()=>C.create('missing'),/Unknown filter/);assert.throws(()=>C.transition({},{}),/Invalid state/);
  for(const e of [null,{type:'next'},{type:'start'},{type:'choose',id:'r0'},{type:'choose',id:'__proto__'}])assert.equal(C.transition(s,e),s);
  const replay=C.replay(ending);assert.ok(C.valid(replay));assert.equal(replay.caseId,s.caseId);assert.deepEqual(replay.seen,s.seen);assert.equal(replay.phase,'scene');
});
test('active entry loads local scenario modules in order and excludes the retired story',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),context={};vm.createContext(context);
  const scripts=Array.from(html.matchAll(/<script src="\.\/([^\"]+)"/g),m=>m[1]);
  assert.deepEqual(scripts,['scenario-seeds.js','scenario-data.js','scenario-core.js','cards-layout.js','scenario.js','pwa-update.js']);
  for(const file of scripts.slice(0,4))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  assert.equal(context.FerryScenarioCore.scenarios.length,500);assert.equal(context.FerryLightCore,undefined);
  for(const file of scripts.slice(0,3))assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/fetch\(|https?:|innerHTML|eval\(/);
  for(const file of [...scripts.slice(0,3),'scenario.js','index.html'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/[没现离还写给开满们处独这来后为会说时从变断决错却见项过装]/);
  assert.doesNotMatch(html,/下一章|十二章|一盞燈的旅程|light-story\.js|light-core\.js/);
});
test('all authored text remains lossless when paginated for small readers',()=>{
  const texts=new Set();const walk=v=>{if(typeof v==='string')texts.add(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(C.scenarios);
  for(const text of texts)for(const cap of [9,27,60]){const pages=L.paginate(text,t=>Array.from(t).length<=cap);assert.equal(pages.map(p=>p.text).join(''),text);assert.ok(pages.every(p=>Array.from(p.text).length<=cap));}
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
  const document=Object.assign(events(),{getElementById:id=>elements[id],createElement:element}),window=Object.assign(events(),{FerryScenarioCore:C,FerryCardLayout:L,innerHeight:options.innerHeight});
  if(options.visualHeight)window.visualViewport=Object.assign(events(),{height:options.visualHeight,scale:1});
  vm.runInNewContext(fs.readFileSync(path.join(root,'scenario.js'),'utf8'),{window,document,localStorage,navigator:{userAgent:options.ua||'iPhone'},setTimeout:f=>{timers.set(++timer,f);return timer;},clearTimeout:i=>timers.delete(i)});
  return {elements,data,reads,writes,window,timers,get active(){return active;},async choose(i){await elements.hand.children[i].emit('click');await elements.confirm.emit('click');},async readAll(){let text=elements.storyText.textContent;while(!elements.pageNext.disabled){await elements.pageNext.emit('click');text+=elements.storyText.textContent;}return text;}};
}
test('fresh visit persists its draw immediately; refresh restores it and leaves all older records untouched',()=>{
  const older={du_ferry_light_v1:'original light',du_ferry_cards_v1:'original cards',du_ferry_save_v1:'original boat',du_ferry_audio_v2:'off'};
  const s=setup(older),raw=s.data.get(KEY),copy=setup(Object.fromEntries(s.data));assert.ok(C.valid(JSON.parse(raw)));assert.equal(s.writes.length,1);assert.equal(copy.writes.length,0);
  assert.equal(copy.elements.sceneTitle.textContent,s.elements.sceneTitle.textContent);assert.equal(copy.data.get(KEY),raw);
  for(const [k,v]of Object.entries(older))assert.equal(copy.data.get(k),v);
  assert.ok(s.reads.every(k=>k===KEY));assert.ok(s.writes.every(([k])=>k===KEY));
  assert.equal(s.elements.hand.children.length,2);assert.equal(s.elements.confirm.disabled,true);assert.equal(s.elements.journeyTrack.children.length,3);
});
test('every one of the 2000 UI routes confirms twice, restores each phase and allows replay then next draw',async()=>{
  for(const c of C.scenarios)for(const a of [0,1])for(const r of [0,1]){
    const s=setup({[KEY]:JSON.stringify(initial(c.id))});assert.equal(s.elements.chapterChoice.children.length,26);
    await s.elements.hand.children[a].emit('click');assert.equal(s.writes.length,0);await s.elements.backStory.emit('click');assert.equal(s.elements.confirm.disabled,false);
    await s.elements.confirm.emit('click');let copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.sceneTitle.textContent,c.paths[a].after.title);
    await s.choose(r);copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.sceneTitle.textContent,c.paths[a].replies[r].end.title);
    assert.equal(s.elements.confirm.textContent,'再遇見一件事');assert.equal(s.elements.endingTools.hidden,false);
    await s.elements.replay.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).caseId,c.id);assert.deepEqual(JSON.parse(s.data.get(KEY)).seen,[c.id]);
    await s.choose(a);await s.choose(r);await s.elements.confirm.emit('click');const next=JSON.parse(s.data.get(KEY));assert.ok(C.valid(next));assert.notEqual(next.caseId,c.id);assert.equal(next.phase,'scene');
  }
});
test('reflections retain the pending choice and never record emotions, and rest never advances',async()=>{
  for(const cat of C.categories)for(const phase of ['scene','response'])for(const kind of ['mirror','timeLens']){
    let state=C.create(cat.id,()=>0);if(phase==='response')state=C.transition(state,{type:'choose',id:'a1'});
    const raw=JSON.stringify(state),s=setup({[KEY]:raw});await s.elements.hand.children[1].emit('click');await s.elements[kind].emit('click');
    assert.equal(s.elements.choicesArea.hidden,true);assert.match(await s.readAll(),kind==='mirror'?/想要 ·/:/十年之後，這件事還會在我心裡嗎/);
    await s.elements.confirm.emit('click');assert.equal(s.elements.hand.children[1].attrs['aria-pressed'],'true');assert.equal(s.elements.confirm.disabled,false);assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,0);
    await s.elements.confirm.emit('click');if(phase==='response'){const end=s.data.get(KEY);await s.elements.rest.emit('click');assert.match(await s.readAll(),/可以關閉/);await s.elements.confirm.emit('click');assert.equal(s.data.get(KEY),end);}
  }
});
test('filter selector draws only after explicit action and retains visited history',async()=>{
  const s=setup({[KEY]:JSON.stringify(initial('s001'))});await s.elements.menuOpen.emit('click');s.elements.chapterChoice.value='ordinary';assert.equal(s.writes.length,0);
  await s.elements.chapterStart.emit('click');const state=JSON.parse(s.data.get(KEY));assert.equal(state.filter,'ordinary');assert.equal(C.caseFor(state).category,'ordinary');assert.ok(state.seen.includes('s001'));assert.equal(s.elements.menu.open,false);
  const copy=setup(Object.fromEntries(s.data));await copy.elements.menuOpen.emit('click');assert.equal(copy.elements.chapterChoice.value,'ordinary');
});
test('bad saves and unavailable storage permit temporary play without overwriting anything',async()=>{
  for(const bad of ['','null','{broken',JSON.stringify({...initial('s001'),v:2}),JSON.stringify({...initial('s001'),seen:[]})]){
    const s=setup({[KEY]:bad});await s.elements.dismissNotice.emit('click');await s.choose(0);await s.choose(1);assert.equal(s.data.get(KEY),bad);assert.equal(s.writes.length,0);assert.match(s.elements.footerNote.textContent,/暫不保存/);
  }
  for(const options of [{readFails:true},{writeFails:true}]){const s=setup({},options);await s.choose(0);await s.choose(1);assert.equal(s.elements.confirm.textContent,'再遇見一件事');assert.equal(s.data.has(KEY),false);}
});
test('cross-tab and deletion conflicts block every saved action until reloaded, older keys do not block',async()=>{
  const s=setup();await s.window.emit('storage',{key:'du_ferry_light_v1'});await s.elements.hand.children[0].emit('click');
  const remote=JSON.stringify(initial('s500'));s.data.set(KEY,remote);await s.elements.confirm.emit('click');assert.equal(s.data.get(KEY),remote);assert.equal(s.elements.loadLatest.hidden,false);
  await s.elements.menuOpen.emit('click');s.elements.chapterChoice.value='waiting';await s.elements.chapterStart.emit('click');assert.equal(s.data.get(KEY),remote);
  await s.elements.loadLatest.emit('click');assert.equal(s.elements.sceneTitle.textContent,C.scenarios[499].title);
  await s.window.emit('storage',{key:null});await s.choose(1);assert.equal(s.data.get(KEY),remote);
  s.data.delete(KEY);await s.elements.loadLatest.emit('click');assert.ok(C.valid(JSON.parse(s.data.get(KEY))));
});
test('mobile viewport changes, pagination, install controls and pending choices retain behavior',async()=>{
  const s=setup({}, {readerHeight:52,lineChars:9,innerHeight:844,visualHeight:620});
  const initialState=JSON.parse(s.data.get(KEY));assert.equal(await s.readAll(),C.sceneFor(initialState).text);assert.equal(s.elements.game.style.values['--app-height'],'620px');
  await s.elements.hand.children[1].emit('click');const raw=s.data.get(KEY),writes=s.writes.length;
  s.window.visualViewport.height=500;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(s.elements.game.style.values['--app-height'],'500px');
  s.window.visualViewport.scale=2;s.window.visualViewport.height=250;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(s.elements.game.style.values['--app-height'],'500px');
  assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,writes);assert.equal(s.elements.confirm.disabled,false);await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).action,'a1');
  for(const ua of ['iPhone','Android']){const p=setup({}, {ua});await p.elements.install.emit('click');assert.match(p.elements.installStatus.textContent,ua==='iPhone'?/Safari/:/Chrome/);}
  let prompted=0;await s.window.emit('beforeinstallprompt',{prompt:async()=>prompted++,userChoice:Promise.resolve({outcome:'accepted'})});await s.elements.install.emit('click');assert.equal(prompted,1);
});
