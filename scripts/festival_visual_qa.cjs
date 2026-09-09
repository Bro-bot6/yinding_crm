// Read-only browser assertions against the isolated local QA instance, never production.
const {chromium}=require('C:/Users/niko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1520,height:920}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8001/#/plans');
  await page.locator('[name=username]').fill('qa-personal');
  await page.locator('[name=password]').fill('Local-QA-only-2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL(url=>!url.pathname.includes('login'));
  await page.goto('http://127.0.0.1:8001/#/plans');
  await page.locator('.calendar-month-scroller').waitFor();
  const cell=page.locator('.calendar-cell[aria-label="选择2026-09-10"]');
  assert.equal(await cell.locator('.calendar-festival').innerText(),'教师节');
  const boxes=await cell.evaluate(el=>{
   const d=el.querySelector('.calendar-day').getBoundingClientRect(), f=el.querySelector('.calendar-festival').getBoundingClientRect();
   return {dayCenter:d.top+d.height/2,festivalCenter:f.top+f.height/2,dayRight:d.right,festivalLeft:f.left};
  });
  assert.ok(Math.abs(boxes.dayCenter-boxes.festivalCenter)<2);
  assert.ok(boxes.festivalLeft>=boxes.dayRight);
  assert.equal(await cell.locator('.calendar-event').count(),0);
  assert.equal(await page.locator('.calendar-cell[aria-label="选择2026-09-25"] .calendar-festival').innerText(),'中秋节');
  await cell.locator('.calendar-festival').click();
  assert.equal(await page.locator('.calendar-detail h2').innerText(),'2026-09-10');
  assert.equal(await page.locator('.calendar-detail form').count(),0);
  assert.equal(await page.locator('.calendar-detail-item').count(),0);
  for(const theme of ['极简商务','深色数据','清爽企业']){
   await page.getByTitle(theme,{exact:true}).click();await page.waitForTimeout(600);
   await page.screenshot({path:path.resolve('private-qa-personal/festivals-'+theme+'.png')});
  }
  await page.getByRole('button',{name:'周',exact:true}).click();
  assert.equal(await page.locator('.calendar-week .calendar-festival').innerText(),'教师节');
  await page.getByRole('button',{name:'月',exact:true}).click();
  for(let i=0;i<5;i++) await page.getByRole('button',{name:'下一期',exact:true}).click();
  assert.equal(await page.locator('.calendar-cell[aria-label="选择2027-02-06"] .calendar-festival').innerText(),'春节');
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:920});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.resolve('private-qa-personal/festivals-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: festival dates, aligned headers, distinct from events, three themes, week/month, next year, narrow layout; no page errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
