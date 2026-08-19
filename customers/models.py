from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_tomorrow_date():
    return timezone.localdate() + timedelta(days=1)


class EmployeeProfile(models.Model):
    class Role(models.TextChoices):
        BUSINESS = 'business', '商务负责人'
        TECHNICAL = 'technical', '技术负责人'
        BOTH = 'both', '商务与技术兼任'
        OTHER = 'other', '其他岗位'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employee_profile',
        verbose_name='员工账号',
    )
    role = models.CharField(
        '岗位类型',
        max_length=20,
        choices=Role.choices,
        default=Role.OTHER,
    )
    nickname = models.CharField('员工昵称', max_length=50, blank=True)
    business_level = models.PositiveSmallIntegerField(
        '商务等级',
        default=1,
        help_text='1-5级，数字越大，在进度汇总中排序越靠前。',
    )
    technical_level = models.PositiveSmallIntegerField(
        '技术等级',
        default=1,
        help_text='1-5级，数字越大，在技术进度汇总中排序越靠前。',
    )

    class Meta:
        verbose_name = '员工档案'
        verbose_name_plural = '员工档案'

    @property
    def display_name(self):
        return self.nickname or self.user.get_full_name() or self.user.username

    @property
    def has_business_nature(self):
        return self.role in (self.Role.BUSINESS, self.Role.BOTH)

    @property
    def has_technical_nature(self):
        return self.role in (self.Role.TECHNICAL, self.Role.BOTH)

    def __str__(self):
        return f'{self.display_name}（{self.get_role_display()}）'


class Customer(models.Model):
    name = models.CharField('客户名称', max_length=100)
    phone = models.CharField('联系电话', max_length=30, blank=True)
    source = models.CharField('客资来源', max_length=30, default='抖音')
    channel = models.CharField('来源说明', max_length=100, blank=True)
    referrer = models.CharField('介绍人', max_length=100, blank=True)
    province = models.CharField('省', max_length=50, blank=True)
    city = models.CharField('市', max_length=50, blank=True)
    district = models.CharField('区县', max_length=50, blank=True)
    grade = models.CharField('客户等级', max_length=1, default='B')
    description = models.TextField('客户描述', blank=True)
    progress = models.CharField('项目进度', max_length=30, default='需求对接')
    plan = models.TextField('施工方案', blank=True)
    business_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='商务负责人账号',
        related_name='business_customers',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    technical_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='技术负责人账号',
        related_name='technical_customers',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    business_owner_name = models.CharField('商务负责人', max_length=100, blank=True)
    technical_owner_name = models.CharField('技术负责人', max_length=100, blank=True)
    color = models.CharField('标识颜色', max_length=20, blank=True)
    sort_order = models.PositiveIntegerField('排序', default=0)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('sort_order', 'id')
        verbose_name = '客资信息'
        verbose_name_plural = '客资信息'

    def __str__(self):
        return self.name


class ProjectType(models.Model):
    name = models.CharField('项目类型名称', max_length=50, unique=True)
    is_active = models.BooleanField('可用', default=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('id',)
        verbose_name = '项目类型'
        verbose_name_plural = '项目类型'

    def __str__(self):
        return self.name


class Project(models.Model):
    customer = models.ForeignKey(
        Customer,
        verbose_name='所属客户',
        related_name='projects',
        on_delete=models.CASCADE,
    )
    project_type = models.ForeignKey(
        ProjectType,
        verbose_name='项目类型',
        related_name='projects',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    name = models.CharField('项目名称', max_length=150)
    progress = models.CharField('当前进度', max_length=50, default='需求对接')
    plan = models.TextField('施工方案', blank=True)
    province = models.CharField('省', max_length=50, blank=True)
    city = models.CharField('市', max_length=50, blank=True)
    district = models.CharField('区县', max_length=50, blank=True)
    business_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='商务负责人',
        related_name='business_projects',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    technical_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='技术负责人',
        related_name='technical_projects',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    is_active = models.BooleanField('项目有效', default=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('-updated_at', 'id')
        verbose_name = '客户项目'
        verbose_name_plural = '客户项目'

    def __str__(self):
        return f'{self.customer.name} - {self.name}'


class SchemeCalculation(models.Model):
    project = models.OneToOneField(
        Project,
        verbose_name='关联项目',
        related_name='scheme_calculation',
        on_delete=models.CASCADE,
    )
    title = models.CharField('测算单标题', max_length=150)
    layer_count = models.PositiveSmallIntegerField('结构层数', default=1)
    layers = models.JSONField('结构层数据', default=list)
    remarks = models.TextField('备注', blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='创建人',
        related_name='created_scheme_calculations',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='最后修改人',
        related_name='updated_scheme_calculations',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '施工方案测算'
        verbose_name_plural = '施工方案测算'

    def __str__(self):
        return self.title


class MaterialExperiment(models.Model):
    project = models.OneToOneField(
        Project,
        verbose_name='关联项目',
        related_name='material_experiment',
        on_delete=models.CASCADE,
    )
    stable_material = models.CharField('稳定材料', max_length=150, blank=True)
    day_7_data = models.TextField('7天数据', blank=True)
    day_14_data = models.TextField('14天数据', blank=True)
    day_28_data = models.TextField('28天数据', blank=True)
    technical_message = models.TextField('技术方留言', blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='创建人',
        related_name='created_material_experiments',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='最后修改人',
        related_name='updated_material_experiments',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '材料实验档案'
        verbose_name_plural = '材料实验档案'

    def __str__(self):
        return f'{self.project} - 材料实验'


class ProjectProgressUpdate(models.Model):
    project = models.ForeignKey(
        Project,
        verbose_name='关联项目',
        related_name='progress_updates',
        on_delete=models.CASCADE,
    )
    content = models.TextField('进度更新')
    from_progress = models.CharField('前置正式阶段', max_length=50, default='需求对接')
    to_progress = models.CharField('后置正式阶段', max_length=50, default='技术验证')
    occurred_at = models.DateTimeField('记录时间', default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='更新人',
        related_name='project_progress_updates',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('更新时间', auto_now_add=True)
    updated_at = models.DateTimeField('最后修改时间', auto_now=True)

    class Meta:
        ordering = ('occurred_at', 'id')
        verbose_name = '项目进度更新'
        verbose_name_plural = '项目进度更新'

    def __str__(self):
        return f'{self.project} - {self.created_at:%Y-%m-%d}'


class ProgressUpdateReadState(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name='员工账号',
        related_name='progress_update_read_state',
        on_delete=models.CASCADE,
    )
    last_read_at = models.DateTimeField('最后查看时间', null=True, blank=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '进度更新阅读状态'
        verbose_name_plural = '进度更新阅读状态'

    def __str__(self):
        return f'{self.user} - {self.last_read_at or "未查看"}'


class ProgressUpdateReadReceipt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='阅读账号',
        related_name='progress_update_read_receipts',
        on_delete=models.CASCADE,
    )
    progress_update = models.ForeignKey(
        ProjectProgressUpdate,
        verbose_name='进度更新',
        related_name='read_receipts',
        on_delete=models.CASCADE,
    )
    read_at = models.DateTimeField('已读时间', auto_now_add=True)

    class Meta:
        ordering = ('-read_at', '-id')
        constraints = (
            models.UniqueConstraint(
                fields=('user', 'progress_update'),
                name='unique_progress_update_read_receipt',
            ),
        )
        verbose_name = '进度更新已读记录'
        verbose_name_plural = '进度更新已读记录'

    def __str__(self):
        return f'{self.user} - {self.progress_update}'


class VisitorRecord(models.Model):
    customer = models.ForeignKey(
        Customer,
        verbose_name='关联客资',
        related_name='visitor_records',
        on_delete=models.CASCADE,
    )
    visit_date = models.DateField('来访日期')
    visitor_count = models.PositiveSmallIntegerField('来访人数', default=1)
    contact_name = models.CharField('来访联系人', max_length=100, blank=True)
    visitor_contacts = models.JSONField('来访客户负责人', default=list, blank=True)
    purpose = models.CharField('来访目的', max_length=200)
    remarks = models.TextField('备注', blank=True)
    notes = models.TextField('接待记录', blank=True)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='接待负责人',
        related_name='hosted_visitor_records',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    hosts = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        verbose_name='接待人员',
        related_name='hosted_visitor_records_as_member',
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='记录人',
        related_name='created_visitor_records',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('-visit_date', '-id')
        verbose_name = '客户来访记录'
        verbose_name_plural = '客户来访记录'

    def __str__(self):
        return f'{self.customer.name} - {self.visit_date}'


class FollowUpTask(models.Model):
    class Role(models.TextChoices):
        BUSINESS = 'business', '商务'
        TECHNICAL = 'technical', '技术'

    class Status(models.TextChoices):
        PENDING = 'pending', '待处理'
        WAITING = 'waiting', '等待客户'
        COMPLETED = 'completed', '已完成'

    project = models.ForeignKey(
        Project,
        verbose_name='关联项目',
        related_name='follow_up_tasks',
        on_delete=models.CASCADE,
    )
    title = models.CharField('任务内容', max_length=200)
    target_progress = models.CharField('目标进度', max_length=50)
    is_manual = models.BooleanField('项目内临时任务', default=False)
    role = models.CharField('负责岗位', max_length=20, choices=Role.choices)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='负责人',
        related_name='follow_up_tasks',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    status = models.CharField(
        '任务状态',
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    due_at = models.DateTimeField('计划完成时间', null=True, blank=True)
    completed_at = models.DateTimeField('实际完成时间', null=True, blank=True)
    result = models.TextField('跟进结果', blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('status', 'due_at', '-updated_at')
        verbose_name = '跟进任务'
        verbose_name_plural = '跟进任务'
        constraints = [
            models.UniqueConstraint(
                fields=('project', 'target_progress', 'role'),
                condition=models.Q(is_manual=False),
                name='unique_project_progress_role_task',
            ),
        ]

    def __str__(self):
        return f'{self.project} - {self.title}'


class TomorrowItem(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='所属员工',
        related_name='tomorrow_items',
        on_delete=models.CASCADE,
    )
    title = models.CharField('事项标题', max_length=160)
    note = models.TextField('补充说明', blank=True)
    planned_date = models.DateField('计划日期', default=default_tomorrow_date)
    is_completed = models.BooleanField('已完成', default=False)
    completed_at = models.DateTimeField('完成时间', null=True, blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('is_completed', 'created_at')
        verbose_name = '个人明日事项'
        verbose_name_plural = '个人明日事项'

    def __str__(self):
        return f'{self.user} - {self.title}'
