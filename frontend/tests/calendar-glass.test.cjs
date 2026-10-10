const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../..');
function preview() {
  let timer;
  const context = { Vue: { createApp: () => ({ mount() {} }), nextTick() {} },
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout: () => { timer = null; },
    document: { activeElement: null, addEventListener() {}, removeEventListener() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'frontend_static/app.js'), 'utf8'), context);
  const definition = context.createCalendarOverflow({});
  const emitted = [];
  const instance = { ...definition.data(), day: '2026-09-18', $el: { contains: () => false }, $refs: {}, $emit: (...args) => emitted.push(args) };
  for (const [name, method] of Object.entries(definition.methods)) instance[name] = method.bind(instance);
  return { instance, emitted, definition, context, timer: () => timer?.() };
}
test('更多事项 hover 只预览，点击再选中日期，连续点击不意外关窗', () => {
  const { instance: i, emitted } = preview();
  i.show(); assert.equal(i.open, true); assert.equal(emitted.length, 0);
  i.select(); i.select(); assert.equal(i.open, true);
  assert.equal(emitted[0].join(','), 'select,2026-09-18');
});
test('跨过浮层间隙不关闭，移出后关闭；键盘焦点在内部时不关闭', () => {
  const { instance: i, timer } = preview();
  i.show(); i.deferClose(); i.cancelClose(); timer(); assert.equal(i.open, true);
  i.deferClose(); timer(); assert.equal(i.open, false);
  i.show(); i.$el.contains = () => true; i.deferClose(); timer(); assert.equal(i.open, true);
});
test('预览完整事项保留原数据，编辑转交现有表单；完成取消状态正确', () => {
  const { instance: i, emitted } = preview();
  const event = { id: 5, title: '<长事项>', isCancelled: true, isCompleted: false };
  i.show(); i.edit(event); assert.equal(i.open, false); assert.equal(emitted[0][1], event);
  assert.equal(i.status(event), '已取消'); assert.equal(i.status({isCompleted:true}), '已完成'); assert.equal(i.status({}), '待完成');
});
test('预览卸载清除延迟任务及外部点击监听', () => {
  const { instance: i, definition, context, timer } = preview();
  let removed = false;
  context.document.removeEventListener = (name, callback) => { removed = name === 'pointerdown' && callback === i.outside; };
  definition.mounted.call(i); i.show(); i.deferClose(); definition.beforeUnmount.call(i); timer();
  assert.equal(removed, true); assert.equal(i.open, true);
});
test('月格限制两条，完整列表与同一行节日独立渲染；三主题共用模板', () => {
  const template = fs.readFileSync(path.join(root, 'frontend/personal_pages.html'), 'utf8');
  assert.match(template, /eventsOn\(day\)\.slice\(0,2\)/);
  assert.match(template, /<calendar-overflow v-if="eventsOn\(day\).length>2"/);
  assert.doesNotMatch(template, /v-(?:if|else-if)="theme/);
  assert.match(template, /calendar-date-row[\s\S]*?calendar-festival/);
});
test('时间轴依据所选日真实数据计数，已完成已取消不计入待办', () => {
  const context = { Intl, Date };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'frontend_static/personal.js'), 'utf8')+';this.work=PersonalWork;', context);
  const data = { calendarDate: '2026-09-18', calendarSelectedEvents: [{}, {isCompleted:true}, {isCancelled:true}, {}] };
  assert.equal(context.work.computed.calendarPendingCount.call(data), 2);
  assert.equal(context.work.computed.calendarSelectedLabel.call(data), '2026年9月18日');
  assert.equal(context.work.computed.calendarSelectedWeekday.call(data), '星期五');
});
test('编辑日程仅保留保存入口，操作区不再粘底或生成白色遮挡层', () => {
  const template = fs.readFileSync(path.join(root, 'frontend/personal_pages.html'), 'utf8');
  const actions = template.match(/<div class="calendar-editor-actions">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(actions, /保存日程/);
  assert.doesNotMatch(actions, /删除日程|calendar-delete|changeCalendarEvent/);
  const css = fs.readFileSync(path.join(root, 'frontend_static/personal.css'), 'utf8');
  const actionRule = css.match(/\.calendar-editor-actions\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(actionRule, /background:\s*transparent/);
  assert.doesNotMatch(actionRule, /position:\s*sticky|bottom:\s*-/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.calendar-editor-actions \.calendar-save\s*\{[^}]*width:\s*100%/);
});
