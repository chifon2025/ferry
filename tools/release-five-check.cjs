'use strict';
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),C=require('../flow-core.js');
const base=process.argv[2]||'http://127.0.0.1:8138/',ids=['s041','s003','s201','s096','s131'],vivid={s041:'想頂回去',s003:'怕催了會被嫌煩',s201:'又滑回對話框',s096:'憑什麼又是我',s131:'又不甘心像是自己全錯'};
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0,pages=0;const errors=[];
  try{
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
      for(const id of ids){
        await page.evaluate(({id,state})=>localStorage.setItem('du_ferry_flow_v1',JSON.stringify({...state,caseId:id,seen:[id]})),{id,state:C.snapshot(C.create())});await page.reload();
        for(const b of await page.locator('#hand button').all())await b.click();const raw=await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1'));await page.locator('#confirm').click();
        assert.equal(await page.locator('#stageLabel').textContent(),'② 先停一下 · 鬆一點');assert.equal(await page.locator('#confirm').textContent(),'帶著感覺，看看下一步');
        const read=await page.evaluate(()=>{let text='',count=0;do{const story=document.getElementById('storyText'),reader=document.getElementById('reader');if(story.scrollHeight>reader.clientHeight+1)throw Error('page clipped');text+=story.textContent;count++;if(document.getElementById('pageNext').disabled)break;document.getElementById('pageNext').click();if(count>100)throw Error('page loop');}while(true);return {text,count};});pages+=read.count;
        for(const phrase of ['剛才心裡冒出：','你可能只是很想：','「我可以先不抓這麼緊嗎？」','還不能，也沒關係。',vivid[id]])assert.ok(read.text.includes(phrase),id+' missing '+phrase);
        assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1')),raw);await page.locator('#backStory').click();assert.equal(await page.locator('#hand button[aria-pressed=true]').count(),3);await page.locator('#confirm').click();await page.locator('#confirm').click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'response');checks++;
      }await context.close();
    }
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();await page.goto(base+'?offline-test');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.evaluate(({id,state})=>localStorage.setItem('du_ferry_flow_v1',JSON.stringify({...state,caseId:id,seen:[id]})),{id:ids[0],state:C.snapshot(C.create())});await page.reload();await context.setOffline(true);for(const b of await page.locator('#hand button').all())await b.click();await page.locator('#confirm').click();assert.match(await page.locator('#storyText').textContent(),/剛才心裡冒出/);assert.equal(await page.evaluate(()=>Object.hasOwn(JSON.parse(localStorage.getItem('du_ferry_flow_v1')),'reactions')),false);await context.close();assert.deepEqual(errors,[]);
    console.log(JSON.stringify({checks,releasePagesChecked:pages,offline:true,noSavedReactions:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
