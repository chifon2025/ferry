'use strict';
// Isolated loopback server reproduces an installed 500 original scenarios -> unified reframing update.
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline='5cbf1f7c01ba1d123b51821851c191daf0c34347';
const oldFiles=new Map(['index.html','sw.js','manifest.webmanifest','reframe.html','reframe-core.js','reframe.js'].map(file=>[file,execFileSync('git',['show',baseline+':'+file],{cwd:root})]));
let upgrade=false;
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',target=path.resolve(root,name);
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const body=!upgrade&&oldFiles.has(name)?oldFiles.get(name):fs.readFileSync(target);res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.webmanifest')?'application/manifest+json':'text/html','Cache-Control':'no-store'});res.end(body);}catch(_){res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/?offline-test';
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    assert.ok(await page.evaluate(async()=>(await caches.keys()).some(k=>k.endsWith('scenarios-v4'))));
    await page.locator('#hand button').first().click();await page.locator('#confirm').click();
    const oldRaw=await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1'));assert.ok(oldRaw);
    await page.goto(new URL('reframe.html?offline-test',url).href);
    await page.locator('#hand button').first().click();await page.locator('#confirm').click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'flip');
    upgrade=true;await page.locator('#menuOpen').click();await page.locator('#btnUpdate').click();
    await page.waitForFunction(()=>window.FerryFlowCore?.scenarios.length===500,{},{timeout:30000});
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),oldRaw);
    const keys=await page.evaluate(()=>caches.keys());assert.equal(keys.length,1);assert.ok(keys[0].endsWith('scenarios-v8'));
    await context.setOffline(true);await page.reload();
    assert.equal(await page.locator('#game').getAttribute('data-phase'),'response');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('du_ferry_flow_v1')).legacy.phase),'response');
    await page.locator('#hand button').first().click();await page.locator('#confirm').click();await page.locator('#confirm').click();
    await page.locator('#hand button').first().click();await page.locator('#hand button').last().click();assert.equal(await page.locator('#hand button[aria-pressed=true]').count(),2);
    await page.locator('#confirm').click();assert.equal(await page.locator('#game').getAttribute('data-phase'),'flip');
    await page.goto(url);assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),oldRaw);
    assert.ok(await page.evaluate(()=>FerryScenarioCore.valid(JSON.parse(localStorage.getItem('du_ferry_scenarios_v1')))));
    const newSave=await page.evaluate(()=>localStorage.getItem('du_ferry_flow_v1'));assert.equal(Object.hasOwn(JSON.parse(newSave),'reactions'),false);
    await page.reload();assert.equal(await page.locator('#hand button').count(),3);assert.equal(await page.locator('#hand button[aria-pressed=true]').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),oldRaw);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({installedUnifiedFlowUpdated:true,offlineMultiSelect:true,oldRoundCompleted:true,oldRecordPreserved:true,obsoleteCacheRemoved:true,errors}));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
