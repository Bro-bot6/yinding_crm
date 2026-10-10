const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

test('客资列表不显示新建时间，编辑弹窗显示首次添加时间', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  const cards = html.slice(html.indexOf('<div class="customer-records">'), html.indexOf('<section v-else-if="activePage === \'heatmap\'"'))
  assert.ok(!cards.includes('record-created'))
  assert.ok(!cards.includes('新建于'))
  assert.ok(cards.includes('record-copy-phone'))
  assert.ok(cards.includes('description-field'))
  assert.ok(html.includes('customer-created-meta'))
  assert.ok(html.includes('首次添加时间'))
  assert.ok(html.includes('formatCustomerCreatedAt(customers[editingIndex])'))
})

test('客资主信息按省市区、来源、项目进度排列', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8')
  const row = html.slice(html.indexOf('<div class="record-topline">'), html.indexOf('<div class="record-details">'))
  assert.ok(row.indexOf('record-location') < row.indexOf('record-source'))
  assert.ok(row.indexOf('record-source') < row.indexOf('record-progress'))
})

function fixture({ project = true, grade = 'B', ok = true, detailOk = true } = {}) {
  let app
  const requests = [], messages = [], scrolls = [], pageScrolls = []
  const detailRequests = []
  const sandbox = {
    Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
    document: { getElementById(id) { return { scrollIntoView() { scrolls.push(id) } } } },
    window: { scrollY: 0, scrollTo(...args) { pageScrolls.push(args) } },
    fetch: async (url, options) => {
      if (!options?.body) {
        detailRequests.push(url)
        return { ok: detailOk, status: detailOk ? 200 : 503, json: async () => detailOk ? {
          selectedProjectId: project ? 47 : null,
          projects: project ? [{ id: 47, name: '服务器项目名称', progress: '需求对接' }] : [],
        } : { error: '项目资料读取暂时不可用' } }
      }
      const payload = JSON.parse(options.body)
      requests.push({ url, payload })
      return { ok, json: async () => ok ? {
        customer: { id: 7, createdAt: '2026-09-04T09:00:00Z', ...payload, updatedAt: '2026-09-04T10:00:00Z' },
        project: payload.projectName ? { id: 47, name: payload.projectName, projectType: { id: 3 } } : null,
      } : { error: '项目类型无效' } }
    },
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), sandbox)
  const form = {
    activePage: 'customers', customerPool: 'active', customerEditReturnContext: null, savedCustomerId: null, savedProjectId: null,
    editingIndex: 0, customers: [{ id: 7, grade: 'C' }],
    editCustomer: { name: '编辑客资', phone: 'wx_test', grade, projectName: project ? '道路项目' : '',
      province: '河北省', city: '衡水市', source: '抖音', referrer: '', plan: '', progress: '需求对接', projectTypeId: 3 },
    customerDetailProjects: project ? [{ id: 47 }] : [], selectedCustomerProjectId: project ? 47 : null,
    customerProjects: [{ id: 47, projectType: null }], customerAssociatedProjects: [], visitorRecords: [],
    customerGrade: 'all', sourceFilter: 'all', projectTypeFilter: 'all', progressFilter: 'all', ownerAssignmentFilter: 'all',
    provinceFilter: 'all', cityFilter: 'all', dateFrom: '', dateTo: '', keyword: '', openRegionMenu: '',
    personalFilters: {}, personalProjects: [],
    activeCustomerPartnerships: [], syncInlineRelationshipForms() {}, customerProgressRoadmap: [],
    loadCustomerFollowUps: app.methods.loadCustomerFollowUps,
    editCustomerShowsFullProjectModules: ['A', 'B'].includes(grade),
    isValidCustomerPhone: app.methods.isValidCustomerPhone,
    customerHasProjectType: app.methods.customerHasProjectType,
    isCustomerOwnerMissing: app.methods.isCustomerOwnerMissing,
    customerMatchesOwnerAssignment: app.methods.customerMatchesOwnerAssignment,
    customerMatchesCurrentFilters: app.methods.customerMatchesCurrentFilters,
    restoreCustomerEditReturnContext: app.methods.restoreCustomerEditReturnContext,
    locationParts: item => ({ province: item.province || '', city: item.city || '', district: item.district || '' }),
    csrfToken: () => '', stagePercent: () => 0, buildProvinceData: () => [],
    syncSummaryData() {}, async loadFollowUpTasks() {}, closeCustomerEdit() { this.closed = true },
    switchPage(page) { this.page = page }, resetFilters: app.methods.resetFilters,
    returnToSavedCustomer: app.methods.returnToSavedCustomer,
    $refs: {}, $nextTick(fn) { fn() }, showToast(message) { messages.push(message) },
  }
  return { app, form, requests, detailRequests, messages, scrolls, pageScrolls, save: () => app.methods.saveCustomerEdit.call(form) }
}

test('编辑客户和项目只提交一次，返回原筛选页并保留滚动位置', async () => {
  const f = fixture({ grade: 'C' })
  Object.assign(f.form, {
    customerGrade: 'C', sourceFilter: '抖音', projectTypeFilter: 3, progressFilter: '需求对接',
    provinceFilter: '河北省', cityFilter: '衡水市', dateFrom: '2026-09-01', dateTo: '2026-09-08', keyword: '编辑',
  })
  assert.equal(await f.save(), true, f.messages.join(' | '))
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].url, '/api/customers/7/')
  assert.equal(f.requests[0].payload.projectId, 47)
  assert.equal(f.form.customerProjects[0].projectType.id, 3)
  assert.equal(f.form.activePage, 'customers')
  assert.equal(f.form.customerPool, 'active')
  assert.equal(f.form.savedCustomerId, 7, f.messages.join(' | '))
  assert.equal(f.form.customerGrade, 'C')
  assert.equal(f.form.sourceFilter, '抖音')
  assert.equal(f.form.projectTypeFilter, 3)
  assert.equal(f.form.progressFilter, '需求对接')
  assert.equal(f.form.provinceFilter, '河北省')
  assert.equal(f.form.cityFilter, '衡水市')
  assert.equal(f.form.dateFrom, '2026-09-01')
  assert.equal(f.form.dateTo, '2026-09-08')
  assert.equal(f.form.keyword, '编辑')
  assert.deepEqual(f.scrolls, [])
  assert.deepEqual(f.pageScrolls, [[0, 0]])
})

test('未命名项目选择类型后会明确阻止保存，不再误报成功', async () => {
  const f = fixture({ project: false })
  assert.equal(await f.save(), false)
  assert.equal(f.requests.length, 0)
  assert.match(f.messages[0], /项目名称/)
})

test('在有效客资页改为D类后保留原页面，但从当前结果隐藏', async () => {
  const f = fixture({ grade: 'D', project: false })
  assert.equal(await f.save(), true, f.messages.join(' | '))
  assert.equal(f.form.activePage, 'customers')
  assert.equal(f.form.customerPool, 'active')
  f.form.reportingCustomers = f.app.computed.reportingCustomers.call(f.form)
  f.form.dormantCustomers = f.app.computed.dormantCustomers.call(f.form)
  assert.equal(f.app.computed.customerPoolCustomers.call(f.form).length, 0)
  assert.equal(f.form.savedCustomerId, null)
  assert.equal(f.scrolls.length, 0)
  f.form.customerPool = 'dormant'
  assert.equal(f.app.computed.customerPoolCustomers.call(f.form)[0].grade, 'D')
})

test('修改后不符合原筛选时保留筛选与页面，并提示该客资已隐藏', async () => {
  const f = fixture({ grade: 'C' })
  Object.assign(f.form, {
    customerEditReturnContext: {
      page: 'customers', customerPool: 'active', customerGrade: 'B', sourceFilter: '抖音',
      projectTypeFilter: 'all', progressFilter: 'all', provinceFilter: 'all', cityFilter: 'all',
      dateFrom: '', dateTo: '', keyword: '', scrollY: 260,
    },
    customerGrade: 'B',
  })
  assert.equal(await f.save(), true, f.messages.join(' | '))
  assert.equal(f.form.activePage, 'customers')
  assert.equal(f.form.customerGrade, 'B')
  assert.equal(f.form.savedCustomerId, null)
  assert.equal(f.scrolls.length, 0)
  assert.deepEqual(f.pageScrolls, [[0, 260]])
  assert.match(f.messages.at(-1), /不符合当前筛选条件/)
})

test('从D类沉淀池修改后仍为D类时保留沉淀池和滚动位置', async () => {
  const f = fixture({ grade: 'D', project: false })
  Object.assign(f.form, {
    customerPool: 'dormant',
    customerEditReturnContext: { page: 'customers', customerPool: 'dormant', scrollY: 120 },
  })
  assert.equal(await f.save(), true, f.messages.join(' | '))
  assert.equal(f.form.customerPool, 'dormant')
  assert.equal(f.form.savedCustomerId, 7)
  assert.deepEqual(f.scrolls, [])
  assert.deepEqual(f.pageScrolls, [[0, 120]])
})

test('刚保存的客户仍按原有创建时间排序', () => {
  const f = fixture()
  f.form.savedCustomerId = 7
  f.form.customerPoolCustomers = [
    { id: 7, createdAt: '2026-09-04T09:00:00Z' },
    { id: 8, createdAt: '2026-09-05T09:00:00Z' },
  ]
  f.form.customerMatchesCurrentFilters = () => true
  assert.deepEqual(Array.from(f.app.computed.filteredCustomers.call(f.form), item => item.id), [8, 7])
})

test('总表计数与等级筛选只含 ABC，沉淀池只含 D', () => {
  const f = fixture()
  f.form.customers = ['A', 'B', 'C', 'D'].map((grade, id) => ({ grade, id }))
  f.form.reportingCustomers = f.app.computed.reportingCustomers.call(f.form)
  f.form.dormantCustomers = f.app.computed.dormantCustomers.call(f.form)
  f.form.customerPool = 'active'
  f.form.customerPoolCustomers = f.app.computed.customerPoolCustomers.call(f.form)
  assert.deepEqual(Array.from(f.form.customerPoolCustomers, row => row.grade), ['A', 'B', 'C'])
  assert.deepEqual(Array.from(f.app.computed.gradeFilterOptions.call(f.form), row => row.value), ['A', 'B', 'C'])
  f.form.navItems = [{ id: 'customers' }]
  f.app.methods.syncSummaryData.call(f.form)
  assert.equal(f.form.navItems[0].badge, '3')
  f.form.customerPool = 'dormant'
  assert.deepEqual(Array.from(f.app.computed.customerPoolCustomers.call(f.form), row => row.grade), ['D'])
})

test('服务端拒绝不关闭表单、不修改列表、不提示成功', async () => {
  const f = fixture({ ok: false })
  assert.equal(await f.save(), false)
  assert.equal(f.form.closed, undefined)
  assert.equal(f.form.customers[0].grade, 'C')
  assert.match(f.messages[0], /保存失败.*项目类型无效/)
})

test('项目资料加载过程中阻止保存，避免覆盖真实项目', async () => {
  const f = fixture()
  f.form.customerFollowUpsLoading = true
  assert.equal(await f.save(), false)
  assert.equal(f.requests.length, 0)
})

test('详情首次加载失败后保存会重新加载，并保留已填写的项目和客户内容', async () => {
  const f = fixture()
  f.form.customerFollowUpsError = '网络错误'
  f.form.editCustomer.description = '用户新填写的内容'
  assert.equal(await f.save(), true, f.messages.join(' | '))
  assert.equal(f.detailRequests.length, 1)
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].payload.description, '用户新填写的内容')
  assert.equal(f.requests[0].payload.projectName, '道路项目')
  assert.equal(f.form.customerFollowUpsError, '')
})

test('重试仍然加载失败时不提交，保留草稿并显示具体原因', async () => {
  const f = fixture({ detailOk: false })
  f.form.customerFollowUpsError = '网络错误'
  assert.equal(await f.save(), false)
  assert.equal(f.detailRequests.length, 1)
  assert.equal(f.requests.length, 0)
  assert.equal(f.form.closed, undefined)
  assert.equal(f.form.savingEdit, false)
  assert.match(f.messages.at(-1), /项目资料读取暂时不可用/)
})

test('上一个客户的迟到失败不会锁住新客户的保存流程', async () => {
  let app, rejectOld, resolveNew
  const oldRequest = new Promise((resolve, reject) => { rejectOld = reject })
  const newRequest = new Promise(resolve => { resolveNew = resolve })
  let calls = 0
  const sandbox = {
    Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
    fetch: () => ++calls === 1 ? oldRequest : newRequest,
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), sandbox)
  const f = fixture()
  const oldLoad = app.methods.loadCustomerFollowUps.call(f.form, 7, 47)
  f.form.customers = [{ id: 8 }]
  const newLoad = app.methods.loadCustomerFollowUps.call(f.form, 8, 48)
  rejectOld(new Error('旧客户网络错误'))
  await oldLoad
  assert.equal(f.form.customerFollowUpsError, '')
  assert.equal(f.form.customerFollowUpsLoading, true)
  resolveNew({ ok: true, json: async () => ({ selectedProjectId: 48, projects: [{ id: 48, name: '新项目', progress: '需求对接' }] }) })
  await newLoad
  assert.equal(f.form.selectedCustomerProjectId, 48)
  assert.equal(f.form.customerFollowUpsLoading, false)
  assert.equal(f.form.customerFollowUpsError, '')
})

test('慢速项目响应只填充未修改的字段，不撤销用户已选的项目类型', async () => {
  let app, release
  const response = new Promise(resolve => { release = resolve })
  const sandbox = {
    Vue: { createApp(options) { app = options; return { mount() {} } }, nextTick() {} },
    fetch: () => response,
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend_static/app.js'), 'utf8'), sandbox)
  const f = fixture()
  Object.assign(f.form, { activeCustomerPartnerships: [], syncInlineRelationshipForms() {}, customerProgressRoadmap: [] })
  const pending = app.methods.loadCustomerFollowUps.call(f.form, 7, 47)
  f.form.editCustomer.projectTypeId = 9
  release({ ok: true, json: async () => ({ selectedProjectId: 47, projects: [{
    id: 47, name: '服务器项目名', progress: '需求对接', projectType: { id: 3 }, businessOwner: { id: 5, name: '负责人' },
  }] }) })
  await pending
  assert.equal(f.form.editCustomer.projectTypeId, 9)
  assert.equal(f.form.editCustomer.projectName, '服务器项目名')
  assert.equal(f.form.editCustomer.ownerId, 5)
  assert.equal(f.form.customerFollowUpsError, '')
})

test('客资始终按新增时间倒序，保存标记不改变顺序', () => {
  const f = fixture()
  Object.assign(f.form, { savedCustomerId: null, customerPoolCustomers: [
    { id: 8, name: '新客户', grade: 'B', createdAt: '2026-09-04', updatedAt: '2026-09-04' },
    { id: 7, name: '旧客户', grade: 'C', createdAt: '2025-01-01', updatedAt: '2026-09-10' },
  ], locationParts: () => ({}) })
  f.form.resetFilters()
  assert.deepEqual(Array.from(f.app.computed.filteredCustomers.call(f.form), row => row.id), [8, 7])
  f.form.savedCustomerId = 7
  assert.deepEqual(Array.from(f.app.computed.filteredCustomers.call(f.form), row => row.id), [8, 7])
  f.app.methods.setRecentDateRange.call(f.form, 1)
  assert.equal(f.form.dateFrom, f.form.dateTo)
  assert.match(f.form.dateFrom, /^\d{4}-\d{2}-\d{2}$/)
})

test('首次添加时间固定按中国时区显示', () => {
  const f = fixture()
  const value = f.app.methods.formatCustomerCreatedAt({ createdAt: '2026-09-08T01:30:00Z' }).replace(/\s/g, '')
  assert.match(value, /2026.*09.*08.*09:30/)
})
