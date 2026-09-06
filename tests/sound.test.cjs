const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../sound-core.js');
test('legacy mute representations remain muted; default remains enabled',()=>{for(const value of ['0','off','false','OFF'])assert.equal(S.enabled(value),false);for(const value of [null,'1','on'])assert.equal(S.enabled(value),true);});
test('independent levels clamp, corrupt or unknown preferences fall back safely',()=>{
  assert.deepEqual(S.settings('broken'),S.defaults);assert.deepEqual(S.settings({music:NaN,ambience:Infinity,effects:'loud'}),S.defaults);
  assert.deepEqual(S.settings({music:2,ambience:-1,effects:.2,riverOnly:true}),{music:1,ambience:0,effects:.2,riverOnly:true});
});
test('reading sound preferences never mutates the source or shares defaults',()=>{const p={music:.2,riverOnly:true},before=JSON.stringify(p);S.settings(p);assert.equal(JSON.stringify(p),before);const n=S.settings(null);n.music=0;assert.equal(S.defaults.music,.45);});
test('theme uses short related motifs rather than random unrelated pitches',()=>{assert.equal(S.motifs.length,3);for(const motif of S.motifs){assert.ok(motif.length>=4&&motif.length<=6);assert.ok(motif.every(n=>n>=0&&n<=4));}});
