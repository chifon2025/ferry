'use strict';
// Real mobile emulation plus controlled browser-chrome/keyboard viewport changes.
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),C=require('../scenario-core.js');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0;
  try{
    for(const visual of [null,620,500]){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3});
      if(visual)await context.addInitScript(height=>{
        const v=new EventTarget();Object.assign(v,{height,width:390,scale:1,offsetTop:0});
        Object.defineProperty(window,'visualViewport',{value:v,configurable:true});window.testViewport=v;
      },visual);
      const page=await context.newPage();await page.goto('http://127.0.0.1:8138/');
      async function inspect(label){
        await page.waitForTimeout(80);
        const m=await page.evaluate(()=>{
          const visible=Math.min(innerHeight,visualViewport?.height||innerHeight),ids=['pagePrev','pageNext','mirror','timeLens','confirm','replay','rest'];
          const rows=ids.map(id=>{const e=document.getElementById(id);if(!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {id,top:r.top,bottom:r.bottom,height:r.height};}).filter(Boolean);
          for(const e of document.querySelectorAll('#hand button')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();rows.push({id:'choice',top:r.top,bottom:r.bottom,height:r.height});}
          const reader=document.getElementById('reader'),story=document.getElementById('storyText');
          return {visible,game:document.getElementById('game').getBoundingClientRect().height,rows,reader:reader.clientHeight,text:story.scrollHeight,line:parseFloat(getComputedStyle(story).lineHeight)};
        });
        for(const row of m.rows)assert.ok(row.top>=0&&row.bottom<=m.visible+1,label+' bottom row outside visible screen '+JSON.stringify(m));
        assert.ok(m.reader>=m.line-1&&m.text<=m.reader+1,label+' story clipped '+JSON.stringify(m));checks++;
      }
      await inspect('random/'+visual);
      for(const id of ['s001','s257','s499']){
        await page.evaluate(s=>localStorage.setItem('du_ferry_scenarios_v1',JSON.stringify(s)),({...C.create(),caseId:id,seen:[id]}));await page.reload();await inspect(id+'/'+visual);
        await page.locator('#hand button').last().click();await inspect('selected/'+visual);
        await page.locator('#mirror').click();await inspect('mirror/'+visual);await page.locator('#confirm').click();
        await page.locator('#confirm').click();await inspect('response/'+visual);
        await page.locator('#hand button').first().click();await page.locator('#confirm').click();await inspect('ending/'+visual);
        if(visual){
          const raw=await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1'));
          await page.evaluate(()=>{testViewport.height=460;testViewport.dispatchEvent(new Event('resize'));});await inspect('toolbar grew');
          await page.evaluate(()=>{testViewport.height=700;testViewport.dispatchEvent(new Event('resize'));});await inspect('toolbar shrank');
          const oldHeight=await page.locator('#game').evaluate(e=>e.getBoundingClientRect().height);
          await page.evaluate(()=>{testViewport.scale=2;testViewport.height=350;testViewport.dispatchEvent(new Event('resize'));});await page.waitForTimeout(80);
          assert.equal(await page.locator('#game').evaluate(e=>e.getBoundingClientRect().height),oldHeight,'pinch zoom must not shrink the app');
          assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),raw);
          await page.evaluate(h=>{testViewport.scale=1;testViewport.height=h;testViewport.dispatchEvent(new Event('resize'));},visual);
        }
      }
      await context.close();
    }
    console.log(JSON.stringify({checks,mobileEmulation:true,visualViewportChanges:true,pinchZoomPreserved:true}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
