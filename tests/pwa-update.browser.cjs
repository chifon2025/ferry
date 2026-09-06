// Run with Playwright available in NODE_PATH. Uses a temporary browser profile
// and an in-memory versioned server; never changes production/player storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.join(__dirname, '..');
const baseline = '6d412b1';
let release = 'old', breakDownload = false;
const oldFiles = new Map();
const mime = {'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.webmanifest':'application/manifest+json', '.png':'image/png'};
const server = http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (file.includes('..')) {res.writeHead(403);res.end();return;}
  try {
    if (breakDownload && file === 'practice-data.js') {res.writeHead(503);res.end();return;}
    let data;
    if (release === 'old') {
      if (!oldFiles.has(file)) oldFiles.set(file, execFileSync('git', ['show', `${baseline}:${file}`], {cwd:root,stdio:['ignore','pipe','ignore']}));
      data = oldFiles.get(file);
    } else {
      data = fs.readFileSync(path.join(root, file));
      if (file === 'sw.js') data = Buffer.from(data.toString().replace('daily-v4', `daily-${release}`));
    }
    res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  } catch (_) {res.writeHead(404);res.end();}
});
const save = page => page.evaluate(() => localStorage.getItem('du_ferry_save_v1'));
const waitVersion = (page, version) => page.waitForFunction(async v => (await caches.keys()).some(k=>k.endsWith(v)), version);
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const context = await browser.newContext({viewport:{width:390,height:844}});
    const page = await context.newPage();
    const errors=[];page.on('pageerror', e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?offline-test=1`);
    await page.waitForFunction(()=>navigator.serviceWorker.controller);
    await page.locator('[data-do="start"]').click();
    await page.locator('[data-do="next"]').click();
    const original = await save(page);
    await page.evaluate(()=>localStorage.setItem('du_ferry_sound','off'));
    release='v4';
    await page.evaluate(async()=> (await navigator.serviceWorker.getRegistration()).update());
    await page.locator('#btnUpdate').waitFor({state:'attached'});
    assert.equal(await save(page), original);
    assert.equal(await page.evaluate(()=>localStorage.getItem('du_ferry_sound')), 'off');
    console.log('PASS legacy v3 upgrades without closing other tabs; saved story and audio preference survive');

    await page.locator('[data-do="resume"]').click();
    const phaseTitle=await page.locator('#practiceTitle').innerText();
    release='v5';
    await Promise.all([
      page.waitForEvent('framenavigated', {predicate:frame=>frame===page.mainFrame()}),
      page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
    ]);
    await waitVersion(page,'daily-v5');
    await page.waitForFunction(title=>document.querySelector('#practiceTitle')?.textContent===title, phaseTitle);
    await page.waitForLoadState('load');
    assert.equal(await save(page),original);
    console.log('PASS foreground check applies next release and resumes saved story phase');

    await context.setOffline(true);
    await page.reload();
    await page.locator('[data-do="resume"]').click();
    assert.equal(await page.locator('#practiceTitle').innerText(),phaseTitle);
    await context.setOffline(false);
    console.log('PASS upgraded app reloads and resumes offline');

    await page.locator('[data-do="next"]').click();
    await page.locator('[data-do^="choose:"]').first().click();
    await page.locator('[data-do="next"]').click();
    await page.locator('[data-do="next"]').click();
    await page.locator('[data-do="carry:open"]').click();
    await page.locator('#lifeStep').fill('測試保留的生活提醒');
    const beforeFormUpdate = await save(page);
    release='v6';
    await page.locator('#btnMenu').click();
    await page.locator('#btnUpdate').click();
    await page.locator('#updateNotice').waitFor();
    assert.equal(await save(page),beforeFormUpdate);
    assert.equal(await page.locator('#lifeStep').inputValue(),'測試保留的生活提醒');
    await page.locator('#functionClose').click();
    await page.locator('[data-do="finish:keep"]').click();
    const completed = await save(page);
    await page.locator('#updateNotice button').click();
    await page.waitForFunction(()=>!document.getElementById('updateNotice'));
    assert.equal(await save(page),completed);
    console.log('PASS update waits for form completion and preserves typed invitation');

    release='v7';breakDownload=true;
    await page.locator('#btnMenu').click();
    await page.locator('#btnUpdate').click();
    await page.waitForFunction(()=>document.getElementById('updateStatus').textContent.includes('新版下載未完成'));
    assert.equal(await save(page),completed);
    await context.setOffline(true);
    await page.reload();
    await page.locator('#practiceTitle').waitFor();
    assert.equal(await save(page),completed);
    assert.deepEqual(errors,[]);
    console.log('PASS incomplete download retains working offline version and saves; no page errors');
    await context.close();
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
