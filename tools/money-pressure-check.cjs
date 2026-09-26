'use strict';
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),C=require('../flow-core.js');
const base=process.argv[2]||'http://127.0.0.1:8138/',ids=C.scenarios.filter(c=>c.category==='money_pressure').map(c=>c.id);
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});let checks=0,pages=0;const errors=[];
  try{
    assert.equal(ids.length,20);assert.equal(new Set(ids.map(id=>C.caseFor({caseId:id}).reactions.map(r=>r.title).join('|'))).size,20);
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
      await page.locator('#menuOpen').click();assert.ok(await page.locator('#chapterChoice option').filter({hasText:'金錢壓力 · 20 則'}).count());await page.locator('#menuClose').click();
      for(const id of ids){
        await page.evaluate(({id,state})=>localStorage.setItem('du_ferry_flow_v1',JSON.stringify({...state,caseId:id,filter:'money_pressure',seen:[id]})),{id,state:C.snapshot(C.create())});await page.reload();
        assert.equal(await page.locator('#hand button').count(),3);await page.locator('#hand button').first().click();const raw=await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1'));await page.locator('#confirm').click();
        assert.equal(await page.locator('#stageLabel').textContent(),'② 看見抓緊 · 鬆一點');
        const read=await page.evaluate(()=>{let text='',count=0;do{const story=document.getElementById('storyText'),reader=document.getElementById('reader');if(story.scrollHeight>reader.clientHeight+1)throw Error('page clipped');text+=story.textContent;count++;if(document.getElementById('pageNext').disabled)break;document.getElementById('pageNext').click();if(count>100)throw Error('page loop');}while(true);return {text,count};});pages+=read.count;
        for(const phrase of ['剛才心裡冒出：','我很想：','我很怕：','非得立刻照我想的不可','還不能，也沒關係。'])assert.ok(read.text.includes(phrase),id+' missing '+phrase);
        assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1')),raw);checks++;
      }await context.close();
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,moneyPressurePagesChecked:pages,uniqueScripts:20,noClipping:true,noSavedReactions:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
