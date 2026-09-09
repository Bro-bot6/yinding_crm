const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

function customerForm(grade, ownersAvailable = false) {
  let app
  const requests = []
  const messages = []
  const sandbox = {
    Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
    fetch: async (url, options) => {
      const payload = JSON.parse(options.body)
      requests.push({ url, payload })
      return { ok: true, json: async () => ({ customer: { id: 1, ...payload } }) }
    },
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), sandbox)
  const form = {
    newCustomer: {
      name: '保存流程测试', phone: '13800000000', source: '抖音', referrer: '',
      grade, projectName: '测试项目', province: '河北省', city: '唐山市', district: '',
      projectTypeId: 3, progress: '合同签订', plan: '隐藏方案', ownerId: 10, techId: 20,
    },
    employees: {
      business: ownersAvailable ? [{ id: 10, display_name: '商务测试' }] : [],
      technical: ownersAvailable ? [{ id: 20, display_name: '技术测试' }] : [],
    },
    customers: [],
    isValidCustomerPhone: app.methods.isValidCustomerPhone,
    csrfToken: () => '', stagePercent: () => 0, buildProvinceData: () => [],
    syncSummaryData() {}, closeCreateCustomer() {}, switchPage() {}, returnToSavedCustomer() {},
    $nextTick() {}, showToast: message => messages.push(message),
  }
  Object.defineProperty(form, 'newCustomerShowsFullProjectModules', {
    get: () => app.computed.newCustomerShowsFullProjectModules.call(form),
  })
  return { form, requests, messages, save: () => app.methods.addCustomer.call(form) }
}

for (const grade of ['C', 'D']) {
  test(`${grade} 级无需负责人和区县即可提交，隐藏字段不写入`, async () => {
    const fixture = customerForm(grade)
    await fixture.save()
    assert.equal(fixture.requests.length, 1)
    const payload = fixture.requests[0].payload
    assert.equal(payload.ownerId, '')
    assert.equal(payload.techId, '')
    assert.equal(payload.projectTypeId, '')
    assert.equal(payload.plan, '')
    assert.equal(payload.progress, '需求对接')
    assert.equal(payload.district, '')
    assert.equal(payload.projectName, '测试项目')
  })
}

for (const grade of ['A', 'B']) {
  test(`${grade} 级仍要求负责人，但不要求区县`, async () => {
    const missing = customerForm(grade)
    await missing.save()
    assert.equal(missing.requests.length, 0)
    assert.match(missing.messages[0], /商务负责人和技术负责人/)
    const complete = customerForm(grade, true)
    await complete.save()
    assert.equal(complete.requests.length, 1)
    assert.equal(complete.requests[0].payload.ownerId, 10)
    assert.equal(complete.requests[0].payload.techId, 20)
    assert.equal(complete.requests[0].payload.district, '')
  })
}

test('C 级联系方式不可为空，国内仍校验省市', async () => {
  const phone = customerForm('C')
  phone.form.newCustomer.phone = ''
  await phone.save()
  assert.equal(phone.requests.length, 0)
  assert.match(phone.messages[0], /联系方式/)
  const region = customerForm('C')
  region.form.newCustomer.city = ''
  await region.save()
  assert.equal(region.requests.length, 0)
  assert.match(region.messages[0], /省份和城市/)
})

for (const contact of ['微信：wx_customer_01', 'QQ：1234567', '+60 12-3456789', '1234567']) {
  test(`联系方式支持 ${contact}`, async () => {
    const fixture = customerForm('C')
    fixture.form.newCustomer.phone = contact
    await fixture.save()
    assert.equal(fixture.requests[0].payload.phone, contact)
  })
}

test('国外登记使用国家和城市，不要求国内省市', async () => {
  const fixture = customerForm('C')
  Object.assign(fixture.form.newCustomer, { locationMode: 'overseas', country: 'Malaysia', province: '', city: 'Kuala Lumpur' })
  await fixture.save()
  assert.equal(fixture.requests[0].payload.country, 'Malaysia')
  fixture.requests.length = 0
  fixture.form.newCustomer.country = ''
  await fixture.save()
  assert.equal(fixture.requests.length, 0)
  assert.match(fixture.messages.at(-1), /国家/)
})

test('新建客资提交是否添加微信状态', async () => {
  const fixture = customerForm('C')
  fixture.form.newCustomer.wechatStatus = 'yes'
  await fixture.save()
  assert.equal(fixture.requests[0].payload.wechatStatus, 'yes')
})

test('所有可选客资来源入口统一为四种来源并包含服务号', () => {
  let app
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), {
    Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
  })
  const expected = ['抖音', '视频号', '服务号', '朋友介绍']
  const optionValues = computed => Array.from(computed, item => item.value)
  assert.deepEqual(optionValues(app.computed.customerSourceSelectOptions.call({})), expected)
  assert.deepEqual(optionValues(app.computed.batchCustomerSourceOptions.call({})), expected)
  assert.deepEqual(optionValues(app.computed.sourceFilterOptions.call({ customerPoolCustomers: [] })), expected)
  assert.deepEqual(Array.from(app.computed.visitorSourceOptions.call({ visitorRecords: [] })), expected)
  assert.deepEqual(optionValues(app.computed.followSourceOptions.call({ followUpTasks: [] })), expected)
})

test('客资列表展示三种微信状态且状态与电话号码位于同一行', () => {
  let app
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), {
    Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
  })
  const appSource = fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8')
  assert.match(appSource, /wechatStatusOptions: \[\{ value: 'yes', label: '已添加' \}, \{ value: 'no', label: '未添加' \}, \{ value: 'rejected', label: '已添加未通过' \}\]/)
  assert.equal(app.methods.wechatStatusLabel('yes'), '已添加')
  assert.equal(app.methods.wechatStatusLabel('no'), '未添加')
  assert.equal(app.methods.wechatStatusLabel('rejected'), '已添加未通过')
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  assert.match(html, /class="record-contact-line"/)
  assert.match(html, /class="record-wechat-status"/)
  assert.match(html, /wechatStatusLabel\(customer\.wechatStatus\)/)
  assert.equal(html.split('class="edit-region-select wechat-status-select"').length - 1, 2)
  assert.equal(html.split('match-width').length - 1, 2)
  assert.match(appSource, /:style="matchWidth \? \{ '--floating-min-width': '1' \} : null"/)
})

test('国内地区选择统一可搜索，元数据去掉自动账号提示', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  for (const label of ['省份', '城市', '区县']) {
    assert.equal(html.split(`search-placeholder="输入${label}名称过滤"`).length - 1, 2)
  }
  assert.ok(!html.includes('自动使用当前登录账号'))
  assert.match(html, /class="progress-creator-field"/)
})
