'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../cards-core.js'),KEY='du_ferry_cards_v1';
function finish(wish,action,reply,variant,aside=false){let s=C.create(variant);for(const e of [{type:'wish',id:wish},{type:'action',id:action},{type:'reveal'},...(aside?[{type:'aside'}]:[]),{type:'reply',id:reply}])s=C.transition(s,e);return s;}
test('all wishes, actions, replies and delivery states finish coherently without modifying input',()=>{
  let paths=0;for(const w of C.wishes)for(const a of C.actions)for(const r of C.replies)for(const v of [0,1]){
    const s=finish(w.id,a.id,r.id,v);assert.equal(s.phase,'ending');assert.equal(C.valid(s),true);assert.ok(C.ending(s).text.length>30);paths++;
  }assert.equal(paths,36);
  const original=C.create(),next=C.transition(original,{type:'wish',id:'share'});assert.equal(original.phase,'opening');assert.notEqual(original,next);
});
test('keeping and setting aside the same thought produce identical outside events and endings',()=>{
  for(const a of C.actions)for(const r of C.replies)for(const v of [0,1]){
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
  for(const invalid of [null,{}, {...s,v:2},{...s,phase:'unknown'},{...s,wish:'share'},{...s,variant:7},{...s,aside:'yes'}])assert.equal(C.valid(invalid),false);
});
function setup(values={},options={}){
  const events=()=>({handlers:{},addEventListener(k,f){(this.handlers[k]??=[]).push(f);},async emit(k,e={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},...e});}});
  let active=null;function element(){const classes=new Set();return Object.assign(events(),{children:[],attrs:{},dataset:{},hidden:false,disabled:false,textContent:'',
    classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle(n,force){if(force===undefined? !classes.has(n):force)classes.add(n);else classes.delete(n);}},
    setAttribute(k,v){this.attrs[k]=v;},append(...kids){this.children.push(...kids);},replaceChildren(...kids){this.children=kids;},focus(){active=this;},showModal(){this.open=true;},close(){this.open=false;this.emit('close');}});}
  const elements={},html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const [,id]of html.matchAll(/id="([^"]+)"/g))elements[id]=element();
  const data=new Map(Object.entries(values)),reads=[],writes=[],timers=new Map();let timer=0;
  const localStorage={getItem(k){reads.push(k);if(options.readFails)throw new Error('blocked');return data.get(k)??null;},setItem(k,v){if(options.writeFails)throw new Error('quota');writes.push([k,v]);data.set(k,v);}};
  const document=Object.assign(events(),{getElementById:id=>elements[id],createElement:()=>element()});
  const window=Object.assign(events(),{FerryCardsCore:C,scrollTo(){}});
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
  assert.equal(s.elements.sceneTitle.textContent,'電話那一頭');assert.equal(s.elements.hand.children.length,2);assert.equal(s.active,s.elements.sceneTitle);
});
test('thought can be set aside and taken back without discarding a selected action or wish',async()=>{
  const s=setup();await s.choose(0);await s.elements.hand.children[1].emit('click');
  await s.elements.thought.emit('click');assert.equal(s.elements.thought.attrs['aria-pressed'],'true');assert.equal(s.elements.confirm.disabled,false);
  await s.elements.thought.emit('click');assert.equal(s.elements.thought.attrs['aria-pressed'],'false');
  await s.elements.confirm.emit('click');assert.equal(JSON.parse(s.data.get(KEY)).action,'borrow');assert.equal(JSON.parse(s.data.get(KEY)).wish,'share');
});
test('all three UI action branches can finish, rest and replay the same external circumstances',async()=>{
  for(let action=0;action<3;action++){
    const s=setup();await s.choose(2);await s.choose(action);await s.elements.deck.emit('click');await s.choose(action%2);
    assert.equal(s.elements.endingActions.hidden,false);const ending=JSON.parse(s.data.get(KEY));assert.equal(ending.phase,'ending');
    await s.elements.rest.emit('click');assert.equal(s.elements.restNote.hidden,false);
    await s.elements.replay.emit('click');const restarted=JSON.parse(s.data.get(KEY));assert.equal(restarted.phase,'opening');assert.equal(restarted.variant,ending.variant);
    assert.equal(s.elements.hand.children.length,3);
  }
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
  for(const raw of ['{broken',JSON.stringify({...C.create(),v:2}),'null']){
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
