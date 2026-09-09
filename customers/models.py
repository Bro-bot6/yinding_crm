from datetime import timedelta

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone


def default_tomorrow_date():
    return timezone.localdate() + timedelta(days=1)


class EmployeeProfile(models.Model):
    class Role(models.TextChoices):
        BUSINESS = 'business', '商务负责人'
        TECHNICAL = 'technical', '技术负责人'
        BOTH = 'both', '商务与技术兼任'
        AGENT = 'agent', '代理商账号'
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
    class Source(models.TextChoices):
        DOUYIN = '抖音', '抖音'
        VIDEO_ACCOUNT = '视频号', '视频号'
        SERVICE_ACCOUNT = '服务号', '服务号'
        REFERRAL = '朋友介绍', '朋友介绍'

    class CooperationStatus(models.TextChoices):
        NONE = 'none', '未建立合作关系'
        COOPERATING = 'cooperating', '已建立合作关系'

    name = models.CharField('客户名称', max_length=100)
    phone = models.CharField('联系方式', max_length=100)
    wechat_status = models.CharField(
        '是否添加微信', max_length=10, default='no',
        choices=(('yes', '已添加'), ('no', '未添加'), ('rejected', '已添加未通过')),
    )
    country = models.CharField('国外国家 / 地区', max_length=100, blank=True)
    source = models.CharField('客资来源', max_length=30, choices=Source.choices, default=Source.DOUYIN)
    channel = models.CharField('来源说明', max_length=100, blank=True)
    referrer = models.CharField('介绍人', max_length=100, blank=True)
    province = models.CharField('省', max_length=50, blank=True)
    city = models.CharField('市', max_length=50, blank=True)
    district = models.CharField('区县', max_length=50, blank=True)
    grade = models.CharField('客户等级', max_length=1, default='C')
    cooperation_status = models.CharField(
        '合作关系状态',
        max_length=20,
        choices=CooperationStatus.choices,
        default=CooperationStatus.NONE,
    )
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
    country = models.CharField('国外国家 / 地区', max_length=100, blank=True)
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
    commercial_notes = models.TextField('商务信息', blank=True)
    quoted_amount = models.DecimalField(
        '报价金额', max_digits=14, decimal_places=2, null=True, blank=True,
    )
    contract_amount = models.DecimalField(
        '合同金额', max_digits=14, decimal_places=2, null=True, blank=True,
    )
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
    owners_inherit_customer = models.BooleanField(
        '负责人沿用客户默认值',
        default=True,
        help_text='关闭后，该项目负责人不再随客户级默认负责人变更。',
    )
    is_active = models.BooleanField('项目有效', default=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('-updated_at', 'id')
        verbose_name = '客户项目'
        verbose_name_plural = '客户项目'
        constraints = (
            models.CheckConstraint(
                condition=~models.Q(name=''),
                name='project_name_not_empty',
            ),
        )

    def __str__(self):
        return f'{self.customer.name} - {self.name}'


class CustomerProjectAssociation(models.Model):
    customer = models.ForeignKey(
        Customer,
        verbose_name='关联客户',
        related_name='project_associations',
        on_delete=models.CASCADE,
    )
    project = models.ForeignKey(
        Project,
        verbose_name='客资项目案例',
        related_name='customer_associations',
        on_delete=models.CASCADE,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='关联人',
        related_name='created_customer_project_associations',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('关联时间', auto_now_add=True)

    class Meta:
        ordering = ('created_at', 'id')
        constraints = (
            models.UniqueConstraint(
                fields=('customer', 'project'),
                name='unique_customer_project_association',
            ),
        )
        verbose_name = '客户项目案例关联'
        verbose_name_plural = '客户项目案例关联'

    def __str__(self):
        return f'{self.customer} - {self.project}'


class PartnershipIdentity(models.Model):
    class IdentityType(models.TextChoices):
        CUSTOMER = 'customer', '客户'
        SIGNED_CUSTOMER = 'signed_customer', '签约客户'
        PROVINCIAL_AGENT = 'provincial_agent', '省级代理'
        CITY_AGENT = 'city_agent', '市级代理'
        DISTRICT_AGENT = 'district_agent', '区县代理'
        PARTNER = 'partner', '合伙人'
        CHANNEL_PARTNER = 'channel_partner', '渠道合作方'
        TECHNICAL_PARTNER = 'technical_partner', '技术合作方'

    customer = models.ForeignKey(
        Customer,
        verbose_name='客户主体',
        related_name='partnership_identities',
        on_delete=models.CASCADE,
    )
    identity_type = models.CharField(
        '合作身份', max_length=40, choices=IdentityType.choices,
    )
    is_active = models.BooleanField('有效', default=True)
    notes = models.CharField('说明', max_length=300, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='创建人',
        related_name='created_partnership_identities',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('identity_type', 'id')
        constraints = (
            models.UniqueConstraint(
                fields=('customer', 'identity_type'),
                name='unique_customer_partnership_identity',
            ),
            models.UniqueConstraint(
                fields=('customer',),
                condition=models.Q(is_active=True),
                name='unique_active_customer_partnership_identity',
            ),
        )
        verbose_name = '合作身份'
        verbose_name_plural = '合作身份'

    def __str__(self):
        return f'{self.customer} - {self.get_identity_type_display()}'


class AgencyAuthorization(models.Model):
    class Level(models.TextChoices):
        PROVINCE = 'province', '省级代理'
        CITY = 'city', '市级代理'
        DISTRICT = 'district', '区县代理'

    class AgreementStatus(models.TextChoices):
        INTENT = 'intent', '意向'
        NEGOTIATING = 'negotiating', '谈判中'
        PENDING = 'pending', '待签约'
        ACTIVE = 'active', '已签约/履约中'
        RENEWED = 'renewed', '已续约'
        TERMINATED = 'terminated', '已终止'
        EXPIRED = 'expired', '已到期'

    customer = models.ForeignKey(
        Customer,
        verbose_name='代理主体',
        related_name='agency_authorizations',
        on_delete=models.CASCADE,
    )
    level = models.CharField('代理级别', max_length=20, choices=Level.choices)
    province = models.CharField('授权省份', max_length=50)
    city = models.CharField('授权城市', max_length=50, blank=True)
    district = models.CharField('授权区县', max_length=50, blank=True)
    is_exclusive = models.BooleanField('独家授权', default=False)
    product_scope = models.CharField('授权产品或业务范围', max_length=300)
    effective_date = models.DateField('生效日期')
    expiry_date = models.DateField('到期日期')
    agreement_status = models.CharField(
        '协议状态',
        max_length=20,
        choices=AgreementStatus.choices,
        default=AgreementStatus.INTENT,
    )
    agreement_number = models.CharField('协议编号', max_length=100, blank=True)
    viewers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        verbose_name='可查看该授权范围的代理账号',
        related_name='agency_authorizations',
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='创建人',
        related_name='created_agency_authorizations',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('expiry_date', 'province', 'city', 'district', 'id')
        indexes = (
            models.Index(fields=('province', 'city', 'district')),
            models.Index(fields=('agreement_status', 'expiry_date')),
        )
        verbose_name = '区域代理授权'
        verbose_name_plural = '区域代理授权'

    @property
    def region_label(self):
        return ' / '.join(filter(None, (self.province, self.city, self.district)))

    def __str__(self):
        return f'{self.customer} - {self.region_label}'


class BusinessContract(models.Model):
    class Status(models.TextChoices):
        INTENT = 'intent', '意向'
        NEGOTIATING = 'negotiating', '谈判'
        PENDING = 'pending', '待签约'
        ACTIVE = 'active', '已签约/履约中'
        EXPIRING = 'expiring', '即将到期'
        EXPIRED = 'expired', '已到期'
        RENEWED = 'renewed', '已续约'
        TERMINATED = 'terminated', '已终止'

    customer = models.ForeignKey(
        Customer,
        verbose_name='客户主体',
        related_name='business_contracts',
        on_delete=models.CASCADE,
    )
    project = models.ForeignKey(
        Project,
        verbose_name='关联项目',
        related_name='business_contracts',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    title = models.CharField('合同名称', max_length=150)
    contract_number = models.CharField('合同编号', max_length=100, blank=True)
    status = models.CharField(
        '合同状态', max_length=20, choices=Status.choices, default=Status.INTENT,
    )
    amount = models.DecimalField(
        '合同金额', max_digits=14, decimal_places=2, null=True, blank=True,
    )
    signed_date = models.DateField('签约日期', null=True, blank=True)
    effective_date = models.DateField('生效日期', null=True, blank=True)
    expiry_date = models.DateField('到期日期', null=True, blank=True)
    notes = models.TextField('备注', blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='创建人',
        related_name='created_business_contracts',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        ordering = ('expiry_date', '-updated_at', 'id')
        indexes = (models.Index(fields=('status', 'expiry_date')),)
        verbose_name = '商务合同'
        verbose_name_plural = '商务合同'

    def __str__(self):
        return self.title


class BusinessAttachment(models.Model):
    class Category(models.TextChoices):
        GENERAL = 'general', '常规附件'
        CONTRACT = 'contract', '合同附件'
        AUTHORIZATION = 'authorization', '授权/代理协议'
        PROJECT = 'project', '项目资料'

    customer = models.ForeignKey(
        Customer,
        verbose_name='客户主体',
        related_name='business_attachments',
        on_delete=models.CASCADE,
    )
    project = models.ForeignKey(
        Project,
        verbose_name='关联项目',
        related_name='business_attachments',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    name = models.CharField('附件名称', max_length=150)
    category = models.CharField(
        '附件类型', max_length=20, choices=Category.choices, default=Category.GENERAL,
    )
    file_url = models.CharField('文件地址', max_length=500)
    is_sensitive = models.BooleanField('敏感附件', default=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name='上传人',
        related_name='uploaded_business_attachments',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField('上传时间', auto_now_add=True)

    class Meta:
        ordering = ('-created_at', '-id')
        verbose_name = '业务附件'
        verbose_name_plural = '业务附件'

    def __str__(self):
        return self.name


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
    planned_time = models.TimeField('安排时间（空为全天）', null=True, blank=True)
    kind = models.CharField('事项类型', max_length=20, default='personal', choices=[('personal', '个人事项'), ('appointment', '客户预约'), ('project', '项目事项')])
    is_cancelled = models.BooleanField('已取消', default=False)
    reminder_minutes = models.PositiveIntegerField('提前提醒分钟数', null=True, blank=True)
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.SET_NULL, related_name='calendar_items')
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='calendar_items')
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
