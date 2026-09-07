'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../cards-core.js'),J=require('../cards-journey.js');
const root=path.resolve(__dirname,'..');
test('fifteen chapters contain 69 distinct routes and 828 complete state combinations',()=>{
  assert.equal(C.chapters.length,15);assert.equal(Object.keys(J.stories).length,12);
  const titles=new Set();let routes=0,combinations=0;
  for(const chapter of C.chapters){
    const start=C.create(0,chapter),profile=C.reflectionFor(start);
    for(const key of ['want','avoid','question','carry'])assert.ok(profile[key].length>12,chapter+' '+key);
    for(const action of C.actionsFor(start))for(const reply of C.repliesFor({...start,action:action.id})){
      routes++;let baseline;
      for(const wish of C.wishes)for(const variant of [0,1])for(const aside of [false,true]){
        let s=C.create(variant,chapter);
        for(const event of [{type:'wish',id:wish.id},{type:'action',id:action.id},{type:'reveal'},...(aside?[{type:'aside'}]:[]),{type:'reply',id:reply.id}]){
          const previous=JSON.stringify(s);const next=C.transition(s,event);assert.equal(JSON.stringify(s),previous);assert.equal(C.valid(next),true);s=next;
        }
        const end=C.ending(s);assert.equal(s.phase,'ending');assert.ok(end.text.length>30);assert.ok(end.after.length>12);assert.ok(C.aftermath(s).text.length>25);combinations++;
        if(chapter!=='flowers'){if(baseline)assert.deepEqual(end,baseline);else baseline=end;}
        titles.add(chapter+':'+end.title);
      }
    }
  }
  assert.equal(routes,69);assert.equal(titles.size,69);assert.equal(combinations,828);
});
test('browser script order constructs the same chapters without CommonJS',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),context={};vm.createContext(context);
  const scripts=Array.from(html.matchAll(/<script src="\.\/(cards-[^\"]+\.js)"/g),m=>m[1]);
  for(const file of scripts)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  assert.deepEqual(Array.from(context.FerryCardsCore.chapters),C.chapters);
  for(const id of C.chapters)assert.equal(context.FerryCardsCore.chapterFor(context.FerryCardsCore.create(0,id)).title,C.chapterFor(C.create(0,id)).title);
});
test('new stories use traditional text and contain no outside book text or runtime dependency',()=>{
  const source=fs.readFileSync(path.join(root,'cards-journey.js'),'utf8');
  assert.doesNotMatch(source,/[没现离还写给开满]/);
  assert.doesNotMatch(source,/fetch\(|localStorage|https?:|innerHTML|eval\(/);
  assert.doesNotMatch(JSON.stringify(J),/癌症|停藥|必然成真|百分之百|放下成功|通關獎勵/);
});
