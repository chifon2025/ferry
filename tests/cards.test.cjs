'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../cards-core.js'),L=require('../cards-layout.js'),KEY='du_ferry_cards_v1';
function finish(wish,action,reply,variant,aside=false){let s=C.create(variant);for(const e of [{type:'wish',id:wish},{type:'action',id:action},{type:'reveal'},...(aside?[{type:'aside'}]:[]),{type:'reply',id:reply}])s=C.transition(s,e);return s;}
test('all wishes, actions, replies and delivery states finish coherently without modifying input',()=>{
  let paths=0;for(const w of C.wishes)for(const a of C.actions)for(const r of C.repliesFor({edition:2,action:a.id}))for(const v of [0,1]){
    const s=finish(w.id,a.id,r.id,v);assert.equal(s.phase,'ending');assert.equal(C.valid(s),true);assert.ok(C.ending(s).text.length>30);paths++;
  }assert.equal(paths,54);
  const original=C.create(),next=C.transition(original,{type:'wish',id:'share'});assert.equal(original.phase,'opening');assert.notEqual(original,next);
});
test('keeping and setting aside the same thought produce identical outside events and endings',()=>{
  for(const a of C.actions)for(const r of C.repliesFor({edition:2,action:a.id}))for(const v of [0,1]){
    const keep=finish('share',a.id,r.id,v),aside=finish('share',a.id,r.id,v,true);
    assert.deepEqual(C.aftermath(keep),C.aftermath(aside));assert.deepEqual(C.ending(keep),C.ending(aside));assert.equal(aside.aside,true);
  }
});
test('actions produce distinct consequences while external delivery time remains independent',()=>{
  for(const v of [0,1]){
    const outcomes=C.actions.map(a=>C.aftermath(finish('share',a.id,'open',v)));
    assert.equal(new Set(outcomes.map(o=>o.title)).size,3);assert.ok(outcomes.every(o=>o.text.includes(v?'明天早上':'下午')));
  }
});
test('invalid, skipped and double events never advance or overwrite an earlier action',()=>{
  const s=C.create();for(const e of [{type:'reveal'},{type:'reply',id:'open'},{type:'wish',id:'hack'}])assert.equal(C.transition(s,e),s);
  let a=C.transition(s,{type:'wish',id:'steady'});a=C.transition(a,{type:'action',id:'call'});
  assert.equal(C.transition(a,{type:'action',id:'borrow'}),a);
  for(const invalid of [null,{}, {...s,v:2},{...s,edition:3},{...s,edition:null},{...s,phase:'unknown'},{...s,wish:'share'},{...s,variant:7},{...s,aside:'yes'}])assert.equal(C.valid(invalid),false);
});
test('the first action unlocks only its own follow-up cards and each has a distinct concrete ending',()=>{
  const unique={call:'pickup',borrow:'together',notice:'invite'},endings=new Set();
  for(const a of C.actions){
    const state={...finish('steady',a.id,'open',0),phase:'response',reply:null};
    assert.equal(C.repliesFor(state).length,3);
    for(const [branch,id]of Object.entries(unique)){
      const next=C.transition(state,{type:'reply',id});
      if(branch===a.id)assert.equal(next.phase,'ending');else {assert.equal(next,state);assert.equal(C.valid({...state,phase:'ending',reply:id}),false);}
    }
    for(const reply of C.repliesFor(state)){
      assert.ok(reply.preview.length>10);const end=C.ending(C.transition(state,{type:'reply',id:reply.id}));
      assert.ok(end.after.length>15);endings.add(end.title);
    }
  }
  assert.equal(endings.size,9);
});
test('legacy states retain their original two cards and endings across all 36 paths',()=>{
  for(const wish of C.wishes)for(const action of C.actions)for(const reply of C.replies)for(const variant of [0,1]){
    let s=C.create(variant);delete s.edition;
    for(const event of [{type:'wish',id:wish.id},{type:'action',id:action.id},{type:'reveal'}])s=C.transition(s,event);
    assert.equal(C.valid(s),true);assert.deepEqual(C.repliesFor(s),C.replies);
    assert.equal(C.transition(s,{type:'reply',id:'pickup'}),s);
    const result=C.transition(s,{type:'reply',id:reply.id});assert.equal(result.edition,undefined);assert.equal(result.phase,'ending');
    assert.equal(C.aftermath(result).clue,undefined);
    assert.equal(C.ending(result).title,reply.id==='open'?'門開了，故事還在走':'換個時間，繼續這件事');
    assert.equal(C.ending(result).after,'這不是原先想像的開幕日。小店的以後，也還沒有答案。');
  }
});
function setup(values={},options={}){
  const events=()=>({handlers:{},addEventListener(k,f){(this.handlers[k]??=[]).push(f);},async emit(k,e={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},...e});}});
  let active=null;function element(){const classes=new Set();return Object.assign(events(),{children:[],attrs:{},dataset:{},hidden:false,disabled:false,textContent:'',
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle(n,force){if(force===undefined? !classes.has(n):force)classes.add(n);else classes.delete(n);}},
    setAttribute(k,v){this.attrs[k]=v;},append(...kids){this.children.push(...kids);},replaceChildren(...kids){this.children=kids;},focus(){active=this;},showModal(){this.open=true;},close(){this.open=false;this.emit('close');}});}
  const elements={},html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements[id]=element();
  elements.reader.clientHeight=options.readerHeight||160;
  Object.defineProperty(elements.storyText,'scrollHeight',{get(){return Math.ceil(Array.from(this.textContent).length/(options.lineChars||18))*26;}});
  const data=new Map(Object.entries(values)),reads=[],writes=[],timers=new Map();let timer=0;
  const localStorage={getItem(k){reads.push(k);if(options.readFails)throw new Error('blocked');return data.get(k)??null;},setItem(k,v){if(options.writeFails)throw new Error('quota');writes.push([k,v]);data.set(k,v);}};
  const document=Object.assign(events(),{getElementById:id=>elements[id],createElement:()=>element()});
  const window=Object.assign(events(),{FerryCardsCore:C,FerryCardLayout:L,scrollTo(){}});
  vm.runInNewContext(fs.readFileSync(path.join(root,'cards.js'),'utf8'),{window,document,localStorage,navigator:{userAgent:options.ua||'iPhone'},Math:Object.assign(Object.create(Math),{random:()=>.2}),
    setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  async function choose(index){await elements.hand.children[index].emit('click');await elements.confirm.emit('click');}
  return {elements,data,reads,writes,window,document,choose,timers,get active(){return active;}};
}
test('selection previews a card, confirmation advances, then a separate flip reveals the story',async()=>{
  const s=setup();assert.equal(s.elements.hand.children.length,3);assert.equal(s.elements.confirm.disabled,true);
  await s.elements.hand.children[1].emit('click');assert.equal(s.elements.confirm.disabled,false);assert.equal(s.writes.length,0);
  await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).wish,'steady');
  await s.choose(0);assert.equal(s.elements.deck.hidden,false);assert.equal(s.elements.sceneWrap.hidden,true);
  assert.equal(JSON.parse(s.data.get(KEY)).phase,'sealed');await s.elements.deck.emit('click');
  assert.equal(s.elements.sceneTitle.textContent,'電話那一頭');assert.equal(s.elements.hand.children.length,3);assert.equal(s.active,s.elements.sceneTitle);
  assert.equal(s.elements.carried.hidden,false);assert.match(s.elements.carried.textContent,/取少量花材/);
  const writes=s.writes.length;await s.elements.hand.children[2].emit('click');assert.equal(s.writes.length,writes);
  assert.equal(s.elements.choicePreview.hidden,false);assert.match(s.elements.choicePreview.textContent,/暫時關著/);
  await s.elements.thought.emit('click');await s.elements.backStory.emit('click');assert.equal(s.elements.choicePreview.hidden,false);
  await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).reply,'pickup');
  assert.equal(s.elements.carried.hidden,true);assert.equal(s.elements.playedPath.hidden,false);assert.match(s.elements.playedPath.textContent,/先問清楚 → 去取現有花材/);
});
test('inner cards can be opened and closed without discarding a selected action or wish',async()=>{
  const s=setup();await s.choose(0);await s.elements.hand.children[1].emit('click');
  const writes=s.writes.length;await s.elements.thought.emit('click');assert.equal(s.elements.thought.attrs['aria-pressed'],'true');assert.equal(s.elements.confirm.disabled,true);
  await s.elements.thought.emit('click');assert.equal(s.elements.thought.attrs['aria-pressed'],'false');
  assert.equal(s.writes.length,writes);await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).action,'borrow');assert.equal(JSON.parse(s.data.get(KEY)).wish,'share');
});
test('all three UI action branches can finish, rest and replay the same external circumstances',async()=>{
  for(let action=0;action<3;action++)for(let reply=0;reply<3;reply++){
    const s=setup();await s.choose(2);await s.choose(action);await s.elements.deck.emit('click');await s.choose(reply);
    assert.equal(s.elements.endingActions.hidden,false);const ending=JSON.parse(s.data.get(KEY));assert.equal(ending.phase,'ending');
    await s.elements.rest.emit('click');assert.equal(s.elements.restNote.hidden,false);
    await s.elements.replay.emit('click');const restarted=JSON.parse(s.data.get(KEY));assert.equal(restarted.phase,'opening');assert.equal(restarted.variant,ending.variant);
    assert.equal(s.elements.hand.children.length,3);
    assert.equal(s.elements.playedPath.hidden,true);assert.equal(s.elements.choicePreview.hidden,true);
  }
});
test('legacy progress is not rewritten on load; replay explicitly starts the new edition',async()=>{
  let legacy=C.create(1);delete legacy.edition;
  const states=[legacy];for(const event of [{type:'wish',id:'welcome'},{type:'action',id:'notice'},{type:'reveal'},{type:'reply',id:'later'}]){legacy=C.transition(legacy,event);states.push(legacy);}
  for(const state of states){
    const raw=JSON.stringify(state,null,2),s=setup({[KEY]:raw});assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,0);
    if(state.phase==='response')assert.equal(s.elements.hand.children.length,2);
  }
  const done=setup({[KEY]:JSON.stringify(legacy)});assert.equal(done.elements.sceneTitle.textContent,C.ending(legacy).title);
  await done.elements.replay.emit('click');const next=JSON.parse(done.data.get(KEY));assert.equal(next.edition,2);assert.equal(next.variant,1);assert.equal(next.phase,'opening');
  await done.choose(0);await done.choose(2);await done.elements.deck.emit('click');assert.equal(done.elements.hand.children.length,3);
});
test('reload resumes at each confirmed stage and old game or sound keys are never touched',async()=>{
  const original={du_ferry_save_v1:'private legacy data',du_ferry_sound:'off',du_ferry_audio_v2:'{"custom":1}'};
  const s=setup(original);await s.choose(1);await s.choose(2);
  const copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.deck.hidden,false);await copy.elements.deck.emit('click');await copy.choose(1);
  const done=setup(Object.fromEntries(copy.data));assert.equal(done.elements.endingActions.hidden,false);
  for(const [k,v]of Object.entries(original))assert.equal(done.data.get(k),v);
  assert.ok([...s.reads,...copy.reads,...done.reads,...s.writes.map(w=>w[0])].every(k=>k===KEY));
});
test('corrupt and future saves remain byte-identical while temporary play continues',async()=>{
  for(const raw of ['{broken',JSON.stringify({...C.create(),v:2}),JSON.stringify({...C.create(),edition:3}),'null']){
    const s=setup({[KEY]:raw});await s.choose(0);await s.choose(0);assert.equal(s.data.get(KEY),raw);assert.equal(s.elements.deck.hidden,false);assert.match(s.elements.saveStatus.textContent,/不會覆寫/);
  }
});
test('unavailable storage and quota errors allow temporary play without claiming persistence',async()=>{
  for(const options of [{readFails:true},{writeFails:true}]){
    const s=setup({},options);await s.choose(0);await s.choose(1);assert.equal(s.elements.deck.hidden,false);assert.equal(s.data.has(KEY),false);
    assert.match(s.elements.saveStatus.textContent,/無法保存/);
  }
});
test('concurrent tab edits are detected before writing and can be explicitly reloaded',async()=>{
  const s=setup();await s.choose(0);const remote=C.transition(C.create(1),{type:'wish',id:'welcome'});s.data.set(KEY,JSON.stringify(remote));
  await s.choose(1);assert.equal(JSON.parse(s.data.get(KEY)).action,null);assert.equal(s.elements.loadLatest.hidden,false);
  await s.elements.loadLatest.emit('click');assert.match(s.elements.wishTag.textContent,/相遇/);await s.choose(2);assert.equal(JSON.parse(s.data.get(KEY)).action,'notice');
});
test('cross-tab event pauses writing; native install and platform fallback remain reachable',async()=>{
  const s=setup();await s.window.emit('storage',{key:KEY});assert.equal(s.elements.loadLatest.hidden,false);
  let prompts=0;await s.window.emit('beforeinstallprompt',{prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});await s.elements.install.emit('click');assert.equal(prompts,1);
  await s.window.emit('appinstalled');assert.match(s.elements.installStatus.textContent,/已加入/);
  const iphone=setup();await iphone.elements.install.emit('click');assert.match(iphone.elements.installStatus.textContent,/Safari/);
  const android=setup({}, {ua:'Android'});await android.elements.install.emit('click');assert.match(android.elements.installStatus.textContent,/Chrome/);
});
test('page arrows expose all text without advancing story or changing saves',async()=>{
  const s=setup({}, {readerHeight:52,lineChars:9}),startTitle=s.elements.sceneTitle.textContent;
  let text=s.elements.storyText.textContent,steps=0;
  while(!s.elements.pageNext.disabled){await s.elements.pageNext.emit('click');text+=s.elements.storyText.textContent;assert.ok(++steps<100);}
  assert.equal(text,C.chapterFor(C.create()).opening.text);assert.equal(s.writes.length,0);assert.equal(s.elements.sceneTitle.textContent,startTitle);
  assert.equal(s.elements.pageNext.disabled,true);await s.elements.pagePrev.emit('click');assert.equal(s.elements.pageNext.disabled,false);
  await s.elements.hand.children[0].emit('click');assert.equal(s.elements.backStory.hidden,false);assert.equal(s.elements.confirm.disabled,false);
  await s.elements.backStory.emit('click');assert.equal(s.elements.sceneTitle.textContent,startTitle);assert.equal(s.elements.confirm.disabled,false);
  await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).wish,'share');
});
test('viewport changes re-page a selected card without clearing selection or writing',async()=>{
  const s=setup({}, {readerHeight:78,lineChars:9});await s.choose(0);await s.choose(0);await s.elements.deck.emit('click');
  await s.elements.hand.children[2].emit('click');await s.elements.pageNext.emit('click');const writes=s.writes.length;
  s.elements.reader.clientHeight=26;await s.window.emit('resize');for(const fn of s.timers.values())fn();
  assert.equal(s.elements.confirm.disabled,false);assert.equal(s.writes.length,writes);assert.ok(Array.from(s.elements.storyText.textContent).length<=9);
  await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).reply,'pickup');
});
test('all new UI routes resume correctly and can move through the full chapter sequence',async()=>{
  for(const chapter of ['review','order'])for(let a=0;a<3;a++)for(let r=0;r<2;r++){
    const s=setup({[KEY]:JSON.stringify(C.create(1,chapter))});await s.choose(1);await s.choose(a);await s.elements.deck.emit('click');await s.choose(r);
    const done=JSON.parse(s.data.get(KEY));assert.equal(done.chapter,chapter);assert.equal(done.phase,'ending');
    const restored=setup(Object.fromEntries(s.data));assert.equal(restored.elements.sceneTitle.textContent,C.ending(done).title);
    if(chapter==='review'){assert.equal(restored.elements.nextChapter.hidden,false);await restored.elements.nextChapter.emit('click');assert.equal(JSON.parse(restored.data.get(KEY)).chapter,'order');}
    else {assert.equal(restored.elements.nextChapter.hidden,false);await restored.elements.nextChapter.emit('click');assert.equal(JSON.parse(restored.data.get(KEY)).chapter,'money');}
    await s.elements.replay.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).chapter,chapter);assert.equal(JSON.parse(s.data.get(KEY)).phase,'opening');
  }
});
test('chapter selection needs explicit start and respects concurrent-save protection',async()=>{
  const s=setup();await s.choose(0);await s.elements.menuOpen.emit('click');const original=s.data.get(KEY);
  s.elements.chapterChoice.value='review';assert.equal(s.data.get(KEY),original);
  await s.elements.chapterStart.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).chapter,'review');assert.equal(s.elements.menu.open,false);
  await s.elements.menuOpen.emit('click');s.elements.chapterChoice.value='order';
  const remote=JSON.stringify(C.create(1));s.data.set(KEY,remote);await s.elements.chapterStart.emit('click');assert.equal(s.data.get(KEY),remote);assert.equal(s.elements.loadLatest.hidden,false);
});
test('all chapters expose both sides without recording feelings or requiring a positive report',async()=>{
  for(const chapter of C.chapters){
    const initial=C.create(0,chapter),profile=C.reflectionFor(initial),s=setup({[KEY]:JSON.stringify(initial)});
    const readAll=async()=>{let text=s.elements.storyText.textContent;while(!s.elements.pageNext.disabled){await s.elements.pageNext.emit('click');text+=s.elements.storyText.textContent;}return text;};
    await s.choose(0);await s.elements.hand.children[0].emit('click');const raw=s.data.get(KEY),writes=s.writes.length;
    await s.elements.thought.emit('click');assert.match(await readAll(),new RegExp(profile.want.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    await s.choose(1);assert.equal(s.elements.sceneTitle.textContent,'另一面，想推開什麼？');assert.ok((await readAll()).includes(profile.avoid));
    await s.choose(1);assert.equal(s.elements.sceneTitle.textContent,'此刻，有沒有不一樣？');
    await s.choose(1);assert.match(await readAll(),/感覺還是一樣，也能繼續/);assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,writes);
    assert.equal(s.elements.confirm.disabled,false);
    await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).action,C.actionsFor(initial)[0].id);
  }
});

test('every added route plays through the UI controller simulation, restores, and reaches the next chapter',async()=>{
  for(const chapter of C.chapters.slice(3))for(let a=0;a<2;a++)for(let r=0;r<2;r++){
    const s=setup({[KEY]:JSON.stringify(C.create(0,chapter))});assert.equal(s.elements.chapterChoice.children.length,15);
    await s.choose(0);await s.choose(a);await s.elements.deck.emit('click');await s.choose(r);
    const state=JSON.parse(s.data.get(KEY)),copy=setup(Object.fromEntries(s.data));
    assert.equal(state.phase,'ending');assert.equal(copy.elements.sceneTitle.textContent,C.ending(state).title);
    assert.equal(copy.elements.nextChapter.hidden,chapter==='ordinary');
    if(chapter!=='ordinary'){await copy.elements.nextChapter.emit('click');assert.equal(JSON.parse(copy.data.get(KEY)).chapter,C.chapterId(C.nextChapter(state)));}
  }
});

test('inner cards can exit from either side and sealed state without advancing; reload drops only transient practice',async()=>{
  for(const step of [0,1,2]){
    const s=setup();await s.choose(0);await s.choose(1);const raw=s.data.get(KEY),writes=s.writes.length;
    await s.elements.thought.emit('click');for(let i=0;i<step;i++)await s.choose(0);
    await s.elements.backStory.emit('click');assert.equal(s.elements.deck.hidden,false);assert.equal(s.elements.choicesArea.hidden,true);
    assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,writes);
    await s.elements.thought.emit('click');const copy=setup(Object.fromEntries(s.data));assert.equal(copy.elements.deck.hidden,false);
  }
});

test('practice cannot bypass a concurrent save and never blocks chapter changes',async()=>{
  const s=setup();await s.choose(0);await s.elements.thought.emit('click');
  const remote=JSON.stringify(C.create(1,'goal'));s.data.set(KEY,remote);await s.window.emit('storage',{key:KEY});
  await s.choose(0);assert.equal(s.data.get(KEY),remote);await s.elements.loadLatest.emit('click');assert.equal(s.elements.thought.hidden,true);
  await s.choose(0);await s.elements.thought.emit('click');await s.elements.menuOpen.emit('click');s.elements.chapterChoice.value='ordinary';await s.elements.chapterStart.emit('click');
  assert.equal(JSON.parse(s.data.get(KEY)).chapter,'ordinary');assert.equal(s.elements.hand.children.length,3);assert.equal(s.elements.thought.hidden,true);
});
