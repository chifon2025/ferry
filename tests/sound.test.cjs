const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../sound-core.js');
test('ambient startup does not create any water loops',()=>{const fs=require('node:fs');const source=fs.readFileSync(require('node:path').join(__dirname,'../sound-core.js'),'utf8');const body=source.match(/function startAmbience\(\)\{([^}]+)\}/)[1];assert.equal(body.includes('streamLoop'),false);assert.equal(body.includes('water'),false);assert.ok(body.includes('wind'));});
test('legacy mute representations remain muted; default remains enabled',()=>{for(const value of ['0','off','false','OFF'])assert.equal(S.enabled(value),false);for(const value of [null,'1','on'])assert.equal(S.enabled(value),true);});
test('independent levels clamp, corrupt or unknown preferences fall back safely',()=>{
  assert.deepEqual(S.settings('broken'),S.defaults);assert.deepEqual(S.settings({music:NaN,ambience:Infinity,effects:'loud'}),S.defaults);
  assert.deepEqual(S.settings({music:2,ambience:-1,effects:.2,riverOnly:true}),{music:1,ambience:0,effects:.2,riverOnly:true});
});
test('reading sound preferences never mutates the source or shares defaults',()=>{const p={music:.2,riverOnly:true},before=JSON.stringify(p);S.settings(p);assert.equal(JSON.stringify(p),before);const n=S.settings(null);n.music=0;assert.equal(S.defaults.music,.45);});
test('theme uses short related motifs rather than random unrelated pitches',()=>{assert.equal(S.motifs.length,3);for(const motif of S.motifs){assert.ok(motif.length>=4&&motif.length<=6);assert.ok(motif.every(n=>n>=0&&n<=4));}});
test('creek texture is repeatable, bounded, DC-free and has irregular short-time energy',()=>{
  const rate=22050,a=S.streamData(rate,4,173),b=S.streamData(rate,4,173);assert.equal(a.length,rate*4);assert.deepEqual(a,b);
  let peak=0,total=0;const energy=[];for(let i=0;i<a.length;i+=1102){let sum=0;for(const v of a.subarray(i,i+1102)){assert.ok(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));total+=v;sum+=v*v;}energy.push(sum/1102);}
  assert.ok(peak>.01&&peak<.8);assert.ok(Math.abs(total/a.length)<1e-7);assert.ok(Math.max(...energy)>Math.min(...energy)*4);
  assert.ok(Math.abs(a[0]-a[a.length-1])<.05,'no large seam discontinuity');
});
