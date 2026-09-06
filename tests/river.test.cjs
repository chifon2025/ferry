const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../river-core.js');
const original={letters:[{text:'原信'}],history:[{id:7}],dailyPractice:{active:{phase:'observe'}},calmCount:9,unknown:{keep:true}};
function shore(story=null){let s=C.begin(original,story,'2026-09-07');s=C.draft(s,'和家人自在吃飯');for(const p of ['see','release','shore'])s=C.advance(s,p);return s;}
test('new journey preserves every old field and does not mutate the source',()=>{
  const before=JSON.stringify(original),s=shore();for(const k of Object.keys(original))assert.deepEqual(s[k],original[k]);assert.equal(JSON.stringify(original),before);
  assert.deepEqual(C.settle(original,'2026-09-07'),original);
});
test('wish can be blank, phases cannot be skipped, and existing journey resumes',()=>{
  let s=C.begin(original,null,'2026-09-07');assert.equal(C.advance(s,'shore').riverJourney.active.phase,'wish');
  s=C.draft(s,'x'.repeat(140));assert.equal(s.riverJourney.active.wish.length,120);
  assert.deepEqual(C.begin(s,'boat','2026-09-08'),s);
  s=C.draft(s,'');s=C.advance(s,'see');assert.equal(s.riverJourney.active.wish,'');assert.deepEqual(C.draft(s,'too late'),s);
});
test('finishing is optional-note only, clears wish, and has no reward or daily limit',()=>{
  const s=shore(),done=C.finish(C.act(s,'tea'),'2026-09-07','  今天慢慢吃飯  ');
  assert.equal(done.riverJourney.active,null);assert.equal(done.riverJourney.notes[0].text,'今天慢慢吃飯');
  assert.equal(JSON.stringify(done).includes('和家人自在吃飯'),false);assert.equal(done.calmCount,9);
  assert.deepEqual(C.finish(done,'2026-09-07','duplicate'),done);
  assert.ok(C.begin(done,null,'2026-09-07').riverJourney.active);
});
test('story aftermath arrives only on a later date and once per story',()=>{
  const done=C.finish(shore('boat'),'2026-09-06',null,'船家補了木板');
  assert.equal(C.settle(done,'2026-09-07').letters.length,1);
  let next=C.settle(done,'2026-09-08');assert.equal(next.letters.length,2);assert.equal(next.letters[1].read,false);
  assert.deepEqual(C.settle(next,'2026-09-09'),next);
  next=C.begin(next,'boat','2026-09-08');for(const p of ['see','release','shore'])next=C.advance(next,p);
  next=C.finish(next,'2026-09-08',null,'again');assert.equal(next.riverJourney.pending.length,0);
});
test('future and malformed records are rejected without erasing data',()=>{
  for(const riverJourney of [{version:2},{version:1,encounters:[],notes:[],pending:[],active:{phase:'oops',wish:''}}])assert.throws(()=>C.read({...original,riverJourney}));
});
