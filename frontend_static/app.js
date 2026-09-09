const { createApp, nextTick } = Vue

const CUSTOMER_SOURCES = Object.freeze(['抖音', '视频号', '服务号', '朋友介绍'])
const CUSTOMER_SOURCE_CLASSES = Object.freeze({ 抖音: 'douyin', 视频号: 'wechat', 服务号: 'service-account', 朋友介绍: 'referral' })

let themedPopoverSequence = 0
const nextThemedPopoverId = prefix => `${prefix}-${++themedPopoverSequence}`
const announceThemedPopover = id => window.dispatchEvent(new CustomEvent('yd-themed-popover-open', { detail: id }))

function chineseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  return match ? `${match[1]}年${match[2]}月${match[3]}日` : ''
}

function floatingMenuPosition(anchor, bounds, width, height) {
  const gap = 7
  const below = Math.max(0, bounds.bottom - anchor.bottom - gap)
  const above = Math.max(0, anchor.top - bounds.top - gap)
  const opensAbove = below < height && above > below
  const available = opensAbove ? above : below
  const actualHeight = Math.min(height, available)
  const actualWidth = Math.min(width, bounds.right - bounds.left)
  return {
    left: Math.max(bounds.left, Math.min(anchor.left, bounds.right - actualWidth)),
    top: opensAbove ? anchor.top - gap - actualHeight : anchor.bottom + gap,
    width: actualWidth, maxHeight: actualHeight, opensAbove,
  }
}

// Use one body-level portal in every browser, not native popover positioning.
// Keep the original field as the anchor throughout this menu's lifetime.
const FloatingMenuPositioner = {
  mounted(menu, binding) {
    const field = binding.value.field
    const trigger = field.querySelector('.custom-select-trigger, .searchable-select-control, .themed-date-trigger')
    if (!trigger) return
    const scrollport = field.closest('.edit-scroll')
    const initialStyle = getComputedStyle(menu)
    // Never measure a popup's own percentage width: once in the top layer its
    // containing block is the viewport, and cached/reopened nodes can retain it.
    const calendar = menu.classList.contains('date-picker-popover')
    const minimumWidth = parseFloat(initialStyle.getPropertyValue('--floating-min-width')) || (calendar ? 292 : 190)
    const preferredHeight = parseFloat(initialStyle.getPropertyValue('--floating-max-height')) || (calendar ? 380 : 330)
    const originalStyle = menu.getAttribute('style')
    const legacyOptions = !menu.querySelector('[role="listbox"]') && !menu.classList.contains('date-picker-popover')
    const popoverId = binding.instance.popoverId
    const closeMenu = binding.value.close
    announceThemedPopover(popoverId)
    const closeOnPeer = event => { if (event.detail !== popoverId) closeMenu() }
    window.addEventListener('yd-themed-popover-open', closeOnPeer)
    const themeShell = field.closest('.app-shell')
    const portal = menu.closest('.floating-menu-root')
    let frame = 0
    let disposed = false
    menu.classList.add('floating-menu-layer')
    menu.removeAttribute('popover')
    menu.style.visibility = 'hidden'
    menu._floatingTrigger = trigger
    const update = () => {
      if (disposed || !trigger.isConnected || !menu.isConnected) return
      portal.dataset.theme = themeShell?.dataset.theme || 'business'
      const anchor = trigger.getBoundingClientRect()
      const viewport = window.visualViewport
      const bounds = {
        top: (viewport?.offsetTop || 0) + 8,
        left: (viewport?.offsetLeft || 0) + 8,
        right: (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth) - 8,
        bottom: (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 8,
      }
      if (scrollport) {
        const rect = scrollport.getBoundingClientRect()
        bounds.top = Math.max(bounds.top, rect.top + 8)
        bounds.bottom = Math.min(bounds.bottom, rect.bottom - 8)
      }
      const position = floatingMenuPosition(anchor, bounds, Math.max(anchor.width, minimumWidth), Math.min(menu.scrollHeight + 2, preferredHeight))
      const nextStyle = {
        left: `${position.left}px`, top: `${position.top}px`,
        width: `${position.width}px`, maxHeight: `${position.maxHeight}px`,
        visibility: anchor.bottom <= bounds.top || anchor.top >= bounds.bottom ? 'hidden' : 'visible',
      }
      for (const [key, value] of Object.entries(nextStyle)) {
        if (menu.style[key] !== value) menu.style[key] = value
      }
      menu.dataset.placement = position.opensAbove ? 'top' : 'bottom'
      if (legacyOptions) {
        menu.id = popoverId
        trigger.setAttribute('aria-expanded', 'true')
        trigger.setAttribute('aria-controls', popoverId)
        trigger.setAttribute('aria-haspopup', 'listbox')
        menu.setAttribute('role', 'listbox')
        menu.setAttribute('aria-label', field.querySelector('span')?.textContent || '选择选项')
        menu.querySelectorAll('button').forEach(button => {
          button.setAttribute('role', 'option')
          button.setAttribute('aria-selected', String(button.classList.contains('selected')))
        })
      }
    }
    // Position changes do not fire ResizeObserver (e.g. scrolling, expanding a
    // section or dialog animation). Track the live anchor while the menu is open.
    const trackAnchor = () => {
      if (disposed) return
      update()
      frame = requestAnimationFrame(trackAnchor)
    }
    const stopClick = event => event.stopPropagation()
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMenu()
        trigger.focus()
      } else if (legacyOptions && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const options = [...menu.querySelectorAll('button:not(:disabled)')]
        const index = options.indexOf(document.activeElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        options[next]?.focus()
      }
    }
    const onTriggerKey = event => {
      if (event.key === 'Escape') return onKey(event)
      if (legacyOptions && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault()
        const options = [...menu.querySelectorAll('button:not(:disabled)')]
        const selected = menu.querySelector('button.selected')
        ;(selected || (event.key === 'ArrowDown' ? options[0] : options.at(-1)))?.focus()
      }
    }
    menu.addEventListener('click', stopClick)
    menu.addEventListener('keydown', onKey)
    trigger.addEventListener('keydown', onTriggerKey)
    update()
    frame = requestAnimationFrame(trackAnchor)
    menu._floatingUpdate = update
    menu._floatingClose = () => { closeMenu(); trigger.focus() }
    menu._floatingCleanup = () => {
      disposed = true
      cancelAnimationFrame(frame)
      menu.removeEventListener('click', stopClick)
      menu.removeEventListener('keydown', onKey)
      trigger.removeEventListener('keydown', onTriggerKey)
      window.removeEventListener('yd-themed-popover-open', closeOnPeer)
      if (legacyOptions) trigger.setAttribute('aria-expanded', 'false')
      menu.classList.remove('floating-menu-layer')
      if (originalStyle === null) menu.removeAttribute('style')
      else menu.setAttribute('style', originalStyle)
      delete menu.dataset.placement
      delete menu._floatingTrigger
    }
  },
  updated(menu) { menu._floatingUpdate?.() },
  beforeUnmount(menu) { menu._floatingCleanup?.() },
}

// Vue owns the portal and its anchor. Moving v-if nodes by hand leaves Vue's
// next insertion point in the old detached parent on the second open.
const FloatingMenu = {
  inheritAttrs: false,
  props: { ownerId: { type: String, default: '' } },
  emits: ['close'],
  data() { return { popoverId: this.ownerId || nextThemedPopoverId('floating') } },
  mounted() {
    FloatingMenuPositioner.mounted(this.$refs.menu, {
      instance: this,
      value: {
        field: this.$refs.anchor.parentElement,
        close: () => this.$emit('close'),
      },
    })
  },
  updated() { FloatingMenuPositioner.updated(this.$refs.menu) },
  beforeUnmount() { FloatingMenuPositioner.beforeUnmount(this.$refs.menu) },
  template: `<span ref="anchor" class="floating-menu-anchor" aria-hidden="true"></span><Teleport to="body"><div class="app-shell floating-menu-root" :data-theme="$root.theme"><div ref="menu" v-bind="$attrs"><slot /></div></div></Teleport>`,
}

const ThemedSelect = {
  components: { FloatingMenu },
  props: {
    modelValue: { type: [String, Number], default: '' },
    label: { type: String, required: true },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: '请选择' },
    searchable: { type: Boolean, default: false },
    searchPlaceholder: { type: String, default: '输入关键词搜索' },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    matchWidth: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  data() {
    return { open: false, activeIndex: -1, searchQuery: '', popoverId: nextThemedPopoverId('select') }
  },
  computed: {
    selectedOption() {
      return this.options.find(option => String(option.value) === String(this.modelValue)) || null
    },
    selectedLabel() {
      return this.selectedOption?.label || this.placeholder
    },
    visibleOptions() {
      const word = this.searchQuery.trim().toLocaleLowerCase('zh-CN')
      if (!this.searchable || !word) return this.options
      return this.options.filter(option => `${option.label || ''} ${option.detail || ''} ${option.value || ''}`.toLocaleLowerCase('zh-CN').includes(word))
    },
  },
  mounted() {
    this.closeOnDocumentClick = () => { this.open = false }
    this.closeOnEscape = event => {
      if (event.key === 'Escape' && this.open) this.close(true)
    }
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
      if (this.disabled) return
      const shouldOpen = !this.open
      if (!shouldOpen) return this.close()
      this.openMenu(this.selectedOption ? this.visibleOptions.indexOf(this.selectedOption) : 0, false)
    },
    openMenu(index = 0, focusOption = true) {
      if (this.disabled || !this.options.length) return
      announceThemedPopover(this.popoverId)
      this.open = true
      this.searchQuery = ''
      this.activeIndex = Math.max(0, Math.min(index, this.visibleOptions.length - 1))
      if (focusOption) this.focusActiveOption()
      else if (this.searchable) nextTick(() => this.$refs.searchInput?.focus())
    },
    close(restoreFocus = false) {
      this.open = false
      this.activeIndex = -1
      this.searchQuery = ''
      if (restoreFocus) nextTick(() => this.$refs.trigger?.focus())
    },
    focusActiveOption() {
      nextTick(() => this.$refs.optionButtons?.[this.activeIndex]?.focus())
    },
    moveActive(step) {
      if (!this.open) return this.openMenu(step > 0 ? 0 : this.visibleOptions.length - 1)
      if (!this.visibleOptions.length) return
      this.activeIndex = (this.activeIndex + step + this.visibleOptions.length) % this.visibleOptions.length
      this.focusActiveOption()
    },
    moveTo(index) {
      if (!this.visibleOptions.length) return
      this.activeIndex = Math.max(0, Math.min(index, this.visibleOptions.length - 1))
      this.focusActiveOption()
    },
    onSearchInput() {
      this.activeIndex = this.visibleOptions.length ? 0 : -1
    },
    moveFromSearch(step) {
      if (!this.visibleOptions.length) return
      this.activeIndex = step > 0 ? 0 : this.visibleOptions.length - 1
      this.focusActiveOption()
    },
    selectActiveFromSearch() {
      const option = this.visibleOptions[this.activeIndex]
      if (option) this.select(option)
    },
    select(option) {
      this.$emit('update:modelValue', option.value)
      this.close(true)
    },
  },
  template: `
    <div class="custom-select-field themed-select-field" :class="{ disabled }" @click.stop>
      <span>{{ label }} <b v-if="required">必填</b></span>
      <button ref="trigger" type="button" class="custom-select-trigger" :class="{ active: open }" :disabled="disabled" :aria-label="label" :aria-expanded="String(open)" :aria-controls="popoverId" aria-haspopup="listbox" @click="toggle" @keydown.down.prevent="openMenu(selectedOption ? visibleOptions.indexOf(selectedOption) : 0)" @keydown.up.prevent="openMenu(selectedOption ? visibleOptions.indexOf(selectedOption) : visibleOptions.length - 1)"><b>{{ selectedLabel }}</b><i></i></button>
      <floating-menu v-if="open" :owner-id="popoverId" @close="close(true)" class="custom-select-menu themed-select-menu" :style="matchWidth ? { '--floating-min-width': '1' } : null" @keydown.tab="close()">
        <input v-if="searchable" ref="searchInput" v-model="searchQuery" class="themed-select-search" type="search" role="searchbox" :aria-label="searchPlaceholder" :placeholder="searchPlaceholder" autocomplete="off" @input="onSearchInput" @keydown.down.prevent="moveFromSearch(1)" @keydown.up.prevent="moveFromSearch(-1)" @keydown.enter.prevent="selectActiveFromSearch" @keydown.esc.prevent.stop="close(true)" />
        <div :id="popoverId" class="themed-select-options" role="listbox" :aria-label="label">
        <button v-for="(option, optionIndex) in visibleOptions" ref="optionButtons" :key="String(option.value)" type="button" role="option" :tabindex="optionIndex === activeIndex ? 0 : -1" :aria-selected="String(option === selectedOption)" :class="{ selected: option === selectedOption, focused: optionIndex === activeIndex }" @focus="activeIndex = optionIndex" @click="select(option)" @keydown.down.prevent="moveActive(1)" @keydown.up.prevent="moveActive(-1)" @keydown.home.prevent="moveTo(0)" @keydown.end.prevent="moveTo(visibleOptions.length - 1)" @keydown.enter.prevent="select(option)" @keydown.space.prevent="select(option)" @keydown.esc.prevent.stop="close(true)"><span><b>{{ option.label }}</b><small v-if="option.detail">{{ option.detail }}</small></span><i>✓</i></button>
        <p v-if="searchable && !visibleOptions.length" class="themed-select-empty">没有匹配的选项</p>
        </div>
      </floating-menu>
    </div>
  `,
}

const ThemedDatePicker = {
  components: { FloatingMenu },
  props: {
    modelValue: { type: String, default: '' },
    label: { type: String, required: true },
    placeholder: { type: String, default: '年/月/日' },
    min: { type: String, default: '' },
    max: { type: String, default: '' },
    required: { type: Boolean, default: false },
    dateTime: { type: Boolean, default: false },
    align: { type: String, default: 'left' },
    disabled: { type: Boolean, default: false },
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
      const formattedDate = chineseDate(this.dateValue)
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
      if (this.disabled) return
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
      if (!this.dateTime) {
        this.open = false
        nextTick(() => this.$el.querySelector('.themed-date-trigger')?.focus())
      }
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
    <div class="date-picker-field themed-date-picker" :class="[{ 'date-time-picker': dateTime, 'align-right': align === 'right', disabled }]" @click.stop>
      <label><span>{{ label }} <b v-if="required">必填</b></span><input class="themed-date-trigger" :value="displayValue" type="text" readonly :required="required" :disabled="disabled" :placeholder="placeholder" :aria-label="label" :aria-expanded="String(open)" aria-haspopup="dialog" :class="{ active: open }" @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle" /><i class="date-input-icon" aria-hidden="true"></i></label>
      <floating-menu v-if="open" :owner-id="popoverId" @close="open = false" class="date-picker-popover" role="dialog" :aria-label="'选择' + label">
        <header><button type="button" aria-label="上个月" @click="shiftMonth(-1)">‹</button><strong>{{ calendarTitle }}</strong><button type="button" aria-label="下个月" @click="shiftMonth(1)">›</button></header>
        <div class="date-picker-weekdays"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
        <div class="date-picker-days"><button v-for="day in calendarDays" :key="day.value" type="button" :disabled="day.disabled" :class="{ outside: !day.inMonth, today: day.isToday, selected: day.isSelected }" @click="selectDate(day.value)">{{ day.day }}</button></div>
        <div v-if="dateTime" class="date-time-editor"><span>具体时间</span><input :value="draftTime" inputmode="numeric" maxlength="5" placeholder="09:00" aria-label="具体时间，24小时制" @input="updateTime" /></div>
        <footer><button type="button" :disabled="isDisabled(todayValue)" @click="selectDate(todayValue)">今天</button><button v-if="modelValue" type="button" @click="clear">清除</button><button v-if="dateTime" type="button" @click="open = false">完成</button></footer>
      </floating-menu>
    </div>
  `,
}

createApp({
  mixins: [typeof PersonalWork !== 'undefined' ? PersonalWork : {}],
  components: { ThemedSelect, ThemedDatePicker, FloatingMenu },
  data() {
    const allowedPages = ['overview', 'customers', 'heatmap', 'followups', 'updates', 'visitors', 'plans']
    const hashPage = window.location.hash.replace(/^#\/?/, '').split('?')[0]
    return {
      theme: localStorage.getItem('yd-theme') || 'minimal',
      activePage: allowedPages.includes(hashPage) ? hashPage : 'overview',
      customerPool: 'active',
      savedCustomerId: null,
      customerEditReturnContext: null,
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
      mapView: 'customers',
      mapRegions: [],
      mapRegionCustomers: [],
      mapRegionAgents: [],
      mapLegend: [],
      mapAccessScope: 'internal',
      mapLoading: false,
      selectedMapRegion: '',
      mapFilters: { province: '', signed: '', progress: '', ownerId: '', dateFrom: '', dateTo: '', level: '', status: '', exclusive: '', product: '', expiryWithin: '' },
      showCreate: false,
      showCreateUnsavedConfirm: false,
      createSnapshot: '',
      savingCreate: false,
      showBatchCustomerCreate: false,
      batchCustomerRows: [],
      batchCustomerRowErrors: {},
      batchCustomerSaving: false,
      batchCustomerRowSequence: 0,
      pageScrollLockY: 0,
      showEdit: false,
      showUnsavedConfirm: false,
      showProjectNavigationConfirm: false,
      pendingCustomerProjectId: null,
      pendingCustomerProjectTarget: null,
      customerDeepLinkHandled: false,
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
      customerCanManageCommercial: false,
      customerDetailProjects: [],
      customerAssociatedProjects: [],
      customerProjectsExpanded: false,
      selectedCustomerProjectId: null,
      customerPartnerships: [],
      customerAuthorizations: [],
      customerContracts: [],
      customerAttachments: [],
      customerRelationshipExpanded: false,
      inlinePartnershipType: '',
      inlineAuthorizationId: null,
      inlineAuthorizationForm: { level: '', province: '', city: '', district: '', effectiveDate: '', expiryDate: '' },
      inlineContractId: null,
      inlineContractNumber: '',
      showProjectAssociationPicker: false,
      projectAssociationProjectId: '',
      showPartnershipEditor: false,
      editingPartnershipId: null,
      partnershipForm: { type: 'customer', notes: '' },
      partnershipIdentityOptions: [
        { value: 'provincial_agent', label: '省级代理', detail: '省级区域合作' },
        { value: 'city_agent', label: '市级代理', detail: '市级区域合作' },
        { value: 'district_agent', label: '区 / 县级代理', detail: '区县区域合作' },
        { value: 'partner', label: '事业合伙人', detail: '事业合伙合作关系' },
      ],
      wechatStatusOptions: [{ value: 'yes', label: '已添加' }, { value: 'no', label: '未添加' }, { value: 'rejected', label: '已添加未通过' }],
      cooperationStatusOptions: [
        { value: 'none', label: '未建立合作关系', detail: '仅维护普通客资与项目跟进' },
        { value: 'cooperating', label: '已建立合作关系', detail: '显示合作身份与关联项目案例' },
      ],
      showProjectEditor: false,
      editingProjectId: null,
      projectForm: { name: '', projectTypeId: '', progress: '需求对接', ownerId: '', techId: '', plan: '', commercialNotes: '', quotedAmount: '', contractAmount: '' },
      showAuthorizationEditor: false,
      editingAuthorizationId: null,
      authorizationForm: { level: 'province', province: '', city: '', district: '', isExclusive: false, productScope: '', effectiveDate: '', expiryDate: '', agreementStatus: 'intent', agreementNumber: '' },
      showContractEditor: false,
      editingContractId: null,
      contractForm: { title: '', contractNumber: '', projectId: '', status: 'intent', amount: '', signedDate: '', effectiveDate: '', expiryDate: '', notes: '' },
      businessRecordSaving: false,
      actionConfirm: { open: false, title: '', message: '', confirmLabel: '确认', tone: 'danger' },
      actionConfirmResolver: null,
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
        { id: 'customers', label: '全部客资', icon: '客', badge: '0' },
        { id: 'heatmap', label: '客户热力图', icon: '图' },
        { id: 'followups', label: '我的客资', icon: '客', badge: '0' },
        { id: 'visitors', label: '来访接待', icon: '访' },
        { id: 'plans', label: '我的日历', icon: '历' },
      ],
      metrics: [
        { label: '有效客资总览', value: '0', change: 'A 0 · B 0 · C 0', note: '等待读取真实客资数据', icon: '客', tone: 'blue', trend: 1, action: 'customers-summary' },
        { label: '每日进度更新', value: '0', change: '近 7 天', note: '暂无项目进度更新', icon: '更', tone: 'orange', trend: 0, action: 'progress-updates' },
        { label: '实施中项目', value: '0', change: '占 0%', note: '当前处于项目实施跟进阶段', icon: '施', tone: 'green', trend: 1, action: 'construction' },
      ],
      overviewStats: null,
      overviewLoading: false,
      overviewError: '',
      customers: [],
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
      provinceData: [],
      newCustomer: { name: '', phone: '', wechatStatus: 'no', source: '抖音', referrer: '', country: '', locationMode: 'domestic', province: '', city: '', district: '', grade: 'C', cooperationStatus: 'none', projectName: '', projectTypeId: '', progress: '需求对接', ownerId: '', owner: '', techId: '', tech: '', plan: '', description: '' },
      editCustomer: { name: '', phone: '', wechatStatus: 'no', source: '抖音', referrer: '', country: '', locationMode: 'domestic', province: '', city: '', district: '', grade: 'C', cooperationStatus: 'none', projectName: '', projectTypeId: '', progress: '需求对接', ownerId: '', owner: '', techId: '', tech: '', plan: '', description: '' },
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
      return [...CUSTOMER_SOURCES]
    },
    visitorSourceSelectOptions() {
      return [{ value: 'all', label: '全部来源' }, ...this.visitorSourceOptions.map(source => ({ value: source, label: source }))]
    },
    visitorHostSelectOptions() {
      return [{ value: 'all', label: '全部人员' }, ...this.visitorHostOptions.map(employee => ({ value: String(employee.id), label: employee.display_name, detail: employee.username }))]
    },
    customerSourceSelectOptions() {
      return CUSTOMER_SOURCES.map(source => ({ value: source, label: source }))
    },
    batchCustomerSourceOptions() {
      return CUSTOMER_SOURCES.map(source => ({ value: source, label: source }))
    },
    batchCustomerFilledCount() {
      return this.batchCustomerRows.filter(row => this.batchCustomerRowHasContent(row)).length
    },
    editCustomerSourceSelectOptions() {
      const options = [...this.customerSourceSelectOptions]
      if (this.editCustomer.source && !options.some(option => option.value === this.editCustomer.source)) {
        options.unshift({ value: this.editCustomer.source, label: `${this.editCustomer.source}（历史来源，仅保留）` })
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
        : '统一查看 A、B、C 类客资；D 类请进入沉淀客户查看'
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
    customerEmptyMessage() {
      const today = this.formatLocalDate(new Date())
      if (this.dateFrom === today && this.dateTo === today) {
        const hasTodayCustomers = this.customerPoolCustomers.some(customer => (
          (customer.createdDate || String(customer.createdAt || '').slice(0, 10)) === today
        ))
        return {
          title: hasTodayCustomers ? '今天没有符合当前筛选条件的客资' : '今天暂无新录入客资',
          description: '可调整筛选条件，或点击“重置筛选”查看全部日期的客资。',
        }
      }
      if (this.customerPool === 'dormant' && !this.customerPoolCustomers.length) {
        return { title: 'D 类沉淀池为空', description: '当前没有 D 类客户。' }
      }
      return { title: '没有找到匹配客资', description: '请尝试其他关键词或点击“重置筛选”' }
    },
    currentPeriodLabel() {
      const period = this.overviewStats?.period
      if (period && typeof period === 'object') return `近${period.days}天 · 截至 ${chineseDate(period.endDate)}`
      if (this.overviewState === 'error') return '统计周期暂不可用'
      if (this.overviewState === 'empty') return '近30天 · 暂无真实数据'
      return '近30天 · 正在读取实际数据'
    },
    overviewState() {
      if (this.overviewError) return 'error'
      if (this.overviewLoading || !this.overviewStats) return 'loading'
      const stats = this.overviewStats && typeof this.overviewStats === 'object' ? this.overviewStats : {}
      const customers = stats.customers && typeof stats.customers === 'object' ? stats.customers : {}
      const projects = stats.projects && typeof stats.projects === 'object' ? stats.projects : {}
      const visitors = stats.visitors && typeof stats.visitors === 'object' ? stats.visitors : {}
      const followUps = stats.followUps && typeof stats.followUps === 'object' ? stats.followUps : {}
      return [customers.total, projects.total, visitors.visits, visitors.people, followUps.total]
        .some(value => Number(value || 0) > 0) ? 'ready' : 'empty'
    },
    todayDateValue() {
      return this.formatLocalDate(new Date())
    },
    newCustomerShowsFullProjectModules() {
      return ['A', 'B'].includes(this.newCustomer.grade)
    },
    editCustomerShowsFullProjectModules() {
      return ['A', 'B'].includes(this.editCustomer.grade)
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
      return this.customerPoolCustomers.filter(item => this.customerMatchesCurrentFilters(item)).sort((left, right) => {
        if (left.id === this.savedCustomerId) return -1
        if (right.id === this.savedCustomerId) return 1
        const leftTime = Date.parse(left.updatedAt || left.createdAt || left.createdDate || '') || 0
        const rightTime = Date.parse(right.updatedAt || right.createdAt || right.createdDate || '') || 0
        return rightTime - leftTime || Number(right.id || 0) - Number(left.id || 0)
      })
    },
    provinceOptions() {
      const counts = new Map()
      this.customerPoolCustomers.forEach(customer => {
        const province = customer.country ? '' : this.locationParts(customer).province
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
        count: this.customerPoolCustomers.filter(customer => customer.grade === value).length,
      }))
    },
    sourceFilterOptions() {
      return CUSTOMER_SOURCES.map(value => ({
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
      const rawCounts = this.overviewStats?.customers?.gradeCounts
      const counts = rawCounts && typeof rawCounts === 'object' && !Array.isArray(rawCounts) ? rawCounts : { A: 0, B: 0, C: 0 }
      const total = Number(this.overviewStats?.customers?.total || 0)
      let cursor = 0
      return ['A', 'B', 'C'].map(grade => {
        const value = Number(counts[grade] || 0)
        const ratio = total ? value / total * 100 : 0
        const start = cursor
        cursor += ratio
        const point = fraction => {
          const radians = fraction / 100 * Math.PI * 2
          return `${60 + 47 * Math.cos(radians)},${60 + 47 * Math.sin(radians)}`
        }
        return {
          grade,
          value,
          ratio,
          start,
          path: value && total ? `M ${point(start)} A 47 47 0 0 1 ${point(start + ratio / 2)} A 47 47 0 0 1 ${point(start + ratio)}` : '',
          percent: `${Math.round(ratio)}%`,
        }
      })
    },
    sourceStats() {
      const sourceCounts = this.overviewStats?.customers?.sourceCounts
      const countBySource = Object.fromEntries(
        (Array.isArray(sourceCounts) ? sourceCounts : [])
          .filter(item => item && typeof item === 'object')
          .map(item => [String(item.name || ''), Number(item.count || 0)]),
      )
      return CUSTOMER_SOURCES.map(name => ({
        name,
        value: countBySource[name] || 0,
        className: CUSTOMER_SOURCE_CLASSES[name],
      }))
    },
    topRegions() {
      const regions = this.overviewStats?.customers?.regions
      return (Array.isArray(regions) ? regions : [])
        .filter(item => item && typeof item === 'object' && item.name)
        .map(item => ({ name: String(item.name).replace(/省|市/g, ''), value: Number(item.count || 0) }))
        .slice(0, 6)
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
      return CUSTOMER_SOURCES.map(value => ({
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
      return this.mapRegions.map(item => ({
        name: item.name.replace(/省|市|壮族自治区/g, ''),
        value: this.mapView === 'customers' ? Number(item.count || 0) : Number(item.authorizationCount || 0),
      })).sort((a, b) => b.value - a.value).slice(0, 6)
    },
    mapTotal() {
      return this.mapRegions.reduce((sum, item) => sum + (
        this.mapView === 'customers' ? Number(item.count || 0) : Number(item.authorizationCount || 0)
      ), 0)
    },
    mapGradeLabel() {
      if (this.mapView === 'agents') return '全国代理授权覆盖'
      return this.mapGrade === 'all' ? '全国全部客资分布' : `全国 ${this.mapGrade} 级客户分布`
    },
    topAreaStats() {
      return this.rankedAreas.slice(0, 2).map(area => ({
        name: area.name,
        percent: this.mapTotal ? `${Math.round(area.value / this.mapTotal * 100)}%` : '0%',
      }))
    },
    customerExpiryReminderCount() {
      return [...this.customerAuthorizations, ...this.customerContracts]
        .filter(item => item.daysRemaining != null && item.daysRemaining <= 90).length
    },
    activeCustomerPartnerships() {
      const visibleOptions = new Map(this.partnershipIdentityOptions.map(option => [option.value, option]))
      return this.customerPartnerships
        .filter(identity => identity.isActive && visibleOptions.has(identity.type))
        .map(identity => ({ ...identity, label: visibleOptions.get(identity.type).label }))
    },
    currentPartnershipIdentityType() {
      return this.inlinePartnershipType || this.activeCustomerPartnerships[0]?.type || ''
    },
    availablePartnershipIdentityOptions() {
      const activeTypes = new Set(this.activeCustomerPartnerships.map(identity => identity.type))
      return this.partnershipIdentityOptions.filter(option => !activeTypes.has(option.value))
    },
    activeAgentIdentity() {
      const agentTypes = ['provincial_agent', 'city_agent', 'district_agent']
      return this.activeCustomerPartnerships.find(identity => agentTypes.includes(identity.type)) || null
    },
    inlineAgentLevel() {
      return ({ provincial_agent: 'province', city_agent: 'city', district_agent: 'district' })[this.activeAgentIdentity?.type] || ''
    },
    inlineAuthorizationPeriodLabel() {
      const formatDate = value => {
        const [year, month, day] = String(value || '').split('-')
        return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : ''
      }
      const effective = formatDate(this.inlineAuthorizationForm.effectiveDate)
      const expiry = formatDate(this.inlineAuthorizationForm.expiryDate)
      return effective && expiry ? `从 ${effective} 到 ${expiry}` : '请选择生效和到期日期'
    },
    inlineAuthorizationProvinceOptions() {
      return this.regionTree.map(item => ({ value: item.name, label: item.name }))
    },
    inlineAuthorizationCityOptions() {
      const province = this.regionTree.find(item => item.name === this.inlineAuthorizationForm.province)
      if (!province) return []
      const children = province.children || []
      const hasCityLevel = children.some(item => Array.isArray(item.children) && item.children.length)
      const cities = hasCityLevel ? children : [{ name: province.name, code: province.code, children }]
      return cities.map(item => ({ value: item.name, label: item.name }))
    },
    inlineAuthorizationDistrictOptions() {
      const province = this.regionTree.find(item => item.name === this.inlineAuthorizationForm.province)
      const children = province?.children || []
      const hasCityLevel = children.some(item => Array.isArray(item.children) && item.children.length)
      const cities = hasCityLevel ? children : [{ name: province?.name, children }]
      const city = cities.find(item => item.name === this.inlineAuthorizationForm.city)
      return (city?.children || []).map(item => ({ value: item.name, label: item.name }))
    },
    projectAssociationOptions() {
      const associatedIds = new Set(this.customerAssociatedProjects.map(item => item.project?.id))
      return this.customerProjects
        .filter(project => !associatedIds.has(project.id))
        .map(project => ({
          value: project.id,
          label: project.name,
          detail: `项目 #${project.id} · ${project.customer?.name || '未知客户'} · ${project.progress}`,
        }))
    },
    unfinishedAssociatedProjects() {
      return this.customerAssociatedProjects.filter(association => association.project?.isActive !== false)
    },
    completedAssociatedProjects() {
      return this.customerAssociatedProjects.filter(association => association.project?.isActive === false)
    },
    overviewGradeCounts() {
      const counts = this.overviewStats?.customers?.gradeCounts
      return counts && typeof counts === 'object' && !Array.isArray(counts) ? counts : { A: 0, B: 0, C: 0 }
    },
    trendChart() {
      const rawBuckets = this.overviewStats?.customers?.trendBuckets
      const buckets = Array.isArray(rawBuckets) ? rawBuckets : []
      const lineClasses = ['line-main', 'line-second', 'line-fourth', 'line-third']
      const sources = CUSTOMER_SOURCES.map((name, index) => ({
        name,
        className: lineClasses[index % lineClasses.length],
      }))
      const valuesBySource = sources.map(source => buckets.map(bucket => Number(bucket.counts?.[source.name] || 0)))
      const primaryValues = valuesBySource[0] || []
      const actualMaximum = Math.max(0, ...valuesBySource.flat())
      const tickStep = Math.max(1, Math.ceil(actualMaximum / 4))
      const maximum = tickStep * 4
      const yFor = value => 200 - (value / maximum * 180)
      const formatDate = value => {
        const [, month, day] = String(value || '').split('-')
        return month && day ? `${Number(month)}/${Number(day)}` : value
      }
      const xFor = index => buckets.length > 1 ? index * (700 / (buckets.length - 1)) : 350
      return {
        hasData: actualMaximum > 0,
        maximum,
        ticks: [maximum, maximum - tickStep, maximum - tickStep * 2, maximum - tickStep * 3, 0],
        labels: buckets.map(bucket => `${formatDate(bucket.startDate)}–${formatDate(bucket.endDate)}`),
        series: sources.map((source, sourceIndex) => {
          const values = valuesBySource[sourceIndex] || []
          const points = values.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ')
          return { ...source, values, points }
        }),
        areaPoints: primaryValues.length
          ? `0,200 ${primaryValues.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ')} 700,200`
          : '0,200 700,200',
      }
    },
    projectTypeStats() {
      const typeCounts = this.overviewStats?.projects?.typeCounts
      return (Array.isArray(typeCounts) ? typeCounts : []).filter(item => item && typeof item === 'object' && item.name).map(item => ({
        id: item.id || item.name,
        name: String(item.name),
        value: Number(item.count || 0),
      })).sort((left, right) => Number(left.name === '未分类') - Number(right.name === '未分类'))
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
        visits: Number(this.overviewStats?.visitors?.visits || 0),
        people: Number(this.overviewStats?.visitors?.people || 0),
      }
    },
    visitorTrendChart() {
      const rawBuckets = this.overviewStats?.visitors?.trendBuckets
      const buckets = Array.isArray(rawBuckets) ? rawBuckets : []
      const visits = buckets.map(bucket => Number(bucket.visits || 0))
      const people = buckets.map(bucket => Number(bucket.people || 0))
      const actualMaximum = Math.max(0, ...visits, ...people)
      const tickStep = Math.max(1, Math.ceil(actualMaximum / 4))
      const maximum = tickStep * 4
      const yFor = value => 200 - (value / maximum * 180)
      const formatDate = value => {
        const [, month, day] = String(value || '').split('-')
        return month && day ? `${Number(month)}/${Number(day)}` : value
      }
      const xFor = index => buckets.length > 1 ? index * (700 / (buckets.length - 1)) : 350
      return {
        hasData: actualMaximum > 0,
        ticks: [maximum, maximum - tickStep, maximum - tickStep * 2, maximum - tickStep * 3, 0],
        labels: buckets.map(bucket => `${formatDate(bucket.startDate)}–${formatDate(bucket.endDate)}`),
        visits,
        people,
        visitsPoints: visits.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' '),
        peoplePoints: people.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' '),
        areaPoints: visits.length
          ? `0,200 ${visits.map((value, index) => `${xFor(index)},${yFor(value)}`).join(' ')} 700,200`
          : '0,200 700,200',
      }
    },
    overviewTaskSummary() {
      const source = this.overviewStats?.followUps
      const followUps = source && typeof source === 'object' && !Array.isArray(source) ? source : {}
      return {
        total: Number(followUps.total || 0),
        todayDue: Number(followUps.todayDue || 0),
        tomorrowDue: Number(followUps.tomorrowDue || 0),
        overdue: Number(followUps.overdue || 0),
        completed: Number(followUps.completed || 0),
      }
    },
    hasOpenOverlay() {
      return Boolean(
        this.showCreate
        || this.showBatchCustomerCreate
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
    customerMatchesCurrentFilters(item) {
      const word = this.keyword.trim().toLowerCase()
      const matchesWord = !word || [item.name, item.phone, item.region, item.projectName, item.plan, item.description].some(value => String(value || '').toLowerCase().includes(word))
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
      if (page === 'heatmap') this.loadRegionalMap()
      if (page === 'overview') this.loadOverviewStatistics()
      if (page === 'followups') this.loadFollowUpTasks()
      if (page === 'visitors') this.loadVisitorRecords()
      if (page === 'plans') {
        this.loadFollowUpTasks()
        this.loadTomorrowItems()
      }
    },
    setMapGrade(grade) {
      this.mapGrade = grade
      this.loadRegionalMap(this.selectedMapRegion)
    },
    setMapView(view) {
      if (!['customers', 'agents'].includes(view) || this.mapView === view) return
      this.mapView = view
      this.selectedMapRegion = ''
      this.mapRegionCustomers = []
      this.mapRegionAgents = []
      this.loadRegionalMap()
    },
    setMapFilter(key, value) {
      this.mapFilters[key] = value
      this.loadRegionalMap()
    },
    resetMapFilters() {
      this.mapGrade = 'all'
      this.mapFilters = { province: '', signed: '', progress: '', ownerId: '', dateFrom: '', dateTo: '', level: '', status: '', exclusive: '', product: '', expiryWithin: '' }
      this.selectedMapRegion = ''
      this.loadRegionalMap()
    },
    async loadRegionalMap(region = '') {
      this.mapLoading = true
      this.mapError = ''
      try {
        const params = new URLSearchParams({ view: this.mapView })
        if (this.mapFilters.province) params.set('province', this.mapFilters.province)
        if (region) {
          params.set('province', region)
          params.set('region', region)
        }
        if (this.mapView === 'customers') {
          if (this.mapGrade !== 'all') params.set('grade', this.mapGrade)
          if (this.mapFilters.signed) params.set('signed', this.mapFilters.signed)
          if (this.mapFilters.progress) params.set('progress', this.mapFilters.progress)
          if (this.mapFilters.ownerId) params.set('ownerId', this.mapFilters.ownerId)
          if (this.mapFilters.dateFrom) params.set('dateFrom', this.mapFilters.dateFrom)
          if (this.mapFilters.dateTo) params.set('dateTo', this.mapFilters.dateTo)
        } else {
          for (const key of ['level', 'status', 'exclusive', 'product', 'expiryWithin']) {
            if (this.mapFilters[key]) params.set(key, this.mapFilters[key])
          }
        }
        const response = await fetch(`/api/statistics/regional-business-map/?${params}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `地图数据加载失败（${response.status}）`)
        this.mapAccessScope = data.accessScope || 'authorized_agent'
        if (region) {
          this.selectedMapRegion = region
          if (this.mapView === 'customers') this.mapRegionCustomers = Array.isArray(data.customers) ? data.customers : []
          else this.mapRegionAgents = Array.isArray(data.authorizations) ? data.authorizations : []
        } else {
          this.selectedMapRegion = ''
          this.mapRegions = Array.isArray(data.regions) ? data.regions : []
          this.mapLegend = Array.isArray(data.legend) ? data.legend : []
          this.mapRegionCustomers = []
          this.mapRegionAgents = []
        }
        nextTick(() => this.renderMap())
      } catch (error) {
        this.mapError = error.message || '区域地图数据加载失败'
      } finally {
        this.mapLoading = false
      }
    },
    openMapCustomer(customer) {
      const target = this.customers.find(item => item.id === customer?.id)
      if (!target) return this.showToast('该客户不在当前账号可查看列表中')
      this.openCustomerEdit(target)
    },
    openAgentRegionCustomers(item) {
      this.openCustomerList({ province: item.province, city: item.city || 'all' })
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
        const max = Math.max(1, ...this.mapRegions.map(item => this.mapView === 'customers' ? Number(item.count || 0) : Number(item.authorizationCount || 0)))
        const agentColors = { active: '#198f63', partial: '#79b997', expiring: '#e6a23c', expired: '#d75a5a', inactive: '#a7b1ad', none: soft }
        const mapData = this.mapRegions.map(item => ({
          name: item.name,
          value: this.mapView === 'customers' ? Number(item.count || 0) : Number(item.authorizationCount || 0),
          coverageStatus: item.coverageStatus || 'none',
          authorizationCount: item.authorizationCount || 0,
          exclusiveCount: item.exclusiveCount || 0,
          grades: item.grades || {},
          signedCount: item.signedCount || 0,
          itemStyle: this.mapView === 'agents' ? { areaColor: agentColors[item.coverageStatus] || soft } : undefined,
        }))
        this.mapChart.setOption({
          tooltip: { trigger: 'item', backgroundColor: card, borderColor: border, textStyle: { color: text }, formatter: params => {
            const data = params.data || {}
            if (this.mapView === 'agents') return `${params.name}<br/><b style="font-size:16px">${data.authorizationCount || 0}</b> 项授权 · ${data.exclusiveCount || 0} 项独家<br/>区域客资 ${data.value == null ? 0 : (this.mapRegions.find(item => item.name === params.name)?.count || 0)} 条`
            return `${params.name}<br/><b style="font-size:18px">${params.value || 0}</b> 条客资<br/>A ${data.grades?.A || 0} · B ${data.grades?.B || 0} · C ${data.grades?.C || 0}<br/>签约客户 ${data.signedCount || 0}`
          } },
          visualMap: this.mapView === 'customers' ? { show: true, min: 0, max, left: 24, bottom: 24, text: ['高', '低'], calculable: false, textStyle: { color: text }, inRange: { color: [soft, accent] } } : { show: false },
          series: [{ type: 'map', map: 'china-customers', roam: true, zoom: 1.12, scaleLimit: { min: .9, max: 4 }, label: { show: false }, itemStyle: { areaColor: soft, borderColor: card, borderWidth: 1.3 }, emphasis: { label: { show: true, color: text, fontWeight: 700 }, itemStyle: { shadowBlur: 12, shadowColor: `${accent}66` } }, data: mapData }],
        }, true)
        this.mapChart.off('click')
        this.mapChart.on('click', params => {
          const province = this.resolveMapProvince(params.name) || params.name
          this.loadRegionalMap(province)
        })
        this.mapChart.resize()
      } catch (error) {
        this.mapError = error.message || '请检查地图静态资源是否完整。'
      }
    },
    retryMap() {
      this.chinaGeoJSON = null
      this.loadRegionalMap(this.selectedMapRegion)
    },
    returnToSavedCustomer(customerId, options = {}) {
      const visibleInMainList = this.customers.some(customer => customer.id === customerId && customer.grade !== 'D')
      this.savedCustomerId = visibleInMainList ? customerId : null
      this.customerPool = 'active'
      if (options.preserveFilters) this.openRegionMenu = ''
      else this.resetFilters()
      this.switchPage('customers')
      if (visibleInMainList) this.$nextTick(() => document.getElementById(`customer-record-${customerId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    },
    captureCustomerEditReturnContext() {
      return {
        page: this.activePage,
        customerPool: this.customerPool,
        keyword: this.keyword,
        customerGrade: this.customerGrade,
        sourceFilter: this.sourceFilter,
        projectTypeFilter: this.projectTypeFilter,
        progressFilter: this.progressFilter,
        provinceFilter: this.provinceFilter,
        cityFilter: this.cityFilter,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        personalSearch: this.personalSearch || '',
        personalStatus: this.personalStatus || 'active',
        personalSort: this.personalSort || 'priority',
        personalEmployee: this.personalEmployee || '',
        personalFilters: { ...(this.personalFilters || {}) },
        scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
      }
    },
    restoreCustomerEditReturnContext(savedCustomer, savedProject, context = this.customerEditReturnContext) {
      const target = context || { page: 'customers', customerPool: 'active', scrollY: 0 }
      const page = ['overview', 'customers', 'heatmap', 'followups', 'updates', 'visitors', 'plans'].includes(target.page) ? target.page : 'customers'
      for (const key of ['keyword', 'customerGrade', 'sourceFilter', 'projectTypeFilter', 'progressFilter', 'provinceFilter', 'cityFilter', 'dateFrom', 'dateTo']) {
        if (target[key] !== undefined) this[key] = target[key]
      }
      this.customerPool = target.customerPool === 'dormant' ? 'dormant' : 'active'
      if (target.personalFilters) this.personalFilters = { ...target.personalFilters }
      for (const key of ['personalSearch', 'personalStatus', 'personalSort', 'personalEmployee']) {
        if (target[key] !== undefined) this[key] = target[key]
      }
      this.activePage = page
      if (typeof history !== 'undefined') history.replaceState(null, '', `#/${page}`)
      this.openRegionMenu = ''

      let visible = null
      let elementId = ''
      this.savedCustomerId = null
      this.savedProjectId = null
      if (page === 'customers') {
        const inPool = this.customerPool === 'dormant' ? savedCustomer.grade === 'D' : savedCustomer.grade !== 'D'
        visible = inPool && this.customerMatchesCurrentFilters(savedCustomer)
        this.savedCustomerId = visible ? savedCustomer.id : null
        elementId = `customer-record-${savedCustomer.id}`
      } else if (page === 'followups') {
        const projectId = savedProject?.id || this.selectedCustomerProjectId
        const cached = this.personalProjects?.find(project => project.id === projectId)
        const candidate = cached ? { ...cached, ...(savedProject || {}), customer: { ...cached.customer, ...savedCustomer } } : null
        visible = Boolean(candidate && this.personalProjectMatchesFilters?.(candidate))
        this.savedProjectId = visible ? projectId : null
        elementId = `personal-project-${projectId}`
      }

      this.$nextTick(() => {
        const element = visible && elementId ? document.getElementById(elementId) : null
        if (element) element.scrollIntoView({ block: 'start', behavior: 'smooth' })
        else if (typeof window !== 'undefined' && Number.isFinite(target.scrollY)) window.scrollTo({ top: target.scrollY })
        if (page === 'heatmap') this.loadRegionalMap()
        if (page === 'overview') this.loadOverviewStatistics()
      })
      this.customerEditReturnContext = null
      return visible
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
    isValidCustomerPhone(value) {
      const contact = String(value || '').trim()
      return contact.length > 0 && contact.length <= 100
    },
    async loadOverviewStatistics() {
      if (this.overviewLoading) return
      this.overviewLoading = true
      this.overviewError = ''
      try {
        const response = await fetch('/api/statistics/overview/')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `经营总览加载失败（${response.status}）`)
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('经营总览数据格式不正确')
        this.overviewStats = data
        const customerStats = data.customers && typeof data.customers === 'object' ? data.customers : {}
        const rawGradeCounts = customerStats.gradeCounts
        const gradeCounts = rawGradeCounts && typeof rawGradeCounts === 'object' && !Array.isArray(rawGradeCounts) ? rawGradeCounts : { A: 0, B: 0, C: 0 }
        const projectStats = data.projects && typeof data.projects === 'object' ? data.projects : {}
        const progressUpdateStats = data.progressUpdates && typeof data.progressUpdates === 'object' ? data.progressUpdates : {}
        this.metrics[0].value = String(customerStats.total || 0)
        this.metrics[0].change = `A ${gradeCounts.A || 0} · B ${gradeCounts.B || 0} · C ${gradeCounts.C || 0}`
        this.metrics[0].note = `A / B / C 类可见客资共 ${customerStats.total || 0} 条`
        this.metrics[1].value = String(progressUpdateStats.last7Days || 0)
        this.metrics[1].change = '近 7 天'
        this.metrics[1].note = progressUpdateStats.last7Days
          ? `近 7 天共有 ${progressUpdateStats.last7Days} 条实际项目进展`
          : '近 7 天暂无项目进展记录'
        const activeProjects = Number(projectStats.active || 0)
        const implementationProjects = Number(projectStats.implementation || 0)
        this.metrics[2].value = String(implementationProjects)
        this.metrics[2].change = activeProjects
          ? `占在办 ${Math.round(implementationProjects / activeProjects * 100)}%`
          : '占在办 0%'
        this.metrics[2].note = `项目共 ${projectStats.total || 0} 个 · 在办 ${activeProjects} 个 · 已完成 ${projectStats.completed || 0} 个`
      } catch (error) {
        this.overviewError = error.message || '经营总览加载失败'
        this.showToast(this.overviewError)
      } finally {
        this.overviewLoading = false
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
        if (!this.customerDeepLinkHandled) {
          this.customerDeepLinkHandled = true
          await nextTick()
          this.openCustomerProjectFromHash()
        }
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
    requestActionConfirm({ title, message, confirmLabel = '确认', tone = 'danger' }) {
      if (this.actionConfirmResolver) this.actionConfirmResolver(false)
      this.actionConfirm = { open: true, title, message, confirmLabel, tone }
      return new Promise(resolve => { this.actionConfirmResolver = resolve })
    },
    resolveActionConfirm(confirmed) {
      const resolver = this.actionConfirmResolver
      this.actionConfirmResolver = null
      this.actionConfirm = { open: false, title: '', message: '', confirmLabel: '确认', tone: 'danger' }
      if (resolver) resolver(Boolean(confirmed))
    },
    async deleteVisitorRecord(record) {
      if (!record?.id) return
      const confirmed = await this.requestActionConfirm({
        title: '删除来访记录？',
        message: `将删除 ${record.customer.name} 的这条来访记录，此操作无法撤销。`,
        confirmLabel: '确认删除',
      })
      if (!confirmed) return
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
      if (!customer) return
      const selectedProject = this.customerDetailProjects.find(item => item.id === this.selectedCustomerProjectId)
      if (!selectedProject) {
        this.showToast('请先填写项目名称和项目地区并保存，再添加进展记录')
        this.$nextTick(() => {
          this.$refs.editProjectNameInput?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          this.$refs.editProjectNameInput?.focus()
        })
        return
      }
      const currentProgress = selectedProject?.progress || customer.progress
      const currentIndex = Math.max(0, Math.min(this.progressStages.indexOf(currentProgress), this.progressStages.length - 2))
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
      const project = this.customerDetailProjects.find(item => item.id === this.selectedCustomerProjectId)
        || this.customerProjects.find(item => item.customer?.id === customer?.id)
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
        if (customer?.id) await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
        this.showToast(isEditing ? '进展记录已修改' : '进展记录已添加，项目正式阶段保持不变')
      } catch (error) {
        this.showToast(error.message || '进度更新保存失败')
      } finally {
        this.progressUpdateSaving = false
      }
    },
    async deleteProgressUpdate(item) {
      if (!item?.id || !item.canDelete) return
      const confirmed = await this.requestActionConfirm({
        title: '删除这条小进展？',
        message: `${item.createdLabel} · ${item.intervalLabel}\n${item.content}`,
        confirmLabel: '确认删除',
      })
      if (!confirmed) return
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
        if (customerId) await this.loadCustomerFollowUps(customerId, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
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
        if (customerId) await this.loadCustomerFollowUps(customerId, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
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
        if (customerId) await this.loadCustomerFollowUps(customerId, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
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
            ? '事项已完成，项目阶段保持不变'
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
      this.syncPersonalBadges?.()
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
        const response = await fetch(`/api/customers/${customer.id}/scheme-calculation/?projectId=${encodeURIComponent(this.selectedCustomerProjectId || '')}`)
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
      const [n, d] = this.schemeLayerFraction(layer)
      const [price, scale] = this.schemeDecimal(layer?.unitPrice)
      const [squareN, squareD] = this.schemeLayerFraction({...layer, length: 1, width: 1})
      const money = (a, b) => Number((2n * a * 100n + b) / (2n * b)) / 100
      const exactQuantity = Number(n) / Number(d)
      return {
        exactQuantity,
        quantity: exactQuantity,
        squareMeterPrice: money(squareN * price, squareD * scale),
        totalPrice: money(n * price, d * scale),
      }
    },
    schemeMoney(value) {
      return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    schemeTotalPrice() {
      return this.schemeCalculation.layers.slice(0, this.schemeCalculation.layerCount).reduce((sum, layer) => sum + Math.round(this.schemeLayerPreview(layer).totalPrice * 100), 0) / 100
    },
    schemeDecimal(value) {
        const n = Number(value) || 0
        if (!Number.isFinite(n) || n < 0) return [0n, 1n]
        const [mantissa, exponent = '0'] = String(n).toLowerCase().split('e')
        const places = (mantissa.split('.')[1] || '').length - Number(exponent)
        const digits = BigInt(mantissa.replace('.', ''))
        return places < 0 ? [digits * 10n ** BigInt(-places), 1n] : [digits, 10n ** BigInt(places)]
    },
    schemeLayerFraction(layer) {
      let n = 1n, d = 100n
      for (const key of ['length', 'width', 'thickness', 'dosagePercent', 'density']) {
        const [a, b] = this.schemeDecimal(layer?.[key]); n *= a; d *= b
      }
      return [n, d]
    },
    schemeQuantityTotals() {
      // Decimal integer arithmetic avoids rounding 2.0000000000000004 up to 3.
      let numerator = 0n, denominator = 1n
      for (const layer of this.schemeCalculation.layers.slice(0, this.schemeCalculation.layerCount)) {
        const [n, d] = this.schemeLayerFraction(layer)
        numerator = numerator * d + n * denominator; denominator *= d
      }
      return { exactQuantity: Number(numerator) / Number(denominator), quantity: Number((numerator + denominator - 1n) / denominator) }
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
        const response = await fetch(`/api/customers/${customer.id}/scheme-calculation/?projectId=${encodeURIComponent(this.selectedCustomerProjectId || '')}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify(payload),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `测算保存失败（${response.status}）`)
        this.schemeCalculation = this.normalizeSchemeCalculation(data.calculation, customer)
        this.customerSchemeCalculation = data.calculation
        if (!silent) this.showToast('方案测算已保存，项目总用量合计后向上取整')
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
        const response = await fetch(`/api/customers/${customer.id}/scheme-calculation/export/?projectId=${encodeURIComponent(this.selectedCustomerProjectId || '')}`, {
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
    stageItemCount(stage) {
      return this.stageTasksForDisplay(stage).length
    },
    stageSummaryLabel(stage) {
      if (!stage) return '点击查看'
      if (stage.name === '技术验证' && this.customerMaterialExperiment?.id) return '实验已登记'
      if (stage.name === '客户深度沟通' && this.customerVisitorRecords.length) return `${this.customerVisitorRecords.length} 次来访`
      if (stage.name === '方案与报价' && this.customerSchemeCalculation?.id) return `${this.customerSchemeCalculation.layerCount || 1} 层测算`
      const count = this.stageItemCount(stage)
      return count ? `${count} 条事项` : '点击查看'
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
        const response = await fetch(`/api/customers/${customer.id}/material-experiment/?projectId=${encodeURIComponent(this.selectedCustomerProjectId || '')}`, {
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
      if (customer.country) return { province: customer.country, city: customer.city || '待完善', district: customer.district || '—' }
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
    wechatStatusLabel(value) {
      return ({ yes: '已添加', no: '未添加', rejected: '已添加未通过', unknown: '未添加' })[value] || '未添加'
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
          国家地区: customer.country || '',
          省: customer.country ? '' : location.province,
          市: location.city,
          区: location.district,
          客户名称: customer.name || '',
          联系方式: customer.phone || '',
          是否添加微信: ({ yes: '已添加', no: '未添加', rejected: '已添加未通过', unknown: '未添加' })[customer.wechatStatus || 'no'],
          客户描述: this.customerDescription(customer),
          项目名称: customer.projectName || '',
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
        { wch: 18 }, { wch: 62 }, { wch: 28 }, { wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
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
        const requiredHeaders = ['客资来源', '客户等级', '省', '市', '区', '客户名称', '客户电话', '客户描述', '项目名称', '项目进度', '施工方案', '商务负责人', '技术负责人']
        const missingHeaders = requiredHeaders.filter(header => !Object.prototype.hasOwnProperty.call(rows[0], header))
        if (missingHeaders.length) throw new Error(`缺少列：${missingHeaders.join('、')}`)
        const imported = rows.filter(row => String(row['客户名称'] || '').trim()).map((row, index) => {
          const grade = String(row['客户等级'] || 'C').trim().toUpperCase()
          const source = String(row['客资来源'] || '').trim()
          if (!CUSTOMER_SOURCES.includes(source)) throw new Error(`第 ${index + 2} 行客资来源必须是：${CUSTOMER_SOURCES.join('、')}`)
          const province = String(row['省'] || '').trim()
          const city = String(row['市'] || '').trim()
          const progress = String(row['项目进度'] || '需求对接').trim()
          const referrer = source === '朋友介绍' ? String(row['介绍人'] || '').trim() : ''
          return {
            name: String(row['客户名称']).trim(),
            phone: String(row['客户电话'] || row['联系方式'] || '').trim(),
            country: String(row['国家地区'] || '').trim(),
            wechatStatus: ({ '已添加': 'yes', '是': 'yes', '未添加': 'no', '否': 'no', '已添加未通过': 'rejected' })[String(row['是否添加微信'] || '').trim()] || 'no',
            source,
            channel: referrer ? `介绍人：${referrer}` : 'Excel导入',
            referrer,
            province,
            city,
            district: String(row['区'] || '').trim(),
            region: [province, city].filter(Boolean).join(' · ') || '地区待完善',
            grade: ['A', 'B', 'C', 'D'].includes(grade) ? grade : 'C',
            description: String(row['客户描述'] || '').trim(),
            projectName: String(row['项目名称'] || '').trim(),
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
        const province = customer.country ? '' : this.locationParts(customer).province
        if (!province || province.includes('待完善')) return
        if (!grouped.has(province)) grouped.set(province, { name: province, all: 0, A: 0, B: 0, C: 0 })
        const item = grouped.get(province)
        item.all += 1
        if (['A', 'B', 'C'].includes(customer.grade)) item[customer.grade] += 1
      })
      return [...grouped.values()].sort((a, b) => b.all - a.all)
    },
    syncSummaryData() {
      const total = this.customers.filter(customer => customer.grade !== 'D').length
      const customerNav = this.navItems.find(item => item.id === 'customers')
      if (customerNav) customerNav.badge = String(total)
    },
    async loadCustomerFollowUps(customerId, projectId = this.selectedCustomerProjectId, options = {}) {
      if (!customerId) return
      const preserveEditSnapshot = Boolean(options.preserveEditSnapshot)
      const preserveStageExpansion = Boolean(options.preserveStageExpansion)
      const openingDraft = JSON.stringify(this.editCustomer)
      this.customerFollowUpsLoading = true
      this.customerFollowUpsError = ''
      try {
        const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''
        const response = await fetch(`/api/customers/${customerId}/${query}`)
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
        this.customerCanManageCommercial = Boolean(data.canManageCommercial)
        this.customerDetailProjects = Array.isArray(data.projects) ? data.projects : []
        this.customerAssociatedProjects = Array.isArray(data.associatedProjects) ? data.associatedProjects : []
        this.selectedCustomerProjectId = data.selectedProjectId || this.customerDetailProjects[0]?.id || null
        this.customerPartnerships = Array.isArray(data.partnerships) ? data.partnerships : []
        this.customerAuthorizations = Array.isArray(data.authorizations) ? data.authorizations : []
        this.customerContracts = Array.isArray(data.contracts) ? data.contracts : []
        this.customerAttachments = Array.isArray(data.attachments) ? data.attachments : []
        this.customerRelationshipExpanded = this.activeCustomerPartnerships.length > 0
        this.syncInlineRelationshipForms()
        const selectedProject = this.customerDetailProjects.find(item => item.id === this.selectedCustomerProjectId)
        const draftUnchanged = JSON.stringify(this.editCustomer) === openingDraft
        if (selectedProject && !preserveEditSnapshot) {
          const initial = JSON.parse(openingDraft)
          const projectValues = {
            ownerId: selectedProject.businessOwner?.id || '', owner: selectedProject.businessOwner?.name || '待分配',
            techId: selectedProject.technicalOwner?.id || '', tech: selectedProject.technicalOwner?.name || '待分配',
            projectName: selectedProject.name || '', country: selectedProject.country || '',
            locationMode: selectedProject.country ? 'overseas' : 'domestic',
            province: selectedProject.province || '', city: selectedProject.city || '', district: selectedProject.district || '',
            progress: selectedProject.progress, plan: selectedProject.plan || '', projectTypeId: selectedProject.projectType?.id || '',
          }
          // Merge each untouched field; a slow response must not undo user input.
          for (const [key, value] of Object.entries(projectValues)) {
            if (this.editCustomer[key] === initial[key]) this.editCustomer[key] = value
          }
          if (!preserveStageExpansion) {
            const selectedStage = this.customerProgressRoadmap.find(stage => stage.name === selectedProject.progress)
            this.expandedCustomerProgressStage = selectedStage && this.stageItemCount(selectedStage) ? selectedProject.progress : ''
          }
        }
        if (!preserveEditSnapshot && draftUnchanged) this.editSnapshot = JSON.stringify(this.editCustomer)
      } catch (error) {
        this.customerFollowUpsError = error.message || '阶段事项加载失败'
      } finally {
        this.customerFollowUpsLoading = false
      }
    },
    setCustomerLocationMode(target, mode) {
      Object.assign(this[target], { locationMode: mode, country: '', province: '', city: '', district: '' })
      this.openRegionMenu = ''
      this.newRegionSearch = { province: '', city: '', district: '' }
    },
    emptyNewCustomer() {
      return {
        name: '', phone: '', wechatStatus: 'no', source: '抖音', referrer: '',
        country: '', locationMode: 'domestic', province: '', city: '', district: '', grade: 'C', cooperationStatus: 'none', projectName: '', projectTypeId: '', progress: '需求对接',
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
    editCustomerFromRecord(customer) {
      const location = this.locationParts(customer)
      return {
        name: customer.name || '',
        phone: customer.phone || '',
        wechatStatus: customer.wechatStatus === 'unknown' ? 'no' : (customer.wechatStatus || 'no'),
        source: customer.source || '抖音',
        referrer: customer.referrer || '',
        country: customer.country || '', locationMode: customer.country ? 'overseas' : 'domestic',
        province: customer.country ? '' : (location.province.includes('待完善') ? '' : location.province),
        city: location.city.includes('待完善') ? '' : location.city,
        district: customer.district || '',
        grade: customer.grade || 'D',
        cooperationStatus: customer.cooperationStatus || ((customer.identities || []).length ? 'cooperating' : 'none'),
        projectName: customer.projectName || '',
        projectTypeId: customer.projectTypeId || '',
        progress: customer.progress || '需求对接',
        ownerId: this.employees.business.some(employee => employee.id === customer.ownerId) ? customer.ownerId : '',
        owner: customer.owner || '',
        techId: this.employees.technical.some(employee => employee.id === customer.techId) ? customer.techId : '',
        tech: customer.tech || '',
        plan: customer.plan === '方案待完善' ? '' : (customer.plan || ''),
        description: customer.description || '',
      }
    },
    emptyBatchCustomerRow() {
      this.batchCustomerRowSequence += 1
      return { localId: this.batchCustomerRowSequence, name: '', phone: '', description: '', source: '抖音' }
    },
    batchCustomerRowHasContent(row) {
      return Boolean(String(row?.name || '').trim() || String(row?.phone || '').trim() || String(row?.description || '').trim())
    },
    openBatchCustomerCreate() {
      this.batchCustomerRows = Array.from({ length: 10 }, () => this.emptyBatchCustomerRow())
      this.batchCustomerRowErrors = {}
      this.showBatchCustomerCreate = true
    },
    addBatchCustomerRow() {
      this.batchCustomerRows.push(this.emptyBatchCustomerRow())
      this.$nextTick(() => {
        const rows = document.querySelector('.batch-customer-table')
        rows?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
    },
    formatCustomerCreatedAt(customer) {
      const value = customer?.createdAt
      const date = value ? new Date(value) : null
      if (!date || Number.isNaN(date.getTime())) return customer?.createdDate ? chineseDate(customer.createdDate) : '时间待记录'
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(date)
    },
    clearBatchCustomerRowError(localId) {
      if (!this.batchCustomerRowErrors[localId]) return
      const nextErrors = { ...this.batchCustomerRowErrors }
      delete nextErrors[localId]
      this.batchCustomerRowErrors = nextErrors
    },
    closeBatchCustomerCreate() {
      this.showBatchCustomerCreate = false
      this.batchCustomerRows = []
      this.batchCustomerRowErrors = {}
    },
    async requestCloseBatchCustomerCreate() {
      if (this.batchCustomerSaving) return
      if (this.batchCustomerFilledCount) {
        const confirmed = await this.requestActionConfirm({
          title: '放弃本次批量录入？',
          message: `当前已填写 ${this.batchCustomerFilledCount} 条客资，关闭后本次内容不会保留。`,
          confirmLabel: '放弃录入',
          tone: 'warning',
        })
        if (!confirmed) return
      }
      this.closeBatchCustomerCreate()
    },
    async submitBatchCustomers() {
      if (this.batchCustomerSaving) return
      const filledRows = this.batchCustomerRows
        .map((row, index) => ({ row, index }))
        .filter(item => this.batchCustomerRowHasContent(item.row))
      if (!filledRows.length) {
        this.showToast('请至少填写一条客资')
        return
      }
      const errors = {}
      filledRows.forEach(({ row }) => {
        if (!String(row.name || '').trim()) errors[row.localId] = '请填写客户名称'
        else if (!this.isValidCustomerPhone(row.phone)) errors[row.localId] = '请填写联系方式（最多100个字符）'
      })
      this.batchCustomerRowErrors = errors
      if (Object.keys(errors).length) {
        const firstInvalidIndex = this.batchCustomerRows.findIndex(row => errors[row.localId])
        const firstInvalidRow = this.batchCustomerRows[firstInvalidIndex]
        const missingName = !String(firstInvalidRow?.name || '').trim()
        this.showToast(`第 ${firstInvalidIndex + 1} 行：${errors[firstInvalidRow.localId]}`)
        this.$nextTick(() => {
          const input = missingName
            ? this.$refs.batchCustomerNameInputs?.[firstInvalidIndex]
            : this.$refs.batchCustomerPhoneInputs?.[firstInvalidIndex]
          input?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          input?.focus()
        })
        return
      }
      this.batchCustomerSaving = true
      try {
        const customers = filledRows.map(({ row }) => ({
          name: String(row.name || '').trim(),
          phone: String(row.phone || '').trim(),
          description: String(row.description || '').trim(),
          source: String(row.source || '').trim() || '抖音',
        }))
        if (this.confirmCustomerDuplicates && !(await this.confirmCustomerDuplicates(customers))) return
        const response = await fetch('/api/customers/import/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({ mode: 'leads', customers }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `批量增加失败（${response.status}）`)
        await this.loadCustomers()
        this.customerPool = 'active'
        this.resetFilters()
        this.switchPage('customers')
        this.closeBatchCustomerCreate()
        this.showToast(`已新增 ${data.createdCount || customers.length} 条客资，可在列表中逐步完善资料`)
      } catch (error) {
        this.showToast(`批量增加失败：${error.message || '请稍后重试'}`)
      } finally {
        this.batchCustomerSaving = false
      }
    },
    syncInlineRelationshipForms() {
      const level = this.inlineAgentLevel
      const activeAuthorization = this.customerAuthorizations.find(item => (
        item.level === level && !['terminated', 'expired'].includes(item.agreementStatus)
      )) || this.customerAuthorizations.find(item => !['terminated', 'expired'].includes(item.agreementStatus)) || null
      const nextYear = new Date()
      nextYear.setFullYear(nextYear.getFullYear() + 1)
      this.inlineAuthorizationId = activeAuthorization?.id || null
      this.inlineAuthorizationForm = {
        level,
        province: activeAuthorization?.province || this.editCustomer.province || '',
        city: level === 'province' ? '' : (activeAuthorization?.city || this.editCustomer.city || ''),
        district: level === 'district' ? (activeAuthorization?.district || this.editCustomer.district || '') : '',
        effectiveDate: activeAuthorization?.effectiveDate || this.todayDateValue,
        expiryDate: activeAuthorization?.expiryDate || this.formatLocalDate(nextYear),
      }
      const activeContract = this.customerContracts.find(item => item.status !== 'terminated') || this.customerContracts[0] || null
      this.inlineContractId = activeContract?.id || null
      this.inlineContractNumber = activeContract?.contractNumber || ''
      this.inlinePartnershipType = ''
    },
    openCustomerEdit(customer, requestedProjectId = null) {
      const index = this.customers.indexOf(customer)
      if (index < 0) return
      if (!this.showEdit) this.customerEditReturnContext = this.captureCustomerEditReturnContext()
      this.editingIndex = index
      this.editCustomer = this.editCustomerFromRecord(customer)
      this.editSnapshot = JSON.stringify(this.editCustomer)
      this.customerFollowUps = []
      this.customerProgressUpdates = []
      this.customerVisitorRecords = []
      this.customerSchemeCalculation = null
      this.customerMaterialExperiment = null
      this.customerCanManageProject = false
      this.customerCanManageCommercial = false
      this.customerDetailProjects = this.customerProjects.filter(project => project.customer?.id === customer.id)
      this.customerAssociatedProjects = []
      this.customerProjectsExpanded = false
      const exactProject = this.customerDetailProjects.find(project => project.id === Number(requestedProjectId))
      this.selectedCustomerProjectId = exactProject?.id || this.customerDetailProjects[0]?.id || null
      this.customerPartnerships = Array.isArray(customer.identities) ? customer.identities.map(item => ({ ...item, isActive: true })) : []
      this.customerAuthorizations = []
      this.customerContracts = []
      this.customerAttachments = []
      this.customerRelationshipExpanded = this.activeCustomerPartnerships.length > 0
      this.inlinePartnershipType = ''
      this.inlineAuthorizationId = null
      this.inlineAuthorizationForm = { level: '', province: '', city: '', district: '', effectiveDate: '', expiryDate: '' }
      this.inlineContractId = null
      this.inlineContractNumber = ''
      this.showProjectAssociationPicker = false
      this.projectAssociationProjectId = ''
      this.showPartnershipEditor = false
      this.editingPartnershipId = null
      this.showProjectEditor = false
      this.showAuthorizationEditor = false
      this.showContractEditor = false
      this.expandedProgressIntervalKey = ''
      this.expandedProgressUpdateId = null
      this.expandedCustomerProgressStage = ''
      this.customerFollowUpsError = ''
      this.showUnsavedConfirm = false
      this.showProjectNavigationConfirm = false
      this.pendingCustomerProjectId = null
      this.pendingCustomerProjectTarget = null
      this.showEdit = true
      this.updateCustomerProjectHash(customer.id, this.selectedCustomerProjectId)
      this.loadRegionTree()
      this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
    },
    openCustomerProjectFromHash() {
      const rawHash = window.location.hash.replace(/^#\/?/, '')
      const [page, query = ''] = rawHash.split('?')
      if (page !== 'customers' || !query || this.showEdit) return
      const params = new URLSearchParams(query)
      const customerId = Number(params.get('customerId'))
      const projectId = Number(params.get('projectId'))
      if (!Number.isInteger(customerId) || !Number.isInteger(projectId)) return
      const customer = this.customers.find(item => item.id === customerId)
      const project = this.customerProjects.find(item => item.id === projectId && item.customer?.id === customerId)
      if (customer && project) this.openCustomerEdit(customer, projectId)
    },
    updateCustomerProjectHash(customerId, projectId) {
      if (!customerId || !projectId || this.activePage !== 'customers') return
      const params = new URLSearchParams({ customerId: String(customerId), projectId: String(projectId) })
      history.replaceState(null, '', `#/customers?${params.toString()}`)
    },
    async activateCustomerProject(project) {
      if (!project?.id || project.id === this.selectedCustomerProjectId) return
      const customer = this.customers[this.editingIndex]
      if (!customer) return
      const exactProject = this.customerDetailProjects.find(item => item.id === project.id && item.customer?.id === customer.id)
      if (!exactProject) return this.showToast('未找到该客户对应的项目记录')
      this.selectedCustomerProjectId = project.id
      this.expandedProgressIntervalKey = ''
      this.expandedProgressUpdateId = null
      await this.loadCustomerFollowUps(customer.id, project.id)
      this.updateCustomerProjectHash(customer.id, project.id)
    },
    openCustomerProject(project) {
      if (!project?.id || project.id === this.selectedCustomerProjectId) return
      if (this.hasUnsavedEdit) {
        this.pendingCustomerProjectId = project.id
        this.pendingCustomerProjectTarget = { customerId: this.customers[this.editingIndex]?.id, projectId: project.id }
        this.showProjectNavigationConfirm = true
        return
      }
      this.activateCustomerProject(project)
    },
    async activateAssociatedProject(target) {
      if (!target?.customerId || !target?.projectId) return
      const currentCustomer = this.customers[this.editingIndex]
      if (currentCustomer?.id === target.customerId) {
        const project = this.customerDetailProjects.find(item => item.id === target.projectId)
        if (!project) return this.showToast('未找到该项目的客资详情')
        await this.activateCustomerProject(project)
        return
      }
      const customer = this.customers.find(item => item.id === target.customerId)
      const project = this.customerProjects.find(item => item.id === target.projectId && item.customer?.id === target.customerId)
      if (!customer || !project) return this.showToast('未找到可访问的项目客资详情')
      this.openCustomerEdit(customer, project.id)
    },
    openAssociatedProject(association) {
      const project = association?.project
      if (!project?.id || !project.customer?.id) return
      const target = { customerId: project.customer.id, projectId: project.id }
      if (this.hasUnsavedEdit) {
        this.pendingCustomerProjectTarget = target
        this.pendingCustomerProjectId = project.id
        this.showProjectNavigationConfirm = true
        return
      }
      this.activateAssociatedProject(target)
    },
    openProjectAssociationPicker() {
      this.projectAssociationProjectId = ''
      this.showProjectAssociationPicker = true
    },
    async createProjectAssociation() {
      const customer = this.customers[this.editingIndex]
      if (!customer?.id || !this.projectAssociationProjectId || this.businessRecordSaving) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/project-associations/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({ projectId: this.projectAssociationProjectId }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '项目案例关联失败')
        this.showProjectAssociationPicker = false
        this.projectAssociationProjectId = ''
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
        this.showToast('项目案例已关联')
      } catch (error) {
        this.showToast(error.message || '项目案例关联失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    async removeProjectAssociation(association) {
      if (!association?.associationId || this.businessRecordSaving) return
      const confirmed = await this.requestActionConfirm({
        title: '移除这个项目关联？',
        message: '只会从当前客户的关联案例中移除，不会删除客资系统中的项目、进度或跟进记录。',
        confirmLabel: '移除关联',
      })
      if (!confirmed) return
      const customer = this.customers[this.editingIndex]
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/project-associations/${association.associationId}/`, {
          method: 'DELETE', headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '移除关联失败')
        this.customerAssociatedProjects = this.customerAssociatedProjects.filter(item => item.associationId !== association.associationId)
        this.showToast('关联已移除，原项目及历史记录保持不变')
      } catch (error) {
        this.showToast(error.message || '移除关联失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    async setAssociatedProjectCompletion(association, completed) {
      const project = association?.project
      if (!project?.id || this.businessRecordSaving) return
      const confirmed = await this.requestActionConfirm({
        title: completed ? '将项目标记为已完成？' : '将项目恢复为未完成？',
        message: completed
          ? '项目会移入“已完成”栏并停止作为进行中项目展示；项目资料、阶段记录和关联关系都会保留。'
          : '项目会返回“未完成”栏，并重新作为进行中项目参与后续跟进。',
        confirmLabel: completed ? '标记完成' : '恢复未完成',
      })
      if (!confirmed) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/projects/${project.id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({ isActive: !completed }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '项目完成状态更新失败')
        const updatedProject = data.project
        this.customerAssociatedProjects = this.customerAssociatedProjects.map(item => (
          item.associationId === association.associationId ? { ...item, project: updatedProject } : item
        ))
        this.customerProjects = this.customerProjects.map(item => item.id === updatedProject.id ? updatedProject : item)
        this.customerDetailProjects = this.customerDetailProjects.map(item => item.id === updatedProject.id ? updatedProject : item)
        this.showToast(completed ? '项目已标记完成' : '项目已恢复为未完成')
      } catch (error) {
        this.showToast(error.message || '项目完成状态更新失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    selectCustomerProject(project) {
      this.openCustomerProject(project)
    },
    cancelProjectNavigation() {
      if (this.savingEdit) return
      this.showProjectNavigationConfirm = false
      this.pendingCustomerProjectId = null
      this.pendingCustomerProjectTarget = null
    },
    async discardAndOpenCustomerProject() {
      const target = this.pendingCustomerProjectTarget
      const customer = this.customers[this.editingIndex]
      if (!target || !customer) return this.cancelProjectNavigation()
      this.editCustomer = this.editCustomerFromRecord(customer)
      this.editSnapshot = JSON.stringify(this.editCustomer)
      this.showProjectNavigationConfirm = false
      this.pendingCustomerProjectId = null
      this.pendingCustomerProjectTarget = null
      await this.activateAssociatedProject(target)
    },
    async saveAndOpenCustomerProject() {
      const target = this.pendingCustomerProjectTarget
      if (!target) return this.cancelProjectNavigation()
      const saved = await this.saveCustomerEdit({ keepOpen: true })
      if (!saved) return
      this.showProjectNavigationConfirm = false
      this.pendingCustomerProjectId = null
      this.pendingCustomerProjectTarget = null
      await this.activateAssociatedProject(target)
    },
    openProjectEditor(project = null) {
      this.editingProjectId = project?.id || null
      this.projectForm = project ? {
        name: project.name || '', projectTypeId: project.projectType?.id || '', progress: project.progress || '需求对接',
        ownerId: project.businessOwner?.id || '', techId: project.technicalOwner?.id || '',
        plan: project.plan || '', commercialNotes: project.commercialNotes || '', quotedAmount: project.quotedAmount ?? '', contractAmount: project.contractAmount ?? '',
      } : { name: '', projectTypeId: '', progress: '需求对接', ownerId: this.editCustomer.ownerId || '', techId: this.editCustomer.techId || '', plan: '', commercialNotes: '', quotedAmount: '', contractAmount: '' }
      this.showProjectEditor = true
    },
    async saveProjectRecord() {
      const customer = this.customers[this.editingIndex]
      if (!customer?.id || this.businessRecordSaving) return
      if (!this.projectForm.name.trim()) {
        this.showToast('请填写项目名称')
        this.$nextTick(() => document.querySelector('.business-editor-modal input')?.focus())
        return
      }
      this.businessRecordSaving = true
      try {
        const originalProject = this.customerDetailProjects.find(project => project.id === this.editingProjectId)
        if (this.confirmStageChange && !(await this.confirmStageChange(originalProject?.progress, this.projectForm.progress))) return
        const response = await fetch(this.editingProjectId ? `/api/projects/${this.editingProjectId}/` : `/api/customers/${customer.id}/projects/`, {
          method: this.editingProjectId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify(this.projectForm),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `项目保存失败（${response.status}）`)
        this.showProjectEditor = false
        this.editingProjectId = null
        await this.loadCustomers()
        await this.loadCustomerFollowUps(customer.id, data.project.id)
        this.showToast('项目已保存；进度与跟进记录按项目独立管理')
      } catch (error) {
        this.showToast(error.message || '项目保存失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    async archiveProjectRecord() {
      if (!this.editingProjectId) return
      const confirmed = await this.requestActionConfirm({
        title: '归档当前项目？',
        message: '项目会从有效项目中移除，但历史进度与小节点记录都会保留。',
        confirmLabel: '确认归档',
        tone: 'warning',
      })
      if (!confirmed) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/projects/${this.editingProjectId}/`, { method: 'DELETE', headers: { 'X-CSRFToken': this.csrfToken() } })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '项目归档失败')
        const customer = this.customers[this.editingIndex]
        this.showProjectEditor = false
        await this.loadCustomers()
        await this.loadCustomerFollowUps(customer.id)
        this.showToast('项目已归档，历史数据仍保留')
      } catch (error) {
        this.showToast(error.message || '项目归档失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    handleRoadmapWheel(event) {
      const scroller = event.currentTarget
      if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      const maximum = scroller.scrollWidth - scroller.clientWidth
      const nextPosition = Math.max(0, Math.min(maximum, scroller.scrollLeft + delta))
      if (nextPosition === scroller.scrollLeft) return
      event.preventDefault()
      scroller.scrollLeft = nextPosition
    },
    async addInlinePartnershipIdentity(identityType) {
      const customer = this.customers[this.editingIndex]
      if (identityType === this.activeCustomerPartnerships[0]?.type) return
      const replacingIdentity = this.activeCustomerPartnerships.length > 0
      this.inlinePartnershipType = identityType
      if (!customer?.id || !identityType || this.businessRecordSaving) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/customers/${customer.id}/partnerships/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify({ type: identityType, notes: '' }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '合作身份添加失败')
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
        this.customerRelationshipExpanded = true
        this.showToast(replacingIdentity ? '合作身份已替换，原身份已转为历史记录' : '合作身份已添加')
      } catch (error) {
        this.inlinePartnershipType = ''
        this.showToast(error.message || '合作身份添加失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    async removeInlinePartnershipIdentity(identity) {
      if (!identity?.id || this.businessRecordSaving) return
      const confirmed = await this.requestActionConfirm({
        title: `移除“${identity.label}”身份？`,
        message: '只停用当前合作身份标签，既有授权、合同和历史记录仍会保留。',
        confirmLabel: '移除身份',
      })
      if (!confirmed) return
      const customer = this.customers[this.editingIndex]
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/partnerships/${identity.id}/`, {
          method: 'DELETE', headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '合作身份移除失败')
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
        this.showToast('合作身份已移除，历史记录仍保留')
      } catch (error) {
        this.showToast(error.message || '合作身份移除失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    selectInlineAuthorizationProvince(value) {
      this.inlineAuthorizationForm.province = value
      this.inlineAuthorizationForm.city = ''
      this.inlineAuthorizationForm.district = ''
    },
    selectInlineAuthorizationCity(value) {
      this.inlineAuthorizationForm.city = value
      this.inlineAuthorizationForm.district = ''
    },
    async saveInlineCooperationInfo() {
      const customer = this.customers[this.editingIndex]
      const level = this.inlineAgentLevel
      const contractNumber = this.inlineContractNumber.trim()
      if (!customer?.id || this.businessRecordSaving) return
      let authorizationPayload = null
      if (level) {
        const { province, city, district, effectiveDate, expiryDate } = this.inlineAuthorizationForm
        if (!province || (level !== 'province' && !city) || (level === 'district' && !district)) {
          return this.showToast('请完善与代理级别对应的授权区域')
        }
        if (!effectiveDate || !expiryDate) return this.showToast('请填写完整的代理期限')
        if (expiryDate < effectiveDate) return this.showToast('代理到期日期不能早于生效日期')
        const existing = this.customerAuthorizations.find(item => item.id === this.inlineAuthorizationId)
        authorizationPayload = {
          level,
          province,
          city: level === 'province' ? '' : city,
          district: level === 'district' ? district : '',
          isExclusive: existing?.isExclusive || false,
          productScope: existing?.productScope || '全部产品及业务',
          effectiveDate,
          expiryDate,
          agreementStatus: existing?.agreementStatus || 'intent',
          agreementNumber: existing?.agreementNumber || '',
        }
      }
      if (!authorizationPayload && !contractNumber) return this.showToast('请输入合同编号')
      this.businessRecordSaving = true
      try {
        if (authorizationPayload) {
          const authorizationResponse = await fetch(this.inlineAuthorizationId ? `/api/authorizations/${this.inlineAuthorizationId}/` : `/api/customers/${customer.id}/authorizations/`, {
            method: this.inlineAuthorizationId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
            body: JSON.stringify(authorizationPayload),
          })
          const authorizationData = await authorizationResponse.json()
          if (!authorizationResponse.ok) throw new Error(authorizationData.error || '代理信息保存失败')
        }
        if (contractNumber) {
          const contractResponse = await fetch(this.inlineContractId ? `/api/contracts/${this.inlineContractId}/` : `/api/customers/${customer.id}/contracts/`, {
            method: this.inlineContractId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
            body: JSON.stringify(this.inlineContractId ? { contractNumber } : {
              title: `${customer.name}合作合同`, contractNumber, status: 'intent', projectId: this.selectedCustomerProjectId || '',
            }),
          })
          const contractData = await contractResponse.json()
          if (!contractResponse.ok) throw new Error(contractData.error || '合同编号保存失败')
        }
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId, { preserveEditSnapshot: true, preserveStageExpansion: true })
        if (authorizationPayload && this.activePage === 'heatmap') await this.loadRegionalMap()
        this.showToast('合作信息已保存')
      } catch (error) {
        this.showToast(error.message || '合作信息保存失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    openPartnershipEditor(item = null) {
      this.editingPartnershipId = item?.id || null
      this.partnershipForm = {
        type: item?.type || 'customer',
        notes: item?.notes || '',
      }
      this.showPartnershipEditor = true
    },
    async savePartnership() {
      const customer = this.customers[this.editingIndex]
      if (!customer?.id || this.businessRecordSaving) return
      const isEditing = Boolean(this.editingPartnershipId)
      this.businessRecordSaving = true
      try {
        const response = await fetch(isEditing ? `/api/partnerships/${this.editingPartnershipId}/` : `/api/customers/${customer.id}/partnerships/`, {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
          body: JSON.stringify(isEditing ? { notes: this.partnershipForm.notes, isActive: true } : this.partnershipForm),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '合作身份保存失败')
        this.showPartnershipEditor = false
        this.editingPartnershipId = null
        this.partnershipForm = { type: 'customer', notes: '' }
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
        this.customerRelationshipExpanded = true
        this.showToast(isEditing ? '合作身份说明已更新' : '合作身份已添加；原有身份不会被替换')
      } catch (error) {
        this.showToast(error.message || '合作身份保存失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    async archivePartnership() {
      if (!this.editingPartnershipId || this.businessRecordSaving) return
      const confirmed = await this.requestActionConfirm({
        title: '停用这个合作身份？',
        message: '合作身份会从客户当前标签中移除，但历史记录仍会保留。',
        confirmLabel: '确认停用',
      })
      if (!confirmed) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/partnerships/${this.editingPartnershipId}/`, {
          method: 'DELETE', headers: { 'X-CSRFToken': this.csrfToken() },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '合作身份停用失败')
        const customer = this.customers[this.editingIndex]
        this.showPartnershipEditor = false
        this.editingPartnershipId = null
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
        this.showToast('合作身份已停用，历史记录仍保留')
      } catch (error) {
        this.showToast(error.message || '合作身份停用失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    openAuthorizationEditor(item = null) {
      const today = this.formatLocalDate(new Date())
      const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1)
      this.editingAuthorizationId = item?.id || null
      this.authorizationForm = item ? {
        level: item.level, province: item.province, city: item.city || '', district: item.district || '', isExclusive: item.isExclusive,
        productScope: item.productScope || '', effectiveDate: item.effectiveDate || '', expiryDate: item.expiryDate || '', agreementStatus: item.agreementStatus, agreementNumber: item.agreementNumber || '',
      } : { level: 'province', province: '', city: '', district: '', isExclusive: false, productScope: '', effectiveDate: today, expiryDate: this.formatLocalDate(nextYear), agreementStatus: 'intent', agreementNumber: '' }
      this.showAuthorizationEditor = true
    },
    async saveAuthorization() {
      const customer = this.customers[this.editingIndex]
      if (!customer?.id || this.businessRecordSaving) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(this.editingAuthorizationId ? `/api/authorizations/${this.editingAuthorizationId}/` : `/api/customers/${customer.id}/authorizations/`, {
          method: this.editingAuthorizationId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() }, body: JSON.stringify(this.authorizationForm),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '代理授权保存失败')
        this.showAuthorizationEditor = false
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
        if (this.activePage === 'heatmap') await this.loadRegionalMap()
        this.showToast('区域代理授权已保存')
      } catch (error) {
        this.showToast(error.message || '代理授权保存失败')
      } finally {
        this.businessRecordSaving = false
      }
    },
    async terminateAuthorization() {
      if (!this.editingAuthorizationId) return
      const confirmed = await this.requestActionConfirm({
        title: '终止代理授权？',
        message: '该授权将标记为已终止，历史授权记录仍会保留。',
        confirmLabel: '确认终止',
      })
      if (!confirmed) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/authorizations/${this.editingAuthorizationId}/`, { method: 'DELETE', headers: { 'X-CSRFToken': this.csrfToken() } })
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '终止授权失败')
        const customer = this.customers[this.editingIndex]
        this.showAuthorizationEditor = false
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
        this.showToast('代理授权已终止，历史记录已保留')
      } catch (error) { this.showToast(error.message || '终止授权失败') } finally { this.businessRecordSaving = false }
    },
    openContractEditor(item = null) {
      this.editingContractId = item?.id || null
      this.contractForm = item ? {
        title: item.title, contractNumber: item.contractNumber || '', projectId: item.projectId || '', status: item.status, amount: item.amount ?? '',
        signedDate: item.signedDate || '', effectiveDate: item.effectiveDate || '', expiryDate: item.expiryDate || '', notes: item.notes || '',
      } : { title: '', contractNumber: '', projectId: this.selectedCustomerProjectId || '', status: 'intent', amount: '', signedDate: '', effectiveDate: '', expiryDate: '', notes: '' }
      this.showContractEditor = true
    },
    async saveContract() {
      const customer = this.customers[this.editingIndex]
      if (!customer?.id || this.businessRecordSaving) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(this.editingContractId ? `/api/contracts/${this.editingContractId}/` : `/api/customers/${customer.id}/contracts/`, {
          method: this.editingContractId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() }, body: JSON.stringify(this.contractForm),
        })
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '合同保存失败')
        this.showContractEditor = false
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
        this.showToast('合同信息已保存，状态与合作身份独立维护')
      } catch (error) { this.showToast(error.message || '合同保存失败') } finally { this.businessRecordSaving = false }
    },
    async terminateContract() {
      if (!this.editingContractId) return
      const confirmed = await this.requestActionConfirm({
        title: '终止当前合同？',
        message: '合同状态将变为已终止，合同历史和关联项目仍会保留。',
        confirmLabel: '确认终止',
      })
      if (!confirmed) return
      this.businessRecordSaving = true
      try {
        const response = await fetch(`/api/contracts/${this.editingContractId}/`, { method: 'DELETE', headers: { 'X-CSRFToken': this.csrfToken() } })
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '终止合同失败')
        const customer = this.customers[this.editingIndex]
        this.showContractEditor = false
        await this.loadCustomerFollowUps(customer.id, this.selectedCustomerProjectId)
        this.showToast('合同已标记为终止')
      } catch (error) { this.showToast(error.message || '终止合同失败') } finally { this.businessRecordSaving = false }
    },
    requestCloseEdit() {
      this.openRegionMenu = ''
      if (this.hasUnsavedEdit) {
        this.showUnsavedConfirm = true
        return
      }
      this.closeCustomerEdit()
    },
    closeCustomerEdit(options = {}) {
      const visitorReturnId = this.visitorDetailReturnRecordId
      if (this.actionConfirm.open) this.resolveActionConfirm(false)
      this.closeFollowTaskEditor()
      this.closeFollowTaskDelete()
      this.closeManualTaskDialog()
      this.showPartnershipEditor = false
      this.editingPartnershipId = null
      this.showProjectEditor = false
      this.showAuthorizationEditor = false
      this.showContractEditor = false
      this.showCustomerDelete = false
      this.showUnsavedConfirm = false
      this.showProjectNavigationConfirm = false
      this.pendingCustomerProjectId = null
      this.showEdit = false
      this.editingIndex = -1
      this.editSnapshot = ''
      this.customerFollowUps = []
      this.customerProgressUpdates = []
      this.customerVisitorRecords = []
      this.customerSchemeCalculation = null
      this.customerMaterialExperiment = null
      this.customerCanManageProject = false
      this.customerCanManageCommercial = false
      this.customerDetailProjects = []
      this.customerAssociatedProjects = []
      this.customerProjectsExpanded = false
      this.selectedCustomerProjectId = null
      this.customerPartnerships = []
      this.customerAuthorizations = []
      this.customerContracts = []
      this.customerAttachments = []
      this.customerRelationshipExpanded = false
      this.inlinePartnershipType = ''
      this.inlineAuthorizationId = null
      this.inlineAuthorizationForm = { level: '', province: '', city: '', district: '', effectiveDate: '', expiryDate: '' }
      this.inlineContractId = null
      this.inlineContractNumber = ''
      this.showProjectAssociationPicker = false
      this.projectAssociationProjectId = ''
      this.expandedProgressIntervalKey = ''
      this.expandedProgressUpdateId = null
      this.expandedCustomerProgressStage = ''
      this.customerFollowUpsError = ''
      if (this.activePage === 'customers' && window.location.hash.includes('?')) {
        history.replaceState(null, '', '#/customers')
      }
      if (visitorReturnId) {
        this.visitorDetailReturnRecordId = null
        const record = this.visitorRecords.find(item => item.id === visitorReturnId)
        this.activeVisitorRecord = record || null
        this.showVisitorDetail = Boolean(record)
      }
      if (!options.preserveReturnContext) this.customerEditReturnContext = null
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
    async saveCustomerEdit(options = {}) {
      if (this.savingEdit) return false
      if (this.customerFollowUpsLoading) { this.showToast('项目资料仍在加载，请稍后保存'); return false }
      if (this.customerFollowUpsError) { this.showToast('项目资料加载失败，请重新打开客资后再保存'); return false }
      const keepOpen = Boolean(options.keepOpen)
      this.showUnsavedConfirm = false
      if (this.editingIndex < 0 || !this.customers[this.editingIndex]) return false
      const projectName = this.editCustomer.projectName.trim()
      const primaryProject = this.customerDetailProjects[0]
      const selectedProject = this.customerDetailProjects.find(project => project.id === this.selectedCustomerProjectId)
      const creatingFirstProject = !primaryProject && Boolean(projectName)
      if (!this.isValidCustomerPhone(this.editCustomer.phone)) {
        this.showToast('请填写联系方式（电话、微信或 QQ，最多100个字符）')
        this.$nextTick(() => {
          this.$refs.editCustomerPhoneInput?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          this.$refs.editCustomerPhoneInput?.focus()
        })
        return false
      }
      const hasProjectDetails = this.editCustomerShowsFullProjectModules && (this.editCustomer.projectTypeId || this.editCustomer.plan.trim() || this.editCustomer.progress !== '需求对接')
      if ((primaryProject || hasProjectDetails) && !projectName) {
        this.showToast('请填写项目名称')
        this.$nextTick(() => {
          this.$refs.editProjectNameInput?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          this.$refs.editProjectNameInput?.focus()
        })
        return false
      }
      if (primaryProject && !selectedProject) {
        this.showToast('未找到当前项目，请刷新后重新进入')
        return false
      }
      const editingNonPrimaryProject = Boolean(primaryProject && selectedProject.id !== primaryProject.id)
      if (this.editCustomer.source === '朋友介绍' && !this.editCustomer.referrer.trim()) {
        this.showToast('朋友介绍的客资必须填写介绍人')
        return false
      }
      if ((selectedProject || creatingFirstProject) && (!(this.editCustomer.locationMode === 'overseas' ? this.editCustomer.country.trim() : this.editCustomer.province) || !this.editCustomer.city.trim())) {
        this.showToast(this.editCustomer.locationMode === 'overseas' ? '请填写国家 / 地区和城市' : '请选择项目所在的省份和城市')
        return false
      }
      const original = this.customers[this.editingIndex]
      if (!original.id) {
        this.showToast('该客资尚未同步到数据库，请刷新页面后重试')
        return false
      }
      this.savingEdit = true
      try {
        if (this.confirmStageChange && !(await this.confirmStageChange(selectedProject?.progress, this.editCustomer.progress))) return false
        if ((original.name !== this.editCustomer.name || original.phone !== this.editCustomer.phone) && this.confirmCustomerDuplicates && !(await this.confirmCustomerDuplicates([{ ...this.editCustomer, id: original.id }]))) return false
        const customerPayload = { ...this.editCustomer, projectId: selectedProject?.id || null, allowIncomplete: !primaryProject }
        const response = await fetch(`/api/customers/${original.id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': this.csrfToken(),
          },
          body: JSON.stringify(customerPayload),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `保存失败（${response.status}）`)
        let savedProject = data.project || null
        const savedCustomer = data.customer
        if (savedProject) {
          const existingProjectIndex = this.customerDetailProjects.findIndex(project => project.id === savedProject.id)
          if (existingProjectIndex >= 0) this.customerDetailProjects.splice(existingProjectIndex, 1, savedProject)
          else this.customerDetailProjects.push(savedProject)
          this.selectedCustomerProjectId = savedProject.id
          this.customerAssociatedProjects = this.customerAssociatedProjects.map(item => (
            item.project?.id === savedProject.id ? { ...item, project: savedProject } : item
          ))
          const cachedIndex = this.customerProjects.findIndex(project => project.id === savedProject.id)
          if (cachedIndex >= 0) this.customerProjects.splice(cachedIndex, 1, savedProject)
          else this.customerProjects.push(savedProject)
          if (!editingNonPrimaryProject) savedCustomer.projectName = savedProject.name
        }
        savedCustomer.percent = this.stagePercent(savedCustomer.progress)
        this.customers.splice(this.editingIndex, 1, savedCustomer)
        this.visitorRecords = this.visitorRecords.map(record => (
          record.customer?.id === savedCustomer.id
            ? { ...record, customer: { ...record.customer, id: savedCustomer.id, name: savedCustomer.name, grade: savedCustomer.grade, phone: savedCustomer.phone, source: savedCustomer.source } }
            : record
        ))
        this.customerPool = 'active'
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        await this.loadFollowUpTasks()
        if (keepOpen) {
          this.editSnapshot = JSON.stringify(this.editCustomer)
        } else {
          const returnContext = this.customerEditReturnContext
          const returnProject = savedProject || selectedProject || null
          this.closeCustomerEdit({ preserveReturnContext: true })
          const visible = this.restoreCustomerEditReturnContext(savedCustomer, returnProject, returnContext)
          if (visible === false) {
            this.showToast(`${savedCustomer.name} 已保存，但修改后不符合当前筛选条件`)
            return true
          }
        }
        this.showToast(`${savedCustomer.name} 的客资信息已保存到数据库`)
        return true
      } catch (error) {
        this.showToast(`保存失败：${error.message || '请稍后重试'}`)
        return false
      } finally {
        this.savingEdit = false
      }
    },
    async addCustomer() {
      if (this.savingCreate) return
      const name = this.newCustomer.name.trim()
      const phone = this.newCustomer.phone.trim()
      const projectName = this.newCustomer.projectName.trim()
      const isReferral = this.newCustomer.source === '朋友介绍'
      if (!name || !phone) {
        this.showToast('请填写客户名称和联系方式')
        return
      }
      if (!this.isValidCustomerPhone(phone)) {
        this.showToast('请填写联系方式（电话、微信或 QQ，最多100个字符）')
        this.$nextTick(() => {
          this.$refs.newCustomerPhoneInput?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          this.$refs.newCustomerPhoneInput?.focus()
        })
        return
      }
      if (!projectName) {
        this.showToast('请填写项目名称')
        this.$nextTick(() => {
          this.$refs.newProjectNameInput?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          this.$refs.newProjectNameInput?.focus()
        })
        return
      }
      if (isReferral && !this.newCustomer.referrer.trim()) {
        this.showToast('朋友介绍的客资必须填写介绍人')
        return
      }
      if (!(this.newCustomer.locationMode === 'overseas' ? this.newCustomer.country.trim() : this.newCustomer.province) || !this.newCustomer.city.trim()) {
        this.showToast(this.newCustomer.locationMode === 'overseas' ? '请填写国家 / 地区和城市' : '请从候选项中选择项目所在的省份和城市；区 / 县可不填')
        return
      }
      const requiresProjectOwners = this.newCustomerShowsFullProjectModules
      const businessOwner = requiresProjectOwners
        ? this.employees.business.find(employee => employee.id === this.newCustomer.ownerId)
        : null
      const technicalOwner = requiresProjectOwners
        ? this.employees.technical.find(employee => employee.id === this.newCustomer.techId)
        : null
      if (requiresProjectOwners && (!businessOwner || !technicalOwner)) {
        this.showToast('请选择状态可用的商务负责人和技术负责人')
        return
      }
      const payload = {
        ...this.newCustomer,
        name,
        phone,
        projectName,
        projectTypeId: requiresProjectOwners ? this.newCustomer.projectTypeId : '',
        progress: requiresProjectOwners ? this.newCustomer.progress : '需求对接',
        plan: requiresProjectOwners ? this.newCustomer.plan : '',
        ownerId: businessOwner?.id || '',
        owner: businessOwner?.display_name || '',
        techId: technicalOwner?.id || '',
        tech: technicalOwner?.display_name || '',
        referrer: isReferral ? this.newCustomer.referrer.trim() : '',
      }
      this.showCreateUnsavedConfirm = false
      this.savingCreate = true
      try {
        if (this.confirmCustomerDuplicates && !(await this.confirmCustomerDuplicates([payload]))) return
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
        this.customerPool = 'active'
        this.provinceData = this.buildProvinceData(this.customers)
        this.syncSummaryData()
        this.closeCreateCustomer()
        this.returnToSavedCustomer(data.customer.id)
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
    this.loadOverviewStatistics()
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
      const page = window.location.hash.replace(/^#\/?/, '').split('?')[0]
      if (this.navItems.some(item => item.id === page) && page !== this.activePage) this.switchPage(page)
    })
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const popover = document.querySelector('.floating-menu-layer')
        if (popover) {
          popover._floatingClose?.()
          event.preventDefault()
          return
        }
        if (this.actionConfirm.open) {
          this.resolveActionConfirm(false)
        } else if (this.showProjectNavigationConfirm) {
          this.cancelProjectNavigation()
        } else if (this.showVisitorForm) {
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
        } else if (this.showPartnershipEditor) {
          this.showPartnershipEditor = false
          this.editingPartnershipId = null
        } else if (this.showProjectEditor) {
          this.showProjectEditor = false
        } else if (this.showAuthorizationEditor) {
          this.showAuthorizationEditor = false
        } else if (this.showContractEditor) {
          this.showContractEditor = false
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
        } else if (this.showBatchCustomerCreate) {
          this.requestCloseBatchCustomerCreate()
        }
      }
    })
    window.addEventListener('click', () => { this.openRegionMenu = '' })
    if (this.activePage === 'heatmap') this.loadRegionalMap()
  },
}).mount('#app')
