'use strict';
// Optional browser regression: set FERRY_PLAYWRIGHT_PATH to an installed Playwright package.
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const C=require('../light-core.js');
const url=process.argv[2]||'http://127.0.0.1:8138/';
(async()=>{
  const browser=await chromium.launch({channel:process.env.FERRY_BROWSER_CHANNEL||'msedge',headless:true});
  let checked=0;const errors=[];
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForFunction(()=>window.FerryLightCore);
    async function inspect(label){
      await page.waitForTimeout(70);
      const m=await page.evaluate(()=>{
        const reader=document.getElementById('reader'),text=document.getElementById('storyText'),confirm=document.getElementById('confirm'),stage=document.querySelector('.stage'),hand=document.getElementById('choicesArea');
        const r=reader.getBoundingClientRect(),c=confirm.getBoundingClientRect(),s=stage.getBoundingClientRect(),h=hand.getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,bodyWidth:document.documentElement.scrollWidth,bodyHeight:document.documentElement.scrollHeight,reader:r.height,line:parseFloat(getComputedStyle(text).lineHeight),text:text.scrollHeight,available:reader.clientHeight,confirmTop:c.top,confirmBottom:c.bottom,confirmRight:c.right,stageBottom:s.bottom,handTop:h.top,handVisible:!hand.hidden};
      });
      assert.ok(m.bodyWidth<=m.width+1,label+' horizontal '+JSON.stringify(m));assert.ok(m.bodyHeight<=m.height+1,label+' vertical '+JSON.stringify(m));
      assert.ok(m.reader>=m.line-1,label+' no readable line '+JSON.stringify(m));assert.ok(m.text<=m.available+1,label+' clipped text '+JSON.stringify(m));
      assert.ok(m.confirmTop>=0&&m.confirmBottom<=m.height+1&&m.confirmRight<=m.width+1,label+' confirm outside '+JSON.stringify(m));
      if(m.width<m.height){assert.ok(m.stageBottom<=m.confirmTop,label+' overlap');if(m.handVisible)assert.ok(m.stageBottom<=m.handTop+1,label+' cards overlap');}
      checked++;
    }
    const sizes=[[320,568,100],[360,640,100],[390,844,100],[430,932,100],[768,1024,100],[844,390,100],[390,844,150],[390,844,200]];
    for(const [width,height,font]of sizes){
      await page.setViewportSize({width,height});
      for(const id of C.ids){
        for(const phase of ['scene','response','ending']){
          let state=C.create(id,false);if(phase!=='scene')state=C.transition(state,{type:'choose',id:'a1'});if(phase==='ending')state=C.transition(state,{type:'choose',id:'r1'});
          await page.evaluate(s=>localStorage.setItem('du_ferry_light_v1',JSON.stringify(s)),state);await page.reload();
          await page.evaluate(n=>document.documentElement.style.fontSize=n+'%',font);await page.evaluate(()=>dispatchEvent(new Event('resize')));
          await inspect([width,height,font,id,phase].join('/'));
          if(phase==='scene'){
            await page.locator('#hand button').first().click();await inspect(id+'/preview');
            await page.locator('#mirror').click();await inspect(id+'/mirror');await page.locator('#confirm').click();
            await page.locator('#timeLens').click();await inspect(id+'/time');await page.locator('#confirm').click();
            assert.equal(await page.locator('#confirm').isEnabled(),true);
          }
        }
      }
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>localStorage.removeItem('du_ferry_light_v1'));await page.reload();await inspect('prologue');
    const screenshot=path.join(os.tmpdir(),'ferry-light-preview-390.png');await page.screenshot({path:screenshot});
    await page.locator('#confirm').click();await page.locator('#hand button').first().click();await page.locator('#confirm').click();await page.locator('#hand button').last().click();await page.locator('#confirm').click();await page.locator('#rest').click();await inspect('rest');
    await page.locator('#menuOpen').click();assert.equal(await page.locator('#menu').isVisible(),true);await page.locator('#menuClose').click();
    assert.deepEqual(errors,[]);console.log(JSON.stringify({checked,errors,screenshot}));
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
