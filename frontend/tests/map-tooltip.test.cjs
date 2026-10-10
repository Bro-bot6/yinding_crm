const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

let app
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), {
  Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
})

function context(mapView = 'customers') {
  return { mapView, escapeMapTooltip: app.methods.escapeMapTooltip, mapTooltipCount: app.methods.mapTooltipCount }
}

test('地图提示卡使用实色背景，并为图表外壳提供独立兜底', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../frontend_static/style.css'), 'utf8')
  const rules = css.slice(css.indexOf('.regional-map-tooltip {'), css.indexOf('@media (prefers-reduced-motion'))
  assert.match(rules, /background: var\(--card, #fff\)/)
  assert.doesNotMatch(rules, /color-mix|backdrop-filter/)
  const render = app.methods.renderMap.toString()
  assert.match(render, /backgroundColor: card \|\| '#fff'/)
})

test('中国地图用独立底层描绘国家外沿，省界保持细线', () => {
  const render = app.methods.renderMap.toString()
  assert.match(render, /--map-outline/)
  assert.match(render, /geo: \{ id: 'china-outline'[\s\S]*borderColor: mapOutline[\s\S]*series: \[\{ id: 'china-data'/)
  assert.match(render, /seriesIndex: 0/)
  assert.match(render, /china-data'[\s\S]*borderColor: card, borderWidth: 1\.2/)
  assert.match(render, /this\.mapChart\.on\('georoam'/)
})

test('客资地图提示卡区分总数、ABC等级与签约客户', () => {
  const html = app.methods.mapTooltipFormatter.call(context(), {
    name: '内蒙古自治区', value: 3,
    data: { customerCount: 3, hasCustomerCount: true, grades: { A: 0, B: 0, C: 3 }, signedCount: 0 },
  })
  assert.match(html, /内蒙古自治区/)
  assert.match(html, /<b>3<\/b><span>条客资<\/span>/)
  assert.match(html, /grade-a[\s\S]*A级[\s\S]*<b>0<\/b>/)
  assert.match(html, /grade-b[\s\S]*B级[\s\S]*<b>0<\/b>/)
  assert.match(html, /grade-c[\s\S]*C级[\s\S]*<b>3<\/b>/)
  assert.match(html, /<span>签约客户<\/span><b>0<\/b>/)
})

test('提示卡转义地区名，缺失统计不伪装成零', () => {
  const html = app.methods.mapTooltipFormatter.call(context(), {
    name: '<img src=x onerror=alert(1)>', value: 0,
    data: { hasCustomerCount: false, grades: {}, signedCount: null },
  })
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img/)
  assert.equal((html.match(/暂无数据/g) || []).length, 5)
})

test('真实的全零统计保留五个零值且不会除零', () => {
  const html = app.methods.mapTooltipFormatter.call(context(), {
    name: '零值测试地区', value: 0,
    data: { customerCount: 0, hasCustomerCount: true, grades: { A: 0, B: 0, C: 0 }, signedCount: 0 },
  })
  assert.doesNotMatch(html, /暂无数据|NaN|Infinity/)
  assert.equal((html.match(/<b>0<\/b>/g) || []).length, 5)
})

test('代理地图沿用轻量外壳但保持授权指标语义', () => {
  const html = app.methods.mapTooltipFormatter.call(context('agents'), {
    name: '新疆维吾尔自治区', data: { authorizationCount: 2, exclusiveCount: 1, customerCount: 8 },
  })
  assert.match(html, /agent-map-tooltip/)
  assert.match(html, /授权项目[\s\S]*独家授权[\s\S]*区域客资/)
  assert.doesNotMatch(html, /A级|B级|C级/)
})

test('提示卡在地图右下边缘向左上翻转并限制在视口内', () => {
  const position = app.methods.mapTooltipPosition([790, 570], null, null, null, { viewSize: [800, 580], contentSize: [260, 205] })
  assert.deepEqual(Array.from(position), [516, 351])
  const narrow = app.methods.mapTooltipPosition([310, 430], null, null, null, { viewSize: [320, 440], contentSize: [236, 210] })
  assert.ok(narrow[0] >= 8 && narrow[0] <= 76)
  assert.ok(narrow[1] >= 8 && narrow[1] <= 222)
})
