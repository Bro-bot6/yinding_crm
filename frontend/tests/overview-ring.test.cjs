const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

let app
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), {
  Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
})

for (const counts of [{ A: 0, B: 5, C: 16 }, { A: 1, B: 1, C: 1 }, { A: 0, B: 0, C: 21 }, { A: 1, B: 1, C: 998 }, { A: 0, B: 0, C: 0 }]) {
  test(`圆环精确分配且不为零值绘制色段：${JSON.stringify(counts)}`, () => {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
    const segments = app.computed.gradeStats.call({ overviewStats: { customers: { total, gradeCounts: counts } } })
    let cursor = 0
    for (const segment of segments) {
      assert.ok(Math.abs(segment.start - cursor) < 1e-10)
      assert.equal(segment.ratio, total ? counts[segment.grade] / total * 100 : 0)
      cursor += segment.ratio
      if (!segment.value) assert.equal(segment.path, '')
      else {
        assert.equal(segment.path.match(/ A 47 47 /g).length, 2)
        assert.ok(!segment.path.includes('NaN'))
      }
    }
    assert.ok(Math.abs(cursor - (total ? 100 : 0)) < 1e-10)
  })
}

test('未分类固定排末尾，其余类型维持原排序', () => {
  const rows = [{ id: null, name: '未分类', count: 8 }, { id: 1, name: '道路', count: 4 }, { id: 2, name: '护坡', count: 2 }]
  const result = app.computed.projectTypeStats.call({ overviewStats: { projects: { typeCounts: rows } } })
  assert.deepEqual(Array.from(result, row => row.name), ['道路', '护坡', '未分类'])
  assert.equal(result[2].value, 8)
  assert.equal(rows[0].name, '未分类')
})

test('客资与来访趋势的零值、刻度和填充基线一致', () => {
  const values = [0, 1, 2, 3, 4]
  const overviewStats = {
    customers: { sourceCounts: [{ name: '抖音' }], trendBuckets: values.map(value => ({ counts: { 抖音: value } })) },
    visitors: { trendBuckets: values.map(value => ({ visits: value, people: value })) },
  }
  const customers = app.computed.trendChart.call({ overviewStats })
  const visitors = app.computed.visitorTrendChart.call({ overviewStats })
  for (const points of [customers.series[0].points, visitors.visitsPoints, visitors.peoplePoints]) {
    assert.deepEqual(points.split(' ').map(point => Number(point.split(',')[1])), [200, 155, 110, 65, 20])
  }
  for (const chart of [customers, visitors]) {
    assert.deepEqual(Array.from(chart.ticks), [4, 3, 2, 1, 0])
    assert.ok(chart.areaPoints.startsWith('0,200 '))
    assert.ok(chart.areaPoints.endsWith(' 700,200'))
  }
})

test('客资来源统计和趋势固定包含四种来源，服务号使用独立视觉样式', () => {
  const overviewStats = {
    customers: {
      sourceCounts: [{ name: '服务号', count: 2 }],
      trendBuckets: [{ startDate: '2026-09-01', endDate: '2026-09-05', counts: { 服务号: 2 } }],
    },
  }
  const stats = app.computed.sourceStats.call({ overviewStats })
  assert.deepEqual(Array.from(stats, item => item.name), ['抖音', '视频号', '服务号', '朋友介绍'])
  assert.deepEqual(Array.from(stats, item => item.value), [0, 0, 2, 0])
  assert.equal(stats[2].className, 'service-account')
  const chart = app.computed.trendChart.call({ overviewStats })
  assert.deepEqual(Array.from(chart.series, item => item.name), ['抖音', '视频号', '服务号', '朋友介绍'])
  assert.equal(chart.series[2].className, 'line-fourth')
  assert.deepEqual(Array.from(chart.series[2].values), [2])
})
