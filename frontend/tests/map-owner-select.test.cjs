const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')

let app
const source = fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8')
vm.runInNewContext(source, {
  Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
})

test('地图负责人按商务与技术分组，组内去重且选择值保留身份', () => {
  const component = app.components.GroupedOwnerSelect
  const context = {
    business: [{ id: 1, display_name: '商务甲' }, { id: 1, display_name: '商务甲' }],
    technical: [{ id: 1, display_name: '兼任甲' }, { id: 2, display_name: '技术乙' }],
    modelValue: 'technical:1',
    uniqueEmployees: component.methods.uniqueEmployees,
  }
  context.businessOptions = component.computed.businessOptions.call(context)
  context.technicalOptions = component.computed.technicalOptions.call(context)
  context.selectedKey = component.computed.selectedKey.call(context)

  assert.deepEqual(Array.from(context.businessOptions, item => item.id), [1])
  assert.deepEqual(Array.from(context.technicalOptions, item => item.id), [1, 2])
  assert.equal(component.computed.selectedLabel.call(context), '技术 · 兼任甲')
  assert.equal(component.methods.employeeKey('business', { id: 1 }), 'business:1')
  assert.equal(component.methods.employeeKey('technical', { id: 1 }), 'technical:1')
})

test('负责人下拉为两个等高且各自可滚动的身份区', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../frontend/index.html'), 'utf8')
  const css = fs.readFileSync(path.join(__dirname, '../../frontend_static/style.css'), 'utf8')
  const template = app.components.GroupedOwnerSelect.template

  assert.match(html, /<grouped-owner-select[^>]+:business="employees\.business"[^>]+:technical="employees\.technical"/)
  assert.match(template, /class="grouped-owner-group business"/)
  assert.match(template, /class="grouped-owner-group technical"/)
  assert.equal((template.match(/class="grouped-owner-scroll"/g) || []).length, 2)
  assert.match(css, /\.grouped-owner-group \{ height: 126px;/)
  assert.match(css, /\.grouped-owner-scroll \{[^}]*overflow-y: auto;/)
})

test('地图请求把负责人身份和账号分别提交', () => {
  assert.match(source, /const \[ownerRole, ownerId\] = String\(this\.mapFilters\.ownerId\)\.split\(':'\)/)
  assert.match(source, /params\.set\('ownerId', ownerId \|\| ownerRole\)/)
  assert.match(source, /params\.set\('ownerRole', ownerRole\)/)
})
