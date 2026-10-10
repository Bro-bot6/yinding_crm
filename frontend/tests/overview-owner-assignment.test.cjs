const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

let app
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), {
  Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
})

test('责任人待分配仅统计 A/B 类，并按客资去重', () => {
  const customers = [
    { id: 1, grade: 'A', ownerId: '', owner: '待分配', techId: '', tech: '待分配' },
    { id: 2, grade: 'B', ownerId: 7, owner: '商务甲', techId: '', tech: '待分配' },
    { id: 3, grade: 'C', ownerId: '', owner: '待分配', techId: '', tech: '待分配' },
    { id: 4, grade: 'A', ownerId: 7, owner: '商务甲', techId: 8, tech: '技术乙' },
    { id: 5, grade: 'D', ownerId: '', owner: '待分配', techId: '', tech: '待分配' },
  ]
  const context = {
    customerPoolCustomers: customers,
    isCustomerOwnerMissing: app.methods.isCustomerOwnerMissing,
    customerMatchesOwnerAssignment: app.methods.customerMatchesOwnerAssignment,
  }
  const options = app.computed.ownerAssignmentFilterOptions.call(context)
  assert.deepEqual(Array.from(options, option => [option.value, option.count]), [
    ['incomplete', 2],
    ['business', 1],
    ['technical', 2],
  ])
})

test('点击责任人卡片进入去重后的待分配筛选', () => {
  let opened = null
  app.methods.handleMetric.call({
    openCustomerList(filters = {}) { opened = filters },
    openProgressUpdates() {},
    switchPage() {},
  }, { action: 'owner-assignment' })
  assert.equal(opened.ownerAssignment, 'incomplete')
})

test('总览卡片和全部客资均使用明确的负责人文案', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  const source = fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8')
  assert.match(source, /label: 'A\/B 责任人待分配'[\s\S]*?action: 'owner-assignment'/)
  assert.match(source, /fetch\('\/api\/statistics\/overview\/', \{ cache: 'no-store' \}\)/)
  assert.match(html, />A\/B负责人<[\s\S]*?>全部负责人</)
  assert.doesNotMatch(source, /label: '实施中项目'/)
})

test('省份筛选不会为国外客资生成空白选项', () => {
  const context = {
    customerPoolCustomers: [
      { id: 1, country: '新加坡', city: '新加坡' },
      { id: 2, country: '', province: '', city: '' },
      { id: 3, country: '', province: '河北', city: '石家庄' },
    ],
    normalizeProvinceName: app.methods.normalizeProvinceName,
    locationParts: app.methods.locationParts,
  }
  const options = app.computed.provinceOptions.call(context)
  assert.deepEqual(Array.from(options, option => [option.name, option.count]), [['河北省', 1]])
})
