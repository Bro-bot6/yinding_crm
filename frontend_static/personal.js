/* Personal work views. Calendar dates and reminders use Asia/Shanghai. */
const PersonalWork = (() => {
  const dayKey = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
  const dateAt = value => new Date(value + 'T12:00:00+08:00');
  const shiftDay = (value, offset) => dayKey(new Date(dateAt(value).getTime() + offset * 86400000));
  const eventOrder = (a, b) => a.plannedDate.localeCompare(b.plannedDate)
    || (a.plannedTime || '').localeCompare(b.plannedTime || '') || a.id - b.id;
  return {
    data() {
      return {
        personalProjects: [], personalLoading: false, personalError: '', personalRequest: 0,
        personalEmployee: '', personalEmployees: [], personalAdmin: false, personalOwnCount: 0, personalOwnCustomerCount: 0,
        personalSort: 'priority', personalStatus: 'active', personalSearch: '',
        savedProjectId: null,
        personalFilters: { grade: '', source: '', province: '', city: '', progress: '' },
        expandedDescriptions: {},
        calendarFocusMonth: dayKey().slice(0, 7), calendarWindowMonth: dayKey().slice(0, 7),
        calendarDate: dayKey(), calendarView: 'month', calendarItems: [], calendarTodayCount: 0,
        calendarLoading: false, calendarError: '', calendarRequest: 0, calendarSaving: false,
        calendarEditor: null, calendarSnapshot: '', calendarUserId: '', calendarReminderQueue: [],
        eventKinds: [{ value: 'personal', label: '个人事项' }, { value: 'appointment', label: '客户预约' }, { value: 'project', label: '项目事项' }],
        reminderOptions: [{ value: '', label: '不提醒' }, { value: 0, label: '开始时（全天事项为09:00）' }, { value: 15, label: '提前15分钟' }, { value: 30, label: '提前30分钟' }, { value: 60, label: '提前1小时' }, { value: 1440, label: '提前1天' }],
      };
    },
    computed: {
      visiblePersonalProjects() {
        return this.personalProjects.filter(p => this.personalProjectMatchesFilters(p)).sort((a, b) => {
          if (a.id === this.savedProjectId) return -1;
          if (b.id === this.savedProjectId) return 1;
          const grade = this.personalSort === 'priority' ? 'ABCD'.indexOf(a.customer.grade) - 'ABCD'.indexOf(b.customer.grade) : 0;
          return grade || (b.latestFollowupAt ? Date.parse(b.latestFollowupAt) : 0) - (a.latestFollowupAt ? Date.parse(a.latestFollowupAt) : 0) || a.id - b.id;
        });
      },
      calendarDays() {
        let start, count;
        if (this.calendarView === 'week') {
          const weekday = new Date(this.calendarDate + 'T12:00:00Z').getUTCDay();
          start = shiftDay(this.calendarDate, -(weekday + 6) % 7); count = 7;
        } else {
          const first = this.calendarDate.slice(0, 7) + '-01';
          const weekday = new Date(first + 'T12:00:00Z').getUTCDay();
          start = shiftDay(first, -(weekday + 6) % 7); count = 42;
        }
        return Array.from({ length: count }, (_, i) => shiftDay(start, i));
      },
      calendarMonths() {
        return [-2, -1, 0, 1, 2].map(offset => {
          const key = this.shiftCalendarMonth(this.calendarWindowMonth, offset);
          const first = key + '-01';
          const lead = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
          const days = new Date(this.shiftCalendarMonth(key, 1) + '-01T12:00:00Z').getTime() - new Date(first + 'T12:00:00Z').getTime();
          const count = Math.round(days / 86400000);
          return { key, label: this.calendarMonthLabel(key), cells: Array.from({ length: Math.ceil((lead + count) / 7) * 7 }, (_, i) => i < lead || i >= lead + count ? '' : key + '-' + String(i - lead + 1).padStart(2, '0')) };
        });
      },
      calendarTitle() {
        if (this.calendarView === 'week') return this.calendarDays[0] + ' 至 ' + this.calendarDays[6];
        return this.calendarMonthLabel(this.calendarView === 'month' ? this.calendarFocusMonth : this.calendarDate.slice(0, 7));
      },
      calendarAgenda() {
        return [...this.calendarItems].filter(e => e.plannedDate.slice(0, 7) === this.calendarDate.slice(0, 7)).sort(eventOrder);
      },
      calendarSelectedEvents() { return this.eventsOn(this.calendarDate); },
      calendarCustomerOptions() {
        return [{ value: '', label: '不关联客户' }, ...this.customers.map(c => ({ value: c.id, label: c.name }))];
      },
      calendarProjectOptions() {
        return [{ value: '', label: '不关联项目' }, ...this.customerProjects
          .filter(p => !this.calendarEditor?.customerId || String(p.customer.id) === String(this.calendarEditor.customerId))
          .map(p => ({ value: p.id, label: p.name + ' · ' + p.customer.name }))];
      },
    },
    watch: {
      activePage(page) {
        if (page === 'followups' || page === 'overview') this.loadPersonalProjects();
        if (page === 'plans' || page === 'overview') this.loadCalendar();
        if (page === 'plans') this.$nextTick(() => this.scrollCalendarToMonth(this.calendarFocusMonth));
      },
      personalEmployee() { this.loadPersonalProjects(); },
      'personalFilters.province'() { this.personalFilters.city = ''; },
      calendarDate() { this.loadCalendar(); },
      calendarView() { this.loadCalendar(); this.$nextTick(() => this.scrollCalendarToMonth(this.calendarFocusMonth)); },
      calendarWindowMonth() { this.loadCalendar(); },
      showEdit(value) { if (!value) this.loadPersonalProjects(); },
    },
    methods: {
      personalProjectMatchesFilters(project) {
        const f = this.personalFilters;
        const search = (this.personalSearch || this.keyword || '').trim().toLowerCase();
        return project.isActive === (this.personalStatus === 'active')
          && (!f.grade || project.customer.grade === f.grade)
          && (!f.source || project.customer.source === f.source)
          && (!f.province || project.province === f.province)
          && (!f.city || project.city === f.city)
          && (!f.progress || project.progress === f.progress)
          && (!search || [project.name, project.customer.name, project.customer.phone].join(' ').toLowerCase().includes(search));
      },
      personalOptions(key) {
        const values = this.personalProjects.filter(p => key !== 'city' || !this.personalFilters.province || p.province === this.personalFilters.province)
          .map(p => key === 'grade' || key === 'source' ? p.customer[key] : p[key]).filter(Boolean);
        return [{ value: '', label: '全部' }, ...[...new Set(values)].sort((a, b) => a.localeCompare(b, 'zh-CN')).map(v => ({ value: v, label: v }))];
      },
      resetPersonalFilters() {
        this.personalFilters = { grade: '', source: '', province: '', city: '', progress: '' };
        this.personalSearch = '';
        this.keyword = '';
      },
      async loadPersonalProjects() {
        const request = ++this.personalRequest;
        this.personalLoading = true;
        try {
          const response = await fetch('/api/my-projects/' + (this.personalEmployee ? '?employee=' + encodeURIComponent(this.personalEmployee) : ''));
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '我的客资加载失败');
          if (request !== this.personalRequest) return;
          this.personalProjects = data.projects;
          this.personalAdmin = data.canViewEmployees;
          this.personalEmployees = data.employees;
          this.personalOwnCount = data.ownActiveCount;
          this.personalOwnCustomerCount = data.ownActiveCustomerCount;
          this.personalError = '';
          this.syncPersonalBadges();
        } catch (e) {
          if (request === this.personalRequest) { this.personalError = e.message; this.personalProjects = []; }
        } finally { if (request === this.personalRequest) this.personalLoading = false; }
      },
      syncPersonalBadges() {
        const projects = this.navItems.find(n => n.id === 'followups');
        const calendar = this.navItems.find(n => n.id === 'plans');
        if (projects) projects.badge = String(this.personalOwnCustomerCount || 0);
        if (calendar) calendar.badge = this.calendarTodayCount ? this.calendarTodayCount + '项' : '';
      },
      async openPersonalProject(project) {
        if (!this.customers.some(c => c.id === project.customer.id) || !this.customerProjects.some(p => p.id === project.id)) await this.loadCustomers();
        if (!this.customerProjects.some(p => p.id === project.id && p.customer.id === project.customer.id)) return this.showToast('当前无法访问该项目，请刷新后重试');
        const customer = this.customers.find(c => c.id === project.customer.id);
        if (!customer) return this.showToast('当前无法访问该客户，请刷新后重试');
        this.openCustomerEdit(customer, project.id);
      },
      followupDate(value) {
        return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value)) : '暂无跟进记录';
      },
      toggleDescription(id) { this.expandedDescriptions[id] = !this.expandedDescriptions[id]; },
      eventsOn(day) { return [...this.calendarItems].filter(e => e.plannedDate === day).sort(eventOrder); },
      eventKindLabel(kind) { return this.eventKinds.find(k => k.value === kind)?.label || '个人事项'; },
      shiftCalendarMonth(month, offset) {
        const d = new Date(month + '-01T12:00:00Z');
        d.setUTCMonth(d.getUTCMonth() + offset);
        return d.toISOString().slice(0, 7);
      },
      calendarMonthLabel(month) { return month.slice(0, 4) + '年' + Number(month.slice(5, 7)) + '月'; },
      calendarToday() { return dayKey(); },
      calendarFestival(day) { return typeof CalendarFestivals === 'undefined' ? '' : CalendarFestivals.label(day); },
      calendarFestivalCompact(day) { return this.calendarFestival(day).split('·').map(name => name === '春节' ? name : name.replace(/节$/, '')).join('·'); },
      scrollCalendarToMonth(month) {
        if (this.calendarView !== 'month') return;
        const scroller = this.$refs?.calendarScroller;
        const block = scroller?.querySelector('[data-calendar-month="' + month + '"]');
        if (!block) return;
        this._calendarReanchoring = true;
        scroller.scrollTop += block.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        requestAnimationFrame(() => { this._calendarReanchoring = false; });
      },
      onCalendarScroll() {
        if (this._calendarScrollFrame || this._calendarReanchoring) return;
        this._calendarScrollFrame = requestAnimationFrame(async () => {
          this._calendarScrollFrame = null;
          const scroller = this.$refs.calendarScroller;
          if (!scroller || this._calendarReanchoring) return;
          const viewport = scroller.getBoundingClientRect();
          let active, largest = -1;
          for (const block of scroller.querySelectorAll('[data-calendar-month]')) {
            const bounds = block.getBoundingClientRect();
            const visible = Math.max(0, Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top));
            if (visible > largest) { active = block; largest = visible; }
          }
          if (!active) return;
          const month = active.dataset.calendarMonth;
          this.calendarFocusMonth = month;
          const months = this.calendarMonths;
          if (month !== months[0].key && month !== months[months.length - 1].key) return;
          const offset = active.getBoundingClientRect().top - viewport.top;
          this._calendarReanchoring = true;
          this.calendarWindowMonth = month;
          await this.$nextTick();
          const retained = scroller.querySelector('[data-calendar-month="' + month + '"]');
          if (retained) scroller.scrollTop += retained.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset;
          requestAnimationFrame(() => { this._calendarReanchoring = false; });
        });
      },
      async selectCalendarDate(day) {
        if (!(await this.closeCalendarEditor())) return;
        this.calendarDate = day;
        if (this.calendarView !== 'month') this.calendarFocusMonth = day.slice(0, 7);
      },
      async moveCalendar(direction) {
        if (!(await this.closeCalendarEditor())) return;
        if (direction === 0) this.calendarDate = dayKey();
        else if (this.calendarView === 'week') this.calendarDate = shiftDay(this.calendarDate, direction * 7);
        else this.calendarDate = this.shiftCalendarMonth(this.calendarView === 'month' ? this.calendarFocusMonth : this.calendarDate.slice(0, 7), direction) + '-01';
        this.calendarFocusMonth = this.calendarDate.slice(0, 7);
        this.calendarWindowMonth = this.calendarFocusMonth;
        await this.$nextTick();
        this.scrollCalendarToMonth(this.calendarFocusMonth);
      },
      async loadCalendar() {
        const request = ++this.calendarRequest;
        this.calendarLoading = true;
        try {
          const days = this.calendarDays;
          const months = this.calendarMonths;
          const start = this.calendarView === 'month' ? months[0].key + '-01' : days[0];
          const end = this.calendarView === 'month' ? shiftDay(this.shiftCalendarMonth(months[4].key, 1) + '-01', -1) : days[days.length - 1];
          const response = await fetch('/api/calendar/?start=' + start + '&end=' + end);
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '日历加载失败');
          if (request !== this.calendarRequest) return;
          const retained = this.calendarItems.filter(item => item.plannedDate === this.calendarDate && (item.plannedDate < start || item.plannedDate > end));
          this.calendarItems = [...data.items, ...retained];
          this.calendarTodayCount = data.todayCount;
          this.calendarUserId = data.userId;
          this.calendarError = '';
          this.calendarReminderQueue = data.reminders || [];
          this.syncPersonalBadges();
        } catch (e) { if (request === this.calendarRequest) this.calendarError = e.message; }
        finally { if (request === this.calendarRequest) this.calendarLoading = false; }
      },
      showNextCalendarReminder() {
        if (this.toast || document.visibilityState === 'hidden') return;
        for (const event of this.calendarReminderQueue) {
          const key = ['crm-calendar-reminder', this.calendarUserId, event.id, event.plannedDate, event.plannedTime, event.reminderMinutes].join(':');
          try {
            if (localStorage.getItem(key)) continue;
            localStorage.setItem(key, 'shown');
          } catch (_) {
            this._calendarSeen = this._calendarSeen || new Set();
            if (this._calendarSeen.has(key)) continue;
            this._calendarSeen.add(key);
          }
          this.showToast('日程提醒：' + event.title + ' · ' + event.plannedDate + ' ' + (event.plannedTime || '全天'));
          break;
        }
      },
      async editCalendarEvent(item = null) {
        if (!(await this.closeCalendarEditor())) return;
        if (item) { this.calendarDate = item.plannedDate; this.calendarFocusMonth = item.plannedDate.slice(0, 7); }
        this.calendarEditor = item ? { ...item, reminderMinutes: item.reminderMinutes ?? '' } : {
          title: '', note: '', plannedDate: this.calendarDate, plannedTime: '', kind: 'personal',
          reminderMinutes: '', projectId: '', customerId: '', isCompleted: false, isCancelled: false,
        };
        this.calendarSnapshot = JSON.stringify(this.calendarEditor);
        this.$nextTick(() => this.$refs.calendarTitleInput?.focus());
      },
      async closeCalendarEditor() {
        if (this.calendarSaving) return false;
        if (this.calendarEditor && JSON.stringify(this.calendarEditor) !== this.calendarSnapshot) {
          if (!(await this.requestActionConfirm({ title: '放弃日程修改？', message: '未保存的内容将丢失。', confirmLabel: '放弃修改', tone: 'warning' }))) return false;
        }
        this.calendarEditor = null; return true;
      },
      async saveCalendarEvent() {
        if (this.calendarSaving || !this.calendarEditor) return;
        const item = { ...this.calendarEditor };
        item.reminderMinutes = item.reminderMinutes === '' ? null : Number(item.reminderMinutes);
        this.calendarSaving = true;
        try {
          const response = await fetch('/api/calendar/' + (item.id ? item.id + '/' : ''), {
            method: item.id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() }, body: JSON.stringify(item),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '保存失败');
          this.calendarEditor = null;
          this.calendarDate = data.item.plannedDate;
          this.calendarFocusMonth = data.item.plannedDate.slice(0, 7);
          this.calendarWindowMonth = this.calendarFocusMonth;
          await this.loadCalendar();
          await this.$nextTick();
          this.scrollCalendarToMonth(this.calendarFocusMonth);
          this.showToast('日程已保存');
        } catch (e) { this.showToast(e.message); }
        finally { this.calendarSaving = false; }
      },
      async changeCalendarEvent(item, action) {
        if (this.calendarSaving) return;
        const deleting = action === 'delete';
        if ((deleting || action === 'cancel') && !(await this.requestActionConfirm({
          title: deleting ? '删除这条日程？' : '取消这条日程？',
          message: deleting ? '删除后无法在日历中恢复。关联客户和项目不受影响。' : '保留日程记录，但不再提醒。',
          confirmLabel: deleting ? '确认删除' : '取消日程', tone: 'warning',
        }))) return;
        this.calendarSaving = true;
        try {
          const payload = action === 'complete' ? { isCompleted: !item.isCompleted, isCancelled: false } : { isCancelled: !item.isCancelled, isCompleted: false };
          const response = await fetch('/api/calendar/' + item.id + '/', {
            method: deleting ? 'DELETE' : 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() }, body: deleting ? undefined : JSON.stringify(payload),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || '操作失败');
          if (deleting) this.calendarItems = this.calendarItems.filter(event => event.id !== item.id);
          if (this.calendarEditor?.id === item.id) this.calendarEditor = null;
          await this.loadCalendar();
          this.showToast(deleting ? '日程已删除' : '日程已更新，项目阶段未改变');
        } catch (e) { this.showToast(e.message); }
        finally { this.calendarSaving = false; }
      },
      openCalendarLink(item) {
        if (item.projectId) {
          const project = this.customerProjects.find(p => p.id === item.projectId);
          if (project) return this.openPersonalProject(project);
          return this.showToast('关联项目已删除或当前不可访问');
        }
        const customer = this.customers.find(c => c.id === item.customerId);
        if (customer) this.openCustomerEdit(customer);
      },
      async confirmStageChange(before, after) {
        if (!before || !after || before === after) return true;
        return await this.requestActionConfirm({
          title: '确认修改项目阶段？',
          message: '当前阶段：' + before + '\n修改为：' + after + '\n这是正式阶段变更，不会自动完成历史任务或生成新的截止时间。',
          confirmLabel: '确认变更阶段', tone: 'warning',
        });
      },
      async confirmCustomerDuplicates(rows) {
        try {
          const warnings = [];
          for (let offset = 0; offset < rows.length; offset += 200) {
            const response = await fetch('/api/customers/check-duplicates/', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken() },
              body: JSON.stringify({ customers: rows.slice(offset, offset + 200) }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '重复检查失败');
            for (const m of data.matches) warnings.push('第' + (m.row + offset) + '条「' + m.name + '」：' + [
              ...m.existing.map(c => c.name + '（' + (c.phone || '无联系方式') + '，编号' + c.id + '）'),
              ...m.batchRows.map(n => '与本批第' + (n + offset) + '条重复'),
            ].join('、'));
          }
          if (!warnings.length) return true;
          return await this.requestActionConfirm({
            title: '发现疑似重复客资', message: warnings.slice(0, 8).join('\n') + (warnings.length > 8 ? '\n另有' + (warnings.length - 8) + '条疑似重复。' : '') + '\n名称或联系方式相同不一定是同一客户，请确认后继续。',
            confirmLabel: '仍然保存', tone: 'warning',
          });
        } catch (e) { this.showToast(e.message + '，请重试后保存'); return false; }
      },
    },
    mounted() {
      this.loadPersonalProjects(); this.loadCalendar();
      this.$nextTick(() => this.scrollCalendarToMonth(this.calendarFocusMonth));
      if (window.innerWidth < 760) this.calendarView = 'agenda';
      this._calendarPoll = setInterval(() => { if (document.visibilityState !== 'hidden') this.loadCalendar(); }, 60000);
      this._calendarReminder = setInterval(() => this.showNextCalendarReminder(), 10000);
    },
    beforeUnmount() { cancelAnimationFrame(this._calendarScrollFrame); clearInterval(this._calendarPoll); clearInterval(this._calendarReminder); },
  };
})();
