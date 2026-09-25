'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../flow-core.js'),O=require('../scenario-core.js'),L=require('../cards-layout.js'),root=path.resolve(__dirname,'..'),KEY='du_ferry_flow_v1',OLD='du_ferry_scenarios_v1';
const initial=id=>({...C.create(),caseId:id,seen:[id]});
test('all 500 stable situations support all 8000 combination/action paths without emotion rewards',()=>{
  assert.equal(C.scenarios.length,500);assert.equal(C.categories.length,25);let paths=0;
  for(const c of C.scenarios){
    assert.deepEqual(c.event,O.scenarios.find(o=>o.id===c.id).event);assert.equal(c.reactions.length,3);assert.equal(c.actions.length,2);const ends=[new Set(),new Set()];
    for(let mask=0;mask<8;mask++)for(let a=0;a<2;a++){
      let s=initial(c.id);for(let i=0;i<3;i++)if(mask&(1<<i))s=C.transition(s,{type:'choose',id:'t'+i});assert.ok(C.valid(s));assert.equal(s.phase,'scene');
      if(mask){s=C.transition(s,{type:'flip'});assert.ok(C.valid(s));const text=C.sceneFor(s).text;for(let i=0;i<3;i++)assert.equal(text.includes(c.release?c.reactions[i].title:c.reactions[i].text),!!(mask&(1<<i)));s=C.transition(s,{type:'continue'});}else s=C.transition(s,{type:'skip'});
      assert.ok(C.valid(s));assert.equal(s.phase,'response');s=C.transition(s,{type:'choose',id:'a'+a});assert.equal(s.phase,'ending');assert.ok(C.valid(s));ends[a].add(C.sceneFor(s).text);paths++;
      assert.equal(C.restore(C.snapshot(s)).reactions.length,0);assert.ok(!JSON.stringify(C.snapshot(s)).includes('reactions'));
    }assert.equal(ends[0].size,1);assert.equal(ends[1].size,1);assert.notEqual([...ends[0]][0],[...ends[1]][0]);
  }assert.equal(paths,8000);
});
test('only the five selected cases use the release pause; the other 495 retain reframing',()=>{
  const ids=['s041','s003','s201','s096','s131'];assert.deepEqual(C.scenarios.filter(c=>c.release).map(c=>c.id).sort(),[...ids].sort());
  for(const c of C.scenarios){let s=initial(c.id);s=C.transition(s,{type:'choose',id:'t0'});s=C.transition(s,{type:'flip'});const scene=C.sceneFor(s);
    if(ids.includes(c.id)){assert.match(scene.text,/我能允許現在的感覺先在這裡嗎/);assert.match(scene.text,/我願意鬆開一點點嗎/);assert.match(scene.text,/還不願意/);assert.match(scene.text,/想被/);assert.match(scene.text,/想控制/);assert.match(scene.text,/想安心/);assert.doesNotMatch(scene.text,/不用急著跟著它們走/);}
    else {assert.match(scene.text,/不用急著跟著它們走/);assert.doesNotMatch(scene.text,/我願意鬆開一點點嗎/);}
  }
});
test('five release cases show release labels and button while an ordinary case keeps existing labels',async()=>{
  for(const id of ['s041','s003','s201','s096','s131','s001']){const s=setup({[KEY]:JSON.stringify(C.snapshot(initial(id)))}),e=s.elements;await e.hand.children[0].emit('click');await e.confirm.emit('click');
    if(C.caseFor(initial(id)).release){assert.equal(e.stageLabel.textContent,'② 容許感受 · 鬆開一點');assert.equal(e.confirm.textContent,'帶著現在的自己，選下一步');}
    else {assert.equal(e.stageLabel.textContent,'② 翻牌 · 看見在意');assert.equal(e.confirm.textContent,'選眼前的一小步');}
  }
});
test('new homepage loads unified flow while old pilot URL redirects, all content stays original/local',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),scripts=[...html.matchAll(/<script src="\.\/([^" ]+)"/g)].map(m=>m[1]);
  assert.deepEqual(scripts,['scenario-seeds.js','scenario-data.js','scenario-core.js','reframe-core.js','flow-data.js','flow-core.js','cards-layout.js','flow.js','pwa-update.js']);
  const context={};vm.createContext(context);for(const file of scripts.slice(0,7))vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);assert.equal(context.FerryFlowCore.scenarios.length,500);
  for(const file of ['flow-data.js','flow-core.js','flow.js']){const source=fs.readFileSync(path.join(root,file),'utf8');assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|sendBeacon|innerHTML|[没现离还写给开满们处独这来后为会说时从变断决错却见项过装]/);}
  assert.doesNotMatch(html,/轉念試玩 · 5/);assert.match(fs.readFileSync(path.join(root,'reframe.html'),'utf8'),/0;url=\.\//);
});
test('500 random draws and all 25 filters retain history and avoid immediate repeats',()=>{
  let s=C.create('all',()=>0),seen=new Set([s.caseId]);for(let i=1;i<500;i++){s=C.draw(C.restore(C.snapshot(s)),'all',()=>.37);assert.ok(C.valid(s));assert.ok(!seen.has(s.caseId));seen.add(s.caseId);}assert.equal(seen.size,500);assert.notEqual(C.draw(s).caseId,s.caseId);
  for(const cat of C.categories){let s=C.create(cat.id,()=>0),seen=new Set([s.caseId]);for(let i=1;i<20;i++){s=C.draw(s);assert.equal(C.caseFor(s).category,cat.id);assert.ok(!seen.has(s.caseId));seen.add(s.caseId);}assert.notEqual(C.draw(s).caseId,s.caseId);}
  let other=C.create('waiting',()=>0);for(let i=0;i<21;i++)other=C.draw(other,'changes',()=>0);assert.ok(other.seen.includes('s001'));
  for(const n of [NaN,Infinity,-1,1,99])assert.ok(C.valid(C.create('all',()=>n)));
});
test('release filter draws only the five pilot cases without repeats and rolls over safely',()=>{
  const expected=new Set(['s041','s003','s201','s096','s131']);let s=C.create('release',()=>0),seen=new Set([s.caseId]);assert.ok(expected.has(s.caseId));
  for(let i=1;i<5;i++){s=C.draw(s,'release',()=>0);assert.ok(C.valid(s));assert.ok(expected.has(s.caseId));assert.ok(!seen.has(s.caseId));seen.add(s.caseId);}
  assert.deepEqual(seen,expected);const last=s.caseId;s=C.draw(s,'release',()=>0);assert.ok(expected.has(s.caseId));assert.notEqual(s.caseId,last);assert.equal(s.filter,'release');assert.equal(s.seen.length,1);
});
test('strict runtime and saved validation rejects corrupt, future or emotion-containing saves',()=>{
  const s=initial('s001');for(const bad of [null,{},[],{...s,v:2},{...s,extra:1},{...s,caseId:'bad'},{...s,filter:'bad'},{...s,seen:[]},{...s,seen:['s001','s001']},{...s,phase:'flip'},{...s,action:'a0'},{...s,reactions:['bad']},{...s,reactions:['t0','t0']},{...s,legacy:{}}])assert.equal(C.valid(bad),false);
  for(const bad of [null,{},s,{...C.snapshot(s),phase:'flip'},{...C.snapshot(s),v:2}])assert.throws(()=>C.restore(bad),/Invalid/);
  assert.throws(()=>C.migrate({}),/Invalid/);assert.throws(()=>C.transition({},{}),/Invalid/);assert.throws(()=>C.draw(s,'bad'),/Unknown/);
  for(const e of [null,{type:'next'},{type:'flip'},{type:'continue'},{type:'choose',id:'a0'}])assert.equal(C.transition(s,e),s);
});
test('every legacy scenario and chosen action resumes unchanged until the next new-flow draw',()=>{
  for(const c of O.scenarios){const old={v:1,caseId:c.id,filter:c.category,phase:'scene',action:null,reply:null,seen:[c.id]};assert.equal(C.migrate(old).legacy,null);
    for(const a of ['a0','a1'])for(const r of ['r0','r1']){
      const before=O.transition(old,{type:'choose',id:a}),raw=JSON.stringify(before);let s=C.migrate(before);assert.ok(C.valid(s));assert.deepEqual(C.sceneFor(s),O.sceneFor(before));
      s=C.restore(C.snapshot(s));s=C.transition(s,{type:'choose',id:r});assert.ok(C.valid(s));assert.deepEqual(C.sceneFor(s),O.sceneFor(O.transition(before,{type:'choose',id:r})));assert.ok(C.valid(C.restore(C.snapshot(s))));
      assert.equal(C.replay(s).legacy,null);assert.equal(C.transition(s,{type:'next'}).legacy,null);assert.equal(JSON.stringify(before),raw);
    }
  }
});
test('all 500 UI cases allow skip or all reactions then an action, save no emotions, and preserve old records',async()=>{
  for(const c of C.scenarios)for(const mask of [0,7]){
    const records={[KEY]:JSON.stringify(C.snapshot(initial(c.id))),[OLD]:'old untouched',du_ferry_cards_v1:'older untouched'},s=setup(records),e=s.elements;assert.equal(e.hand.children.length,3);assert.equal(e.chapterChoice.children.length,27);
    if(mask){for(const b of e.hand.children)await b.emit('click');assert.equal(s.writes.length,0);await e.confirm.emit('click');assert.equal(s.writes.length,0);assert.equal(e.game.dataset.phase,'flip');await e.backStory.emit('click');assert.ok(e.hand.children.every(b=>b.attrs['aria-pressed']==='true'));await e.confirm.emit('click');}
    await e.confirm.emit('click');assert.equal(e.game.dataset.phase,'response');assert.equal(JSON.parse(s.data.get(KEY)).phase,'response');assert.equal(Object.hasOwn(JSON.parse(s.data.get(KEY)),'reactions'),false);
    await e.hand.children[mask?1:0].emit('click');for(const tool of ['mirror','timeLens']){const raw=s.data.get(KEY);await e[tool].emit('click');await e.confirm.emit('click');assert.equal(s.data.get(KEY),raw);assert.equal(e.confirm.disabled,false);}
    await e.confirm.emit('click');assert.equal(e.game.dataset.phase,'ending');assert.equal(setup(Object.fromEntries(s.data)).elements.sceneTitle.textContent,e.sceneTitle.textContent);
    await e.rest.emit('click');await e.confirm.emit('click');await e.replay.emit('click');assert.equal(e.hand.children.length,3);assert.ok(e.hand.children.every(b=>b.attrs['aria-pressed']==='false'));
    assert.equal(s.data.get(OLD),'old untouched');assert.equal(s.data.get('du_ferry_cards_v1'),'older untouched');assert.ok(s.writes.every(([k,v])=>k===KEY&&!v.includes('reactions')));
  }
});
test('menu exposes the five-case release filter and changes only after explicit confirmation',async()=>{
  const s=setup(),e=s.elements;await e.menuOpen.emit('click');assert.equal(e.chapterChoice.children[1].textContent,'釋放練習 · 5 則');e.chapterChoice.value='release';const before=s.data.get(KEY);assert.equal(s.data.get(KEY),before);
  await e.chapterStart.emit('click');const state=C.restore(JSON.parse(s.data.get(KEY)));assert.equal(state.filter,'release');assert.ok(C.caseFor(state).release);assert.equal(e.menu.open,false);
  const copy=setup(Object.fromEntries(s.data));await copy.elements.menuOpen.emit('click');assert.equal(copy.elements.chapterChoice.value,'release');
});
test('reload drops only reactions, preserves pending stage/history, and short readers lose no flip text',async()=>{
  const s=setup({[KEY]:JSON.stringify(C.snapshot(initial('s041')))},{readerHeight:52,lineChars:9,innerHeight:844,visualHeight:620}),e=s.elements;
  for(const b of e.hand.children)await b.emit('click');await e.confirm.emit('click');const flip=await s.readAll();for(const r of C.caseFor(initial('s041')).reactions)assert.ok(flip.includes(r.title));assert.match(flip,/我願意鬆開一點點嗎/);
  const copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.game.dataset.phase,'scene');assert.ok(copy.elements.hand.children.every(b=>b.attrs['aria-pressed']==='false'));
  s.window.visualViewport.height=500;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(e.game.style.values['--app-height'],'500px');
  await e.confirm.emit('click');assert.equal(setup(Object.fromEntries(s.data)).elements.game.dataset.phase,'response');
});
test('migration, corrupt data, unavailable storage and cross-tab changes do not overwrite source records',async()=>{
  const legacy=O.transition({...O.create(),caseId:'s041',seen:['s041']},{type:'choose',id:'a0'}),raw=JSON.stringify(legacy),s=setup({[OLD]:raw});assert.equal(s.elements.game.dataset.phase,'response');assert.equal(s.elements.saveNotice.hidden,false);assert.equal(s.data.get(OLD),raw);assert.ok(C.restore(JSON.parse(s.data.get(KEY))).legacy);
  await s.choose(1);await s.elements.confirm.emit('click');assert.equal(s.elements.game.dataset.phase,'scene');assert.equal(s.elements.hand.children.length,3);assert.equal(s.data.get(OLD),raw);
  for(const key of [KEY,OLD])for(const value of ['bad','null','{}']){const t=setup({[key]:value});await t.elements.confirm.emit('click');await t.choose(0);assert.equal(t.writes.length,0);assert.equal(t.data.get(key),value);}
  for(const options of [{readFails:true},{writeFails:true}]){const t=setup({},options);await t.elements.confirm.emit('click');await t.choose(0);assert.equal(t.elements.game.dataset.phase,'ending');assert.equal(t.writes.length,0);}
  const t=setup(),remote=JSON.stringify(C.snapshot(initial('s500')));await t.elements.hand.children[0].emit('click');await t.elements.confirm.emit('click');t.data.set(KEY,remote);await t.elements.confirm.emit('click');assert.equal(t.data.get(KEY),remote);assert.equal(t.elements.loadLatest.hidden,false);
  await t.elements.loadLatest.emit('click');assert.equal(t.elements.sceneTitle.textContent,C.caseFor(initial('s500')).title);await t.window.emit('storage',{key:KEY});await t.elements.hand.children[0].emit('click');assert.equal(t.elements.hand.children[0].attrs['aria-pressed'],'false');
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
  const document=Object.assign(events(),{getElementById:id=>elements[id],createElement:element}),window=Object.assign(events(),{FerryFlowCore:C,FerryCardLayout:L,innerHeight:options.innerHeight});
  if(options.visualHeight)window.visualViewport=Object.assign(events(),{height:options.visualHeight,scale:1});
  vm.runInNewContext(fs.readFileSync(path.join(root,'flow.js'),'utf8'),{window,document,localStorage,navigator:{userAgent:options.ua||'iPhone'},setTimeout:f=>{timers.set(++timer,f);return timer;},clearTimeout:i=>timers.delete(i)});
  return {elements,data,reads,writes,window,timers,get active(){return active;},async choose(i){await elements.hand.children[i].emit('click');await elements.confirm.emit('click');},async readAll(){let text=elements.storyText.textContent;while(!elements.pageNext.disabled){await elements.pageNext.emit('click');text+=elements.storyText.textContent;}return text;}};
}
