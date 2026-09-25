'use strict';
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),C=require('../flow-core.js');
const base=process.argv[2]||'http://127.0.0.1:8138/';
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0,pages=0;const errors=[];
  try{
    await Promise.all([{width:320,height:568},{width:390,height:844},{width:390,height:844,visual:500},{width:844,height:390},{width:390,height:844,font:200}].map(async(config)=>{
      const context=await browser.newContext({viewport:{width:config.width,height:config.height},isMobile:config.width<500,hasTouch:true,serviceWorkers:'block'});
      if(config.visual)await context.addInitScript(h=>{const v=new EventTarget();Object.assign(v,{height:h,scale:1});Object.defineProperty(window,'visualViewport',{value:v});},config.visual);
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
      if(config.font){await page.addStyleTag({content:':root{font-size:'+config.font+'%!important}'});await page.evaluate(()=>dispatchEvent(new Event('resize')));}
      async function inspect(label){
        await page.waitForTimeout(80);
        const m=await page.evaluate(()=>{
          const visible=Math.min(innerHeight,visualViewport?.height||innerHeight),reader=document.getElementById('reader'),story=document.getElementById('storyText');
          const boxes=[...document.querySelectorAll('#controlDock button,#pagePrev,#pageNext,#menuOpen')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.textContent,top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});
          return {visible,width:innerWidth,boxes,reader:reader.clientHeight,text:story.scrollHeight,line:parseFloat(getComputedStyle(story).lineHeight),overflow:document.documentElement.scrollHeight>innerHeight};
        });
        for(const r of m.boxes)assert.ok(r.top>=0&&r.bottom<=m.visible+1&&r.left>=0&&r.right<=m.width+1&&r.height>=44,label+' control clipped '+JSON.stringify({config,m}));
        assert.ok(m.reader>=m.line-1&&m.text<=m.reader+1&&!m.overflow,label+' reader clipped '+JSON.stringify({config,m}));checks++;
      }
      for(const cat of C.categories){
        await page.locator('#menuOpen').click();await page.locator('#chapterChoice').selectOption(cat.id);await page.locator('#chapterStart').click();await inspect(cat.id+' scene');
        for(const b of await page.locator('#hand button').all())await b.click();await inspect('three selected');assert.equal(await page.locator('#hand button[aria-pressed=true]').count(),3);
        const before=await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1'));
        await page.locator('#confirm').click();await inspect('flip');
        const read=await page.evaluate(()=>{let text='',count=0;do{const story=document.getElementById('storyText'),reader=document.getElementById('reader');if(story.scrollHeight>reader.clientHeight+1)throw Error('page clipped');text+=story.textContent;count++;if(document.getElementById('pageNext').disabled)break;document.getElementById('pageNext').click();if(count>100)throw Error('page loop');}while(true);return {text,count};});pages+=read.count;
        const snapshot=C.restore(JSON.parse(before));snapshot.reactions=['t0','t1','t2'];snapshot.phase='flip';assert.equal(read.text,C.sceneFor(snapshot).text);assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1')),before);
        await page.locator('#backStory').click();assert.equal(await page.locator('#hand button[aria-pressed=true]').count(),3);await page.locator('#hand button').last().click();assert.equal(await page.locator('#hand button[aria-pressed=true]').count(),2);
        await page.locator('#confirm').click();await page.locator('#confirm').click();await inspect('action');await page.locator('#hand button').last().click();await inspect('preview');
        await page.locator('#timeLens').click();await inspect('time');await page.locator('#confirm').click();await page.locator('#confirm').click();await inspect('ending');
        await page.locator('#rest').click();await inspect('rest');await page.locator('#confirm').click();await page.locator('#replay').click();await page.locator('#confirm').click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'response');
      }
      if(config.width===390&&!config.visual&&!config.font)await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'ferry-flow-mobile.png')});
      await context.close();console.log(JSON.stringify({viewport:config,passed:true}));
    }));
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'?offline-test');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await page.evaluate(()=>{localStorage.setItem('du_ferry_scenarios_v1','preserved old scenarios');localStorage.setItem('du_ferry_cards_v1','preserved old cards');});
    await page.locator('#hand button').first().click();await page.locator('#confirm').click();await page.locator('#confirm').click();
    const raw=await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1'));assert.equal(JSON.parse(raw).phase,'response');assert.equal(Object.hasOwn(JSON.parse(raw),'reactions'),false);
    await context.setOffline(true);await page.reload();assert.equal(await page.locator('#game').getAttribute('data-phase'),'response');
    await page.locator('#hand button').first().click();await page.locator('#confirm').click();const end=await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1'));
    for(const file of ['reframe.html','boat.html','legacy.html']){await page.goto(base+file);assert.equal(await page.locator('#game').getAttribute('data-phase'),'ending');assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1')),end);}
    await page.locator('#confirm').click();assert.equal(await page.locator('#hand button').count(),3);
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),'preserved old scenarios');assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_cards_v1')),'preserved old cards');
    assert.deepEqual(errors,[]);await context.close();console.log(JSON.stringify({checks,flipPagesChecked:pages,offline:true,oldUrls:true,oldSavesPreserved:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
