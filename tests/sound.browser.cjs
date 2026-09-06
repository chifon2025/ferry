// Isolated mobile audio tests plus actual OfflineAudioContext waveform rendering.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium}=require('playwright'),root=path.join(__dirname,'..');
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{const f=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(f.includes('..')){res.writeHead(403);res.end();return;}try{res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(path.join(root,f)));}catch(_){res.writeHead(404);res.end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
   window.__contexts=[];const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(...args){super(...args);window.__contexts.push(this);}};
   if(!sessionStorage.getItem('audio-test-seeded')){localStorage.setItem('du_ferry_sound','0');sessionStorage.setItem('audio-test-seeded','yes');}
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?offline-test=1`);
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const gameSave=await page.evaluate(()=>localStorage.getItem('du_ferry_save_v1'));
  await page.locator('#btnMenu').click();assert.equal(await page.evaluate(()=>__contexts.length),0);assert.equal(await page.locator('#btnSound').getAttribute('aria-pressed'),'false');
  await page.locator('#soundSettings summary').click();
  await page.evaluate(()=>{const original=FerrySound.create;FerrySound.create=c=>{const p=original(c);window.__palette=p;window.__sounds=[];const fx=p.effect;p.effect=(kind,...args)=>{__sounds.push(kind);return fx(kind,...args);};return p;};});
  await page.locator('#btnSound').click();await page.waitForFunction(()=>__contexts[0]?.state==='running');
  assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_save_v1')),gameSave);
  await page.locator('#sound-music').fill('28');await page.locator('#sound-effects').fill('35');
  await page.locator('#soundRiverOnly').click();assert.equal(await page.locator('#soundRiverOnly').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>__palette.levels().effects<.001&&__palette.levels().music<.001);
  const count=await page.evaluate(()=>__sounds.length);await page.evaluate(()=>ZenAudio.effect('tea'));assert.equal(await page.evaluate(()=>__sounds.length),count);
  await page.locator('#soundNormal').click();assert.equal(await page.locator('#sound-music').inputValue(),'28');assert.equal(await page.locator('#sound-effects').inputValue(),'35');
  await page.evaluate(()=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='du_ferry_audio_v2')throw Error('quota');return window.__originalSet.call(this,k,v);};});
  await page.locator('#sound-effects').fill('36');assert.ok((await page.locator('#soundStatus').innerText()).includes('無法記住'));
  await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSet;});await page.locator('#sound-effects').fill('35');
  await page.screenshot({path:path.join(os.tmpdir(),'ferry-sound-settings.png')});
  await page.setViewportSize({width:320,height:568});await page.locator('#sound-effects').scrollIntoViewIfNeeded();const slider=await page.locator('#sound-effects').boundingBox();assert.ok(slider.height>=44&&slider.x+slider.width<=320);
  await page.locator('#btnSound').click();await page.waitForFunction(()=>__contexts[0].state==='suspended');
  await page.reload();await page.locator('#btnMenu').click();assert.equal(await page.evaluate(()=>__contexts.length),0);
  await page.locator('#soundSettings summary').click();assert.equal(await page.locator('#sound-music').inputValue(),'28');await page.locator('#btnSound').click();
  await page.locator('#functionClose').click();await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{const make=FerrySound.create;/* A context may already exist, hook scene events at the public adapter. */window.__events=[];const fx=ZenAudio.effect;ZenAudio.effect=k=>{__events.push(k);fx(k);};});
  await page.locator('[data-river="story:reply"]').click();await page.locator('[data-river="storywish"]').click();await page.locator('[data-river="see"]').click();await page.locator('[data-river="ready"]').click();await page.locator('#releaseLantern').tap();await page.locator('[data-river="act:tea"]').click();
  const events=await page.evaluate(()=>__events);for(const name of ['mail','paper','release','tea'])assert.ok(events.includes(name));assert.equal(events.filter(n=>n==='release').length,1);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>__contexts[0].state==='suspended');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>__contexts[0].state==='running');
  await context.setOffline(true);await page.reload();await page.locator('#btnMenu').click();await page.waitForFunction(()=>__contexts[0]?.state==='running');
  console.log('PASS mobile controls, legacy mute, independent levels, river-only, reload, scene effects, background suspend, offline audio');
  const signals=await page.evaluate(async()=>{
   async function render(kind){const c=new OfflineAudioContext(1,44100*8,44100),p=FerrySound.create(c);p.mix({music:1,ambience:1,effects:1,riverOnly:kind==='quiet'},kind!=='muted');
    if(kind==='quiet')p.startAmbience();
    if(['full','muted','river'].includes(kind)){p.startAmbience();if(kind!=='river'){p.phrase(0,1);p.effect('tea',2);p.effect('release',3);}}
    else if(kind==='shore'){p.scene('shore');p.phrase(0,1);}
    else if(kind==='music')p.phrase(0,1);
    else p.effect(kind,1);
    const b=await c.startRendering(),d=b.getChannelData(0);let peak=0,sum=0;for(const v of d){if(!Number.isFinite(v))throw Error('nonfinite');peak=Math.max(peak,Math.abs(v));sum+=v*v;}p.dispose();return {kind,peak,rms:Math.sqrt(sum/d.length)};
   }const out=[];for(const k of ['full','muted','quiet','river','music','shore','touch','mail','paper','tea','release','sit','greeting'])out.push(await render(k));return out;
  });
  for(const s of signals){assert.ok(s.peak<.95);if(['muted','quiet'].includes(s.kind))assert.equal(s.peak,0);else assert.ok(s.rms>.000001);}
  assert.ok(signals.find(s=>s.kind==='shore').rms<signals.find(s=>s.kind==='music').rms*.5);
  assert.ok(signals.find(s=>s.kind==='river').rms<signals.find(s=>s.kind==='music').rms,'continuous water/wind must remain below the musical phrase at equal mixer levels');
  console.log('PASS rendered audio is finite, audible, below clipping; mute is silent; shore music recedes',JSON.stringify(signals));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
