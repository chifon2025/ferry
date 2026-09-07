'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../cards-core.js'),L=require('../cards-layout.js');
function finish(chapter,action,reply,wish='share',aside=false,variant=0){
  let s=C.create(variant,chapter);
  for(const e of [{type:'wish',id:wish},{type:'action',id:action},{type:'reveal'},...(aside?[{type:'aside'}]:[]),{type:'reply',id:reply}])s=C.transition(s,e);
  return s;
}
test('two new chapters have twelve complete original routes, with no thought or luck rewards',()=>{
  const titles=new Set();let combinations=0;
  for(const chapter of ['review','order']){
    const start=C.create(0,chapter);assert.equal(C.valid(start),true);
    for(const action of C.actionsFor(start))for(const reply of C.repliesFor({...start,action:action.id})){
      const baseline=finish(chapter,action.id,reply.id);
      assert.equal(baseline.phase,'ending');assert.equal(C.valid(baseline),true);titles.add(C.ending(baseline).title);
      assert.ok(C.aftermath(baseline).clue);assert.ok(C.ending(baseline).after);
      for(const wish of C.wishes)for(const aside of [false,true])for(const variant of [0,1]){
        const state=finish(chapter,action.id,reply.id,wish.id,aside,variant);
        assert.deepEqual(C.ending(state),C.ending(baseline));assert.deepEqual(C.aftermath(state),C.aftermath(baseline));combinations++;
      }
    }
  }
  assert.equal(titles.size,12);assert.equal(combinations,144);
});
test('chapters advance only at endings, replay state is independent, and unknown branches fail safely',()=>{
  assert.equal(C.nextChapter(C.create()),null);
  let first=C.create();for(const event of [{type:'wish',id:'share'},{type:'action',id:'call'},{type:'reveal'},{type:'reply',id:'pickup'}])first=C.transition(first,event);
  const next=C.nextChapter(first);assert.equal(next.chapter,'review');assert.equal(next.phase,'opening');assert.equal(first.phase,'ending');
  assert.equal(C.nextChapter(finish('review','ask','remake')).chapter,'order');assert.equal(C.nextChapter(finish('order','count','eight')),null);
  for(const state of [{...C.create(),chapter:'unknown'},{...C.create(),chapter:null},{...C.create(),chapter:'__proto__'},{...C.create(),chapter:'review',edition:undefined}])assert.equal(C.valid(state),false);
  assert.throws(()=>C.create(0,'nope'),/Unknown chapter/);
  const review=C.transition(C.create(0,'review'),{type:'wish',id:'share'});
  assert.equal(C.transition(review,{type:'action',id:'call'}),review);
  const respond=C.transition(C.transition(review,{type:'action',id:'ask'}),{type:'reveal'});
  assert.equal(C.transition(respond,{type:'reply',id:'eight'}),respond);
});
test('all story text paginates losslessly across small and large measured capacities',()=>{
  const texts=['一段話。\n\n第二段！🌸最後一句。','', '很長而沒有標點的一行文字'.repeat(40)];
  for(const chapter of C.chapters){
    const initial=C.create(0,chapter),meta=C.chapterFor(initial);texts.push(meta.opening.text,meta.event.text);
    for(const action of C.actionsFor(initial))for(const reply of C.repliesFor({...initial,action:action.id})){
      const state=finish(chapter,action.id,reply.id);texts.push(C.aftermath(state).text,C.ending(state).text+'\n\n'+C.ending(state).after,reply.text+'\n\n'+(reply.preview||''));
    }
  }
  for(const text of texts)for(const capacity of [1,8,16,24,48,96,180]){
    const pages=L.paginate(text,value=>Array.from(value).length<=capacity);
    assert.equal(pages.map(p=>p.text).join(''),text);
    assert.ok(pages.every(p=>Array.from(p.text).length<=capacity));
    let offset=0;for(const p of pages){assert.equal(p.start,offset);offset+=Array.from(p.text).length;}
  }
});
test('resizing pages can retain the current reading position and never loops on tiny geometry',()=>{
  const text='今天先做眼前能做的事。'.repeat(20),wide=L.paginate(text,s=>s.length<=80),anchor=wide[2].start;
  const narrow=L.paginate(text,s=>s.length<=19),index=L.pageAt(narrow,anchor);
  assert.ok(narrow[index].start<=anchor);assert.ok(index===narrow.length-1||narrow[index+1].start>anchor);
  assert.equal(L.paginate('小🌸禾',()=>false).length,3);
});
test('phone shell uses the reference viewport height, fixed body and measured reading region',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../cards.css'),'utf8'),html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(css,/body\{position:fixed;inset:0\}/);assert.match(css,/width:min\(100%,480px\)/);assert.match(css,/height:100dvh/);
  assert.match(css,/\.reader\{flex:1;min-height:0;overflow:hidden\}/);assert.doesNotMatch(css,/line-clamp|text-overflow:ellipsis/);
  assert.match(html,/id="pagePrev"/);assert.match(html,/id="pageNext"/);assert.match(html,/cards-layout\.js/);assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
});
