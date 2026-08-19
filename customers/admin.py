from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm
from django import forms
from django.urls import reverse
from django.utils.html import format_html

from .models import (
    Customer,
    EmployeeProfile,
    FollowUpTask,
    MaterialExperiment,
    Project,
    ProjectProgressUpdate,
    ProjectType,
    SchemeCalculation,
    TomorrowItem,
    VisitorRecord,
)


class EmployeeProfileInline(admin.StackedInline):
    model = EmployeeProfile
    extra = 1
    max_num = 1
    can_delete = False
    verbose_name = '员工岗位档案'
    verbose_name_plural = '员工岗位档案'

    class Media:
        js = ('admin/employee-profile-levels.js',)


User = get_user_model()
admin.site.unregister(User)


class EmployeeUserCreationForm(UserCreationForm):
    is_staff = forms.BooleanField(
        label='工作人员状态',
        required=False,
        initial=True,
        help_text='默认允许该账号登录管理后台；如不需要后台权限，可取消勾选。',
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'is_staff')


@admin.register(User)
class EmployeeUserAdmin(UserAdmin):
    add_form = EmployeeUserCreationForm
    inlines = (EmployeeProfileInline,)
    readonly_fields = ('password_management', 'last_login', 'date_joined')
    fieldsets = (
        ('账号信息', {'fields': ('username', 'password_management')}),
        ('账号状态', {'fields': ('is_active', 'is_staff')}),
        (
            '权限设置',
            {
                'classes': ('collapse',),
                'fields': ('is_superuser', 'groups', 'user_permissions'),
            },
        ),
        (
            '登录记录',
            {
                'classes': ('collapse',),
                'fields': ('last_login', 'date_joined'),
            },
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('username', 'password1', 'password2'),
            },
        ),
        (
            '账号状态',
            {
                'classes': ('wide',),
                'fields': ('is_staff',),
            },
        ),
    )
    list_display = (
        'username',
        'employee_name',
        'employee_role',
        'is_active',
        'is_staff',
    )
    search_fields = ('username', 'employee_profile__nickname')
    ordering = ('username',)

    @admin.display(description='密码')
    def password_management(self, obj):
        if not obj or not obj.pk:
            return '账号创建后可在这里重置密码。'
        reset_url = reverse('admin:auth_user_password_change', args=(obj.pk,))
        return format_html(
            '<div style="margin-bottom:10px;color:#667085;">'
            '密码已安全加密，原始密码无法查看，算法及加密内容不会在后台展示。'
            '</div>'
            '<a class="button" href="{}">重置密码</a>',
            reset_url,
        )

    @admin.display(description='员工昵称')
    def employee_name(self, obj):
        profile = getattr(obj, 'employee_profile', None)
        return profile.display_name if profile else obj.username

    @admin.display(description='岗位')
    def employee_role(self, obj):
        profile = getattr(obj, 'employee_profile', None)
        return profile.get_role_display() if profile else '未配置'


@admin.register(EmployeeProfile)
class EmployeeProfileAdmin(admin.ModelAdmin):
    list_display = (
        'display_name', 'user', 'role', 'visible_business_level',
        'visible_technical_level', 'account_status',
    )
    list_filter = ('role', 'user__is_active')
    search_fields = ('nickname', 'user__username', 'user__first_name', 'user__last_name')
    autocomplete_fields = ('user',)

    class Media:
        js = ('admin/employee-profile-levels.js',)

    @admin.display(description='商务等级', ordering='business_level')
    def visible_business_level(self, obj):
        return obj.business_level if obj.has_business_nature else '—'

    @admin.display(description='技术等级', ordering='technical_level')
    def visible_technical_level(self, obj):
        return obj.technical_level if obj.has_technical_nature else '—'

    @admin.display(description='账号状态', boolean=True)
    def account_status(self, obj):
        return obj.user.is_active


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'phone',
        'source',
        'grade',
        'province',
        'city',
        'progress',
        'business_owner_name',
        'technical_owner_name',
        'updated_at',
    )
    list_filter = ('grade', 'source', 'progress', 'province')
    search_fields = ('name', 'phone', 'description', 'plan')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'customer',
        'project_type',
        'progress',
        'business_owner',
        'technical_owner',
        'is_active',
        'updated_at',
    )
    list_filter = ('is_active', 'project_type', 'progress', 'province')
    search_fields = ('name', 'customer__name', 'plan')
    autocomplete_fields = ('customer', 'business_owner', 'technical_owner')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(ProjectType)
class ProjectTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name',)


@admin.register(ProjectProgressUpdate)
class ProjectProgressUpdateAdmin(admin.ModelAdmin):
    list_display = ('project', 'from_progress', 'to_progress', 'occurred_at', 'created_by')
    search_fields = ('content', 'project__name', 'project__customer__name')
    autocomplete_fields = ('project', 'created_by')
    readonly_fields = ('created_at',)


@admin.register(MaterialExperiment)
class MaterialExperimentAdmin(admin.ModelAdmin):
    list_display = ('project', 'stable_material', 'updated_by', 'updated_at')
    search_fields = ('project__name', 'project__customer__name', 'stable_material', 'technical_message')
    autocomplete_fields = ('project', 'created_by', 'updated_by')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(SchemeCalculation)
class SchemeCalculationAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'layer_count', 'updated_by', 'updated_at')
    search_fields = ('title', 'project__name', 'project__customer__name', 'remarks')
    autocomplete_fields = ('project', 'created_by', 'updated_by')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(VisitorRecord)
class VisitorRecordAdmin(admin.ModelAdmin):
    list_display = ('visit_date', 'customer', 'visitor_count', 'contact_name', 'host', 'purpose')
    list_filter = ('visit_date', 'hosts')
    search_fields = ('customer__name', 'contact_name', 'purpose', 'remarks', 'notes')
    autocomplete_fields = ('customer', 'host', 'hosts', 'created_by')
    exclude = ('notes',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(FollowUpTask)
class FollowUpTaskAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'project',
        'role',
        'assignee',
        'status',
        'due_at',
        'updated_at',
    )
    list_filter = ('status', 'role', 'target_progress')
    search_fields = ('title', 'project__name', 'project__customer__name', 'result')
    autocomplete_fields = ('project', 'assignee')
    readonly_fields = ('created_at', 'updated_at', 'completed_at')


@admin.register(TomorrowItem)
class TomorrowItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'planned_date', 'is_completed', 'created_at')
    list_filter = ('planned_date', 'is_completed')
    search_fields = ('title', 'note', 'user__username')
    autocomplete_fields = ('user',)
    readonly_fields = ('created_at', 'updated_at', 'completed_at')
