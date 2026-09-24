'use strict';
function setup(values={},options={}){
  const events=()=>({handlers:{},addEventListener(k,f){(this.handlers[k]??=[]).push(f);},async emit(k,e={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},...e});}});
  let active;function element(){const classes=new Set();return Object.assign(events(),{children:[],attrs:{},dataset:{},textContent:'',hidden:false,disabled:false,
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains:n=>classes.has(n)},
    style:{values:{},setProperty(k,v){this.values[k]=v;}},setAttribute(k,v){this.attrs[k]=v;},append(...kids){this.children.push(...kids);},replaceChildren(...kids){this.children=kids;},focus(){active=this;},showModal(){this.open=true;},close(){this.open=false;}});}
  const elements={},html=fs.readFileSync(path.join(root,'reframe.html'),'utf8');for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements[id]=element();
  elements.reader.clientHeight=options.readerHeight||160;
  Object.defineProperty(elements.storyText,'scrollHeight',{get(){return Math.ceil(Array.from(this.textContent).length/(options.lineChars||18))*26;}});
  const data=new Map(Object.entries(values)),reads=[],writes=[],timers=new Map();let timer=0;
  const localStorage={getItem(k){reads.push(k);if(options.readFails)throw new Error('blocked');return data.get(k)??null;},setItem(k,v){if(options.writeFails)throw new Error('quota');writes.push([k,v]);data.set(k,v);}};
  const document=Object.assign(events(),{getElementById:id=>elements[id],createElement:element}),window=Object.assign(events(),{FerryReframeCore:C,FerryCardLayout:L,innerHeight:options.innerHeight});
  if(options.visualHeight)window.visualViewport=Object.assign(events(),{height:options.visualHeight,scale:1});
  vm.runInNewContext(fs.readFileSync(path.join(root,'reframe.js'),'utf8'),{window,document,localStorage,navigator:{userAgent:options.ua||'iPhone'},setTimeout:f=>{timers.set(++timer,f);return timer;},clearTimeout:i=>timers.delete(i)});
  return {elements,data,reads,writes,window,timers,get active(){return active;},async choose(i){await elements.hand.children[i].emit('click');await elements.confirm.emit('click');},async readAll(){let text=elements.storyText.textContent;while(!elements.pageNext.disabled){await elements.pageNext.emit('click');text+=elements.storyText.textContent;}return text;}};
}
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../reframe-core.js'),L=require('../cards-layout.js'),root=path.resolve(__dirname,'..');
test('five trials have 80 playable paths; feelings never determine external outcomes',()=>{
  assert.equal(C.cases.length,5);let count=0;
  for(const c of C.cases){assert.equal(c.reactions.length,3);assert.equal(c.actions.length,2);const results=[new Set(),new Set()];
    for(let mask=0;mask<8;mask++)for(const [i,a]of c.actions.entries()){
      let s=C.create(c.id);const original=JSON.stringify(s);
      if(mask){for(let i=0;i<3;i++)if(mask&(1<<i))s=C.transition(s,{type:'choose',id:'t'+i});assert.equal(s.phase,'scene');s=C.transition(s,{type:'flip'});assert.ok(C.valid(s));assert.equal(s.phase,'flip');assert.match(C.sceneFor(s).text,/不貼近你也沒關係/);s=C.transition(s,{type:'continue'});}else s=C.transition(s,{type:'skip'});
      assert.equal(s.phase,'response');assert.ok(C.valid(s));s=C.transition(s,{type:'choose',id:a.id});assert.ok(C.valid(s));assert.equal(s.phase,'ending');results[i].add(C.sceneFor(s).text);count++;
      assert.equal(JSON.stringify(C.create(c.id)),original);assert.ok(C.valid(C.replay(s)));
    }assert.equal(results[0].size,1);assert.equal(results[1].size,1);assert.notDeepEqual([...results[0]],[...results[1]]);
  }assert.equal(count,80);
});
test('trial validation and transitions reject unknown and inconsistent choices',()=>{
  const s=C.create();for(const bad of [null,{},[],{...s,extra:1},{...s,caseId:'bad'},{...s,seen:[]},{...s,seen:[s.caseId,s.caseId]},{...s,phase:'flip'},{...s,action:'a0'},{...s,reactions:'t0'},{...s,reactions:['t0','t0']},{...s,reactions:['bad']},{...s,phase:'ending'},{...s,phase:'response',reactions:null}])assert.equal(C.valid(bad),false);
  for(const event of [null,{type:'continue'},{type:'next'},{type:'choose',id:'a0'}])assert.equal(C.transition(s,event),s);
  const selected=C.transition(s,{type:'choose',id:'t0'}),flip=C.transition(selected,{type:'flip'});assert.deepEqual(C.transition(flip,{type:'back'}),selected);assert.deepEqual(C.transition(selected,{type:'choose',id:'t0'}),s);assert.equal(C.transition(s,{type:'flip'}),s);assert.equal(C.transition(selected,{type:'skip'}),selected);assert.equal(C.transition(flip,{type:'skip'}),flip);
  assert.throws(()=>C.create('bad'),/Unknown/);
});
test('five trial cases draw without repetition then avoid immediate repeats',()=>{
  let s=C.create(),seen=new Set([s.caseId]);for(let i=1;i<5;i++){s=C.draw(s,()=>0);assert.ok(C.valid(s));assert.ok(!seen.has(s.caseId));seen.add(s.caseId);}const last=s.caseId;s=C.draw(s,()=>0);assert.notEqual(s.caseId,last);assert.equal(s.seen.length,1);
});
test('trial loads its own controller without storage or network APIs',()=>{
  const html=fs.readFileSync(path.join(root,'reframe.html'),'utf8');const scripts=[...html.matchAll(/<script src="\.\/([^" ]+)"/g)].map(m=>m[1]);
  assert.deepEqual(scripts,['scenario-seeds.js','scenario-data.js','reframe-core.js','cards-layout.js','reframe.js','pwa-update.js']);
  for(const file of ['reframe-core.js','reframe.js'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon|innerHTML/);
  assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/href="\.\/reframe.html"/);
});
test('all 80 controller paths, skip, back, reflections, replay and rest work without touching storage',async()=>{
  for(const c of C.cases)for(let mask=0;mask<8;mask++)for(const action of [0,1]){
    const original={du_ferry_scenarios_v1:'existing main progress',du_ferry_cards_v1:'old record'},s=setup(original,{readFails:true,writeFails:true}),e=s.elements;
    e.chapterChoice.value=c.id;await e.chapterStart.emit('click');assert.equal(e.hand.children.length,3);assert.equal(e.confirm.disabled,false);
    assert.equal(await s.readAll(),c.event.text);
    if(!mask)await e.confirm.emit('click');else{
      for(let i=0;i<3;i++)if(mask&(1<<i))await e.hand.children[i].emit('click');
      assert.equal(e.game.dataset.phase,'scene');
      await e.confirm.emit('click');assert.equal(e.game.dataset.phase,'flip');assert.equal(e.choicesArea.hidden,true);
      const text=await s.readAll();for(let i=0;i<3;i++)assert.equal(text.includes(c.reactions[i].text),!!(mask&(1<<i)));
      await e.backStory.emit('click');assert.equal(e.game.dataset.phase,'scene');
      for(let i=0;i<3;i++)assert.equal(e.hand.children[i].attrs['aria-pressed'],String(!!(mask&(1<<i))));
      await e.confirm.emit('click');await e.confirm.emit('click');
    }
    assert.equal(e.game.dataset.phase,'response');await e.hand.children[action].emit('click');
    for(const tool of ['mirror','timeLens']){await e[tool].emit('click');assert.equal(e.choicesArea.hidden,true);await e.confirm.emit('click');assert.equal(e.confirm.disabled,false);assert.equal(e.hand.children[action].attrs['aria-pressed'],'true');}
    await e.confirm.emit('click');assert.equal(e.sceneTitle.textContent,c.actions[action].end.title);
    await e.rest.emit('click');assert.match(await s.readAll(),/不會保存/);await e.confirm.emit('click');assert.equal(e.sceneTitle.textContent,c.actions[action].end.title);
    await e.replay.emit('click');assert.equal(e.game.dataset.phase,'scene');assert.equal(e.sceneTitle.textContent,c.event.title);
    assert.deepEqual(s.reads,[]);assert.deepEqual(s.writes,[]);assert.deepEqual(Object.fromEntries(s.data),original);
  }
});
test('trial reload resets only trial; short readers paginate losslessly and viewport retains selection',async()=>{
  const s=setup({}, {readerHeight:52,lineChars:9,innerHeight:844,visualHeight:620}),e=s.elements;
  assert.equal(await s.readAll(),C.cases[0].event.text);await e.hand.children[1].emit('click');await e.confirm.emit('click');assert.match(await s.readAll(),/我整個人很差/);
  s.window.visualViewport.height=500;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(e.game.style.values['--app-height'],'500px');assert.equal(e.game.dataset.phase,'flip');
  s.window.visualViewport.scale=2;s.window.visualViewport.height=250;await s.window.visualViewport.emit('resize');for(const fn of s.timers.values())fn();assert.equal(e.game.style.values['--app-height'],'500px');
  assert.equal(setup().elements.game.dataset.phase,'scene');
});
test('multiple toggles preserve reading position and focus; clearing all restores skip; resizing keeps checks',async()=>{
  const s=setup({}, {readerHeight:52,lineChars:9,innerHeight:844,visualHeight:620}),e=s.elements;
  await e.pageNext.emit('click');const text=e.storyText.textContent;
  for(const i of [2,0,1]){e.hand.children[i].focus();await e.hand.children[i].emit('click');assert.equal(s.active,e.hand.children[i]);assert.equal(e.storyText.textContent,text);}
  assert.match(e.confirm.textContent,/已選 3/);
  await s.window.emit('resize');for(const fn of s.timers.values())fn();assert.ok(e.hand.children.every(b=>b.attrs['aria-pressed']==='true'));
  for(const i of [0,1,2])await e.hand.children[i].emit('click');assert.equal(e.confirm.textContent,'都不像，先略過');assert.ok(e.hand.children.every(b=>b.attrs['aria-pressed']==='false'));
  await e.confirm.emit('click');assert.equal(e.game.dataset.phase,'response');assert.deepEqual(s.reads,[]);assert.deepEqual(s.writes,[]);
});
