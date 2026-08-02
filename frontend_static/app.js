const { createApp, nextTick } = Vue

createApp({
  data() {
    const allowedPages = ['overview', 'customers', 'heatmap', 'followups', 'plans']
    const hashPage = window.location.hash.replace(/^#\/?/, '')
    return {
      theme: localStorage.getItem('yd-theme') || 'minimal',
      activePage: allowedPages.includes(hashPage) ? hashPage : 'overview',
      keyword: '',
      customerGrade: 'all',
      sourceFilter: 'all',
      progressFilter: 'all',
      provinceFilter: 'all',
      cityFilter: 'all',
      dateFrom: '',
      dateTo: '',
      mapGrade: 'all',
      showCreate: false,
      showEdit: false,
      showUnsavedConfirm: false,
      editSnapshot: '',
      savingEdit: false,
      editingIndex: -1,
      toast: '',
      toastTimer: null,
      mapChart: null,
      chinaGeoJSON: null,
      mapError: '',
      regionTree: [],
      regionLoadError: '',
      openRegionMenu: '',
      employees: { business: [], technical: [] },
      employeeLoadError: '',
      customerLoadError: '',
      customerFollowUps: [],
      customerFollowUpsLoading: false,
      customerFollowUpsError: '',
      customerProjects: [],
      projectView: 'all',
      followUpTasks: [],
      followUpSummary: { total: 0, pending: 0, today: 0, overdue: 0, waiting: 0, completed: 0 },
      followUpEmployees: [],
      followUpCanViewAll: false,
      followUpEmployeeFilter: 'all',
      followStatusFilter: 'all',
      followGradeFilter: 'all',
      followSourceFilter: 'all',
      followProvinceFilter: 'all',
      followCityFilter: 'all',
      followProgressFilter: 'all',
      expandedFollowColumns: {},
      followUpLoading: false,
      followUpError: '',
      activeFollowTask: null,
      showTaskComplete: false,
      taskResult: '',
      activeSuggestion: null,
      activeDetailMode: 'suggestion',
      highlightFollowTaskId: null,
      tomorrowItems: [],
      tomorrowLoading: false,
      tomorrowError: '',
      tomorrowSaving: false,
      newTomorrowTitle: '',
      newTomorrowNote: '',
      themes: [
        { id: 'minimal', name: '极简商务' },
        { id: 'midnight', name: '深色数据' },
        { id: 'fresh', name: '清爽企业' },
      ],
      navItems: [
        { id: 'overview', label: '经营总览', icon: '总' },
        { id: 'customers', label: '全部客资', icon: '客', badge: '20' },
        { id: 'heatmap', label: '客户热力图', icon: '图' },
        { id: 'followups', label: '跟进任务', icon: '跟' },
        { id: 'plans', label: '明日安排', icon: '明' },
      ],
      metrics: [
        { label: '累计客资', value: '20', change: '共 20 条', note: '明细列表完整展示 20 条', icon: '客', tone: 'blue', trend: 1, action: 'customers', bars: [20, 30, 25, 40, 35, 50, 55, 65, 80, 100] },
        { label: 'A 级客户', value: '6', change: '占 30%', note: 'B级 8 条，C级 6 条', icon: 'A', tone: 'violet', trend: 1, action: 'grade-a', bars: [20, 35, 30, 45, 40, 55, 50, 70, 80, 90] },
        { label: '今日待跟进', value: '2', change: '无逾期', note: '全部跟进任务共 5 项', icon: '待', tone: 'orange', trend: 0, action: 'followups', bars: [72, 60, 54, 47, 40, 34, 30, 26, 22, 18] },
        { label: '施工中项目', value: '0', change: '占 0%', note: '当前处于试验段、A段或B段施工阶段', icon: '施', tone: 'green', trend: 1, action: 'construction', bars: [20, 28, 25, 36, 42, 40, 54, 62, 72, 84] },
      ],
      customers: [
        { name: '浙江恒筑工程', phone: '138****6672', source: '抖音', channel: '短视频私信', region: '浙江 · 杭州', grade: 'A', plan: '园区道路土凝岩施工方案', progress: '方案确认', percent: 72, owner: '王经理', tech: '陈工', updated: '10分钟前', color: '#5b7cfa' },
        { name: '张先生', phone: '186****3021', source: '视频号', channel: '直播间咨询', region: '广东 · 佛山', grade: 'A', plan: '厂区地坪改造方案', progress: '商务洽谈', percent: 86, owner: '李经理', tech: '周工', updated: '35分钟前', color: '#8b5cf6' },
        { name: '山东路达建设', phone: '159****4826', source: '抖音', channel: '广告投放', region: '山东 · 济南', grade: 'B', plan: '乡村道路硬化方案', progress: '已成交', percent: 100, owner: '王经理', tech: '陈工', updated: '1小时前', color: '#19a974' },
        { name: '刘工', phone: '177****9530', source: '视频号', channel: '自然搜索', region: '四川 · 成都', grade: 'B', plan: '景区步道材料建议', progress: '需求确认', percent: 38, owner: '赵经理', tech: '周工', updated: '2小时前', color: '#f59e0b' },
        { name: '河南新材项目部', phone: '132****4178', source: '抖音', channel: '直播间咨询', region: '河南 · 郑州', grade: 'C', plan: '待现场参数确认', progress: '前期了解', percent: 20, owner: '李经理', tech: '待分配', updated: '昨天', color: '#0ea5e9' },
        { name: '湖北诚远施工', phone: '180****8824', source: '朋友介绍', channel: '介绍人：陈先生', referrer: '陈先生', region: '湖北 · 武汉', grade: 'A', plan: '物流园重载道路方案', progress: '报价中', percent: 78, owner: '赵经理', tech: '陈工', updated: '昨天', color: '#ec4899' },
        { name: '福建绿建工程', phone: '135****7641', source: '抖音', channel: '短视频私信', region: '福建 · 厦门', grade: 'B', plan: '滨海步道施工方案', progress: '现场勘察', percent: 44, owner: '王经理', tech: '周工', updated: '2天前', color: '#14b8a6' },
        { name: '杭州森远建材', phone: '137****2189', source: '视频号', channel: '直播间咨询', region: '浙江 · 杭州', grade: 'B', plan: '仓储区地面加固方案', progress: '已成交', percent: 100, owner: '李经理', tech: '陈工', updated: '2天前', color: '#6366f1' },
        { name: '宁波海创建设', phone: '188****5503', source: '朋友介绍', channel: '介绍人：赵总', referrer: '赵总', region: '浙江 · 宁波', grade: 'A', plan: '港区道路耐磨方案', progress: '方案确认', percent: 70, owner: '赵经理', tech: '周工', updated: '3天前', color: '#2563eb' },
        { name: '绍兴陈先生', phone: '150****3927', source: '抖音', channel: '短视频私信', region: '浙江 · 绍兴', grade: 'C', plan: '庭院地面材料建议', progress: '前期了解', percent: 18, owner: '王经理', tech: '待分配', updated: '3天前', color: '#64748b' },
        { name: '佛山鼎创建材', phone: '139****8046', source: '视频号', channel: '自然搜索', region: '广东 · 佛山', grade: 'B', plan: '厂房道路施工方案', progress: '方案设计', percent: 52, owner: '李经理', tech: '周工', updated: '4天前', color: '#0891b2' },
        { name: '东莞黄工', phone: '181****6340', source: '抖音', channel: '直播间咨询', region: '广东 · 东莞', grade: 'C', plan: '园区步道材料建议', progress: '需求确认', percent: 32, owner: '赵经理', tech: '待分配', updated: '4天前', color: '#0d9488' },
        { name: '青岛海岳工程', phone: '156****9175', source: '朋友介绍', channel: '介绍人：孙经理', referrer: '孙经理', region: '山东 · 青岛', grade: 'A', plan: '滨海道路土凝岩方案', progress: '已成交', percent: 100, owner: '王经理', tech: '陈工', updated: '5天前', color: '#0284c7' },
        { name: '临沂周先生', phone: '133****4612', source: '抖音', channel: '广告投放', region: '山东 · 临沂', grade: 'C', plan: '乡村庭院改造建议', progress: '前期了解', percent: 16, owner: '李经理', tech: '待分配', updated: '5天前', color: '#475569' },
        { name: '江苏路联建设', phone: '189****2058', source: '视频号', channel: '直播间咨询', region: '江苏 · 南京', grade: 'B', plan: '市政辅路施工方案', progress: '方案设计', percent: 48, owner: '赵经理', tech: '陈工', updated: '6天前', color: '#7c3aed' },
        { name: '苏州吴经理', phone: '151****7384', source: '抖音', channel: '短视频私信', region: '江苏 · 苏州', grade: 'C', plan: '厂区地坪需求评估', progress: '需求确认', percent: 28, owner: '王经理', tech: '周工', updated: '6天前', color: '#9333ea' },
        { name: '洛阳厚土工程', phone: '158****3691', source: '朋友介绍', channel: '介绍人：王工', referrer: '王工', region: '河南 · 洛阳', grade: 'B', plan: '景区道路硬化方案', progress: '报价中', percent: 75, owner: '李经理', tech: '陈工', updated: '7天前', color: '#c2410c' },
        { name: '成都蜀创建材', phone: '136****8420', source: '视频号', channel: '自然搜索', region: '四川 · 成都', grade: 'A', plan: '物流场地重载方案', progress: '商务洽谈', percent: 84, owner: '赵经理', tech: '周工', updated: '7天前', color: '#ea580c' },
        { name: '合肥安创建设', phone: '187****1265', source: '抖音', channel: '广告投放', region: '安徽 · 合肥', grade: 'B', plan: '园区道路改造方案', progress: '方案确认', percent: 68, owner: '王经理', tech: '陈工', updated: '8天前', color: '#16a34a' },
        { name: '石家庄赵工', phone: '152****5908', source: '视频号', channel: '直播间咨询', region: '河北 · 石家庄', grade: 'C', plan: '项目材料初步建议', progress: '前期了解', percent: 14, owner: '李经理', tech: '待分配', updated: '8天前', color: '#65a30d' },
      ],
      tasks: [
        { time: '09:30', name: '浙江恒筑工程', action: '确认方案技术参数', level: 'urgent' },
        { time: '11:00', name: '张先生', action: '回访报价反馈', level: 'important' },
      ],
      mapGrades: [
        { id: 'all', label: '全部客户' }, { id: 'A', label: 'A级客户' }, { id: 'B', label: 'B级客户' }, { id: 'C', label: 'C级客户' }, { id: 'D', label: 'D级客户' },
      ],
      progressStages: [
        '新客资',
        '客户考察/来访完成',
        '深度需求沟通完成',
        '寄样与实验完成',
        '技术可行性确认',
        '现场勘查完成',
        '技术方案验证汇报通过',
        '商务报价与合同签订',
        '技术交底完成',
        '试验段施工完成',
        'A段施工完成',
        'B段施工完成',
        '客户满意度回访完成',
      ],
      provinceData: [
        { name: '浙江省', all: 4, A: 2, B: 1, C: 1 },
        { name: '广东省', all: 3, A: 1, B: 1, C: 1 },
        { name: '山东省', all: 3, A: 1, B: 1, C: 1 },
        { name: '江苏省', all: 2, A: 0, B: 1, C: 1 },
        { name: '河南省', all: 2, A: 0, B: 1, C: 1 },
        { name: '四川省', all: 2, A: 1, B: 1, C: 0 },
        { name: '湖北省', all: 1, A: 1, B: 0, C: 0 },
        { name: '福建省', all: 1, A: 0, B: 1, C: 0 },
        { name: '安徽省', all: 1, A: 0, B: 1, C: 0 },
        { name: '河北省', all: 1, A: 0, B: 0, C: 1 },
      ],
      followColumns: [
        { title: '今日待跟进', tone: 'orange', items: [{ name: '浙江恒筑工程', grade: 'A', time: '09:30', action: '确认方案技术参数', owner: '王经理' }, { name: '张先生', grade: 'A', time: '11:00', action: '回访报价反馈', owner: '李经理' }] },
        { title: '明日计划', tone: 'blue', items: [{ name: '山东路达建设', grade: 'B', time: '10:00', action: '沟通现场勘察安排', owner: '王经理' }, { name: '刘工', grade: 'B', time: '15:30', action: '确认项目预计方量', owner: '赵经理' }] },
        { title: '已逾期', tone: 'red', items: [{ name: '河南新材项目部', grade: 'C', time: '逾期 2 天', action: '再次确认项目真实性', owner: '李经理' }] },
      ],
      plans: [
        { title: '园区道路土凝岩施工方案', customer: '浙江恒筑工程', grade: 'A', percent: 82, status: '待客户确认', owner: '陈工', date: '7月15日更新' },
        { title: '厂区地坪改造方案', customer: '张先生', grade: 'A', percent: 100, status: '方案已完成', owner: '周工', date: '7月14日更新' },
        { title: '乡村道路硬化方案', customer: '山东路达建设', grade: 'B', percent: 56, status: '设计中', owner: '陈工', date: '7月15日更新' },
        { title: '物流园重载道路方案', customer: '湖北诚远施工', grade: 'A', percent: 90, status: '报价中', owner: '陈工', date: '7月13日更新' },
      ],
      newCustomer: { name: '', call: '', phone: '', source: '抖音', referrer: '', region: '', grade: 'B', progress: '新客资', ownerId: '', techId: '', plan: '', description: '' },
      editCustomer: { name: '', phone: '', source: '抖音', referrer: '', province: '', city: '', district: '', grade: 'B', progress: '新客资', ownerId: '', owner: '', techId: '', tech: '', plan: '', description: '' },
    }
  },
  computed: {
    themeName() {
      return this.themes.find(item => item.id === this.theme)?.name || '极简商务'
    },
    pageTitle() {
      return this.navItems.find(item => item.id === this.activePage)?.label || '经营总览'
    },
    customerPageTitle() {
      return this.progressFilter === 'construction' ? '施工阶段项目' : '全部客资'
    },
    customerPageSubtitle() {
      return this.progressFilter === 'construction'
        ? '仅展示当前处于试验段、A段或B段施工阶段的项目'
        : '统一查看和管理公司客户信息'
    },
    currentPeriodLabel() {
      const today = new Date()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      return `近30天 · 截至 ${today.getFullYear()}-${month}-${day}`
    },
    recent30Customers() {
      const boundary = new Date()
      boundary.setHours(23, 59, 59, 999)
      boundary.setDate(boundary.getDate() - 29)
      boundary.setHours(0, 0, 0, 0)
      return this.customers.filter(customer => {
        const value = customer.createdAt || customer.createdDate
        return value && new Date(value) >= boundary
      })
    },
    displayedProjects() {
      if (this.projectView !== 'construction') return this.customerProjects
      return this.customerProjects.filter(project => this.isConstructionProgress(project.progress))
    },
    projectPageTitle() {
      return this.projectView === 'construction' ? '施工阶段项目' : '项目方案'
    },
    projectPageSubtitle() {
      return this.projectView === 'construction'
        ? '仅展示当前处于试验段、A段或B段施工阶段的项目'
        : '集中管理施工方案、负责人和项目推进状态'
    },
    tomorrowDateValue() {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return this.formatLocalDate(tomorrow)
    },
    tomorrowDateLabel() {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(tomorrow)
    },
    systemTomorrowSuggestions() {
      return this.followUpTasks
        .filter(task => task.status !== 'completed')
        .map(task => {
          const dueDate = task.dueAt ? new Date(task.dueAt) : null
          const dueKey = dueDate && !Number.isNaN(dueDate.getTime()) ? this.formatLocalDate(dueDate) : ''
          const isTomorrow = dueKey === this.tomorrowDateValue
          const priority = task.isOverdue ? 0 : isTomorrow ? 1 : task.status === 'waiting' ? 3 : 2
          const reason = task.isOverdue
            ? '已逾期，建议明日优先处理'
            : isTomorrow
              ? '明日到期'
              : task.status === 'waiting'
                ? '等待客户反馈，可明日复核'
                : '系统建议明日提前准备'
          return { ...task, priority, reason, isTomorrow }
        })
        .sort((a, b) => a.priority - b.priority || String(a.dueAt || '').localeCompare(String(b.dueAt || '')))
        .slice(0, 8)
    },
    unfinishedTomorrowItems() {
      return this.tomorrowItems.filter(item => !item.isCompleted).length
    },
    hasUnsavedEdit() {
      return Boolean(
        this.showEdit
        && this.editSnapshot
        && JSON.stringify(this.editCustomer) !== this.editSnapshot
      )
    },
    filteredCustomers() {
      const word = this.keyword.trim().toLowerCase()
      const progressGroups = {
        early: ['新客资', '客户考察/来访完成', '深度需求沟通完成', '寄样与实验完成'],
        plan: ['技术可行性确认', '现场勘查完成', '技术方案验证汇报通过'],
        business: ['商务报价与合同签订', '技术交底完成'],
        construction: ['试验段施工完成', 'A段施工完成', 'B段施工完成'],
        done: ['客户满意度回访完成'],
      }
      return this.customers.filter(item => {
        const matchesWord = !word || [item.name, item.phone, item.region, item.plan, item.description].some(value => String(value || '').toLowerCase().includes(word))
        const matchesGrade = this.customerGrade === 'all' || item.grade === this.customerGrade
        const matchesSource = this.sourceFilter === 'all' || item.source === this.sourceFilter
        const matchesProgress = this.progressFilter === 'all' || (progressGroups[this.progressFilter] || [this.progressFilter]).includes(item.progress)
        const location = this.locationParts(item)
        const matchesProvince = this.provinceFilter === 'all' || location.province === this.provinceFilter
        const matchesCity = this.cityFilter === 'all' || location.city === this.cityFilter
        const createdDate = item.createdDate || String(item.createdAt || '').slice(0, 10)
        const matchesDateFrom = !this.dateFrom || (createdDate && createdDate >= this.dateFrom)
        const matchesDateTo = !this.dateTo || (createdDate && createdDate <= this.dateTo)
        return matchesWord && matchesGrade && matchesSource && matchesProgress && matchesProvince && matchesCity && matchesDateFrom && matchesDateTo
      })
    },
    provinceOptions() {
      const counts = new Map()
      this.customers.forEach(customer => {
        const province = this.locationParts(customer).province
        if (!province.includes('待完善')) counts.set(province, (counts.get(province) || 0) + 1)
      })
      return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    },
    cityOptions() {
      const counts = new Map()
      this.customers.forEach(customer => {
        const location = this.locationParts(customer)
        if (this.provinceFilter !== 'all' && location.province !== this.provinceFilter) return
        if (!location.city.includes('待完善')) counts.set(location.city, (counts.get(location.city) || 0) + 1)
      })
      return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    },
    gradeFilterOptions() {
      return ['A', 'B', 'C', 'D'].map(value => ({
        value,
        label: `${value} 级客户`,
        count: this.customers.filter(customer => customer.grade === value).length,
      }))
    },
    sourceFilterOptions() {
      return ['抖音', '视频号', '朋友介绍'].map(value => ({
        value,
        label: value,
        count: this.customers.filter(customer => customer.source === value).length,
      }))
    },
    progressFilterOptions() {
      const groups = [
        { value: 'early', label: '考察与需求', stages: ['新客资', '客户考察/来访完成', '深度需求沟通完成', '寄样与实验完成'] },
        { value: 'plan', label: '技术验证', stages: ['技术可行性确认', '现场勘查完成', '技术方案验证汇报通过'] },
        { value: 'business', label: '签约与交底', stages: ['商务报价与合同签订', '技术交底完成'] },
        { value: 'construction', label: '施工阶段', stages: ['试验段施工完成', 'A段施工完成', 'B段施工完成'] },
        { value: 'done', label: '回访完成', stages: ['客户满意度回访完成'] },
      ]
      return groups.map(group => ({
        ...group,
        count: this.customers.filter(customer => group.stages.includes(customer.progress)).length,
      }))
    },
    editProvinceOptions() {
      return this.regionTree
    },
    editCityOptions() {
      const province = this.regionTree.find(item => item.name === this.editCustomer.province)
      if (!province) return []
      const children = province.children || []
      const hasCityLevel = children.some(item => Array.isArray(item.children) && item.children.length)
      return hasCityLevel ? children : [{ name: province.name, code: province.code, children }]
    },
    editDistrictOptions() {
      const city = this.editCityOptions.find(item => item.name === this.editCustomer.city)
      return city?.children || []
    },
    gradeStats() {
      const total = this.customers.length
      let cursor = 0
      return ['A', 'B', 'C', 'D'].map(grade => {
        const value = this.customers.filter(customer => customer.grade === grade).length
        const ratio = total ? Math.round(value / total * 100) : 0
        const start = cursor
        cursor += ratio
        return {
          grade,
          value,
          ratio,
          start,
          arc: ratio ? Math.max(ratio - 6, .8) : 0,
          percent: `${ratio}%`,
        }
      })
    },
    sourceStats() {
      const sourceClasses = { 抖音: 'douyin', 视频号: 'wechat', 朋友介绍: 'referral' }
      return ['抖音', '视频号', '朋友介绍'].map(name => ({
        name,
        value: this.recent30Customers.filter(customer => customer.source === name).length,
        className: sourceClasses[name],
      }))
    },
    topRegions() {
      return this.provinceData.map(item => ({ name: item.name.replace(/省|市/g, ''), value: item.all })).sort((a, b) => b.value - a.value).slice(0, 6)
    },
    progressBuckets() {
      const buckets = [
        { key: 'early', label: '考察与需求', values: ['新客资', '客户考察/来访完成', '深度需求沟通完成', '寄样与实验完成'], color: '#5b7cfa' },
        { key: 'plan', label: '技术验证', values: ['技术可行性确认', '现场勘查完成', '技术方案验证汇报通过'], color: '#8b5cf6' },
        { key: 'business', label: '签约与交底', values: ['商务报价与合同签订', '技术交底完成'], color: '#f59e0b' },
        { key: 'done', label: '施工与回访', values: ['试验段施工完成', 'A段施工完成', 'B段施工完成', '客户满意度回访完成'], color: '#18a875' },
      ]
      return buckets.map(bucket => ({
        ...bucket,
        value: this.customers.filter(customer => bucket.values.includes(customer.progress)).length,
      }))
    },
    followFilterBaseTasks() {
      return this.followUpTasks.filter(task => {
        const project = task.project || {}
        const customer = project.customer || {}
        const matchesGrade = this.followGradeFilter === 'all' || customer.grade === this.followGradeFilter
        const matchesSource = this.followSourceFilter === 'all' || customer.source === this.followSourceFilter
        const matchesProvince = this.followProvinceFilter === 'all' || project.province === this.followProvinceFilter
        const matchesCity = this.followCityFilter === 'all' || project.city === this.followCityFilter
        const matchesProgress = this.followProgressFilter === 'all' || project.progress === this.followProgressFilter
        return matchesGrade && matchesSource && matchesProvince && matchesCity && matchesProgress
      })
    },
    followVisibleSummary() {
      const tasks = this.followFilterBaseTasks
      return {
        total: tasks.length,
        pending: tasks.filter(task => task.status === 'pending' && !task.isOverdue).length,
        overdue: tasks.filter(task => task.isOverdue).length,
        waiting: tasks.filter(task => task.status === 'waiting' && !task.isOverdue).length,
        completed: tasks.filter(task => task.status === 'completed').length,
      }
    },
    filteredFollowUpTasks() {
      if (this.followStatusFilter === 'all') return this.followFilterBaseTasks
      if (this.followStatusFilter === 'overdue') return this.followFilterBaseTasks.filter(task => task.isOverdue)
      if (this.followStatusFilter === 'pending') {
        return this.followFilterBaseTasks.filter(task => task.status === 'pending' && !task.isOverdue)
      }
      if (this.followStatusFilter === 'waiting') {
        return this.followFilterBaseTasks.filter(task => task.status === 'waiting' && !task.isOverdue)
      }
      return this.followFilterBaseTasks.filter(task => task.status === this.followStatusFilter)
    },
    followTaskColumns() {
      const definitions = [
        { key: 'pending', title: '待跟进', tone: 'blue' },
        { key: 'overdue', title: '已逾期', tone: 'red' },
        { key: 'waiting', title: '等待客户', tone: 'orange' },
        { key: 'completed', title: '已完成', tone: 'green' },
      ]
      const visibleDefinitions = this.followStatusFilter === 'all'
        ? definitions
        : definitions.filter(column => column.key === this.followStatusFilter)
      return visibleDefinitions.map(column => {
        const items = this.filteredFollowUpTasks.filter(task => {
          if (column.key === 'overdue') return task.isOverdue
          if (column.key === 'pending') return task.status === 'pending' && !task.isOverdue
          if (column.key === 'waiting') return task.status === 'waiting' && !task.isOverdue
          return task.status === column.key
        })
        const limit = this.followStatusFilter === 'all' ? 4 : 8
        const isExpanded = Boolean(this.expandedFollowColumns[column.key])
        return {
          ...column,
          items,
          visibleItems: isExpanded ? items : items.slice(0, limit),
          hiddenCount: Math.max(0, items.length - limit),
          isExpanded,
          canToggle: items.length > limit,
        }
      })
    },
    followGradeOptions() {
      return ['A', 'B', 'C', 'D'].map(value => ({
        value,
        label: `${value} 级客户`,
        count: this.followUpTasks.filter(task => task.project.customer.grade === value).length,
      }))
    },
    followSourceOptions() {
      return [...new Set(this.followUpTasks.map(task => task.project.customer.source).filter(Boolean))].map(value => ({
        value,
        label: value,
        count: this.followUpTasks.filter(task => task.project.customer.source === value).length,
      }))
    },
    followProvinceOptions() {
      return [...new Set(this.followUpTasks.map(task => task.project.province).filter(Boolean))].map(name => ({
        name,
        count: this.followUpTasks.filter(task => task.project.province === name).length,
      }))
    },
    followCityOptions() {
      const tasks = this.followProvinceFilter === 'all'
        ? this.followUpTasks
        : this.followUpTasks.filter(task => task.project.province === this.followProvinceFilter)
      return [...new Set(tasks.map(task => task.project.city).filter(Boolean))].map(name => ({
        name,
        count: tasks.filter(task => task.project.city === name).length,
      }))
    },
    followProgressOptions() {
      return this.progressStages.map(value => ({
        value,
        label: value,
        count: this.followUpTasks.filter(task => task.project.progress === value).length,
      })).filter(option => option.count)
    },
    followStatusLabel() {
      return {
        all: '全部状态',
        pending: '待跟进',
        overdue: '已逾期',
        waiting: '等待客户',
        completed: '已完成',
      }[this.followStatusFilter] || '全部状态'
    },
    followUpEmployeeLabel() {
      if (this.followUpEmployeeFilter === 'all') return '全部员工'
      return this.followUpEmployees.find(
        employee => String(employee.id) === String(this.followUpEmployeeFilter)
      )?.name || '全部员工'
    },
    rankedAreas() {
      return this.provinceData.map(item => ({ name: item.name.replace(/省|市|壮族自治区/g, ''), value: item[this.mapGrade] || 0 })).sort((a, b) => b.value - a.value).slice(0, 6)
    },
    mapTotal() {
      return this.provinceData.reduce((sum, item) => sum + (item[this.mapGrade] || 0), 0)
    },
    mapGradeLabel() {
      return this.mapGrade === 'all' ? '全国全部客资分布' : `全国 ${this.mapGrade} 级客户分布`
    },
    topAreaStats() {
      return this.rankedAreas.slice(0, 2).map(area => ({
        name: area.name,
        percent: this.mapTotal ? `${Math.round(area.value / this.mapTotal * 100)}%` : '0%',
      }))
    },
  },
  methods: {
    setTheme(theme) {
      this.theme = theme
      localStorage.setItem('yd-theme', theme)
      nextTick(() => this.renderMap())
    },
    handleMetric(metric) {
      if (metric.action === 'customers') this.openCustomerList()
      if (metric.action === 'grade-a') this.openCustomerList({ grade: 'A' })
      if (metric.action === 'followups') this.switchPage('followups')
      if (metric.action === 'done') this.openCustomerList({ progress: 'done' })
      if (metric.action === 'construction') this.openCustomerList({ progress: 'construction' })
    },
    openCustomerList({ grade = 'all', source = 'all', progress = 'all' } = {}) {
      this.keyword = ''
      this.customerGrade = grade
      this.sourceFilter = source
      this.progressFilter = progress
      this.provinceFilter = 'all'
      this.cityFilter = 'all'
      this.dateFrom = ''
      this.dateTo = ''
      this.switchPage('customers')
    },
    openStage(stage) {
      this.openCustomerList({ progress: stage.key })
    },
    switchPage(page) {
      if (this.activePage === 'heatmap' && page !== 'heatmap' && this.mapChart) {
        this.mapChart.dispose()
        this.mapChart = null
      }
      this.activePage = page
      history.replaceState(null, '', `#/${page}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (page === 'heatmap') nextTick(() => this.renderMap())
      if (page === 'followups') this.loadFollowUpTasks()
      if (page === 'plans') {
        this.loadFollowUpTasks()
        this.loadTomorrowItems()
      }
    },
    setMapGrade(grade) {
      this.mapGrade = grade
      this.renderMap()
    },
    async renderMap() {
      if (this.activePage !== 'heatmap' || !this.$refs.mapEl || typeof echarts === 'undefined') return
      try {
        this.mapError = ''
        if (!this.chinaGeoJSON) {
          const response = await fetch('/static/china.json')
          if (!response.ok) throw new Error(`地图数据请求失败（${response.status}）`)
          this.chinaGeoJSON = await response.json()
          echarts.registerMap('china-customers', this.chinaGeoJSON)
        }
        if (!this.mapChart || this.mapChart.isDisposed()) this.mapChart = echarts.init(this.$refs.mapEl)
        const styles = getComputedStyle(document.querySelector('.app-shell'))
        const accent = styles.getPropertyValue('--accent').trim()
        const card = styles.getPropertyValue('--card').trim()
        const soft = styles.getPropertyValue('--soft').trim()
        const border = styles.getPropertyValue('--border').trim()
        const text = styles.getPropertyValue('--text').trim()
        const max = Math.max(1, ...this.provinceData.map(item => item[this.mapGrade] || 0))
        this.mapChart.setOption({
          tooltip: { trigger: 'item', backgroundColor: card, borderColor: border, textStyle: { color: text }, formatter: params => `${params.name}<br/><b style="font-size:18px">${params.value || 0}</b> 位客户` },
          visualMap: { show: true, min: 0, max, left: 24, bottom: 24, text: ['高', '低'], calculable: false, textStyle: { color: text }, inRange: { color: [soft, accent] } },
          series: [{ type: 'map', map: 'china-customers', roam: true, zoom: 1.12, scaleLimit: { min: .9, max: 4 }, label: { show: false }, itemStyle: { areaColor: soft, borderColor: card, borderWidth: 1.3 }, emphasis: { label: { show: true, color: text, fontWeight: 700 }, itemStyle: { areaColor: accent, shadowBlur: 12, shadowColor: `${accent}66` } }, data: this.provinceData.map(item => ({ name: item.name, value: item[this.mapGrade] || 0 })) }],
        }, true)
        this.mapChart.off('click')
        this.mapChart.on('click', params => {
          this.keyword = params.name.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区/g, '')
          this.resetFilters(false)
          this.switchPage('customers')
        })
        this.mapChart.resize()
      } catch (error) {
        this.mapError = error.message || '请检查地图静态资源是否完整。'
      }
    },
    retryMap() {
      this.chinaGeoJSON = null
      this.renderMap()
    },
    resetFilters(clearKeyword = true) {
      this.customerGrade = 'all'
      this.sourceFilter = 'all'
      this.progressFilter = 'all'
      this.provinceFilter = 'all'
      this.cityFilter = 'all'
      this.dateFrom = ''
      this.dateTo = ''
      this.openRegionMenu = ''
      if (clearKeyword) this.keyword = ''
    },
    setRecentDateRange(days) {
      const end = new Date()
      const start = new Date(end)
      start.setDate(start.getDate() - Math.max(0, Number(days) - 1))
      const format = date => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      this.dateFrom = format(start)
      this.dateTo = format(end)
    },
    clearDateRange() {
      this.dateFrom = ''
      this.dateTo = ''
    },
    showToast(message) {
      this.toast = message
      clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.toast = '' }, 2600)
    },
    async loadRegionTree() {
      if (this.regionTree.length) return
      try {
        const response = await fetch('/static/china-regions.json')
        if (!response.ok) throw new Error(`行政区划数据加载失败（${response.status}）`)
        this.regionTree = await response.json()
        this.regionLoadError = ''
      } catch (error) {
        this.regionLoadError = error.message || '行政区划数据加载失败'
      }
    },
    async loadEmployees() {
      try {
        const response = await fetch('/api/employees/')
        if (!response.ok) throw new Error(`员工账号加载失败（${response.status}）`)
        const data = await response.json()
        this.employees = {
          business: Array.isArray(data.business) ? data.business : [],
          technical: Array.isArray(data.technical) ? data.technical : [],
        }
        this.employeeLoadError = ''
      } catch (error) {
        this.employeeLoadError = error.message || '员工账号加载失败'
      }
    },
    async loadCustomers() {
      try {
        const response = await fetch('/api/customers/')
        if (!response.ok) throw new Error(`客资数据加载失败（${response.status}）`)
        const data = await response.json()
        if (!Array.isArray(data.customers)) throw new Error('客资数据格式不正确')
        this.customers = data.customers
        this.customerProjects = Array.isArray(data.projects) ? data.projects : []
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        this.customerLoadError = ''
      } catch (error) {
        this.customerLoadError = error.message || '客资数据加载失败'
        this.showToast(this.customerLoadError)
      }
    },
    async loadFollowUpTasks() {
      if (this.followUpLoading) return
      this.followUpLoading = true
      try {
        const query = (
          this.followUpCanViewAll && this.followUpEmployeeFilter !== 'all'
          ? `?employee=${encodeURIComponent(this.followUpEmployeeFilter)}`
          : ''
        )
        const response = await fetch(`/api/followups/${query}`)
        if (!response.ok) throw new Error(`跟进任务加载失败（${response.status}）`)
        const data = await response.json()
        this.followUpTasks = Array.isArray(data.tasks) ? data.tasks : []
        this.followUpSummary = data.summary || this.followUpSummary
        this.followUpCanViewAll = Boolean(data.canViewAll)
        this.followUpEmployees = Array.isArray(data.employees) ? data.employees : []
        this.followUpError = ''
        this.syncTomorrowBadge()
      } catch (error) {
        this.followUpError = error.message || '跟进任务加载失败'
      } finally {
        this.followUpLoading = false
      }
    },
    selectFollowUpEmployee(employeeId) {
      this.followUpEmployeeFilter = employeeId
      this.openRegionMenu = ''
      this.loadFollowUpTasks()
    },
    setFollowStatus(status) {
      this.followStatusFilter = this.followStatusFilter === status ? 'all' : status
      this.openRegionMenu = ''
    },
    selectFollowProvince(province) {
      this.followProvinceFilter = province
      this.followCityFilter = 'all'
      this.openRegionMenu = ''
    },
    selectFollowCity(city) {
      this.followCityFilter = city
      this.openRegionMenu = ''
    },
    resetFollowFilters() {
      this.followStatusFilter = 'all'
      this.followGradeFilter = 'all'
      this.followSourceFilter = 'all'
      this.followProvinceFilter = 'all'
      this.followCityFilter = 'all'
      this.followProgressFilter = 'all'
      this.expandedFollowColumns = {}
      this.openRegionMenu = ''
    },
    toggleFollowColumn(columnKey) {
      this.expandedFollowColumns[columnKey] = !this.expandedFollowColumns[columnKey]
    },
    openTaskCompleteDialog(task) {
      this.activeFollowTask = task
      this.taskResult = task.result || ''
      this.showTaskComplete = true
    },
    closeTaskCompleteDialog() {
      this.showTaskComplete = false
      this.activeFollowTask = null
      this.taskResult = ''
    },
    openSuggestionDetail(task) {
      this.activeDetailMode = 'suggestion'
      this.activeSuggestion = task
    },
    openProjectDetail(task) {
      this.activeDetailMode = 'project'
      this.activeSuggestion = {
        ...task,
        reason: task.isOverdue
          ? '当前任务已逾期，请优先处理'
          : task.status === 'completed'
            ? '该任务已经完成'
            : task.status === 'waiting'
              ? '正在等待客户反馈'
              : '按计划推进当前任务',
      }
    },
    closeSuggestionDetail() {
      this.activeSuggestion = null
      this.activeDetailMode = 'suggestion'
    },
    openDetailTaskComplete() {
      const task = this.activeSuggestion
      if (!task) return
      this.closeSuggestionDetail()
      this.openTaskCompleteDialog(task)
    },
    openSuggestionFollowUp() {
      const taskId = this.activeSuggestion?.id
      if (!taskId) return
      this.highlightFollowTaskId = taskId
      this.closeSuggestionDetail()
      this.switchPage('followups')
      setTimeout(() => {
        document.querySelector(`[data-follow-task-id="${taskId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 120)
      setTimeout(() => {
        if (this.highlightFollowTaskId === taskId) this.highlightFollowTaskId = null
      }, 4200)
    },
    async updateFollowTask(task, status, result = task.result || '') {
      try {
        const response = await fetch(`/api/followups/${task.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify({ status, result }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `任务更新失败（${response.status}）`)
        this.closeTaskCompleteDialog()
        await this.loadFollowUpTasks()
        await this.loadCustomers()
        this.showToast(status === 'completed' ? '任务已完成，项目已进入下一进度' : '任务状态已更新')
      } catch (error) {
        this.showToast(`操作失败：${error.message || '请稍后重试'}`)
      }
    },
    completeFollowTask() {
      if (!this.activeFollowTask) return
      if (!this.taskResult.trim()) {
        this.showToast('请填写本次跟进结果')
        return
      }
      this.updateFollowTask(this.activeFollowTask, 'completed', this.taskResult.trim())
    },
    formatLocalDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    syncTomorrowBadge() {
      const followUpNav = this.navItems.find(item => item.id === 'followups')
      const tomorrowNav = this.navItems.find(item => item.id === 'plans')
      const activeFollowUps = this.followUpTasks.filter(task => task.status !== 'completed').length
      const tomorrowTotal = this.systemTomorrowSuggestions.length + this.unfinishedTomorrowItems
      if (followUpNav) followUpNav.badge = activeFollowUps ? String(activeFollowUps) : ''
      if (tomorrowNav) tomorrowNav.badge = tomorrowTotal ? String(tomorrowTotal) : ''
    },
    async loadTomorrowItems() {
      if (this.tomorrowLoading) return
      this.tomorrowLoading = true
      try {
        const response = await fetch(`/api/tomorrow-items/?date=${encodeURIComponent(this.tomorrowDateValue)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `明日事项加载失败（${response.status}）`)
        this.tomorrowItems = Array.isArray(data.items) ? data.items : []
        this.tomorrowError = ''
        this.syncTomorrowBadge()
      } catch (error) {
        this.tomorrowError = error.message || '明日事项加载失败'
      } finally {
        this.tomorrowLoading = false
      }
    },
    async addTomorrowItem() {
      const title = this.newTomorrowTitle.trim()
      if (!title || this.tomorrowSaving) {
        if (!title) this.showToast('请先填写明日事项')
        return
      }
      this.tomorrowSaving = true
      try {
        const response = await fetch('/api/tomorrow-items/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify({
            title,
            note: this.newTomorrowNote.trim(),
            plannedDate: this.tomorrowDateValue,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        this.tomorrowItems.push(data.item)
        this.newTomorrowTitle = ''
        this.newTomorrowNote = ''
        this.syncTomorrowBadge()
        this.showToast('已加入明日安排')
      } catch (error) {
        this.showToast(`保存失败：${error.message || '请稍后重试'}`)
      } finally {
        this.tomorrowSaving = false
      }
    },
    async toggleTomorrowItem(item) {
      const nextValue = !item.isCompleted
      try {
        const response = await fetch(`/api/tomorrow-items/${item.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify({ isCompleted: nextValue }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `更新失败（${response.status}）`)
        const index = this.tomorrowItems.findIndex(current => current.id === item.id)
        if (index >= 0) this.tomorrowItems.splice(index, 1, data.item)
        this.syncTomorrowBadge()
      } catch (error) {
        this.showToast(`更新失败：${error.message || '请稍后重试'}`)
      }
    },
    async deleteTomorrowItem(item) {
      try {
        const response = await fetch(`/api/tomorrow-items/${item.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `删除失败（${response.status}）`)
        this.tomorrowItems = this.tomorrowItems.filter(current => current.id !== item.id)
        this.syncTomorrowBadge()
        this.showToast('事项已删除')
      } catch (error) {
        this.showToast(`删除失败：${error.message || '请稍后重试'}`)
      }
    },
    csrfToken() {
      const cookie = document.cookie
        .split('; ')
        .find(item => item.startsWith('csrftoken='))
      return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : ''
    },
    onEditProvinceChange() {
      this.editCustomer.city = ''
      this.editCustomer.district = ''
    },
    onEditCityChange() {
      this.editCustomer.district = ''
    },
    toggleRegionMenu(menu) {
      this.openRegionMenu = this.openRegionMenu === menu ? '' : menu
    },
    selectFilterProvince(province) {
      this.provinceFilter = province
      this.cityFilter = 'all'
      this.openRegionMenu = ''
    },
    selectFilterCity(city) {
      this.cityFilter = city
      this.openRegionMenu = ''
    },
    selectCustomerFilter(field, value) {
      this[field] = value
      this.openRegionMenu = ''
    },
    selectEditProvince(province) {
      this.editCustomer.province = province
      this.onEditProvinceChange()
      this.openRegionMenu = ''
    },
    selectEditCity(city) {
      this.editCustomer.city = city
      this.onEditCityChange()
      this.openRegionMenu = ''
    },
    selectEditDistrict(district) {
      this.editCustomer.district = district
      this.openRegionMenu = ''
    },
    selectEditEmployee(type, employee) {
      if (type === 'business') {
        this.editCustomer.ownerId = employee.id
        this.editCustomer.owner = employee.display_name
      } else {
        this.editCustomer.techId = employee.id
        this.editCustomer.tech = employee.display_name
      }
      this.openRegionMenu = ''
    },
    selectProgress(target, stage) {
      this[target].progress = stage
      this.openRegionMenu = ''
    },
    locationParts(customer) {
      const regionParts = String(customer.region || '').split(/[·\s/]+/).map(item => item.trim()).filter(Boolean)
      const rawProvince = String(customer.province || regionParts[0] || '待完善')
      const rawCity = String(customer.city || regionParts[1] || '待完善')
      const province = this.normalizeProvinceName(rawProvince)
      const city = rawCity === '待完善' || /市$/.test(rawCity) ? rawCity : `${rawCity}市`
      const district = String(customer.district || regionParts[2] || '区县待完善')
      return { province, city, district }
    },
    normalizeProvinceName(value) {
      const name = String(value || '').trim()
      if (!name || name === '待完善' || name === '地区待完善') return '省份待完善'
      if (/省$|市$|自治区$|特别行政区$/.test(name)) return name
      const municipalities = ['北京', '上海', '天津', '重庆']
      const autonomousRegions = { 广西: '广西壮族自治区', 内蒙古: '内蒙古自治区', 西藏: '西藏自治区', 宁夏: '宁夏回族自治区', 新疆: '新疆维吾尔自治区' }
      if (municipalities.includes(name)) return `${name}市`
      return autonomousRegions[name] || `${name}省`
    },
    customerDescription(customer) {
      if (String(customer.description || '').trim()) return customer.description
      return '暂无详细客户描述，请补充客户需求、项目情况、现场条件、施工面积、预计用量、进场时间及每次沟通结果。'
    },
    stagePercent(progress) {
      const index = this.progressStages.indexOf(progress)
      if (index < 0) return 5
      return Math.round(5 + index / (this.progressStages.length - 1) * 95)
    },
    isCommercialized(progress) {
      const contractIndex = this.progressStages.indexOf('商务报价与合同签订')
      const currentIndex = this.progressStages.indexOf(progress)
      return currentIndex >= contractIndex
    },
    isConstructionProgress(progress) {
      return ['试验段施工完成', 'A段施工完成', 'B段施工完成'].includes(progress)
    },
    exportCustomersExcel() {
      if (typeof XLSX === 'undefined') {
        this.showToast('Excel 组件未加载，请刷新页面后重试')
        return
      }
      const records = this.filteredCustomers.map(customer => {
        const location = this.locationParts(customer)
        return {
          客资来源: customer.source || '',
          客户等级: customer.grade || '',
          省: location.province,
          市: location.city,
          区: location.district,
          客户名称: customer.name || '',
          客户电话: customer.phone || '',
          客户描述: this.customerDescription(customer),
          项目进度: customer.progress || '',
          施工方案: customer.plan || '',
          商务负责人: customer.owner || '',
          技术负责人: customer.tech || '',
          介绍人: customer.referrer || '',
          新建时间: customer.created || customer.createdDate || '',
        }
      })
      if (!records.length) {
        this.showToast('当前筛选结果为空，暂无可导出的客资')
        return
      }
      const worksheet = XLSX.utils.json_to_sheet(records)
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 },
        { wch: 18 }, { wch: 62 }, { wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ]
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '客资信息')
      XLSX.writeFile(workbook, `银鼎客资信息_${new Date().toISOString().slice(0, 10)}.xlsx`)
      this.showToast(`已导出当前筛选的 ${records.length} 条客资`)
    },
    async handleExcelImport(event) {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        if (typeof XLSX === 'undefined') throw new Error('Excel 组件未加载')
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
        if (!rows.length) throw new Error('表格中没有可导入的数据')
        const requiredHeaders = ['客资来源', '客户等级', '省', '市', '区', '客户名称', '客户电话', '客户描述', '项目进度', '施工方案', '商务负责人', '技术负责人']
        const missingHeaders = requiredHeaders.filter(header => !Object.prototype.hasOwnProperty.call(rows[0], header))
        if (missingHeaders.length) throw new Error(`缺少列：${missingHeaders.join('、')}`)
        const imported = rows.filter(row => String(row['客户名称'] || '').trim()).map((row, index) => {
          const grade = String(row['客户等级'] || 'D').trim().toUpperCase()
          const source = String(row['客资来源'] || '其他').trim()
          const province = String(row['省'] || '').trim()
          const city = String(row['市'] || '').trim()
          const progress = String(row['项目进度'] || '新客资').trim()
          const referrer = source === '朋友介绍' ? String(row['介绍人'] || '').trim() : ''
          return {
            name: String(row['客户名称']).trim(),
            phone: String(row['客户电话'] || '').trim(),
            source,
            channel: referrer ? `介绍人：${referrer}` : 'Excel导入',
            referrer,
            province,
            city,
            district: String(row['区'] || '').trim(),
            region: [province, city].filter(Boolean).join(' · ') || '地区待完善',
            grade: ['A', 'B', 'C', 'D'].includes(grade) ? grade : 'D',
            description: String(row['客户描述'] || '').trim(),
            progress,
            plan: String(row['施工方案'] || '').trim() || '方案待完善',
            percent: this.stagePercent(progress),
            owner: String(row['商务负责人'] || '').trim() || '待分配',
            tech: String(row['技术负责人'] || '').trim() || '待分配',
            updated: '刚刚导入',
            color: ['#e64b5d', '#f2a23a', '#3b82f6', '#65748a'][index % 4],
          }
        })
        if (!imported.length) throw new Error('没有找到填写了客户名称的有效数据')
        this.customers = imported
        this.provinceData = this.buildProvinceData(imported)
        this.syncSummaryData()
        this.resetFilters()
        this.switchPage('customers')
        this.showToast(`成功导入 ${imported.length} 条客资，已替换当前演示数据`)
      } catch (error) {
        this.showToast(`导入失败：${error.message || '请检查表格格式'}`)
      } finally {
        event.target.value = ''
      }
    },
    buildProvinceData(customers) {
      const grouped = new Map()
      customers.forEach(customer => {
        const province = this.locationParts(customer).province
        if (!province || province.includes('待完善')) return
        if (!grouped.has(province)) grouped.set(province, { name: province, all: 0, A: 0, B: 0, C: 0, D: 0 })
        const item = grouped.get(province)
        item.all += 1
        if (['A', 'B', 'C', 'D'].includes(customer.grade)) item[customer.grade] += 1
      })
      return [...grouped.values()].sort((a, b) => b.all - a.all)
    },
    syncSummaryData() {
      const total = this.customers.length
      const gradeCounts = Object.fromEntries(['A', 'B', 'C', 'D'].map(grade => [grade, this.customers.filter(customer => customer.grade === grade).length]))
      const constructionProjects = this.customerProjects.filter(project => this.isConstructionProgress(project.progress)).length
      const projectTotal = this.customerProjects.length
      const customerNav = this.navItems.find(item => item.id === 'customers')
      if (customerNav) customerNav.badge = String(total)
      this.metrics[0].value = String(total)
      this.metrics[0].change = `共 ${total} 条`
      this.metrics[0].note = `明细列表完整展示 ${total} 条`
      this.metrics[1].value = String(gradeCounts.A)
      this.metrics[1].change = total ? `占 ${Math.round(gradeCounts.A / total * 100)}%` : '占 0%'
      this.metrics[1].note = `B级 ${gradeCounts.B} 条，C级 ${gradeCounts.C} 条，D级 ${gradeCounts.D} 条`
      this.metrics[3].value = String(constructionProjects)
      this.metrics[3].change = projectTotal ? `占 ${Math.round(constructionProjects / projectTotal * 100)}%` : '占 0%'
      this.metrics[3].note = `${projectTotal} 个项目中 ${constructionProjects} 个当前处于施工阶段`
    },
    async loadCustomerFollowUps(customerId) {
      if (!customerId) return
      this.customerFollowUpsLoading = true
      this.customerFollowUpsError = ''
      try {
        const response = await fetch(`/api/customers/${customerId}/`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `跟进记录加载失败（${response.status}）`)
        const activeCustomer = this.customers[this.editingIndex]
        if (!activeCustomer || activeCustomer.id !== customerId) return
        this.customerFollowUps = Array.isArray(data.followUps) ? data.followUps : []
      } catch (error) {
        this.customerFollowUpsError = error.message || '跟进记录加载失败'
      } finally {
        this.customerFollowUpsLoading = false
      }
    },
    openCustomerEdit(customer) {
      const index = this.customers.indexOf(customer)
      if (index < 0) return
      const location = this.locationParts(customer)
      this.editingIndex = index
      this.editCustomer = {
        name: customer.name || '',
        phone: customer.phone || '',
        source: customer.source || '抖音',
        referrer: customer.referrer || '',
        province: location.province.includes('待完善') ? '' : location.province,
        city: location.city.includes('待完善') ? '' : location.city,
        district: location.district.includes('待完善') ? '' : location.district,
        grade: customer.grade || 'D',
        progress: customer.progress || '新客资',
        ownerId: this.employees.business.some(employee => employee.id === customer.ownerId) ? customer.ownerId : '',
        owner: customer.owner || '',
        techId: this.employees.technical.some(employee => employee.id === customer.techId) ? customer.techId : '',
        tech: customer.tech || '',
        plan: customer.plan === '方案待完善' ? '' : (customer.plan || ''),
        description: customer.description || '',
      }
      this.editSnapshot = JSON.stringify(this.editCustomer)
      this.customerFollowUps = []
      this.customerFollowUpsError = ''
      this.showUnsavedConfirm = false
      this.showEdit = true
      this.loadRegionTree()
      this.loadCustomerFollowUps(customer.id)
    },
    requestCloseEdit() {
      this.openRegionMenu = ''
      if (this.hasUnsavedEdit) {
        this.showUnsavedConfirm = true
        return
      }
      this.closeCustomerEdit()
    },
    closeCustomerEdit() {
      this.showUnsavedConfirm = false
      this.showEdit = false
      this.editingIndex = -1
      this.editSnapshot = ''
      this.customerFollowUps = []
      this.customerFollowUpsError = ''
    },
    discardCustomerEdit() {
      this.closeCustomerEdit()
    },
    async saveCustomerEdit() {
      if (this.savingEdit) return
      this.showUnsavedConfirm = false
      if (this.editingIndex < 0 || !this.customers[this.editingIndex]) return
      if (this.editCustomer.source === '朋友介绍' && !this.editCustomer.referrer.trim()) {
        this.showToast('朋友介绍的客资必须填写介绍人')
        return
      }
      if (!this.editCustomer.province || !this.editCustomer.city) {
        this.showToast('请选择项目所在的省份和城市')
        return
      }
      const original = this.customers[this.editingIndex]
      if (!original.id) {
        this.showToast('该客资尚未同步到数据库，请刷新页面后重试')
        return
      }
      this.savingEdit = true
      try {
        const response = await fetch(`/api/customers/${original.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify(this.editCustomer),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        const savedCustomer = data.customer
        savedCustomer.percent = this.stagePercent(savedCustomer.progress)
        this.customers.splice(this.editingIndex, 1, savedCustomer)
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        this.closeCustomerEdit()
        this.resetFilters()
        this.switchPage('customers')
        this.showToast(`${savedCustomer.name} 的客资信息已保存到数据库`)
      } catch (error) {
        this.showToast(`保存失败：${error.message || '请稍后重试'}`)
      } finally {
        this.savingEdit = false
      }
    },
    async addCustomer() {
      const isReferral = this.newCustomer.source === '朋友介绍'
      const savedName = this.newCustomer.name
      const businessOwner = this.employees.business.find(employee => employee.id === this.newCustomer.ownerId)
      const technicalOwner = this.employees.technical.find(employee => employee.id === this.newCustomer.techId)
      if (!businessOwner || !technicalOwner) {
        this.showToast('请选择状态可用的商务负责人和技术负责人')
        return
      }
      const regionParts = String(this.newCustomer.region || '').split(/[·\s/]+/).filter(Boolean)
      const payload = {
        ...this.newCustomer,
        province: regionParts[0] || '',
        city: regionParts[1] || '',
        district: regionParts[2] || '',
        ownerId: businessOwner.id,
        techId: technicalOwner.id,
        referrer: isReferral ? this.newCustomer.referrer : '',
      }
      try {
        const response = await fetch('/api/customers/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify(payload),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        data.customer.percent = this.stagePercent(data.customer.progress)
        this.customers.unshift(data.customer)
        this.newCustomer = { name: '', call: '', phone: '', source: '抖音', referrer: '', region: '', grade: 'B', progress: '新客资', ownerId: '', techId: '', plan: '', description: '' }
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        this.showCreate = false
        this.switchPage('customers')
        this.showToast(`${savedName} 已保存到客资数据库`)
      } catch (error) {
        this.showToast(`新增失败：${error.message || '请稍后重试'}`)
      }
    },
  },
  mounted() {
    this.loadRegionTree()
    this.loadEmployees()
    this.loadCustomers()
    this.loadFollowUpTasks()
    this.loadTomorrowItems()
    window.addEventListener('resize', () => this.mapChart?.resize())
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace(/^#\/?/, '')
      if (this.navItems.some(item => item.id === page) && page !== this.activePage) this.switchPage(page)
    })
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (this.activeSuggestion) {
          this.closeSuggestionDetail()
        } else if (this.showTaskComplete) {
          this.closeTaskCompleteDialog()
        } else if (this.showUnsavedConfirm) {
          this.showUnsavedConfirm = false
        } else if (this.showEdit) {
          this.requestCloseEdit()
        } else {
          this.showCreate = false
        }
      }
    })
    window.addEventListener('click', () => { this.openRegionMenu = '' })
    if (this.activePage === 'heatmap') nextTick(() => this.renderMap())
  },
}).mount('#app')
