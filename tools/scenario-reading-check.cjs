'use strict';
// Exhaust all openings with the real controller and measured small-phone pagination.
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:320,height:568}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv[2]||'http://127.0.0.1:8138/');
    await page.waitForFunction(()=>!!window.FerryScenarioCore);
    const result=await page.evaluate(()=>{
      let checked=0,maxPages=0;
      for(const item of FerryScenarioCore.scenarios){
        localStorage.setItem('du_ferry_scenarios_v1',JSON.stringify({v:1,caseId:item.id,filter:'all',phase:'scene',action:null,reply:null,seen:[item.id]}));
        document.getElementById('loadLatest').click();
        let full='',n=0;
        do{
          const reader=document.getElementById('reader'),text=document.getElementById('storyText');
          if(text.scrollHeight>reader.clientHeight+1)throw Error('Clipped '+item.id);
          full+=text.textContent;n++;
          const next=document.getElementById('pageNext');if(next.disabled)break;
          next.click();if(n>100)throw Error('Pagination loop');
        }while(true);
        if(full!==item.event.text)throw Error('Text mismatch '+item.id);
        const rect=document.getElementById('confirm').getBoundingClientRect();
        if(rect.top<0||rect.bottom>innerHeight+1)throw Error('Confirm outside '+item.id);
        maxPages=Math.max(maxPages,n);checked++;
      }
      return {allOpeningsChecked:checked,width:innerWidth,height:innerHeight,maxPages};
    });
    assert.equal(result.allOpeningsChecked,520);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({...result,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
