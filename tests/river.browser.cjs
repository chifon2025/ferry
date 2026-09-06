// Isolated headless mobile QA. No player profile or production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');let version='daily-v5';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(file.includes('..')){res.writeHead(403);res.end();return;}
  try{let data=fs.readFileSync(path.join(root,file));if(file==='sw.js')data=Buffer.from(data.toString().replace(/daily-v\d+/,version));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch(_){res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base=`http://127.0.0.1:${server.address().port}/?offline-test=1`;
    const click=a=>page.locator(`[data-river="${a}"]`).first().click();
    const phase=p=>page.waitForFunction(p=>document.getElementById('riverStage')?.dataset.screen===p,p);
    const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('du_ferry_save_v1')));
    await page.goto(base);await phase('home');await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await page.screenshot({path:path.join(os.tmpdir(),'ferry-mobile-home.png')});
    for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:900}]){
      await page.setViewportSize(size);
      const box=await page.locator('#riverStage').boundingBox();assert.ok(box.width<=520);assert.equal(box.height,size.height);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const a of ['begin','walk','book']){const b=await page.locator(`[data-river="${a}"]`).boundingBox();assert.ok(b.height>=44);assert.ok(b.y+b.height<=size.height);}
      if(size.width===320)await page.screenshot({path:path.join(os.tmpdir(),'ferry-mobile-small.png')});
    }
    console.log('PASS portrait canvas and thumb controls at 320/390/430 and desktop widths');
    await page.setViewportSize({width:390,height:844});await click('begin');await phase('wish');
    await page.locator('#riverWish').fill('和家人自在地吃一頓飯');assert.equal((await save()).riverJourney.active.wish,'和家人自在地吃一頓飯');
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await phase('wish');
    await page.reload();await click('resume');await phase('wish');assert.equal(await page.locator('#riverWish').inputValue(),'和家人自在地吃一頓飯');
    await page.setViewportSize({width:390,height:500});await page.locator('#riverWish').fill('和家人自在地吃一頓飯');
    await page.screenshot({path:path.join(os.tmpdir(),'ferry-mobile-keyboard-height.png')});
    await click('see');await page.setViewportSize({width:390,height:844});await phase('see');
    await click('ready');await phase('release');await page.screenshot({path:path.join(os.tmpdir(),'ferry-mobile-lantern.png')});
    await page.locator('#releaseLantern').tap();await phase('shore');await click('act:tea');await click('note');
    await page.locator('#riverNote').fill('<b>今天慢慢吃飯</b>');await click('finishnote');await phase('done');
    assert.equal((await save()).riverJourney.active,null);await click('home');await click('book');await click('notes');
    assert.equal(await page.locator('.river-notes b').count(),0);assert.ok((await page.locator('.river-notes').innerText()).includes('<b>今天慢慢吃飯</b>'));
    console.log('PASS wish survives reload/foreground; tap release, optional note and safe text rendering');
    await click('home');await click('story:reply');await phase('encounter');await page.screenshot({path:path.join(os.tmpdir(),'ferry-mobile-story.png')});
    await click('storywish');await click('see');await click('ready');
    const lamp=await page.locator('#releaseLantern').boundingBox(),touch=await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:lamp.x+50,y:lamp.y+50}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:lamp.x+70,y:lamp.y+20}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();await phase('shore');
    await click('finish');assert.equal((await save()).riverJourney.pending.length,1);
    await click('home');await click('book');await click('old:classic');await page.locator('[data-do="start"]').waitFor();await page.locator('[data-do="about"]').click();await page.locator('[data-do="home"]').click();await phase('home');
    await page.locator('#btnMenu').click();await page.locator('#btnMenuInstall').waitFor({state:'visible'});await page.locator('#btnUpdate').waitFor({state:'visible'});await page.locator('#functionClose').click();
    console.log('PASS story encounter, drag release, original story access, install/update function menu');
    await click('begin');await page.locator('#riverWish').fill('更新不可丟失');version='daily-v6';
    await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await page.locator('#updateNotice').waitFor({state:'visible'});
    assert.equal(await page.locator('#riverWish').inputValue(),'更新不可丟失');await click('see');
    await page.locator('#updateNotice button').click();await phase('see');await page.waitForLoadState('load');
    assert.equal((await save()).riverJourney.active.wish,'更新不可丟失');
    await context.setOffline(true);await page.reload();await click('resume');await phase('see');
    const loaded=await page.locator('.river-ferryman').evaluate(img=>img.complete&&img.naturalWidth>0);assert.equal(loaded,true);
    assert.ok(await page.evaluate(async()=>Boolean(await caches.match('./art/river-portrait.webp'))));
    await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.river-ferryman').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.deepEqual(errors,[]);console.log('PASS form-safe update and automatic phase resume; offline art/game; reduced motion; zero browser errors');
    console.log('Screenshots:',path.join(os.tmpdir(),'ferry-mobile-*.png'));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
