'use strict';
const {chromium}=require(process.env.FERRY_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:process.env.FERRY_BROWSER_CHANNEL||'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await page.addInitScript(()=>{localStorage.setItem('du_ferry_cards_v1','original flower record');localStorage.setItem('du_ferry_audio_v2','off');});
    await page.goto((process.argv[2]||'http://127.0.0.1:8138/')+'?offline-test');
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cached=await page.evaluate(async()=>{const names=await caches.keys();return {names,files:(await (await caches.open(names.find(n=>n.endsWith('scenarios-v4')))).keys()).map(r=>new URL(r.url).pathname)};});
    assert.equal(cached.files.length,17);assert.ok(cached.files.some(f=>f.endsWith('scenario-seeds.js')));assert.ok(!cached.files.some(f=>f.includes('flower')));
    await page.locator('#hand button').last().click();await page.locator('#confirm').click();
    const title=await page.locator('#sceneTitle').textContent(),raw=await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1'));
    await context.setOffline(true);await page.reload();assert.equal(await page.locator('#sceneTitle').textContent(),title);
    await page.locator('#mirror').click();await page.locator('#confirm').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_scenarios_v1')),raw);
    await page.locator('#hand button').first().click();await page.locator('#confirm').click();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('du_ferry_scenarios_v1')).phase),'ending');
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_cards_v1')),'original flower record');assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_audio_v2')),'off');
    const endingTitle=await page.locator('#sceneTitle').textContent();
    await page.goto((process.argv[2]||'http://127.0.0.1:8138/')+'boat.html');assert.equal(await page.locator('#sceneTitle').textContent(),endingTitle);
    await page.locator('#confirm').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('du_ferry_scenarios_v1')).phase),'scene');
    console.log(JSON.stringify({offlineReload:true,offlinePlay:true,oldEntryRedirect:true,oldRecordsPreserved:true,cached:cached.files.length}));
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
