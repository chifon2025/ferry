'use strict';
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),C=require('../reframe-core.js');
const base=process.argv[2]||'http://127.0.0.1:8138/';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;const errors=[];
  try{
    for(const config of [{width:320,height:568},{width:390,height:844},{width:390,height:844,visual:500},{width:844,height:390},{width:390,height:844,font:200}]){
      const context=await browser.newContext({viewport:{width:config.width,height:config.height},isMobile:config.width<500,hasTouch:true,serviceWorkers:'block'});
      if(config.visual)await context.addInitScript(h=>{const v=new EventTarget();Object.assign(v,{height:h,scale:1});Object.defineProperty(window,'visualViewport',{value:v});},config.visual);
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'reframe.html');
      if(config.font){await page.addStyleTag({content:':root{font-size:'+config.font+'%!important}'});await page.evaluate(()=>dispatchEvent(new Event('resize')));}
      async function inspect(label){
        await page.waitForTimeout(65);
        const m=await page.evaluate(()=>{
          const visible=Math.min(innerHeight,visualViewport?.height||innerHeight),reader=document.getElementById('reader'),story=document.getElementById('storyText');
          const boxes=[...document.querySelectorAll('#controlDock button,#pagePrev,#pageNext,#menuOpen')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.textContent,top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});
          return {visible,width:innerWidth,boxes,reader:reader.clientHeight,text:story.scrollHeight,line:parseFloat(getComputedStyle(story).lineHeight),overflow:document.documentElement.scrollHeight>innerHeight};
        });
        for(const r of m.boxes)assert.ok(r.top>=0&&r.bottom<=m.visible+1&&r.left>=0&&r.right<=m.width+1&&r.height>=44,label+' control clipped '+JSON.stringify(m));
        assert.ok(m.reader>=m.line-1&&m.text<=m.reader+1&&!m.overflow,label+' reader clipped '+JSON.stringify(m));checks++;
      }
      for(const c of C.cases){
        await page.locator('#menuOpen').click();await page.locator('#chapterChoice').selectOption(c.id);await page.locator('#chapterStart').click();await inspect(c.id+' scene '+JSON.stringify(config));
        await page.locator('#hand button').first().click();await inspect('flip');assert.equal(await page.locator('#hand').isVisible(),false);
        await page.locator('#backStory').click();await page.locator('#hand button').last().click();await page.locator('#confirm').click();await inspect('action');
        await page.locator('#hand button').last().click();await inspect('preview');
        await page.locator('#timeLens').click();await inspect('time');await page.locator('#confirm').click();await page.locator('#confirm').click();await inspect('ending');
        await page.locator('#rest').click();await inspect('rest');await page.locator('#confirm').click();await page.locator('#replay').click();await page.locator('#confirm').click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'response');
      }
      if(config.width===390&&!config.visual&&!config.font)await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'ferry-reframe-mobile.png')});
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'?offline-test');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.locator('#hand button').last().click();await page.locator('#confirm').click();
    const raw=await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1'));
    await page.evaluate(()=>localStorage.setItem('du_ferry_cards_v1','preserved old card record'));
    await page.goto(base+'reframe.html?offline-test');await page.locator('#hand button').last().click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'flip');
    await context.setOffline(true);await page.reload();assert.equal(await page.locator('#game').getAttribute('data-phase'),'scene');
    await page.locator('#confirm').click();await page.locator('#hand button').first().click();await page.locator('#confirm').click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'ending');
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),raw);
    await page.goto(base);assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),raw);assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_cards_v1')),'preserved old card record');assert.equal(await page.locator('#hand button').count(),2);
    assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({checks,offlineTrial:true,offlineReturnToMain:true,noSaveChanges:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
