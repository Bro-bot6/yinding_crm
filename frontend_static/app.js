const { createApp, nextTick } = Vue

let themedPopoverSequence = 0
const nextThemedPopoverId = prefix => `${prefix}-${++themedPopoverSequence}`
const announceThemedPopover = id => window.dispatchEvent(new CustomEvent('yd-themed-popover-open', { detail: id }))

const ThemedSelect = {
  props: {
    modelValue: { type: [String, Number], default: '' },
    label: { type: String, required: true },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: '请选择' },
    required: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  data() {
    return { open: false, popoverId: nextThemedPopoverId('select') }
  },
  computed: {
    selectedOption() {
      return this.options.find(option => String(option.value) === String(this.modelValue)) || null
    },
    selectedLabel() {
      return this.selectedOption?.label || this.placeholder
    },
  },
  mounted() {
    this.closeOnDocumentClick = () => { this.open = false }
    this.closeOnEscape = event => { if (event.key === 'Escape') this.open = false }
    this.closeOnPeerOpen = event => { if (event.detail !== this.popoverId) this.open = false }
    document.addEventListener('click', this.closeOnDocumentClick)
    window.addEventListener('keydown', this.closeOnEscape)
    window.addEventListener('yd-themed-popover-open', this.closeOnPeerOpen)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeOnDocumentClick)
    window.removeEventListener('keydown', this.closeOnEscape)
    window.removeEventListener('yd-themed-popover-open', this.closeOnPeerOpen)
  },
  methods: {
    toggle() {
      const shouldOpen = !this.open
      if (shouldOpen) announceThemedPopover(this.popoverId)
      this.open = shouldOpen
    },
    select(option) {
      this.$emit('update:modelValue', option.value)
      this.open = false
    },
  },
  template: `
    <div class="custom-select-field themed-select-field" @click.stop>
      <span>{{ label }} <b v-if="required">必填</b></span>
      <button type="button" class="custom-select-trigger" :class="{ active: open }" :aria-expanded="String(open)" aria-haspopup="listbox" @click="toggle"><b>{{ selectedLabel }}</b><i></i></button>
      <div v-if="open" class="custom-select-menu themed-select-menu" role="listbox">
        <button v-for="option in options" :key="String(option.value)" type="button" role="option" :aria-selected="String(option === selectedOption)" :class="{ selected: option === selectedOption }" @click="select(option)"><span><b>{{ option.label }}</b><small v-if="option.detail">{{ option.detail }}</small></span><i>✓</i></button>
      </div>
    </div>
  `,
}

const ThemedDatePicker = {
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, required: true },
    placeholder: { type: String, default: '年 / 月 / 日' },
    min: { type: String, default: '' },
    max: { type: String, default: '' },
    required: { type: Boolean, default: false },
    dateTime: { type: Boolean, default: false },
    align: { type: String, default: 'left' },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      open: false,
      calendarMonth: '',
      draftTime: '09:00',
      popoverId: nextThemedPopoverId('date'),
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    }
  },
  computed: {
    dateValue() {
      return String(this.modelValue || '').slice(0, 10)
    },
    displayValue() {
      if (!this.dateValue) return ''
      const formattedDate = this.dateValue.split('-').join(' / ')
      if (!this.dateTime) return formattedDate
      const time = String(this.modelValue || '').slice(11, 16)
      return time ? `${formattedDate}  ${time}` : formattedDate
    },
    calendarTitle() {
      if (!this.calendarMonth) return ''
      const [year, month] = this.calendarMonth.split('-').map(Number)
      return `${year}年 ${month}月`
    },
    todayValue() {
      return this.formatDate(new Date())
    },
    calendarDays() {
      if (!this.calendarMonth) return []
      const [year, month] = this.calendarMonth.split('-').map(Number)
      const firstDay = new Date(year, month - 1, 1)
      const gridStart = new Date(year, month - 1, 1 - firstDay.getDay())
      return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(gridStart)
        date.setDate(gridStart.getDate() + index)
        const value = this.formatDate(date)
        return {
          value,
          day: date.getDate(),
          inMonth: date.getMonth() === month - 1,
          isToday: value === this.todayValue,
          isSelected: value === this.dateValue,
          disabled: this.isDisabled(value),
        }
      })
    },
  },
  mounted() {
    this.closeOnDocumentClick = () => { this.open = false }
    this.closeOnEscape = event => { if (event.key === 'Escape') this.open = false }
    this.closeOnPeerOpen = event => { if (event.detail !== this.popoverId) this.open = false }
    document.addEventListener('click', this.closeOnDocumentClick)
    window.addEventListener('keydown', this.closeOnEscape)
    window.addEventListener('yd-themed-popover-open', this.closeOnPeerOpen)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.closeOnDocumentClick)
    window.removeEventListener('keydown', this.closeOnEscape)
    window.removeEventListener('yd-themed-popover-open', this.closeOnPeerOpen)
  },
  methods: {
    formatDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    toggle() {
      if (this.open) {
        this.open = false
        return
      }
      const base = this.dateValue ? new Date(`${this.dateValue}T00:00:00`) : new Date()
      this.calendarMonth = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
      this.draftTime = String(this.modelValue || '').slice(11, 16) || '09:00'
      announceThemedPopover(this.popoverId)
      this.open = true
    },
    shiftMonth(offset) {
      const [year, month] = this.calendarMonth.split('-').map(Number)
      const nextMonth = new Date(year, month - 1 + Number(offset), 1)
      this.calendarMonth = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
    },
    isDisabled(value) {
      return Boolean((this.min && value < this.min.slice(0, 10)) || (this.max && value > this.max.slice(0, 10)))
    },
    selectDate(value) {
      if (this.isDisabled(value)) return
      this.$emit('update:modelValue', this.dateTime ? `${value}T${this.draftTime}` : value)
      if (!this.dateTime) this.open = false
    },
    updateTime(event) {
      const value = event.target.value.replace(/[^0-9:]/g, '').slice(0, 5)
      this.draftTime = value
      if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && this.dateValue) {
        this.$emit('update:modelValue', `${this.dateValue}T${value}`)
      }
    },
    clear() {
      this.$emit('update:modelValue', '')
      this.open = false
    },
  },
  template: `
    <div class="date-picker-field themed-date-picker" :class="[{ 'date-time-picker': dateTime, 'align-right': align === 'right' }]" @click.stop>
      <label><span>{{ label }} <b v-if="required">必填</b></span><input class="themed-date-trigger" :value="displayValue" type="text" readonly :required="required" :placeholder="placeholder" :aria-label="label" :aria-expanded="String(open)" aria-haspopup="dialog" :class="{ active: open }" @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle" /><i class="date-input-icon" aria-hidden="true"></i></label>
      <div v-if="open" class="date-picker-popover" role="dialog" :aria-label="'选择' + label">
        <header><button type="button" aria-label="上个月" @click="shiftMonth(-1)">‹</button><strong>{{ calendarTitle }}</strong><button type="button" aria-label="下个月" @click="shiftMonth(1)">›</button></header>
        <div class="date-picker-weekdays"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
        <div class="date-picker-days"><button v-for="day in calendarDays" :key="day.value" type="button" :disabled="day.disabled" :class="{ outside: !day.inMonth, today: day.isToday, selected: day.isSelected }" @click="selectDate(day.value)">{{ day.day }}</button></div>
        <div v-if="dateTime" class="date-time-editor"><span>具体时间</span><input :value="draftTime" inputmode="numeric" maxlength="5" placeholder="09:00" aria-label="具体时间，24小时制" @input="updateTime" /></div>
        <footer><button type="button" :disabled="isDisabled(todayValue)" @click="selectDate(todayValue)">今天</button><button v-if="modelValue" type="button" @click="clear">清除</button><button v-if="dateTime" type="button" @click="open = false">完成</button></footer>
      </div>
    </div>
  `,
}

createApp({
  components: { ThemedSelect, ThemedDatePicker },
  data() {
    const allowedPages = ['overview', 'customers', 'heatmap', 'followups', 'updates', 'visitors', 'plans']
    const hashPage = window.location.hash.replace(/^#\/?/, '')
    return {
      theme: localStorage.getItem('yd-theme') || 'minimal',
      activePage: allowedPages.includes(hashPage) ? hashPage : 'overview',
      customerPool: 'active',
      keyword: '',
      hoveredGrade: '',
      customerGrade: 'all',
      sourceFilter: 'all',
      projectTypeFilter: 'all',
      progressFilter: 'all',
      provinceFilter: 'all',
      cityFilter: 'all',
      dateFrom: '',
      dateTo: '',
      mapGrade: 'all',
      showCreate: false,
      showCreateUnsavedConfirm: false,
      createSnapshot: '',
      savingCreate: false,
      pageScrollLockY: 0,
      showEdit: false,
      showUnsavedConfirm: false,
      editSnapshot: '',
      savingEdit: false,
      showCustomerDelete: false,
      deletingCustomer: false,
      editingIndex: -1,
      toast: '',
      toastTimer: null,
      mapChart: null,
      chinaGeoJSON: null,
      mapError: '',
      regionTree: [],
      regionLoadError: '',
      openRegionMenu: '',
      newRegionSearch: { province: '', city: '', district: '' },
      employees: { all: [], business: [], technical: [] },
      employeeLoadError: '',
      customerLoadError: '',
      customerFollowUps: [],
      customerProgressUpdates: [],
      customerVisitorRecords: [],
      customerSchemeCalculation: null,
      customerMaterialExperiment: null,
      customerCanManageProject: false,
      expandedCustomerProgressStage: '',
      expandedProgressIntervalKey: '',
      expandedProgressUpdateId: null,
      customerFollowUpsLoading: false,
      customerFollowUpsError: '',
      customerProjects: [],
      projectTypes: [],
      projectTypesCanManage: false,
      projectTypeName: '',
      projectTypeSaving: false,
      showProjectTypeManager: false,
      progressUpdates: [],
      readProgressUpdates: [],
      periodProgressUpdates: [],
      collapsedProgressGroups: {},
      readProgressArchiveExpanded: false,
      readingProgressUpdateIds: {},
      progressUpdateUnreadCount: 0,
      progressUpdatesLoading: false,
      showProgressUpdates: false,
      showProgressUpdateCreate: false,
      editingProgressUpdateId: null,
      progressUpdateForm: { occurredAt: '', content: '', fromProgress: '', toProgress: '' },
      progressUpdateSaving: false,
      showMaterialExperiment: false,
      materialExperimentSaving: false,
      materialExperimentForm: { stableMaterial: '', day7Data: '', day14Data: '', day28Data: '', technicalMessage: '' },
      showSchemeCalculator: false,
      schemeLoading: false,
      schemeSaving: false,
      schemeExporting: false,
      schemeCalculation: { id: null, projectId: '', title: '', layerCount: 1, layers: [], remarks: '', remarksLines: ['', '', ''], totalPrice: 0, createdLabel: '', updatedLabel: '', updatedBy: '', canEdit: true },
      visitorRecords: [],
      visitorPeopleOverflowFrame: 0,
      visitorLoading: false,
      visitorSaving: false,
      visitorImporting: false,
      visitorExporting: false,
      showVisitorDetail: false,
      activeVisitorRecord: null,
      visitorDetailReturnRecordId: null,
      showVisitorForm: false,
      editingVisitorId: null,
      visitorCustomerSearch: '',
      visitorFilters: { keyword: '', dateFrom: '', dateTo: '', source: 'all', hostId: 'all' },
      visitorForm: { customerId: '', visitDate: '', visitorCount: 1, visitorContacts: [{ name: '', role: '' }], purpose: '', remarks: '', hostIds: [] },
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
      showFollowTaskEdit: false,
      editingFollowTask: null,
      followTaskEditForm: { title: '', role: 'business', dueAt: '', result: '' },
      followTaskSaving: false,
      showFollowTaskDelete: false,
      deletingFollowTask: null,
      followTaskDeleting: false,
      showManualTaskCreate: false,
      activeManualProject: null,
      manualTaskForm: { title: '', role: 'business', dueAt: '' },
      manualTaskSaving: false,
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
        { id: 'visitors', label: '来访接待', icon: '访' },
        { id: 'plans', label: '明日安排', icon: '明' },
      ],
      metrics: [
        { label: '有效客资总览', value: '20', change: 'A / B / C', note: '有效客资与等级构成', icon: '客', tone: 'blue', trend: 1, action: 'customers-summary' },
        { label: '每日进度更新', value: '0', change: '近 7 天', note: '暂无项目进度更新', icon: '更', tone: 'orange', trend: 0, action: 'progress-updates' },
        { label: '实施中项目', value: '0', change: '占 0%', note: '当前处于项目实施跟进阶段', icon: '施', tone: 'green', trend: 1, action: 'construction' },
      ],
      customers: [
        { name: '浙江恒筑工程', phone: '138****6672', source: '抖音', channel: '短视频私信', region: '浙江 · 杭州', grade: 'A', plan: '园区道路土凝岩施工方案', progress: '方案与报价', percent: 72, owner: '王经理', tech: '陈工', updated: '10分钟前', color: '#5b7cfa' },
        { name: '张先生', phone: '186****3021', source: '视频号', channel: '直播间咨询', region: '广东 · 佛山', grade: 'A', plan: '厂区地坪改造方案', progress: '方案与报价', percent: 86, owner: '李经理', tech: '周工', updated: '35分钟前', color: '#8b5cf6' },
        { name: '山东路达建设', phone: '159****4826', source: '抖音', channel: '广告投放', region: '山东 · 济南', grade: 'B', plan: '乡村道路硬化方案', progress: '合同签订', percent: 100, owner: '王经理', tech: '陈工', updated: '1小时前', color: '#19a974' },
        { name: '刘工', phone: '177****9530', source: '视频号', channel: '自然搜索', region: '四川 · 成都', grade: 'B', plan: '景区步道材料建议', progress: '需求对接', percent: 38, owner: '赵经理', tech: '周工', updated: '2小时前', color: '#f59e0b' },
        { name: '河南新材项目部', phone: '132****4178', source: '抖音', channel: '直播间咨询', region: '河南 · 郑州', grade: 'C', plan: '待现场参数确认', progress: '需求对接', percent: 20, owner: '李经理', tech: '待分配', updated: '昨天', color: '#0ea5e9' },
        { name: '湖北诚远施工', phone: '180****8824', source: '朋友介绍', channel: '介绍人：陈先生', referrer: '陈先生', region: '湖北 · 武汉', grade: 'A', plan: '物流园重载道路方案', progress: '方案与报价', percent: 78, owner: '赵经理', tech: '陈工', updated: '昨天', color: '#ec4899' },
        { name: '福建绿建工程', phone: '135****7641', source: '抖音', channel: '短视频私信', region: '福建 · 厦门', grade: 'B', plan: '滨海步道施工方案', progress: '客户深度沟通', percent: 44, owner: '王经理', tech: '周工', updated: '2天前', color: '#14b8a6' },
        { name: '杭州森远建材', phone: '137****2189', source: '视频号', channel: '直播间咨询', region: '浙江 · 杭州', grade: 'B', plan: '仓储区地面加固方案', progress: '合同签订', percent: 100, owner: '李经理', tech: '陈工', updated: '2天前', color: '#6366f1' },
        { name: '宁波海创建设', phone: '188****5503', source: '朋友介绍', channel: '介绍人：赵总', referrer: '赵总', region: '浙江 · 宁波', grade: 'A', plan: '港区道路耐磨方案', progress: '方案与报价', percent: 70, owner: '赵经理', tech: '周工', updated: '3天前', color: '#2563eb' },
        { name: '绍兴陈先生', phone: '150****3927', source: '抖音', channel: '短视频私信', region: '浙江 · 绍兴', grade: 'C', plan: '庭院地面材料建议', progress: '需求对接', percent: 18, owner: '王经理', tech: '待分配', updated: '3天前', color: '#64748b' },
        { name: '佛山鼎创建材', phone: '139****8046', source: '视频号', channel: '自然搜索', region: '广东 · 佛山', grade: 'B', plan: '厂房道路施工方案', progress: '技术验证', percent: 52, owner: '李经理', tech: '周工', updated: '4天前', color: '#0891b2' },
        { name: '东莞黄工', phone: '181****6340', source: '抖音', channel: '直播间咨询', region: '广东 · 东莞', grade: 'C', plan: '园区步道材料建议', progress: '需求对接', percent: 32, owner: '赵经理', tech: '待分配', updated: '4天前', color: '#0d9488' },
        { name: '青岛海岳工程', phone: '156****9175', source: '朋友介绍', channel: '介绍人：孙经理', referrer: '孙经理', region: '山东 · 青岛', grade: 'A', plan: '滨海道路土凝岩方案', progress: '合同签订', percent: 100, owner: '王经理', tech: '陈工', updated: '5天前', color: '#0284c7' },
        { name: '临沂周先生', phone: '133****4612', source: '抖音', channel: '广告投放', region: '山东 · 临沂', grade: 'C', plan: '乡村庭院改造建议', progress: '需求对接', percent: 16, owner: '李经理', tech: '待分配', updated: '5天前', color: '#475569' },
        { name: '江苏路联建设', phone: '189****2058', source: '视频号', channel: '直播间咨询', region: '江苏 · 南京', grade: 'B', plan: '市政辅路施工方案', progress: '技术验证', percent: 48, owner: '赵经理', tech: '陈工', updated: '6天前', color: '#7c3aed' },
        { name: '苏州吴经理', phone: '151****7384', source: '抖音', channel: '短视频私信', region: '江苏 · 苏州', grade: 'C', plan: '厂区地坪需求评估', progress: '需求对接', percent: 28, owner: '王经理', tech: '周工', updated: '6天前', color: '#9333ea' },
        { name: '洛阳厚土工程', phone: '158****3691', source: '朋友介绍', channel: '介绍人：王工', referrer: '王工', region: '河南 · 洛阳', grade: 'B', plan: '景区道路硬化方案', progress: '方案与报价', percent: 75, owner: '李经理', tech: '陈工', updated: '7天前', color: '#c2410c' },
        { name: '成都蜀创建材', phone: '136****8420', source: '视频号', channel: '自然搜索', region: '四川 · 成都', grade: 'A', plan: '物流场地重载方案', progress: '方案与报价', percent: 84, owner: '赵经理', tech: '周工', updated: '7天前', color: '#ea580c' },
        { name: '合肥安创建设', phone: '187****1265', source: '抖音', channel: '广告投放', region: '安徽 · 合肥', grade: 'B', plan: '园区道路改造方案', progress: '方案与报价', percent: 68, owner: '王经理', tech: '陈工', updated: '8天前', color: '#16a34a' },
        { name: '石家庄赵工', phone: '152****5908', source: '视频号', channel: '直播间咨询', region: '河北 · 石家庄', grade: 'C', plan: '项目材料初步建议', progress: '需求对接', percent: 14, owner: '李经理', tech: '待分配', updated: '8天前', color: '#65a30d' },
      ],
      tasks: [
        { time: '09:30', name: '浙江恒筑工程', action: '确认方案技术参数', level: 'urgent' },
        { time: '11:00', name: '张先生', action: '回访报价反馈', level: 'important' },
      ],
      mapGrades: [
        { id: 'all', label: '全部客户' }, { id: 'A', label: 'A级客户' }, { id: 'B', label: 'B级客户' }, { id: 'C', label: 'C级客户' },
      ],
      progressStages: [
        '需求对接',
        '技术验证',
        '客户深度沟通',
        '方案与报价',
        '合同签订',
        '项目实施跟进',
        '售后维护与需求挖掘',
      ],
      progressStageDetails: {
        需求对接: '了解客户需求、技术参数、工期及项目背景。',
        技术验证: '组织技术评估、寄样测试，并反馈实验结果。',
        客户深度沟通: '邀约来访、商务接待，必要时安排现场勘查。',
        方案与报价: '向客户汇报技术方案，完成报价及商务谈判。',
        合同签订: '推进合同评审、签署、用印及开票等工作。',
        项目实施跟进: '组织技术交底、试验段及现场施工指导，协调项目问题。',
        售后维护与需求挖掘: '开展满意度回访，挖掘复购及转介绍机会。',
      },
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
      newCustomer: { name: '', phone: '', source: '抖音', referrer: '', province: '', city: '', district: '', grade: 'B', projectTypeId: '', progress: '需求对接', ownerId: '', owner: '', techId: '', tech: '', plan: '', description: '' },
      editCustomer: { name: '', phone: '', source: '抖音', referrer: '', province: '', city: '', district: '', grade: 'B', projectTypeId: '', progress: '需求对接', ownerId: '', owner: '', techId: '', tech: '', plan: '', description: '' },
    }
  },
  computed: {
    themeName() {
      return this.themes.find(item => item.id === this.theme)?.name || '极简商务'
    },
    selectedVisitorCustomerLabel() {
      const customer = this.customers.find(item => item.id === this.visitorForm.customerId)
      return customer ? `${customer.grade}级 · ${customer.name} · ${customer.phone}` : '请选择客户'
    },
    selectedVisitorHostLabel() {
      const names = this.visitorHostOptions
        .filter(employee => this.visitorForm.hostIds.includes(employee.id))
        .map(employee => employee.display_name)
      if (!names.length) return '待分配'
      return names.length <= 2 ? names.join('、') : `${names.slice(0, 2).join('、')} 等 ${names.length} 人`
    },
    visitorCustomerOptions() {
      const keyword = this.visitorCustomerSearch.trim().toLowerCase()
      if (!keyword) return this.customers
      return this.customers.filter(customer => `${customer.name} ${customer.phone} ${customer.grade}`.toLowerCase().includes(keyword))
    },
    visitorHostOptions() {
      const candidates = this.employees.all?.length
        ? this.employees.all
        : [...this.employees.business, ...this.employees.technical]
      return candidates.filter((employee, index, list) => list.findIndex(item => item.id === employee.id) === index)
    },
    visitorSourceOptions() {
      return [...new Set(this.visitorRecords.map(record => record.customer.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    },
    visitorSourceSelectOptions() {
      return [{ value: 'all', label: '全部来源' }, ...this.visitorSourceOptions.map(source => ({ value: source, label: source }))]
    },
    visitorHostSelectOptions() {
      return [{ value: 'all', label: '全部人员' }, ...this.visitorHostOptions.map(employee => ({ value: String(employee.id), label: employee.display_name, detail: employee.username }))]
    },
    customerSourceSelectOptions() {
      return ['抖音', '视频号', '朋友介绍'].map(source => ({ value: source, label: source }))
    },
    editCustomerSourceSelectOptions() {
      const options = [...this.customerSourceSelectOptions]
      if (this.editCustomer.source && !options.some(option => option.value === this.editCustomer.source)) {
        options.unshift({ value: this.editCustomer.source, label: this.editCustomer.source })
      }
      return options
    },
    customerGradeSelectOptions() {
      return ['A', 'B', 'C', 'D'].map(grade => ({ value: grade, label: `${grade} 级客户` }))
    },
    taskRoleSelectOptions() {
      return [{ value: 'business', label: '商务' }, { value: 'technical', label: '技术' }]
    },
    filteredVisitorRecords() {
      const keyword = this.visitorFilters.keyword.trim().toLowerCase()
      return this.visitorRecords.filter(record => {
        const contacts = (record.visitorContacts || []).map(contact => `${contact.name || ''} ${contact.role || ''}`).join(' ')
        const hosts = (record.hostNames || []).join(' ')
        const haystack = `${record.customer.name} ${contacts} ${record.purpose || ''} ${record.remarks || ''} ${hosts}`.toLowerCase()
        if (keyword && !haystack.includes(keyword)) return false
        if (this.visitorFilters.dateFrom && record.visitDate < this.visitorFilters.dateFrom) return false
        if (this.visitorFilters.dateTo && record.visitDate > this.visitorFilters.dateTo) return false
        if (this.visitorFilters.source !== 'all' && record.customer.source !== this.visitorFilters.source) return false
        if (this.visitorFilters.hostId !== 'all' && !(record.hostIds || []).includes(Number(this.visitorFilters.hostId))) return false
        return true
      })
    },
    visitorRecordSequenceMap() {
      return [...this.visitorRecords]
        .sort((first, second) => (
          String(first.visitDate || '').localeCompare(String(second.visitDate || ''))
          || Number(first.id || 0) - Number(second.id || 0)
        ))
        .reduce((result, record, index) => {
          result[record.id] = String(index + 1).padStart(2, '0')
          return result
        }, {})
    },
    hasVisitorFilters() {
      return Boolean(
        this.visitorFilters.keyword
        || this.visitorFilters.dateFrom
        || this.visitorFilters.dateTo
        || this.visitorFilters.source !== 'all'
        || this.visitorFilters.hostId !== 'all'
      )
    },
    pageTitle() {
      if (this.activePage === 'updates') return '进度更新汇总'
      return this.navItems.find(item => item.id === this.activePage)?.label || '经营总览'
    },
    customerPageTitle() {
      if (this.customerPool === 'dormant') return 'D 类沉淀客户'
      return this.progressFilter === 'construction' ? '施工阶段项目' : '全部客资'
    },
    customerPageSubtitle() {
      if (this.customerPool === 'dormant') return '低价值客资独立存放；重新评估后可修改为 A、B 或 C 类'
      return this.progressFilter === 'construction'
        ? '仅展示当前处于试验段、A段或B段施工阶段的项目'
        : '统一查看和管理 A、B、C 类有效客户信息'
    },
    reportingCustomers() {
      return this.customers.filter(customer => customer.grade !== 'D')
    },
    dormantCustomers() {
      return this.customers.filter(customer => customer.grade === 'D')
    },
    customerPoolCustomers() {
      return this.customerPool === 'dormant' ? this.dormantCustomers : this.reportingCustomers
    },
    currentPeriodLabel() {
      const today = new Date()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      return `近30天 · 截至 ${today.getFullYear()}-${month}-${day}`
    },
    todayDateValue() {
      return this.formatLocalDate(new Date())
    },
    recent30Customers() {
      const boundary = new Date()
      boundary.setHours(23, 59, 59, 999)
      boundary.setDate(boundary.getDate() - 29)
      boundary.setHours(0, 0, 0, 0)
      return this.reportingCustomers.filter(customer => {
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
    hasUnsavedCreate() {
      return Boolean(
        this.showCreate
        && this.createSnapshot
        && JSON.stringify(this.newCustomer) !== this.createSnapshot
      )
    },
    customerProgressRoadmap() {
      const currentIndex = Math.max(0, this.progressStages.indexOf(this.editCustomer.progress))
      return this.progressStages.map((name, index) => ({
        name,
        index,
        description: this.progressStageDetails[name] || '',
        state: index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming',
        tasks: this.customerFollowUps.filter(task => task.targetProgress === name),
      }))
    },
    customerProgressIntervals() {
      return this.progressStages.slice(0, -1).map((fromProgress, index) => {
        const toProgress = this.progressStages[index + 1]
        const records = this.customerProgressUpdates
          .filter(item => item.fromProgress === fromProgress && item.toProgress === toProgress)
          .slice()
          .sort((left, right) => String(left.occurredAt || '').localeCompare(String(right.occurredAt || '')) || Number(left.id || 0) - Number(right.id || 0))
        return {
          key: `${fromProgress}::${toProgress}`,
          index,
          fromProgress,
          toProgress,
          label: `${fromProgress} → ${toProgress}`,
          records,
        }
      })
    },
    expandedProgressInterval() {
      return this.customerProgressIntervals.find(interval => interval.key === this.expandedProgressIntervalKey) || null
    },
    expandedCustomerProgressRecord() {
      return this.customerProgressRoadmap.find(stage => stage.name === this.expandedCustomerProgressStage) || null
    },
    roadmapCanCreateManual() {
      return this.customerFollowUps.some(task => task.canCreateManual)
    },
    filteredCustomers() {
      const word = this.keyword.trim().toLowerCase()
      return this.customerPoolCustomers.filter(item => {
        const matchesWord = !word || [item.name, item.phone, item.region, item.plan, item.description].some(value => String(value || '').toLowerCase().includes(word))
        const matchesGrade = this.customerGrade === 'all' || item.grade === this.customerGrade
        const matchesSource = this.sourceFilter === 'all' || item.source === this.sourceFilter
        const matchesProjectType = this.projectTypeFilter === 'all' || this.customerHasProjectType(item, this.projectTypeFilter)
        const matchesProgress = this.progressFilter === 'all' || item.progress === this.progressFilter
        const location = this.locationParts(item)
        const matchesProvince = this.provinceFilter === 'all' || location.province === this.provinceFilter
        const matchesCity = this.cityFilter === 'all' || location.city === this.cityFilter
        const createdDate = item.createdDate || String(item.createdAt || '').slice(0, 10)
        const matchesDateFrom = !this.dateFrom || (createdDate && createdDate >= this.dateFrom)
        const matchesDateTo = !this.dateTo || (createdDate && createdDate <= this.dateTo)
        return matchesWord && matchesGrade && matchesSource && matchesProjectType && matchesProgress && matchesProvince && matchesCity && matchesDateFrom && matchesDateTo
      }).sort((left, right) => {
        const leftTime = Date.parse(left.createdAt || left.createdDate || '') || 0
        const rightTime = Date.parse(right.createdAt || right.createdDate || '') || 0
        return rightTime - leftTime || Number(right.id || 0) - Number(left.id || 0)
      })
    },
    provinceOptions() {
      const counts = new Map()
      this.customerPoolCustomers.forEach(customer => {
        const province = this.locationParts(customer).province
        if (!province.includes('待完善')) counts.set(province, (counts.get(province) || 0) + 1)
      })
      return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    },
    cityOptions() {
      const counts = new Map()
      this.customerPoolCustomers.forEach(customer => {
        const location = this.locationParts(customer)
        if (this.provinceFilter !== 'all' && location.province !== this.provinceFilter) return
        if (!location.city.includes('待完善')) counts.set(location.city, (counts.get(location.city) || 0) + 1)
      })
      return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    },
    gradeFilterOptions() {
      return ['A', 'B', 'C'].map(value => ({
        value,
        label: `${value} 级客户`,
        count: this.reportingCustomers.filter(customer => customer.grade === value).length,
      }))
    },
    sourceFilterOptions() {
      return ['抖音', '视频号', '朋友介绍'].map(value => ({
        value,
        label: value,
        count: this.customerPoolCustomers.filter(customer => customer.source === value).length,
      }))
    },
    projectTypeFilterOptions() {
      return this.projectTypes
        .filter(item => item.isActive && item.name !== '未分类')
        .map(item => ({
          value: String(item.id),
          label: item.name,
          count: this.customerPoolCustomers.filter(customer => this.customerHasProjectType(customer, item.id)).length,
        }))
    },
    progressFilterOptions() {
      return this.progressStages.map(stage => ({
        value: stage,
        label: stage,
        count: this.customerPoolCustomers.filter(customer => customer.progress === stage).length,
      }))
    },
    editProvinceOptions() {
      return this.regionTree
    },
    newProvinceOptions() {
      return this.regionTree
    },
    newProvinceMatches() {
      const word = this.newRegionSearch.province.trim()
      return word ? this.newProvinceOptions.filter(item => item.name.includes(word)) : this.newProvinceOptions
    },
    newCityOptions() {
      const province = this.regionTree.find(item => item.name === this.newCustomer.province)
      if (!province) return []
      const children = province.children || []
      const hasCityLevel = children.some(item => Array.isArray(item.children) && item.children.length)
      return hasCityLevel ? children : [{ name: province.name, code: province.code, children }]
    },
    newDistrictOptions() {
      const city = this.newCityOptions.find(item => item.name === this.newCustomer.city)
      return city?.children || []
    },
    newCityMatches() {
      const word = this.newRegionSearch.city.trim()
      return word ? this.newCityOptions.filter(item => item.name.includes(word)) : this.newCityOptions
    },
    newDistrictMatches() {
      const word = this.newRegionSearch.district.trim()
      return word ? this.newDistrictOptions.filter(item => item.name.includes(word)) : this.newDistrictOptions
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
      const total = this.reportingCustomers.length
      let cursor = 0
      return ['A', 'B', 'C'].map(grade => {
        const value = this.reportingCustomers.filter(customer => customer.grade === grade).length
        const ratio = total ? Math.round(value / total * 100) : 0
        const start = cursor
        cursor += ratio
        return {
          grade,
          value,
          ratio,
          start,
          arc: ratio ? Math.max(ratio - 8, .8) : 0,
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
      const colors = ['#4f7cf3', '#6d67df', '#0ea98b', '#e49a24', '#da6b49', '#337fc4', '#16946f']
      const buckets = this.progressStages.map((stage, index) => ({ key: `stage-${index}`, label: stage, values: [stage], color: colors[index] }))
      return buckets.map(bucket => ({
        ...bucket,
        value: this.reportingCustomers.filter(customer => bucket.values.includes(customer.progress)).length,
      }))
    },
    followFilterBaseTasks() {
      return this.followUpTasks.filter(task => {
        const project = task.project || {}
        const customer = project.customer || {}
        if (!['A', 'B'].includes(customer.grade)) return false
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
      return ['A', 'B'].map(value => ({
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
    overviewGradeCounts() {
      return Object.fromEntries(
        ['A', 'B', 'C'].map(grade => [
          grade,
          this.reportingCustomers.filter(customer => customer.grade === grade).length,
        ]),
      )
    },
    trendChart() {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      const offsets = [0, 6, 12, 18, 24, 29]
      const sources = [
        { name: '抖音', className: 'line-main' },
        { name: '视频号', className: 'line-second' },
        { name: '朋友介绍', className: 'line-third' },
      ]
      const dates = offsets.map(offset => {
        const value = new Date(start)
        value.setDate(start.getDate() + offset)
        if (offset === 29) value.setTime(today.getTime())
        return value
      })
      const valuesBySource = sources.map(source => dates.map(point => (
        this.recent30Customers.filter(customer => {
          const created = new Date(customer.createdAt || customer.createdDate)
          return customer.source === source.name && created <= point
        }).length
      )))
      const maximum = Math.max(4, ...valuesBySource.flat())
      const yFor = value => 200 - (value / maximum * 170)
      return {
        maximum,
        ticks: [maximum, Math.round(maximum * .75), Math.round(maximum * .5), Math.round(maximum * .25), 0],
        labels: dates.map(date => `${date.getMonth() + 1}月${date.getDate()}日`),
        series: sources.map((source, sourceIndex) => {
          const points = valuesBySource[sourceIndex].map((value, index) => `${index * 140},${yFor(value)}`).join(' ')
          return { ...source, points }
        }),
        areaPoints: `0,220 ${valuesBySource[0].map((value, index) => `${index * 140},${yFor(value)}`).join(' ')} 700,220`,
      }
    },
    projectTypeStats() {
      const effectiveProjects = this.customerProjects.filter(project => project.customer?.grade !== 'D' && project.isActive !== false)
      const grouped = new Map()
      effectiveProjects.forEach(project => {
        const name = project.projectType?.name || '未分类'
        grouped.set(name, (grouped.get(name) || 0) + 1)
      })
      const configured = this.projectTypes.filter(item => item.isActive && item.name !== '未分类').map(item => ({
        ...item,
        value: grouped.get(item.name) || 0,
      }))
      return configured.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    },
    groupedProgressUpdates() {
      const groups = new Map()
      this.progressUpdates.forEach(item => {
        const fallbackOwner = item.project?.businessOwner || {}
        const source = item.updateGroup || {
          key: `business-${fallbackOwner.id || 'unassigned'}`,
          nature: 'business',
          natureLabel: '商务',
          ownerId: fallbackOwner.id || '',
          ownerName: fallbackOwner.name || '待分配',
          level: Number(fallbackOwner.businessLevel || 0),
          levelLabel: `商务等级 ${Number(fallbackOwner.businessLevel || 0)} 级`,
        }
        const key = source.key
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            name: source.ownerName || '待分配',
            ownerId: source.ownerId || '',
            nature: source.nature || 'business',
            natureLabel: source.natureLabel || '商务',
            level: Number(source.level || 0),
            levelLabel: source.levelLabel || '',
            updates: [],
          })
        }
        groups.get(key).updates.push(item)
      })
      const natureOrder = { business: 0, technical: 1, both: 2 }
      return [...groups.values()].sort((a, b) => (
        (natureOrder[a.nature] ?? 9) - (natureOrder[b.nature] ?? 9)
        || b.level - a.level
        || a.name.localeCompare(b.name, 'zh-CN')
      ))
    },
    progressNatureSections() {
      const definitions = [
        { id: 'nature-business', nature: 'business', label: '商务', icon: '商', description: '按商务负责人及商务等级排序' },
        { id: 'nature-technical', nature: 'technical', label: '技术', icon: '技', description: '按技术负责人及技术等级排序' },
        { id: 'nature-both', nature: 'both', label: '商务与技术', icon: '兼', description: '兼任岗位的综合进度更新' },
      ]
      return definitions.map(section => {
        const groups = this.groupedProgressUpdates.filter(group => group.nature === section.nature)
        return {
          ...section,
          groups,
          updateCount: groups.reduce((total, group) => total + group.updates.length, 0),
        }
      })
    },
    progressNatureStats() {
      const stats = { business: 0, technical: 0, both: 0 }
      this.periodProgressUpdates.forEach(item => {
        const nature = item.updateGroup?.nature || item.updateNature || 'business'
        stats[nature] = (stats[nature] || 0) + 1
      })
      return stats
    },
    recent30VisitorRecords() {
      const boundary = new Date()
      boundary.setHours(0, 0, 0, 0)
      boundary.setDate(boundary.getDate() - 29)
      return this.visitorRecords.filter(item => new Date(`${item.visitDate}T12:00:00`) >= boundary)
    },
    visitorSummary() {
      return {
        visits: this.recent30VisitorRecords.length,
        people: this.recent30VisitorRecords.reduce((sum, item) => sum + Number(item.visitorCount || 0), 0),
      }
    },
    visitorTrendChart() {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      const offsets = [0, 6, 12, 18, 24, 29]
      const dates = offsets.map(offset => {
        const value = new Date(start)
        value.setDate(start.getDate() + offset)
        if (offset === 29) value.setTime(today.getTime())
        return value
      })
      const visits = dates.map(point => this.recent30VisitorRecords.filter(item => new Date(`${item.visitDate}T12:00:00`) <= point).length)
      const people = dates.map(point => this.recent30VisitorRecords.filter(item => new Date(`${item.visitDate}T12:00:00`) <= point).reduce((sum, item) => sum + Number(item.visitorCount || 0), 0))
      const maximum = Math.max(4, ...visits, ...people)
      const yFor = value => 200 - (value / maximum * 170)
      return {
        ticks: [maximum, Math.round(maximum * .75), Math.round(maximum * .5), Math.round(maximum * .25), 0],
        labels: dates.map(date => `${date.getMonth() + 1}月${date.getDate()}日`),
        visitsPoints: visits.map((value, index) => `${index * 140},${yFor(value)}`).join(' '),
        peoplePoints: people.map((value, index) => `${index * 140},${yFor(value)}`).join(' '),
        areaPoints: `0,220 ${visits.map((value, index) => `${index * 140},${yFor(value)}`).join(' ')} 700,220`,
      }
    },
    hasOpenOverlay() {
      return Boolean(
        this.showCreate
        || this.showEdit
        || this.showTaskComplete
        || this.showFollowTaskEdit
        || this.showFollowTaskDelete
        || this.showManualTaskCreate
        || this.showProgressUpdates
        || this.showProgressUpdateCreate
        || this.showSchemeCalculator
        || this.showProjectTypeManager
        || this.showVisitorDetail
        || this.showVisitorForm
        || this.activeSuggestion
      )
    },
  },
  watch: {
    hasOpenOverlay(locked) {
      const body = document.body
      if (locked) {
        if (body.classList.contains('modal-open')) return
        this.pageScrollLockY = window.scrollY
        body.style.position = 'fixed'
        body.style.top = `-${this.pageScrollLockY}px`
        body.style.right = '0'
        body.style.left = '0'
        body.style.width = '100%'
        document.documentElement.classList.add('modal-open')
        body.classList.add('modal-open')
        return
      }
      if (!body.classList.contains('modal-open')) return
      const restoreY = this.pageScrollLockY
      document.documentElement.classList.remove('modal-open')
      body.classList.remove('modal-open')
      body.style.removeProperty('position')
      body.style.removeProperty('top')
      body.style.removeProperty('right')
      body.style.removeProperty('left')
      body.style.removeProperty('width')
      window.scrollTo(0, restoreY)
      this.pageScrollLockY = 0
    },
  },
  methods: {
    setTheme(theme) {
      this.theme = theme
      localStorage.setItem('yd-theme', theme)
      nextTick(() => this.renderMap())
    },
    handleMetric(metric) {
      if (metric.action === 'customers-summary') this.openCustomerList()
      if (metric.action === 'progress-updates') this.openProgressUpdates()
      if (metric.action === 'followups') this.switchPage('followups')
      if (metric.action === 'done') this.openCustomerList({ progress: 'done' })
      if (metric.action === 'construction') this.openCustomerList({ progress: 'construction' })
    },
    openCustomerList({ grade = 'all', source = 'all', projectType = 'all', progress = 'all', province = 'all', city = 'all' } = {}) {
      this.customerPool = 'active'
      this.keyword = ''
      this.customerGrade = grade
      this.sourceFilter = source
      this.projectTypeFilter = String(projectType)
      this.progressFilter = progress
      this.provinceFilter = province
      this.cityFilter = city
      this.dateFrom = ''
      this.dateTo = ''
      this.switchPage('customers')
    },
    openProjectTypeCustomers(projectType) {
      if (!projectType || projectType.name === '未分类') return
      this.openCustomerList({ projectType: projectType.id })
    },
    customerHasProjectType(customer, projectTypeId) {
      const targetId = String(projectTypeId || '')
      if (!targetId) return false
      return this.customerProjects.some(project => (
        project.isActive !== false
        && project.customer?.id === customer.id
        && String(project.projectType?.id || '') === targetId
      )) || String(customer.projectTypeId || '') === targetId
    },
    openDormantCustomerPool() {
      this.customerPool = this.customerPool === 'dormant' ? 'active' : 'dormant'
      this.resetFilters()
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
      if (page === 'visitors') this.loadVisitorRecords()
      if (page === 'plans') {
        this.loadFollowUpTasks()
        this.loadTomorrowItems()
      }
    },
    setMapGrade(grade) {
      this.mapGrade = grade
      this.renderMap()
    },
    resolveMapProvince(regionName) {
      const normalize = value => String(value || '')
        .replace(/特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市/g, '')
        .trim()
      const target = normalize(regionName)
      return this.provinceOptions.find(option => normalize(option.name) === target)?.name || ''
    },
    openMapProvinceCustomers(regionName) {
      const province = this.resolveMapProvince(regionName)
      if (!province) {
        this.showToast(`${regionName || '该地区'}暂无可筛选的客资`)
        return
      }
      this.openCustomerList({
        grade: this.mapGrade === 'all' ? 'all' : this.mapGrade,
        province,
      })
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
          this.openMapProvinceCustomers(params.name)
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
      this.projectTypeFilter = 'all'
      this.progressFilter = 'all'
      this.provinceFilter = 'all'
      this.cityFilter = 'all'
      this.dateFrom = ''
      this.dateTo = ''
      this.openRegionMenu = ''
      if (clearKeyword) this.keyword = ''
    },
    formatFilterDate(value) {
      if (!value) return ''
      const [year, month, day] = value.split('-')
      return `${year} / ${month} / ${day}`
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
    async copyCustomerField(value, label) {
      const text = String(value || '').trim()
      if (!text) {
        this.showToast(`${label}为空，暂无可复制内容`)
        return
      }
      let fallbackInput = null
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          fallbackInput = document.createElement('textarea')
          fallbackInput.value = text
          fallbackInput.setAttribute('readonly', '')
          fallbackInput.style.position = 'fixed'
          fallbackInput.style.opacity = '0'
          document.body.appendChild(fallbackInput)
          fallbackInput.select()
          if (!document.execCommand('copy')) throw new Error('copy command failed')
        }
        this.showToast(`${label}已复制：${text}`)
      } catch (error) {
        this.showToast(`${label}复制失败，请重试`)
      } finally {
        fallbackInput?.remove()
      }
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
          all: Array.isArray(data.all) ? data.all : [],
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
    async loadProjectTypes() {
      try {
        const response = await fetch('/api/project-types/')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `项目类型加载失败（${response.status}）`)
        this.projectTypes = Array.isArray(data.types) ? data.types : []
        this.projectTypesCanManage = Boolean(data.canManage)
      } catch (error) {
        this.showToast(error.message || '项目类型加载失败')
      }
    },
    async loadProgressUpdates() {
      this.progressUpdatesLoading = true
      try {
        const response = await fetch('/api/progress-updates/')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `进度更新加载失败（${response.status}）`)
        this.progressUpdates = Array.isArray(data.updates) ? data.updates : []
        this.readProgressUpdates = Array.isArray(data.readUpdates) ? data.readUpdates : []
        this.periodProgressUpdates = Array.isArray(data.periodUpdates) ? data.periodUpdates : this.progressUpdates
        this.progressUpdateUnreadCount = Number(data.unreadCount || 0)
        this.metrics[1].value = String(data.total || 0)
        this.metrics[1].change = this.progressUpdateUnreadCount ? `新 ${this.progressUpdateUnreadCount} 条` : '近 7 天'
        this.metrics[1].note = data.total ? `近一周共有 ${data.total} 条项目进展` : '近一周暂无项目进展'
      } catch (error) {
        this.showToast(error.message || '进度更新加载失败')
      } finally {
        this.progressUpdatesLoading = false
      }
    },
    async openProgressUpdates() {
      this.switchPage('updates')
      await this.loadProgressUpdates()
      if (this.progressUpdateUnreadCount) {
        await fetch('/api/progress-updates/read/', {
          method: 'POST',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        this.progressUpdateUnreadCount = 0
        this.metrics[1].change = '近 7 天'
      }
    },
    closeProgressUpdates() {
      this.switchPage('overview')
    },
    openProgressUpdateCustomer(item) {
      const customer = this.customers.find(current => current.id === item?.project?.customer?.id)
      if (!customer) return this.showToast('未找到关联客资')
      this.switchPage('customers')
      nextTick(() => this.openCustomerEdit(customer))
    },
    toggleProgressGroup(groupId) {
      this.collapsedProgressGroups = {
        ...this.collapsedProgressGroups,
        [groupId]: !this.collapsedProgressGroups[groupId],
      }
    },
    async markProgressUpdateRead(item) {
      if (!item?.id || this.readingProgressUpdateIds[item.id]) return
      this.readingProgressUpdateIds = { ...this.readingProgressUpdateIds, [item.id]: true }
      try {
        const response = await fetch(`/api/progress-updates/${item.id}/read/`, {
          method: 'POST',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `标记已读失败（${response.status}）`)
        const archived = data.update || item
        this.progressUpdates = this.progressUpdates.filter(current => current.id !== item.id)
        this.readProgressUpdates = [
          archived,
          ...this.readProgressUpdates.filter(current => current.id !== item.id),
        ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt) || b.id - a.id)
        this.showToast('已移至页面底部的“已读进度记录”')
      } catch (error) {
        this.showToast(error.message || '标记已读失败')
      } finally {
        const nextState = { ...this.readingProgressUpdateIds }
        delete nextState[item.id]
        this.readingProgressUpdateIds = nextState
      }
    },
    async loadVisitorRecords() {
      this.visitorLoading = true
      try {
        const response = await fetch('/api/visitors/')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `来访记录加载失败（${response.status}）`)
        this.visitorRecords = Array.isArray(data.records) ? data.records : []
      } catch (error) {
        this.showToast(error.message || '来访记录加载失败')
      } finally {
        this.visitorLoading = false
      }
    },
    emptyVisitorForm() {
      return { customerId: '', visitDate: this.todayDateValue, visitorCount: 1, visitorContacts: [{ name: '', role: '' }], purpose: '', remarks: '', hostIds: [] }
    },
    openVisitorDetail(record) {
      if (!record?.id) return
      this.activeVisitorRecord = record
      this.showVisitorDetail = true
      this.openRegionMenu = ''
    },
    closeVisitorDetail() {
      this.showVisitorDetail = false
      this.activeVisitorRecord = null
      this.visitorDetailReturnRecordId = null
    },
    editVisitorFromDetail() {
      const record = this.activeVisitorRecord
      if (!record?.canManage) return
      this.closeVisitorDetail()
      this.openVisitorForm(record)
    },
    formatVisitorUpdatedAt(value) {
      const date = new Date(value)
      if (!value || Number.isNaN(date.getTime())) return '时间待补充'
      return date.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    },
    openVisitorForm(record = null) {
      this.editingVisitorId = record?.id || null
      this.visitorForm = record ? {
        customerId: record.customer.id,
        visitDate: record.visitDate,
        visitorCount: record.visitorCount,
        visitorContacts: record.visitorContacts?.length
          ? record.visitorContacts.map(contact => ({ name: contact.name || '', role: contact.role || '' }))
          : [{ name: record.contactName || '', role: '' }],
        purpose: record.purpose || '',
        remarks: record.remarks || '',
        hostIds: Array.isArray(record.hostIds) ? [...record.hostIds] : (record.hostId ? [record.hostId] : []),
      } : this.emptyVisitorForm()
      this.visitorCustomerSearch = ''
      this.openRegionMenu = ''
      this.showVisitorForm = true
    },
    closeVisitorForm() {
      if (this.visitorSaving) return
      this.showVisitorForm = false
      this.editingVisitorId = null
      this.visitorCustomerSearch = ''
      this.openRegionMenu = ''
      this.visitorForm = this.emptyVisitorForm()
    },
    selectVisitorCustomer(customer) {
      this.visitorForm.customerId = customer.id
      this.visitorCustomerSearch = ''
      this.openRegionMenu = ''
    },
    toggleVisitorHost(employee) {
      const hostIds = new Set(this.visitorForm.hostIds)
      if (hostIds.has(employee.id)) hostIds.delete(employee.id)
      else hostIds.add(employee.id)
      this.visitorForm.hostIds = [...hostIds]
    },
    addVisitorContact() {
      this.visitorForm.visitorContacts.push({ name: '', role: '' })
    },
    removeVisitorContact(index) {
      this.visitorForm.visitorContacts.splice(index, 1)
      if (!this.visitorForm.visitorContacts.length) this.addVisitorContact()
    },
    resetVisitorFilters() {
      this.visitorFilters = { keyword: '', dateFrom: '', dateTo: '', source: 'all', hostId: 'all' }
      this.openRegionMenu = ''
    },
    scheduleVisitorPeopleOverflowCheck() {
      if (this.visitorPeopleOverflowFrame) cancelAnimationFrame(this.visitorPeopleOverflowFrame)
      this.visitorPeopleOverflowFrame = requestAnimationFrame(() => {
        document.querySelectorAll('.visitor-record-card .visitor-people-list, .visitor-record-card .visitor-host-list').forEach(list => {
          list.classList.remove('is-overflowing')
          list.classList.toggle('is-overflowing', list.clientWidth > 0 && list.scrollWidth > list.clientWidth + 1)
        })
      })
    },
    async saveVisitorRecord() {
      if (this.visitorSaving) return
      if (!this.visitorForm.customerId || !this.visitorForm.visitDate || !this.visitorForm.purpose.trim()) {
        return this.showToast('请选择关联客资、来访日期并填写来访目的')
      }
      const namedContacts = this.visitorForm.visitorContacts.filter(contact => contact.name.trim() || contact.role.trim())
      if (namedContacts.some(contact => !contact.name.trim())) return this.showToast('请补全来访人员的姓名')
      this.visitorForm.visitorContacts = namedContacts
      this.visitorForm.visitorCount = Math.max(Number(this.visitorForm.visitorCount || 1), namedContacts.length, 1)
      this.visitorSaving = true
      const wasEditing = Boolean(this.editingVisitorId)
      try {
        const url = this.editingVisitorId ? `/api/visitors/${this.editingVisitorId}/` : '/api/visitors/'
        const response = await fetch(url, {
          method: this.editingVisitorId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify(this.visitorForm),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        this.showVisitorForm = false
        this.editingVisitorId = null
        this.visitorForm = this.emptyVisitorForm()
        await this.loadVisitorRecords()
        this.showToast(wasEditing ? '来访记录已修改' : '来访记录已新增')
      } catch (error) {
        this.showToast(error.message || '来访记录保存失败')
      } finally {
        this.visitorSaving = false
      }
    },
    async deleteVisitorRecord(record) {
      if (!record?.id || !window.confirm(`确定删除 ${record.customer.name} 的这条来访记录吗？`)) return
      try {
        const response = await fetch(`/api/visitors/${record.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `删除失败（${response.status}）`)
        this.visitorRecords = this.visitorRecords.filter(item => item.id !== record.id)
        if (this.activeVisitorRecord?.id === record.id) this.closeVisitorDetail()
        this.showToast('来访记录已删除')
      } catch (error) {
        this.showToast(error.message || '来访记录删除失败')
      }
    },
    async handleVisitorExcelImport(event) {
      const file = event.target.files?.[0]
      if (!file || this.visitorImporting) return
      this.visitorImporting = true
      try {
        if (typeof XLSX === 'undefined') throw new Error('Excel 组件未加载')
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
        const headers = ['序号', '考察时间', '关联的客资', '会谈内容', '备注', '客户来源（自媒体）', '接待人员']
        if (!rows.length) throw new Error('表格中没有可导入的来访记录')
        const missingHeaders = headers.filter(header => !Object.prototype.hasOwnProperty.call(rows[0], header))
        if (missingHeaders.length) throw new Error(`缺少列：${missingHeaders.join('、')}`)
        const response = await fetch('/api/visitors/import/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({ records: rows }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `导入失败（${response.status}）`)
        await this.loadVisitorRecords()
        this.showToast(`成功导入 ${data.createdCount || rows.length} 条来访记录`)
      } catch (error) {
        this.showToast(`导入失败：${error.message || '请检查表格格式'}`)
      } finally {
        this.visitorImporting = false
        event.target.value = ''
      }
    },
    async exportVisitorRecordsExcel() {
      if (this.visitorExporting) return
      this.visitorExporting = true
      try {
        const params = new URLSearchParams()
        if (this.visitorFilters.keyword.trim()) params.set('q', this.visitorFilters.keyword.trim())
        if (this.visitorFilters.dateFrom) params.set('dateFrom', this.visitorFilters.dateFrom)
        if (this.visitorFilters.dateTo) params.set('dateTo', this.visitorFilters.dateTo)
        if (this.visitorFilters.source !== 'all') params.set('source', this.visitorFilters.source)
        if (this.visitorFilters.hostId !== 'all') params.set('hostId', this.visitorFilters.hostId)
        const response = await fetch(`/api/visitors/export/${params.size ? `?${params}` : ''}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `导出失败（${response.status}）`)
        }
        const blob = await response.blob()
        const disposition = response.headers.get('Content-Disposition') || ''
        const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
        const plainFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        const filename = encodedFilename
          ? decodeURIComponent(encodedFilename)
          : (plainFilename || `客户来访接待表_${this.todayDateValue}.xlsx`)
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(downloadUrl)
        this.showToast(`Excel 已下载：${filename}`)
      } catch (error) {
        this.showToast(`导出失败：${error.message || '请稍后重试'}`)
      } finally {
        this.visitorExporting = false
      }
    },
    openVisitorCustomer(record, returnToDetail = false) {
      const customer = this.customers.find(item => item.id === record?.customer?.id)
      if (!customer) return this.showToast('未找到关联客资')
      if (returnToDetail) {
        this.visitorDetailReturnRecordId = record.id
        this.activeVisitorRecord = record
        this.showVisitorDetail = false
      }
      this.openCustomerEdit(customer)
    },
    openProgressUpdateCreate(interval = null) {
      const customer = this.customers[this.editingIndex]
      if (!customer || !['A', 'B'].includes(customer.grade)) return
      const currentIndex = Math.max(0, Math.min(this.progressStages.indexOf(customer.progress), this.progressStages.length - 2))
      const targetInterval = interval || this.customerProgressIntervals[currentIndex]
      if (!targetInterval) return
      this.editingProgressUpdateId = null
      this.progressUpdateForm = {
        occurredAt: this.formatLocalDateTimeInput(new Date()),
        content: '',
        fromProgress: targetInterval.fromProgress,
        toProgress: targetInterval.toProgress,
      }
      this.showProgressUpdateCreate = true
    },
    openProgressUpdateEdit(item) {
      if (!item?.id || !item.canEdit) return
      const occurredAt = new Date(item.occurredAt || item.createdAt)
      this.editingProgressUpdateId = item.id
      this.progressUpdateForm = {
        occurredAt: Number.isNaN(occurredAt.getTime()) ? this.formatLocalDateTimeInput(new Date()) : this.formatLocalDateTimeInput(occurredAt),
        content: item.content || '',
        fromProgress: item.fromProgress || '',
        toProgress: item.toProgress || '',
      }
      this.showProgressUpdateCreate = true
    },
    closeProgressUpdateCreate() {
      if (this.progressUpdateSaving) return
      this.showProgressUpdateCreate = false
      this.editingProgressUpdateId = null
      this.progressUpdateForm = { occurredAt: '', content: '', fromProgress: '', toProgress: '' }
    },
    async saveProgressUpdate() {
      const content = this.progressUpdateForm.content.trim()
      const customer = this.customers[this.editingIndex]
      const project = this.customerProjects.find(item => item.customer?.id === customer?.id)
      if (!this.progressUpdateForm.occurredAt) return this.showToast('请选择记录时间')
      if (!content) return this.showToast('请填写跟进内容')
      if (!project) return this.showToast('未找到该客户的关联项目')
      this.progressUpdateSaving = true
      try {
        const isEditing = Boolean(this.editingProgressUpdateId)
        const response = await fetch(isEditing ? `/api/progress-updates/${this.editingProgressUpdateId}/` : '/api/progress-updates/', {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({
            projectId: project.id,
            content,
            occurredAt: this.progressUpdateForm.occurredAt,
            fromProgress: this.progressUpdateForm.fromProgress,
            toProgress: this.progressUpdateForm.toProgress,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        this.showProgressUpdateCreate = false
        this.editingProgressUpdateId = null
        this.expandedProgressIntervalKey = `${data.update.fromProgress}::${data.update.toProgress}`
        this.expandedCustomerProgressStage = ''
        this.expandedProgressUpdateId = data.update.id
        this.progressUpdateForm = { occurredAt: '', content: '', fromProgress: '', toProgress: '' }
        await this.loadProgressUpdates()
        if (customer?.id) await this.loadCustomerFollowUps(customer.id)
        this.showToast(isEditing ? '进展记录已修改' : '进展记录已添加，项目正式阶段保持不变')
      } catch (error) {
        this.showToast(error.message || '进度更新保存失败')
      } finally {
        this.progressUpdateSaving = false
      }
    },
    async deleteProgressUpdate(item) {
      if (!item?.id || !item.canDelete) return
      if (!window.confirm(`确定删除这条进展记录吗？\n\n${item.createdLabel} · ${item.intervalLabel}\n${item.content}`)) return
      try {
        const response = await fetch(`/api/progress-updates/${item.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `删除失败（${response.status}）`)
        this.customerProgressUpdates = this.customerProgressUpdates.filter(update => update.id !== item.id)
        this.progressUpdates = this.progressUpdates.filter(update => update.id !== item.id)
        await this.loadProgressUpdates()
        this.expandedProgressUpdateId = null
        this.showToast('进展记录已删除')
      } catch (error) {
        this.showToast(error.message || '进度更新删除失败')
      }
    },
    openProjectTypeManager() {
      this.projectTypeName = ''
      this.showProjectTypeManager = true
    },
    closeProjectTypeManager() {
      if (this.projectTypeSaving) return
      this.showProjectTypeManager = false
    },
    async addProjectType() {
      const name = this.projectTypeName.trim()
      if (!name || this.projectTypeSaving) return
      this.projectTypeSaving = true
      try {
        const response = await fetch('/api/project-types/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({ name }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `新增失败（${response.status}）`)
        this.projectTypeName = ''
        await this.loadProjectTypes()
        this.showToast(`已新增项目类型：${name}`)
      } catch (error) {
        this.showToast(error.message || '项目类型新增失败')
      } finally {
        this.projectTypeSaving = false
      }
    },
    async archiveProjectType(item) {
      if (!item?.id || item.id === 'unclassified') return
      try {
        const response = await fetch(`/api/project-types/${item.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `停用失败（${response.status}）`)
        await this.loadProjectTypes()
        this.showToast(`${item.name} 已停用，历史项目仍会保留该分类`)
      } catch (error) {
        this.showToast(error.message || '项目类型停用失败')
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
    openFollowTaskEditor(task) {
      if (!task?.canEdit) return
      const dueAt = task.dueAt ? new Date(task.dueAt) : null
      this.editingFollowTask = task
      this.followTaskEditForm = {
        title: task.title || '',
        role: ['business', 'technical'].includes(task.role) ? task.role : 'business',
        dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? this.formatLocalDateTimeInput(dueAt) : '',
        result: task.result || '',
      }
      this.showFollowTaskEdit = true
    },
    closeFollowTaskEditor() {
      if (this.followTaskSaving) return
      this.showFollowTaskEdit = false
      this.editingFollowTask = null
      this.followTaskEditForm = { title: '', role: 'business', dueAt: '', result: '' }
    },
    async saveFollowTaskEdit() {
      if (this.followTaskSaving || !this.editingFollowTask) return
      const title = this.followTaskEditForm.title.trim()
      const result = this.followTaskEditForm.result.trim()
      if (!title) {
        this.showToast('请填写任务内容')
        return
      }
      if (this.editingFollowTask.status === 'completed' && !result) {
        this.showToast('已完成任务的跟进结果不能为空')
        return
      }
      const customerId = this.customers[this.editingIndex]?.id
      this.followTaskSaving = true
      try {
        const response = await fetch(`/api/followups/${this.editingFollowTask.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify({
            title,
            role: this.followTaskEditForm.role,
            dueAt: this.followTaskEditForm.dueAt,
            result,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `阶段事项更新失败（${response.status}）`)
        this.showFollowTaskEdit = false
        this.editingFollowTask = null
        this.followTaskEditForm = { title: '', role: 'business', dueAt: '', result: '' }
        if (customerId) await this.loadCustomerFollowUps(customerId)
        await this.loadFollowUpTasks()
        this.showToast('阶段事项已更新，项目进度保持不变')
      } catch (error) {
        this.showToast(`修改失败：${error.message || '请稍后重试'}`)
      } finally {
        this.followTaskSaving = false
      }
    },
    openFollowTaskDelete(task) {
      if (!task?.canDelete) return
      this.deletingFollowTask = task
      this.showFollowTaskDelete = true
    },
    closeFollowTaskDelete() {
      if (this.followTaskDeleting) return
      this.showFollowTaskDelete = false
      this.deletingFollowTask = null
    },
    async deleteFollowTask() {
      if (this.followTaskDeleting || !this.deletingFollowTask) return
      const customerId = this.customers[this.editingIndex]?.id
      this.followTaskDeleting = true
      try {
        const response = await fetch(`/api/followups/${this.deletingFollowTask.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `阶段事项删除失败（${response.status}）`)
        this.showFollowTaskDelete = false
        this.deletingFollowTask = null
        if (customerId) await this.loadCustomerFollowUps(customerId)
        await this.loadFollowUpTasks()
        this.showToast('阶段事项已删除，项目进度保持不变')
      } catch (error) {
        this.showToast(`删除失败：${error.message || '请稍后重试'}`)
      } finally {
        this.followTaskDeleting = false
      }
    },
    openManualTaskDialog(task) {
      if (!task?.project) return
      const dueAt = new Date()
      dueAt.setDate(dueAt.getDate() + 1)
      dueAt.setHours(9, 0, 0, 0)
      this.activeManualProject = task.project
      this.manualTaskForm = {
        title: '',
        role: ['business', 'technical'].includes(task.role) ? task.role : 'business',
        dueAt: this.formatLocalDateTimeInput(dueAt),
      }
      this.showManualTaskCreate = true
    },
    closeManualTaskDialog() {
      if (this.manualTaskSaving) return
      this.showManualTaskCreate = false
      this.activeManualProject = null
      this.manualTaskForm = { title: '', role: 'business', dueAt: '' }
    },
    async createManualProjectTask() {
      if (this.manualTaskSaving || !this.activeManualProject) return
      const title = this.manualTaskForm.title.trim()
      if (!title) {
        this.showToast('请填写任务内容')
        return
      }
      const customerId = this.customers[this.editingIndex]?.id
      this.manualTaskSaving = true
      try {
        const response = await fetch('/api/followups/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify({
            projectId: this.activeManualProject.id,
            title,
            role: this.manualTaskForm.role,
            dueAt: this.manualTaskForm.dueAt,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `项目任务新增失败（${response.status}）`)
        this.showManualTaskCreate = false
        this.activeManualProject = null
        this.manualTaskForm = { title: '', role: 'business', dueAt: '' }
        if (customerId) await this.loadCustomerFollowUps(customerId)
        await this.loadFollowUpTasks()
        this.showToast('阶段事项已新增，完成后不会改变项目进度')
      } catch (error) {
        this.showToast(`新增失败：${error.message || '请稍后重试'}`)
      } finally {
        this.manualTaskSaving = false
      }
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
    openSuggestionCustomerEdit() {
      const linkedCustomer = this.activeSuggestion?.project?.customer
      if (!linkedCustomer) return
      const customer = this.customers.find(item => String(item.id) === String(linkedCustomer.id))
      if (!customer) {
        this.showToast('未找到关联客资，请刷新页面后重试')
        return
      }
      this.closeSuggestionDetail()
      this.switchPage('customers')
      nextTick(() => this.openCustomerEdit(customer))
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
        this.showToast(
          status === 'completed'
            ? (task.isManual ? '阶段事项已完成，项目进度保持不变' : '任务已完成，项目已进入下一进度')
            : '任务状态已更新',
        )
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
    formatLocalDateTimeInput(date) {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${this.formatLocalDate(date)}T${hours}:${minutes}`
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
    emptySchemeLayer(index = 0, source = null) {
      const structureNames = ['面层', '基层', '底基层']
      const dosagePercent = index === 0 ? 10 : (index === 1 ? 8 : 6)
      const name = source?.name || '土凝岩稳定土'
      return {
        name,
        structureLayer: structureNames[index] || `第${index + 1}层`,
        mixDescription: `${dosagePercent}%${name}（PS-I）`,
        length: source?.length || '',
        width: source?.width || '',
        thickness: source?.thickness || 0.2,
        dosagePercent,
        unitPrice: source?.unitPrice ?? 600,
        density: source?.density ?? 1.7,
      }
    },
    schemeMixDescription(layer) {
      const dosage = Number(layer?.dosagePercent) || 0
      const dosageText = `${dosage.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`
      const name = String(layer?.name || '土凝岩稳定土').trim()
      const baseDescription = String(layer?.mixDescription || '')
        .trim()
        .replace(/^\s*\d+(?:\.\d+)?\s*%\s*/, '') || `${name}（PS-I）`
      return `${dosageText}${baseDescription}`
    },
    emptySchemeCalculation(customer = null) {
      const remarksLines = [
        '实际掺配比例需根据土质情况结合试验确定。',
        '此次报价不含运输费用。',
        '土凝岩材料报价包含13%税点。',
      ]
      return {
        id: null,
        projectId: '',
        title: `${customer?.name || ''}${customer?.projectTypeName && customer.projectTypeName !== '未分类' ? customer.projectTypeName : '项目'}造价分析`,
        layerCount: 1,
        layers: [this.emptySchemeLayer(0)],
        remarks: remarksLines.join('\n'),
        remarksLines,
        totalPrice: 0,
        createdLabel: '',
        updatedLabel: '',
        updatedBy: '',
        canEdit: true,
      }
    },
    normalizeSchemeCalculation(calculation, customer) {
      const count = [1, 2, 3].includes(Number(calculation?.layerCount)) ? Number(calculation.layerCount) : 1
      const sourceLayers = Array.isArray(calculation?.layers) ? calculation.layers : []
      const layers = []
      for (let index = 0; index < count; index += 1) {
        const layer = { ...this.emptySchemeLayer(index, layers[index - 1]), ...(sourceLayers[index] || {}) }
        layer.mixDescription = this.schemeMixDescription(layer)
        layers.push(layer)
      }
      const normalizedRemarks = String(calculation?.remarks ?? '').split(/\r?\n/).map(item => item.trim()).filter(Boolean)
      while (normalizedRemarks.length < 3) normalizedRemarks.push('')
      return {
        ...this.emptySchemeCalculation(customer),
        ...(calculation || {}),
        layerCount: count,
        layers,
        remarksLines: normalizedRemarks,
      }
    },
    async openSchemeCalculator() {
      const customer = this.customers[this.editingIndex]
      if (!customer?.id) {
        this.showToast('请先保存客资信息，再进行方案测算')
        return
      }
      this.schemeCalculation = this.emptySchemeCalculation(customer)
      this.showSchemeCalculator = true
      this.schemeLoading = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/scheme-calculation/`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `测算数据读取失败（${response.status}）`)
        this.schemeCalculation = this.normalizeSchemeCalculation(data.calculation, customer)
      } catch (error) {
        this.showToast(`读取失败：${error.message || '请稍后重试'}`)
      } finally {
        this.schemeLoading = false
      }
    },
    closeSchemeCalculator() {
      if (this.schemeSaving || this.schemeExporting) return
      this.showSchemeCalculator = false
      this.schemeCalculation = this.emptySchemeCalculation()
    },
    setSchemeLayerCount(count) {
      const nextCount = Math.max(1, Math.min(3, Number(count) || 1))
      const layers = this.schemeCalculation.layers.slice(0, nextCount)
      while (layers.length < nextCount) {
        layers.push(this.emptySchemeLayer(layers.length, layers[0] || null))
      }
      this.schemeCalculation.layerCount = nextCount
      this.schemeCalculation.layers = layers
    },
    addSchemeRemark() {
      this.schemeCalculation.remarksLines.push('')
    },
    removeSchemeRemark(index) {
      if (this.schemeCalculation.remarksLines.length <= 3) return
      this.schemeCalculation.remarksLines.splice(index, 1)
    },
    schemeLayerPreview(layer) {
      const length = Number(layer?.length) || 0
      const width = Number(layer?.width) || 0
      const thickness = Number(layer?.thickness) || 0
      const dosage = (Number(layer?.dosagePercent) || 0) / 100
      const density = Number(layer?.density) || 0
      const unitPrice = Number(layer?.unitPrice) || 0
      const exactQuantity = length * width * thickness * dosage * density
      const quantity = exactQuantity > 0 ? Math.ceil(exactQuantity - Number.EPSILON) : 0
      return {
        exactQuantity,
        quantity,
          squareMeterPrice: thickness * dosage * density * unitPrice,
        totalPrice: quantity * unitPrice,
      }
    },
    schemeMoney(value) {
      return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    schemeTotalPrice() {
      return this.schemeCalculation.layers.reduce((sum, layer) => sum + this.schemeLayerPreview(layer).totalPrice, 0)
    },
    schemePayload() {
      return {
        title: this.schemeCalculation.title.trim(),
        layerCount: this.schemeCalculation.layerCount,
        remarks: this.schemeCalculation.remarksLines.map(item => String(item || '').trim()).filter(Boolean).join('\n'),
        layers: this.schemeCalculation.layers.map(layer => ({
          name: String(layer.name || '').trim(),
          structureLayer: String(layer.structureLayer || '').trim(),
          mixDescription: this.schemeMixDescription(layer),
          length: Number(layer.length),
          width: Number(layer.width),
          thickness: Number(layer.thickness),
          dosagePercent: Number(layer.dosagePercent),
          unitPrice: Number(layer.unitPrice),
          density: Number(layer.density),
        })),
      }
    },
    validateSchemeCalculation(payload) {
      if (!payload.title) return '请填写测算单标题'
      for (let index = 0; index < payload.layers.length; index += 1) {
        const layer = payload.layers[index]
        if (!layer.name || !layer.structureLayer) return `请填写第 ${index + 1} 层的材料名称和结构层`
        if (!(layer.length > 0) || !(layer.width > 0) || !(layer.thickness > 0)) return `请完整填写第 ${index + 1} 层的长、宽、厚度`
        if (!(layer.dosagePercent > 0) || layer.dosagePercent > 100) return `第 ${index + 1} 层掺量应在0至100%之间`
        if (!(layer.density > 0) || layer.unitPrice < 0 || Number.isNaN(layer.unitPrice)) return `请检查第 ${index + 1} 层的密度和单价`
      }
      return ''
    },
    async saveSchemeCalculation(silent = false) {
      if (this.schemeSaving) return false
      const customer = this.customers[this.editingIndex]
      if (!customer?.id) return false
      const payload = this.schemePayload()
      const validationError = this.validateSchemeCalculation(payload)
      if (validationError) {
        this.showToast(validationError)
        return false
      }
      this.schemeSaving = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/scheme-calculation/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify(payload),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `测算保存失败（${response.status}）`)
        this.schemeCalculation = this.normalizeSchemeCalculation(data.calculation, customer)
        this.customerSchemeCalculation = data.calculation
        if (!silent) this.showToast('方案测算已保存，用量已按整吨向上取整')
        return true
      } catch (error) {
        this.showToast(`保存失败：${error.message || '请稍后重试'}`)
        return false
      } finally {
        this.schemeSaving = false
      }
    },
    async exportSchemeCalculation() {
      if (this.schemeExporting) return
      const customer = this.customers[this.editingIndex]
      if (!customer?.id) return
      const saved = await this.saveSchemeCalculation(true)
      if (!saved) return
      this.schemeExporting = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/scheme-calculation/export/`, {
          method: 'POST',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || `导出失败（${response.status}）`)
        }
        const blob = await response.blob()
        const disposition = response.headers.get('Content-Disposition') || ''
        const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
        const plainFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        const filename = encodedFilename
          ? decodeURIComponent(encodedFilename)
          : (plainFilename || `${this.schemeCalculation.title || '施工方案测算'}.xlsx`)
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(downloadUrl)
        this.showToast(`Excel 已下载：${filename}`)
      } catch (error) {
        this.showToast(`导出失败：${error.message || '请稍后重试'}`)
      } finally {
        this.schemeExporting = false
      }
    },
    onEditProvinceChange() {
      this.editCustomer.city = ''
      this.editCustomer.district = ''
    },
    onEditCityChange() {
      this.editCustomer.district = ''
    },
    newRegionMenuKey(type) {
      return `new${type.charAt(0).toUpperCase()}${type.slice(1)}`
    },
    newRegionInputValue(type) {
      return this.openRegionMenu === this.newRegionMenuKey(type)
        ? this.newRegionSearch[type]
        : this.newCustomer[type]
    },
    beginNewRegionSearch(type) {
      this.newRegionSearch[type] = this.newCustomer[type] || ''
      this.openRegionMenu = this.newRegionMenuKey(type)
    },
    searchNewRegion(type, value) {
      this.newRegionSearch[type] = value
      this.openRegionMenu = this.newRegionMenuKey(type)
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
    selectNewProvince(province) {
      this.newCustomer.province = province
      this.newCustomer.city = ''
      this.newCustomer.district = ''
      this.newRegionSearch = { province: '', city: '', district: '' }
      this.openRegionMenu = ''
    },
    selectNewCity(city) {
      this.newCustomer.city = city
      this.newCustomer.district = ''
      this.newRegionSearch.city = ''
      this.newRegionSearch.district = ''
      this.openRegionMenu = ''
    },
    selectNewDistrict(district) {
      this.newCustomer.district = district
      this.newRegionSearch.district = ''
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
    selectNewEmployee(type, employee) {
      if (type === 'business') {
        this.newCustomer.ownerId = employee.id
        this.newCustomer.owner = employee.display_name
      } else {
        this.newCustomer.techId = employee.id
        this.newCustomer.tech = employee.display_name
      }
      this.openRegionMenu = ''
    },
    selectProgress(target, stage) {
      this[target].progress = stage
      if (target === 'editCustomer') {
        this.expandedCustomerProgressStage = stage
        this.expandedProgressIntervalKey = ''
      }
      this.openRegionMenu = ''
    },
    toggleCustomerProgressStage(stage) {
      const name = typeof stage === 'string' ? stage : stage.name
      this.expandedCustomerProgressStage = this.expandedCustomerProgressStage === name ? '' : name
      this.expandedProgressIntervalKey = ''
      this.expandedProgressUpdateId = null
    },
    stageTasksForDisplay(stage) {
      if (!stage) return []
      if (['技术验证', '客户深度沟通', '方案与报价'].includes(stage.name)) {
        return stage.tasks.filter(task => task.isManual)
      }
      return stage.tasks
    },
    stageSummaryLabel(stage) {
      if (!stage) return '点击查看'
      if (stage.name === '技术验证' && this.customerMaterialExperiment?.id) return '实验已登记'
      if (stage.name === '客户深度沟通' && this.customerVisitorRecords.length) return `${this.customerVisitorRecords.length} 次来访`
      if (stage.name === '方案与报价' && this.customerSchemeCalculation?.id) return `${this.customerSchemeCalculation.layerCount || 1} 层测算`
      const tasks = this.stageTasksForDisplay(stage)
      return tasks.length ? `${tasks.length} 条事项` : '点击查看'
    },
    toggleProgressInterval(interval) {
      this.expandedProgressIntervalKey = this.expandedProgressIntervalKey === interval.key ? '' : interval.key
      this.expandedCustomerProgressStage = ''
      this.expandedProgressUpdateId = null
    },
    toggleProgressUpdateDetail(item) {
      this.expandedProgressUpdateId = this.expandedProgressUpdateId === item.id ? null : item.id
    },
    openMaterialExperiment() {
      const source = this.customerMaterialExperiment || {}
      this.materialExperimentForm = {
        stableMaterial: source.stableMaterial || '',
        day7Data: source.day7Data || '',
        day14Data: source.day14Data || '',
        day28Data: source.day28Data || '',
        technicalMessage: source.technicalMessage || '',
      }
      this.showMaterialExperiment = true
    },
    closeMaterialExperiment() {
      if (this.materialExperimentSaving) return
      this.showMaterialExperiment = false
    },
    async saveMaterialExperiment() {
      if (this.materialExperimentSaving) return
      const customer = this.customers[this.editingIndex]
      if (!customer?.id) return
      const payload = Object.fromEntries(Object.entries(this.materialExperimentForm).map(([key, value]) => [key, String(value || '').trim()]))
      if (!Object.values(payload).some(Boolean)) return this.showToast('请至少填写一项实验情况')
      this.materialExperimentSaving = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/material-experiment/`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify(payload),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        this.customerMaterialExperiment = data.experiment
        this.showMaterialExperiment = false
        this.showToast('技术验证实验情况已保存')
      } catch (error) {
        this.showToast(error.message || '实验情况保存失败')
      } finally {
        this.materialExperimentSaving = false
      }
    },
    openCurrentStageManualTask() {
      const sourceTask = this.customerFollowUps.find(task => task.canCreateManual)
      if (!sourceTask) {
        this.showToast('当前账号没有新增阶段事项的权限')
        return
      }
      this.openManualTaskDialog(sourceTask)
    },
    projectTypeLabel(projectTypeId) {
      return this.projectTypes.find(item => item.id === projectTypeId)?.name || '未分类'
    },
    selectProjectType(target, projectTypeId) {
      this[target].projectTypeId = projectTypeId
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
      const contractIndex = this.progressStages.indexOf('合同签订')
      const currentIndex = this.progressStages.indexOf(progress)
      return currentIndex >= contractIndex
    },
    isConstructionProgress(progress) {
      return progress === '项目实施跟进'
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
          const progress = String(row['项目进度'] || '需求对接').trim()
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
        const response = await fetch('/api/customers/import/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify({
            customers: imported.map(customer => ({
              ...customer,
              projectTypeId: '',
            })),
          }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || `导入失败（${response.status}）`)
        await this.loadCustomers()
        this.resetFilters()
        this.switchPage('customers')
        this.showToast(`成功追加导入 ${result.createdCount || imported.length} 条客资，原有客资已保留`)
      } catch (error) {
        this.showToast(`导入失败：${error.message || '请检查表格格式'}`)
      } finally {
        event.target.value = ''
      }
    },
    buildProvinceData(customers) {
      const grouped = new Map()
      customers.forEach(customer => {
        if (customer.grade === 'D') return
        const province = this.locationParts(customer).province
        if (!province || province.includes('待完善')) return
        if (!grouped.has(province)) grouped.set(province, { name: province, all: 0, A: 0, B: 0, C: 0 })
        const item = grouped.get(province)
        item.all += 1
        if (['A', 'B', 'C'].includes(customer.grade)) item[customer.grade] += 1
      })
      return [...grouped.values()].sort((a, b) => b.all - a.all)
    },
    syncSummaryData() {
      const total = this.reportingCustomers.length
      const gradeCounts = Object.fromEntries(['A', 'B', 'C'].map(grade => [grade, this.reportingCustomers.filter(customer => customer.grade === grade).length]))
      const reportingProjects = this.customerProjects.filter(project => project.customer?.grade !== 'D')
      const constructionProjects = reportingProjects.filter(project => this.isConstructionProgress(project.progress)).length
      const projectTotal = reportingProjects.length
      const customerNav = this.navItems.find(item => item.id === 'customers')
      if (customerNav) customerNav.badge = String(total)
      this.metrics[0].value = String(total)
      this.metrics[0].change = `A ${gradeCounts.A} · B ${gradeCounts.B} · C ${gradeCounts.C}`
      this.metrics[0].note = `A / B / C 类有效客资共 ${total} 条`
      this.metrics[2].value = String(constructionProjects)
      this.metrics[2].change = projectTotal ? `占 ${Math.round(constructionProjects / projectTotal * 100)}%` : '占 0%'
      this.metrics[2].note = `${projectTotal} 个项目中 ${constructionProjects} 个当前处于施工阶段`
    },
    async loadCustomerFollowUps(customerId) {
      if (!customerId) return
      this.customerFollowUpsLoading = true
      this.customerFollowUpsError = ''
      try {
        const response = await fetch(`/api/customers/${customerId}/`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `阶段事项加载失败（${response.status}）`)
        const activeCustomer = this.customers[this.editingIndex]
        if (!activeCustomer || activeCustomer.id !== customerId) return
        this.customerFollowUps = Array.isArray(data.followUps) ? data.followUps : []
        this.customerProgressUpdates = Array.isArray(data.progressUpdates) ? data.progressUpdates : []
        this.customerVisitorRecords = Array.isArray(data.visitorRecords) ? data.visitorRecords : []
        this.customerSchemeCalculation = data.schemeCalculation || null
        this.customerMaterialExperiment = data.materialExperiment || null
        this.customerCanManageProject = Boolean(data.canManageProject)
      } catch (error) {
        this.customerFollowUpsError = error.message || '阶段事项加载失败'
      } finally {
        this.customerFollowUpsLoading = false
      }
    },
    emptyNewCustomer() {
      return {
        name: '', phone: '', source: '抖音', referrer: '',
        province: '', city: '', district: '', grade: 'B', projectTypeId: '', progress: '需求对接',
        ownerId: '', owner: '', techId: '', tech: '', plan: '', description: '',
      }
    },
    openCreateCustomer() {
      this.newCustomer = this.emptyNewCustomer()
      this.newRegionSearch = { province: '', city: '', district: '' }
      this.openRegionMenu = ''
      this.showCreateUnsavedConfirm = false
      this.createSnapshot = JSON.stringify(this.newCustomer)
      this.showCreate = true
      this.loadRegionTree()
      this.loadEmployees()
    },
    requestCloseCreate() {
      if (this.savingCreate) return
      this.openRegionMenu = ''
      if (this.hasUnsavedCreate) {
        this.showCreateUnsavedConfirm = true
        return
      }
      this.closeCreateCustomer()
    },
    closeCreateCustomer() {
      this.showCreateUnsavedConfirm = false
      this.showCreate = false
      this.createSnapshot = ''
      this.openRegionMenu = ''
      this.newRegionSearch = { province: '', city: '', district: '' }
      this.newCustomer = this.emptyNewCustomer()
    },
    discardCreateCustomer() {
      this.closeCreateCustomer()
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
        projectTypeId: customer.projectTypeId || '',
        progress: customer.progress || '需求对接',
        ownerId: this.employees.business.some(employee => employee.id === customer.ownerId) ? customer.ownerId : '',
        owner: customer.owner || '',
        techId: this.employees.technical.some(employee => employee.id === customer.techId) ? customer.techId : '',
        tech: customer.tech || '',
        plan: customer.plan === '方案待完善' ? '' : (customer.plan || ''),
        description: customer.description || '',
      }
      this.editSnapshot = JSON.stringify(this.editCustomer)
      this.customerFollowUps = []
      this.customerProgressUpdates = []
      this.customerVisitorRecords = []
      this.customerSchemeCalculation = null
      this.customerMaterialExperiment = null
      this.customerCanManageProject = false
      this.expandedProgressIntervalKey = ''
      this.expandedProgressUpdateId = null
      this.expandedCustomerProgressStage = this.editCustomer.progress
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
      const visitorReturnId = this.visitorDetailReturnRecordId
      this.closeFollowTaskEditor()
      this.closeFollowTaskDelete()
      this.closeManualTaskDialog()
      this.showCustomerDelete = false
      this.showUnsavedConfirm = false
      this.showEdit = false
      this.editingIndex = -1
      this.editSnapshot = ''
      this.customerFollowUps = []
      this.customerProgressUpdates = []
      this.customerVisitorRecords = []
      this.customerSchemeCalculation = null
      this.customerMaterialExperiment = null
      this.customerCanManageProject = false
      this.expandedProgressIntervalKey = ''
      this.expandedProgressUpdateId = null
      this.expandedCustomerProgressStage = ''
      this.customerFollowUpsError = ''
      if (visitorReturnId) {
        this.visitorDetailReturnRecordId = null
        const record = this.visitorRecords.find(item => item.id === visitorReturnId)
        this.activeVisitorRecord = record || null
        this.showVisitorDetail = Boolean(record)
      }
    },
    discardCustomerEdit() {
      this.closeCustomerEdit()
    },
    openCustomerDelete() {
      if (this.editingIndex < 0 || !this.customers[this.editingIndex]?.id) return
      this.openRegionMenu = ''
      this.showUnsavedConfirm = false
      this.showCustomerDelete = true
    },
    closeCustomerDelete() {
      if (this.deletingCustomer) return
      this.showCustomerDelete = false
    },
    async deleteCustomer() {
      if (this.deletingCustomer || this.editingIndex < 0) return
      const customer = this.customers[this.editingIndex]
      if (!customer?.id) return
      this.deletingCustomer = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/`, {
          method: 'DELETE',
          headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `客资删除失败（${response.status}）`)
        const deletedName = data.customerName || customer.name
        const returnToVisitors = Boolean(this.visitorDetailReturnRecordId)
        this.customers.splice(this.editingIndex, 1)
        this.visitorRecords = this.visitorRecords.filter(record => record.customer?.id !== customer.id)
        if (returnToVisitors) {
          this.visitorDetailReturnRecordId = null
          this.activeVisitorRecord = null
          this.showVisitorDetail = false
        }
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        this.closeCustomerEdit()
        if (returnToVisitors) this.switchPage('visitors')
        await Promise.all([this.loadFollowUpTasks(), this.loadTomorrowItems()])
        this.showToast(`${deletedName} 已删除，关联项目和阶段事项已同步清理`)
      } catch (error) {
        this.showToast(`删除失败：${error.message || '请稍后重试'}`)
      } finally {
        this.deletingCustomer = false
      }
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
        const returnToVisitorDetail = Boolean(this.visitorDetailReturnRecordId)
        savedCustomer.percent = this.stagePercent(savedCustomer.progress)
        this.customers.splice(this.editingIndex, 1, savedCustomer)
        this.visitorRecords = this.visitorRecords.map(record => (
          record.customer?.id === savedCustomer.id
            ? { ...record, customer: { ...record.customer, id: savedCustomer.id, name: savedCustomer.name, grade: savedCustomer.grade, phone: savedCustomer.phone, source: savedCustomer.source } }
            : record
        ))
        this.customerPool = savedCustomer.grade === 'D' ? 'dormant' : 'active'
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        await this.loadFollowUpTasks()
        this.closeCustomerEdit()
        if (!returnToVisitorDetail) {
          this.resetFilters()
          this.switchPage('customers')
        }
        this.showToast(`${savedCustomer.name} 的客资信息已保存到数据库`)
      } catch (error) {
        this.showToast(`保存失败：${error.message || '请稍后重试'}`)
      } finally {
        this.savingEdit = false
      }
    },
    async addCustomer() {
      if (this.savingCreate) return
      const name = this.newCustomer.name.trim()
      const phone = this.newCustomer.phone.trim()
      const isReferral = this.newCustomer.source === '朋友介绍'
      if (!name || !phone) {
        this.showToast('请填写客户名称和联系电话')
        return
      }
      if (isReferral && !this.newCustomer.referrer.trim()) {
        this.showToast('朋友介绍的客资必须填写介绍人')
        return
      }
      if (!this.newCustomer.province || !this.newCustomer.city || !this.newCustomer.district) {
        this.showToast('请从候选项中完整选择项目所在的省、市、区 / 县')
        return
      }
      const businessOwner = this.employees.business.find(employee => employee.id === this.newCustomer.ownerId)
      const technicalOwner = this.employees.technical.find(employee => employee.id === this.newCustomer.techId)
      if (!businessOwner || !technicalOwner) {
        this.showToast('请选择状态可用的商务负责人和技术负责人')
        return
      }
      const payload = {
        ...this.newCustomer,
        name,
        phone,
        ownerId: businessOwner.id,
        techId: technicalOwner.id,
        referrer: isReferral ? this.newCustomer.referrer.trim() : '',
      }
      this.showCreateUnsavedConfirm = false
      this.savingCreate = true
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
        this.customerPool = data.customer.grade === 'D' ? 'dormant' : 'active'
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        this.closeCreateCustomer()
        this.switchPage('customers')
        this.showToast(`${name} 已保存到客资数据库`)
      } catch (error) {
        this.showToast(`新增失败：${error.message || '请稍后重试'}`)
      } finally {
        this.savingCreate = false
      }
    },
  },
  updated() {
    this.scheduleVisitorPeopleOverflowCheck()
  },
  mounted() {
    this.loadRegionTree()
    this.loadEmployees()
    this.loadCustomers()
    this.loadProjectTypes()
    this.loadProgressUpdates()
    this.loadVisitorRecords()
    this.loadFollowUpTasks()
    this.loadTomorrowItems()
    window.addEventListener('resize', () => {
      this.mapChart?.resize()
      this.scheduleVisitorPeopleOverflowCheck()
    })
    this.scheduleVisitorPeopleOverflowCheck()
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace(/^#\/?/, '')
      if (this.navItems.some(item => item.id === page) && page !== this.activePage) this.switchPage(page)
    })
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (this.showVisitorForm) {
          this.closeVisitorForm()
        } else if (this.showVisitorDetail) {
          this.closeVisitorDetail()
        } else if (this.activeSuggestion) {
          this.closeSuggestionDetail()
        } else if (this.showTaskComplete) {
          this.closeTaskCompleteDialog()
        } else if (this.showFollowTaskEdit) {
          this.closeFollowTaskEditor()
        } else if (this.showFollowTaskDelete) {
          this.closeFollowTaskDelete()
        } else if (this.showManualTaskCreate) {
          this.closeManualTaskDialog()
        } else if (this.showCustomerDelete) {
          this.closeCustomerDelete()
        } else if (this.showUnsavedConfirm) {
          this.showUnsavedConfirm = false
        } else if (this.showEdit) {
          this.requestCloseEdit()
        } else if (this.showCreateUnsavedConfirm) {
          this.showCreateUnsavedConfirm = false
        } else if (this.showCreate) {
          this.requestCloseCreate()
        }
      }
    })
    window.addEventListener('click', () => { this.openRegionMenu = '' })
    if (this.activePage === 'heatmap') nextTick(() => this.renderMap())
  },
}).mount('#app')
