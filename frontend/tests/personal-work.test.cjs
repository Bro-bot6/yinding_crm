const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(extra = {}) {
  const sandbox = { Intl, Date, URLSearchParams, console, ...extra };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/personal.js'), 'utf8') + '\nthis.work = PersonalWork;', sandbox);
  const options = sandbox.work;
  const instance = { ...options.data(), customers: [], customerProjects: [], navItems: [], keyword: '', $refs: {}, $nextTick: async fn => fn?.(), ...extra.instance };
  for (const [name, method] of Object.entries(options.methods)) instance[name] = method.bind(instance);
  for (const [name, compute] of Object.entries(options.computed)) Object.defineProperty(instance, name, { get: () => compute.call(instance) });
  return { instance, options };
}

function project(id, grade, at, active = true) {
  return { id, name: '项目' + id, isActive: active, country: '', province: '河北省', city: '唐山市', progress: '需求对接',
    latestFollowupAt: at, customer: { id, name: '客户' + id, grade, source: '抖音', phone: 'wx:' + id } };
}

test('项目按等级再按真实跟进排序，无记录最后且顺序稳定', () => {
  const { instance: i } = setup();
  i.personalProjects = [project(3, 'B', '2026-09-07'), project(2, 'A', ''), project(1, 'A', '2026-08-01'), project(5, 'C', ''), project(4, 'C', '')];
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '1,2,3,4,5');
  i.personalSort = 'recent';
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '3,1,2,4,5');
});
test('进行中与已完成按真实项目状态切换且保留筛选排序', () => {
  const { instance: i } = setup();
  i.personalProjects = [project(1, 'A', ''), project(2, 'A', '', false), project(3, 'D', '', false)];
  i.personalFilters.grade = 'A'; i.personalSort = 'recent'; i.personalStatus = 'completed';
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '2');
  assert.equal(i.personalSort, 'recent');
});
test('保存高亮不覆盖等级和最近更新排序', () => {
  const { instance: i } = setup();
  i.personalProjects = [project(1, 'A', '2026-09-07'), project(2, 'C', '2026-08-01')];
  i.savedProjectId = 2;
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '1,2');
  i.personalFilters.grade = 'A';
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '1');
});
test('资料和项目更新也进入排序，同等级最近更新优先', () => {
  const { instance: i } = setup();
  i.personalProjects = [project(1, 'A', '2026-09-19'), project(2, 'B', ''), project(3, 'B', '2026-09-20')];
  i.personalProjects[1].latestActivityAt = '2026-09-21T10:00:00+08:00';
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '1,2,3');
  i.personalSort = 'recent';
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '2,3,1');
});
test('无跟进使用真实创建时间，非法或缺失时间排序保持稳定', () => {
  const { instance: i } = setup();
  i.personalSort = 'recent';
  i.personalProjects = [project(3, 'B', ''), project(2, 'B', ''), project(1, 'B', '')];
  i.personalProjects[0].createdAt = '2026-09-21';
  i.personalProjects[1].latestActivityAt = 'invalid';
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '3,1,2');
});
test('卡片主体点击打开对应项目，内部操作和选中文本不误触', async () => {
  let opens = 0;
  const selected = {text:''};
  const {instance:i} = setup({window:{getSelection:()=>({toString:()=>selected.text})}});
  const record = project(7,'B','');
  i.openPersonalProject = async p => { assert.equal(p.id,7); opens++; };
  await i.onPersonalProjectClick({target:{closest:()=>null}}, record);
  assert.equal(opens,1);
  await i.onPersonalProjectClick({target:{closest:()=>({tagName:'BUTTON'})}}, record);
  selected.text='选中客户描述';
  await i.onPersonalProjectClick({target:{closest:()=>null}}, record);
  assert.equal(opens,1);
});
test('进入我的客资刷新且请求禁用缓存，详情刷新后定位同客户的正确项目', async () => {
  let loads=0, opened;
  const {instance:i,options} = setup({fetch:async(url,opts)=>{
    assert.equal(url,'/api/my-projects/'); assert.equal(opts.cache,'no-store');
    return {ok:true,json:async()=>({projects:[project(7,'B','')],employees:[]})};
  }});
  await i.loadPersonalProjects(); assert.equal(i.personalProjects[0].id,7);
  i.loadPersonalProjects=()=>{loads++;};
  options.watch.activePage.call(i,'followups'); assert.equal(loads,1);
  i.customers=[{id:7,name:'旧名称'}];i.customerProjects=[{id:9,customer:{id:7}}];
  i.loadCustomers=async()=>{i.customers=[{id:7,name:'新名称'}];};
  i.openCustomerEdit=(customer,id)=>{opened={customer,id};};
  await i.openPersonalProject({id:9,customer:{id:7}});
  assert.equal(opened.customer.name,'新名称'); assert.equal(opened.id,9);
});
test('搜索联系方式并组合来源地区进度筛选', () => {
  const { instance: i } = setup();
  i.personalProjects = [project(1, 'B', ''), project(2, 'B', '')];
  i.personalSearch = 'wx:2';
  Object.assign(i.personalFilters, { source: '抖音', province: '河北省', city: '唐山市', progress: '需求对接' });
  assert.equal(i.visiblePersonalProjects.map(p => p.id).join(','), '2');
  i.personalFilters.city = '无匹配'; assert.equal(i.visiblePersonalProjects.length, 0);
  i.resetPersonalFilters(); assert.equal(i.visiblePersonalProjects.length, 2);
});
test('月份包含42格、周一开始、正确跨年及闰年', () => {
  const { instance: i } = setup();
  i.calendarDate = '2028-02-29';
  assert.equal(i.calendarDays.length, 42);
  assert.equal(i.calendarDays[0], '2028-01-31');
  assert.ok(i.calendarDays.includes('2028-02-29'));
  i.calendarDate = '2027-01-01'; i.calendarView = 'week';
  assert.equal(i.calendarDays.join(','), '2026-12-28,2026-12-29,2026-12-30,2026-12-31,2027-01-01,2027-01-02,2027-01-03');
});
test('前后翻月不受31日溢出影响', async () => {
  const { instance: i } = setup(); i.calendarDate = '2026-01-31'; i.calendarFocusMonth = '2026-01';
  await i.moveCalendar(1); assert.equal(i.calendarDate, '2026-02-01');
  await i.moveCalendar(-1); assert.equal(i.calendarDate, '2026-01-01');
});

test('连续月份覆盖跨年和闰日，日期不重复且不改变选中日', () => {
  const { instance: i } = setup();
  i.calendarDate = '2027-12-18'; i.calendarWindowMonth = '2028-02'; i.calendarFocusMonth = '2028-03';
  assert.equal(i.calendarMonths.map(m => m.key).join(','), '2027-12,2028-01,2028-02,2028-03,2028-04');
  const days = i.calendarMonths.flatMap(m => m.cells).filter(Boolean);
  assert.equal(days.length, new Set(days).size); assert.ok(days.includes('2028-02-29'));
  assert.equal(i.calendarTitle, '2028年3月'); assert.equal(i.calendarDate, '2027-12-18');
});

test('点击日期格后，新建日程默认使用选中日期', async () => {
  const { instance: i } = setup();
  await i.selectCalendarDate('2026-11-18'); await i.editCalendarEvent();
  assert.equal(i.calendarEditor.plannedDate, '2026-11-18');
});

test('确认删除编辑中的日程后关闭编辑面板并刷新', async () => {
  let method, loaded = false;
  const { instance: i } = setup({ fetch: async (_, opts) => { method = opts.method; return {ok:true,json:async()=>({})}; },
    instance: {requestActionConfirm:async()=>true,csrfToken:()=>'',showToast(){} } });
  i.loadCalendar = async () => { loaded = true; };
  i.calendarEditor = {id:8,plannedDate:'2026-09-07'};
  await i.changeCalendarEvent(i.calendarEditor, 'delete');
  assert.equal(method, 'DELETE'); assert.equal(i.calendarEditor, null); assert.equal(loaded,true);
});

test('滚动按可见面积同步月份标题，不修改已选日期', async () => {
  let frame;
  const {instance:i}=setup({requestAnimationFrame:fn=>{frame=fn;return 1;}});
  i.calendarDate='2026-09-07';i.calendarWindowMonth='2026-09';
  const block=(month,top,bottom)=>({dataset:{calendarMonth:month},getBoundingClientRect:()=>({top,bottom})});
  i.$refs.calendarScroller={getBoundingClientRect:()=>({top:0,bottom:500}),querySelectorAll:()=>[block('2026-09',-400,100),block('2026-10',100,700)]};
  i.onCalendarScroll(); await frame();
  assert.equal(i.calendarFocusMonth,'2026-10'); assert.equal(i.calendarDate,'2026-09-07');
});
test('全天先于定时日程；日程视图只显示所选月份', () => {
  const { instance: i } = setup(); i.calendarDate = '2026-09-07';
  i.calendarItems = [
    {id:1,plannedDate:'2026-09-07',plannedTime:'15:00'},
    {id:2,plannedDate:'2026-09-07',plannedTime:''},
    {id:3,plannedDate:'2026-09-07',plannedTime:'09:00'},
    {id:4,plannedDate:'2026-10-01',plannedTime:''},
  ];
  assert.equal(i.calendarSelectedEvents.map(e => e.id).join(','), '2,3,1');
  assert.equal(i.calendarAgenda.length, 3);
});
test('编辑日程未保存时取消离开，保留草稿与日期', async () => {
  const { instance: i } = setup({ instance: { requestActionConfirm: async () => false } });
  i.calendarDate = '2026-09-07'; i.calendarEditor = {title:'未保存'}; i.calendarSnapshot = '';
  await i.selectCalendarDate('2026-09-08');
  assert.equal(i.calendarDate, '2026-09-07');
  assert.equal(i.calendarEditor.title, '未保存');
});
test('我的客资角标按客户去重，日历角标仍显示今天待办', () => {
  const { instance: i } = setup();
  i.navItems = [{id:'followups'},{id:'plans'}]; i.personalOwnCount = 4; i.personalOwnCustomerCount = 3; i.calendarTodayCount = 2;
  i.syncPersonalBadges();
  assert.equal(i.navItems[0].badge, '3'); assert.equal(i.navItems[1].badge, '2项');
});
test('描述可原地展开并收起', () => {
  const { instance: i } = setup(); i.toggleDescription(1);
  assert.equal(i.expandedDescriptions[1], true); i.toggleDescription(1); assert.equal(i.expandedDescriptions[1], false);
});
test('我的客资卡片直接复用全部客资的正常卡片样式', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../frontend/personal_pages.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../../frontend_static/personal.css'), 'utf8');
  for (const name of ['record-topline', 'record-identity', 'record-location', 'record-source', 'record-progress', 'record-owner', 'record-more', 'description-field', 'plan-field']) {
    assert.match(html, new RegExp(`class="[^"]*${name}`));
  }
  assert.match(html, /record-location-values/);
  assert.match(html, /grade-block-/);
  assert.doesNotMatch(html, /personal-project-field/);
  assert.doesNotMatch(css, /\.personal-project-field\s*\{/);
});
test('我的客资客户名称和联系方式均可点击复制', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../frontend/personal_pages.html'), 'utf8');
  assert.match(html, /copyCustomerField\(project\.customer\.name, '客户名称'\)/);
  assert.match(html, /copyCustomerField\(project\.customer\.phone, '联系方式'\)/);
  assert.equal((html.match(/class="record-copy record-copy-(?:name|phone)"/g) || []).length, 2);
});
test('疑似重复需确认，取消后不继续保存', async () => {
  let question;
  const { instance: i } = setup({
    fetch: async () => ({ok:true,json:async()=>({matches:[{row:1,name:'甲',existing:[{id:2,name:'甲',phone:'wx:1'}],batchRows:[]}]})}),
    instance: { csrfToken:()=>'', requestActionConfirm:async q => {question=q;return false;}, showToast(){} },
  });
  assert.equal(await i.confirmCustomerDuplicates([{name:'甲'}]), false);
  assert.match(question.message, /编号2/); assert.equal(question.confirmLabel, '仍然保存');
});
test('重复检查失败不继续保存，用户可重试', async () => {
  const messages = [];
  const { instance: i } = setup({ fetch: async () => {throw Error('断网');}, instance:{csrfToken:()=>'',showToast:m=>messages.push(m)} });
  assert.equal(await i.confirmCustomerDuplicates([{name:'甲'}]), false);
  assert.match(messages[0], /重试/);
});
test('提醒按用户、事项、改期时间去重，不请求系统通知权限', () => {
  const shown = new Set(), messages = [];
  const { instance: i } = setup({ document:{visibilityState:'visible'}, localStorage:{getItem:k=>shown.has(k),setItem:k=>shown.add(k)}, instance:{showToast:m=>messages.push(m)} });
  i.calendarUserId = 1; i.calendarReminderQueue = [{id:1,title:'测试',plannedDate:'2026-09-07',plannedTime:'10:00',reminderMinutes:0}];
  i.showNextCalendarReminder(); i.showNextCalendarReminder(); assert.equal(messages.length, 1);
  i.calendarReminderQueue[0].plannedTime='11:00'; i.showNextCalendarReminder(); assert.equal(messages.length, 2);
});
