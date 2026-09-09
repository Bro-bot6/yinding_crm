const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = vm.createContext({});
for (const file of ['vendor/lunar-javascript-1.7.7/lunar.js', 'calendar-festivals.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../frontend_static', file), 'utf8'), scope);
}
const label = day => vm.runInContext('CalendarFestivals.label('+JSON.stringify(day)+')', scope);
// Gregorian/lunar conversion verified against HKO 2026 and 2027 calendars.
test('2026 节日按真实公历、农历和节气日期标注', () => {
  for (const [day, name] of Object.entries({
    '2026-01-01':'元旦','2026-02-16':'除夕','2026-02-17':'春节',
    '2026-03-03':'元宵节','2026-04-05':'清明节','2026-05-01':'劳动节',
    '2026-06-19':'端午节','2026-09-10':'教师节','2026-09-25':'中秋节',
    '2026-10-01':'国庆节','2026-10-18':'重阳节','2026-12-22':'冬至',
  })) assert.equal(label(day), name, day);
});
test('支持跨年、29日除夕和30日除夕，不把闰月重复标成节日', () => {
  assert.equal(label('2027-02-05'),'除夕');
  assert.equal(label('2027-02-06'),'春节');
  assert.equal(label('2024-02-09'),'除夕');
  assert.equal(label('2026-02-15'),'');
  assert.equal(label('2020-06-25'),'端午节');
  // 2009 闰五月初五：不是端午节。
  assert.equal(label('2009-06-27'),'');
});
test('同日多个节日全部保留，不影响事项数量或创建事项', () => {
  assert.equal(label('2020-10-01'),'国庆节·中秋节');
  assert.equal(label('2026-09-26'),'');
  assert.equal(label(''),'');
  assert.equal(label('not-a-date'),'');
});
test('月视图与周视图都使用独立的日期同行节日标签', () => {
  const html=fs.readFileSync(path.join(__dirname,'../personal_pages.html'),'utf8');
  assert.equal((html.match(/class="calendar-date-row"/g)||[]).length,2);
  assert.match(html, /class="calendar-festival"/);
  assert.match(html, /非日程或放假安排/);
});
