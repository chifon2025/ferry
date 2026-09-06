const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const C = require('../practice-core.js');
const stories = require('../practice-data.js');
const old = {calmCount:7,totalRounds:4,lastRoundDate:'2026-09-04',seeds:[{sid:'s1',date:'2026-09-04'}],quotes:['q1'],letters:[{text:'原來的信'}],history:[{d:'2026-09-04',c:'calm',g:true}],flags:{cat:true},nightSeed:{text:'私人的夜渡'},lifeTrigger:{when:'等信',line:'先鬆手'},chain:{id:'c1',stage:1}};
function completed(story, action, replay=false) {
  let s=C.begin(C.migrate(old),story.id,'2026-09-06',replay);
  s=C.advance(s);s=C.observe(s,0);s=C.advance(s);s=C.choose(s,action.id);
  for(let i=0;i<4;i++)s=C.advance(s);
  assert.equal(s.dailyPractice.active.phase,'carry');
  return s;
}
test('migration preserves every legacy field and does not mutate input',()=>{
  const before=JSON.stringify(old), s=C.migrate(old);
  for(const key of Object.keys(old))assert.deepEqual(s[key],old[key]);
  assert.equal(JSON.stringify(old),before);assert.deepEqual(C.migrate(s),s);
});
test('malformed and future saves are rejected instead of reset',()=>{
  for(const data of [null,[],{letters:{}},{dailyPractice:{version:2}},{dailyPractice:{version:1,completed:[]}}])assert.throws(()=>C.migrate(data));
});
test('all nine actions complete, preserve old scores, and arrive only on later local date',()=>{
  for(const story of stories)for(const action of story.actions){
    let s=C.finish(completed(story,action),'2026-09-06',story,{when:story.context,step:story.step});
    assert.equal(s.dailyPractice.completed.length,1);assert.equal(s.dailyPractice.life.length,1);
    assert.equal(s.calmCount,old.calmCount);assert.deepEqual(s.flags,old.flags);assert.deepEqual(s.history,old.history);
    assert.equal(C.settle(s,'2026-09-06').letters.length,1);
    const tomorrow=C.settle(s,'2026-09-07');assert.equal(tomorrow.letters.length,2);assert.equal(tomorrow.letters[1].text,action.later);
    assert.deepEqual(C.settle(tomorrow,'2026-09-07'),tomorrow);
    assert.deepEqual(C.finish(s,'2026-09-06',story,null),s);
    assert.equal(C.canBegin(s,'2026-09-06'),false);assert.equal(C.canBegin(s,'2026-09-05'),false);assert.equal(C.canBegin(s,'2026-09-07'),true);
  }
});
test('resume every step, repeated clues deduplicate, choosing does not finish automatically',()=>{
  let s=C.begin(C.migrate(old),'reply','2026-09-06');
  s=C.advance(s);s=C.observe(s,1);s=C.observe(s,1);assert.deepEqual(s.dailyPractice.active.seen,[1]);
  assert.deepEqual(C.migrate(JSON.parse(JSON.stringify(s))),s);
  s=C.advance(s);s=C.advance(s);assert.equal(s.dailyPractice.active.phase,'choose');
  s=C.choose(s,'ask');assert.equal(s.dailyPractice.active.phase,'act');
  assert.equal(s.dailyPractice.completed.length,0);
});
test('replay never creates daily rewards, invitations or letters',()=>{
  const s=C.finish(completed(stories[0],stories[0].actions[0],true),'2026-09-06',stories[0],{when:'x',step:'y'});
  assert.equal(s.lastRoundDate,old.lastRoundDate);assert.equal(s.totalRounds,4);
  for(const key of ['completed','pending','life'])assert.equal(s.dailyPractice[key].length,0);
});
test('cross-midnight completion consumes finish day, and backdating cannot reopen it',()=>{
  const s=C.finish(completed(stories[0],stories[0].actions[0]),'2026-09-07',stories[0],null);
  assert.equal(s.lastRoundDate,'2026-09-07');assert.equal(C.canBegin(s,'2026-09-07'),false);
  assert.equal(C.settle(s,'2026-09-07').dailyPractice.pending.length,1);
});
test('all reflection responses neutral, idempotent and optional',()=>{
  let s=C.finish(completed(stories[0],stories[0].actions[0]),'2026-09-06',stories[0],{when:'x',step:'y'});
  const id=s.dailyPractice.life[0].id;
  for(const response of ['忘了','沒有遇到','有試但未解決','不想談']){
    const r=C.reflect(s,id,response,'2026-09-07');assert.equal(r.dailyPractice.reviews[0].response,response);
    assert.equal(r.calmCount,s.calmCount);assert.deepEqual(r.flags,s.flags);assert.deepEqual(C.reflect(r,id,'另一回答','2026-09-07'),r);
  }
});
test('service worker downloads fresh shell before activating and preserves other apps',async()=>{
  const listeners={},deleted=[],added=[];let skipped=false;
  const keys=['du-ferry-v1','du-ferry-v3','qiyuan-cache','other-game-v1','du-ferry:https://example.com/elsewhere/:daily-v1'];
  const context={URL,Promise,Error,Request:class {constructor(url,options){this.url=url;this.cache=options.cache;}},self:{skipWaiting:async()=>{assert.ok(added.length);skipped=true;},registration:{scope:'https://example.com/ferry/'},location:{origin:'https://example.com'},clients:{claim:async()=>{},matchAll:async()=>[]},addEventListener:(event,fn)=>listeners[event]=fn},caches:{keys:async()=>keys,delete:async(key)=>deleted.push(key),open:async()=>({addAll:async(shell)=>added.push(...shell)})}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
  let wait;listeners.install({waitUntil:p=>wait=p});await wait;
  assert.equal(skipped,true);
  for(const file of added){assert.equal(file.cache,'reload');assert.ok(fs.existsSync(path.join(__dirname,'..',file.url)));}
  listeners.activate({waitUntil:p=>wait=p});await wait;
  assert.deepEqual(deleted,['du-ferry-v1','du-ferry-v3']);
  let responded=false;listeners.fetch({request:{method:'GET',url:'https://example.com/qiyuan/game.js'},respondWith:()=>responded=true});assert.equal(responded,false);
});

function appHarness(raw, failWrites=false, userAgent='') {
  const key='du_ferry_save_v1', data=new Map(raw==null?[]:[[key,raw]]), nodes=new Map(), handlers=new Map(), events={};
  function element(id) {
    if(!nodes.has(id)){
      const classes=new Set(id==='functionPanel'?['hidden']:[]),attributes={};
      nodes.set(id,{id,innerHTML:'',textContent:'',dataset:{},attributes,classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,force){const on=force===undefined?!classes.has(c):force;if(on)classes.add(c);else classes.delete(c);return on;}},setAttribute:(k,v)=>attributes[k]=v,focus(){},remove(){nodes.delete(id);},addEventListener:(event,fn)=>handlers.set(id+':'+event,fn),querySelectorAll(){
      return [...this.innerHTML.matchAll(/data-do="([^"]+)"/g)].map(match=>({dataset:{do:match[1]},addEventListener:(event,fn)=>handlers.set(match[1],fn)}));
      }});
    }
    return nodes.get(id);
  }
  const document={body:{dataset:{tod:'day'},appendChild(node){nodes.set(node.id,node);}},hidden:false,getElementById:id=>id==='saveWarning'&&!nodes.has(id)?null:element(id),createElement:()=>({setAttribute(){}}),addEventListener:(event,fn)=>events[event]=fn};
  const context={console,FerryCore:C,PRACTICE_STORIES:stories,QUOTES:[],GUESTS:[],SCENARIOS:[],CHAINS:[],SAVE_KEY:key,S:{},document,URLSearchParams,location:{search:''},navigator:{userAgent},setTimeout,defaultState:()=>({seeds:[],quotes:[],letters:[],history:[],flags:{}}),todayStr:()=> '2026-09-06',applySky(){},renderWorld(){},esc:s=>String(s),$:element,overlay:element('overlay'),idleBar:element('idleBar'),localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{if(failWrites)throw Error('quota');data.set(k,v);}},window:{addEventListener:(event,fn)=>events[event]=fn}};
  context.window.FerryPractice=undefined;
  Object.defineProperty(context,'FerryPractice',{get:()=>context.window.FerryPractice});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../practice.js'),'utf8'),context);
  return {data,nodes,handlers,events,context,key};
}
test('browser entry creates exact pre-upgrade backup before migrating',()=>{
  const raw=JSON.stringify(old),h=appHarness(raw);
  assert.equal(h.data.get(h.key+'_before_daily_v1'),raw);
  const saved=JSON.parse(h.data.get(h.key));for(const key of Object.keys(old))assert.deepEqual(saved[key],old[key]);
  assert.equal(saved.dailyPractice.version,1);assert.ok(h.nodes.get('overlay').innerHTML.includes('走進今日故事'));
});
test('browser entry protects corrupt saves and quota failures',()=>{
  for(const [raw,fail] of [['not-json',false],[JSON.stringify(old),true]]){
    const h=appHarness(raw,fail);assert.equal(h.data.get(h.key),raw);
    assert.ok(h.nodes.get('overlay').innerHTML.includes('先把原來的渡口留好'));
  }
});
test('cross-tab write conflict stops before replacing newer progress',async()=>{
  const h=appHarness(JSON.stringify(old)),newer=JSON.stringify({...old,totalRounds:20});
  h.data.set(h.key,newer);await h.handlers.get('start')();
  assert.equal(h.data.get(h.key),newer);assert.ok(h.nodes.get('saveWarning').textContent.includes('另一個分頁'));
});
test('function panel owns install entry and Chromium prompt is handled from it',async()=>{
  const h=appHarness(null);let prevented=false,calls=0;
  assert.equal(h.nodes.get('overlay').innerHTML.includes('data-do="install"'),false);
  assert.ok(h.nodes.get('btnMenuInstall').innerHTML.includes('安裝手機 App'));
  h.events.beforeinstallprompt({preventDefault(){prevented=true;},prompt:async()=>{calls++;return {outcome:'accepted'};}});
  h.handlers.get('btnMenuInstall:click')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(prevented,true);assert.equal(calls,1);
  assert.ok(h.nodes.get('overlay').innerHTML.includes('安裝完成'));
});
test('installed event replaces install call-to-action with installed state',()=>{
  const h=appHarness(null);h.events.appinstalled();
  assert.ok(h.nodes.get('btnMenuInstall').innerHTML.includes('App 已安裝'));
  h.context.window.FerryPractice.installApp();
  assert.ok(h.nodes.get('overlay').innerHTML.includes('《渡》已安裝'));
});
test('iPhone and Android receive platform-specific installation guidance',()=>{
  const iphone=appHarness(null,false,'Mozilla/5.0 (iPhone) AppleWebKit Safari');
  iphone.context.window.FerryPractice.installApp();
  assert.ok(iphone.nodes.get('overlay').innerHTML.includes('iPhone 安裝方式'));
  assert.ok(iphone.nodes.get('overlay').innerHTML.includes('加入主畫面'));
  assert.ok(iphone.nodes.get('overlay').innerHTML.includes('以網頁 App 打開'));
  const android=appHarness(null,false,'Mozilla/5.0 (Linux; Android 15) Chrome');
  android.context.window.FerryPractice.installApp();
  assert.ok(android.nodes.get('overlay').innerHTML.includes('Android 安裝方式'));
  assert.ok(android.nodes.get('overlay').innerHTML.includes('安裝應用程式'));
});
test('function key opens one panel, close and backdrop restore it',()=>{
  const h=appHarness(null),panel=h.nodes.get('functionPanel'),menu=h.nodes.get('btnMenu');
  h.handlers.get('btnMenu:click')();assert.equal(panel.classList.contains('hidden'),false);assert.equal(menu.attributes['aria-expanded'],'true');
  h.handlers.get('functionClose:click')();assert.equal(panel.classList.contains('hidden'),true);assert.equal(menu.attributes['aria-expanded'],'false');
  h.handlers.get('btnMenu:click')();h.handlers.get('functionPanel:click')({target:{id:'functionPanel'}});assert.equal(panel.classList.contains('hidden'),true);
});
