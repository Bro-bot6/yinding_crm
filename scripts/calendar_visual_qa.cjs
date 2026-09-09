// Run only against the disposable loopback QA database prepared by personal_qa.py.
const {chromium}=require('C:/Users/niko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1520,height:920}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8001/#/plans');
  if(await page.locator('[name=username]').count()){
   await page.locator('[name=username]').fill('qa-personal');
   await page.locator('[name=password]').fill('Local-QA-only-2026');
   await page.locator('button[type=submit]').click();
   await page.waitForURL(url=>!url.pathname.includes('login'));
  }
  await page.goto('http://127.0.0.1:8001/#/plans');
  const scroller=page.locator('.calendar-month-scroller');
  await scroller.waitFor();
  await page.waitForTimeout(500);
  console.log('initial',await scroller.evaluate(el=>({top:el.scrollTop,height:el.clientHeight,scroll:el.scrollHeight,months:el.querySelectorAll('[data-calendar-month]').length,css:getComputedStyle(el).height,overflow:getComputedStyle(el).overflowY,supports:CSS.supports('height','100dvh'),sheets:[...document.styleSheets].map(s=>s.href)})),errors);
  await page.screenshot({path:path.resolve('private-qa-personal/calendar-initial.png'),fullPage:false});
  await page.waitForFunction(()=>document.querySelector('.calendar-month-scroller')?.scrollTop>100);
  await page.screenshot({path:path.resolve('private-qa-personal/calendar-month.png'),fullPage:true});
  const initial=await page.locator('.calendar-period h2').innerText();
  const selected=await page.locator('.calendar-detail h2').innerText();
  // Scroll well past the initial month, then beyond both ends of the rolling window.
  for(const direction of [1,1,1,1,-1,-1,-1,-1,-1,-1]){
   await scroller.evaluate((el,d)=>{el.scrollTop+=d*620},direction);
   await page.waitForTimeout(150);
  }
  const afterScroll=await page.locator('.calendar-period h2').innerText();
  assert.notEqual(afterScroll,initial);
  assert.equal(await page.locator('.calendar-detail h2').innerText(),selected);
  await page.getByRole('button',{name:'今天',exact:true}).click();
  await page.waitForFunction((initial)=>document.querySelector('.calendar-period h2')?.textContent===initial,initial);
  // Choose a blank area in a date cell, not only its day-number button.
  const dayKey=await page.locator('.calendar-cell.selected').getAttribute('aria-label');
  const month=dayKey.slice(2,9);
  const target=month+'-18';
  await page.locator('.calendar-cell[aria-label="选择'+target+'"]').click({position:{x:70,y:75}});
  assert.equal(await page.locator('.calendar-detail h2').innerText(),target);
  await page.getByRole('button',{name:'＋ 新建日程',exact:true}).click();
  // Visible date picker formats Chinese text; inspect field value rather than internal state.
  assert.match(await page.locator('.calendar-time-row').innerText(),/日期/);
  const title='隔离日历删除验证-'+Date.now();
  await page.locator('.calendar-detail input[maxlength="160"]').fill(title);
  await page.getByRole('button',{name:'保存日程',exact:true}).click();
  await page.locator('.calendar-detail-item').filter({hasText:title}).waitFor();
  assert.equal(await page.locator('.calendar-detail h2').innerText(),target);
  await page.locator('.calendar-detail-item').filter({hasText:title}).getByRole('button',{name:'编辑',exact:true}).click();
  await page.screenshot({path:path.resolve('private-qa-personal/calendar-editor.png'),fullPage:true});
  await page.getByRole('button',{name:'删除日程',exact:true}).click();
  await page.getByRole('button',{name:'确认删除',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.calendar-detail form'));
  assert.equal(await page.locator('.calendar-detail-item').filter({hasText:title}).count(),0);
  for(const width of [1280,760,390]){
   await page.setViewportSize({width,height:920});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow at '+width);
   await page.screenshot({path:path.resolve('private-qa-personal/calendar-'+width+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:1520,height:920});
  await page.evaluate(()=>window.scrollTo(0,0));
  for(let theme=0;theme<3;theme++){
   await page.locator('.theme-picker button').nth(theme).click();
   await page.waitForTimeout(600);
   await page.screenshot({path:path.resolve('private-qa-personal/calendar-theme-'+theme+'.png'),fullPage:false});
  }
  const project=await page.evaluate(async()=>{
   const data=await (await fetch('/api/my-projects/')).json();
   return data.projects.find(p=>p.customer.name==='隔离测试客户A');
  });
  assert.ok(project,'only use isolated QA project');
  await page.goto('http://127.0.0.1:8001/#/customers?customerId='+project.customer.id+'&projectId='+project.id);
  await page.waitForTimeout(1000);
  if(!await page.getByRole('button',{name:'▦ 方案测算',exact:true}).count()) await page.locator('#customer-record-'+project.customer.id).getByTitle('编辑客资').click();
  await page.screenshot({path:path.resolve('private-qa-personal/scheme-entry.png'),fullPage:false});
  await page.locator('.scheme-plan-heading button').click();
  await page.locator('.scheme-layer-selector').getByRole('button',{name:'2 层',exact:true}).click();
  for(let index=0;index<2;index++){
   const card=page.locator('.scheme-layer-card').nth(index);
   for(const [label,value] of [['长度（m）','1.2'],['宽度（m）','1'],['厚度（m）','1'],['掺量（%）','100'],['密度（t/m³）','1'],['单价（元/吨）',index?'700':'500']]){
    await card.locator('label').filter({hasText:label}).locator('input').fill(value);
   }
  }
  const total=page.locator('.scheme-total');
  assert.match(await total.innerText(),/2.400/);
  assert.match(await total.innerText(),/3 吨/);
  assert.match(await total.innerText(),/1,440.00/);
  await total.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.resolve('private-qa-personal/scheme-total.png'),fullPage:false});
  const saved=page.waitForResponse(r=>r.url().includes('/scheme-calculation/')&&r.request().method()==='PUT');
  await page.getByRole('button',{name:'保存测算',exact:true}).click();
  const savedData=await (await saved).json();
  assert.equal(savedData.calculation.totalQuantity,3);
  assert.equal(savedData.calculation.totalPrice,1440);
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载Excel',exact:true}).click();
  await (await download).saveAs(path.resolve('private-qa-personal/scheme-qa.xlsx'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,initial,afterScroll,selectedDate:target,errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
