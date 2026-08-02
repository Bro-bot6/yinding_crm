from datetime import timedelta

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


PROGRESS_STAGES = (
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
)

NEXT_TASKS = {
    '客户考察/来访完成': ('安排客户考察或来访并记录结论', ('business',)),
    '深度需求沟通完成': ('完成深度需求沟通并整理关键参数', ('business',)),
    '寄样与实验完成': ('协调寄样与实验并记录实验结果', ('business', 'technical')),
    '技术可行性确认': ('完成技术可行性确认', ('technical',)),
    '现场勘查完成': ('完成项目现场勘查并整理现场条件', ('technical',)),
    '技术方案验证汇报通过': ('编制技术方案并完成验证汇报', ('technical',)),
    '商务报价与合同签订': ('完成商务报价并推进合同签订', ('business',)),
    '技术交底完成': ('完成项目技术交底', ('technical',)),
    '试验段施工完成': ('组织试验段施工并记录验证结果', ('technical',)),
    'A段施工完成': ('推进并完成 A 段施工', ('business', 'technical')),
    'B段施工完成': ('推进并完成 B 段施工', ('business', 'technical')),
    '客户满意度回访完成': ('完成客户满意度回访并记录反馈', ('business',)),
}


def create_projects_and_tasks(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    Project = apps.get_model('customers', 'Project')
    FollowUpTask = apps.get_model('customers', 'FollowUpTask')
    due_at = timezone.now() + timedelta(days=3)

    for customer in Customer.objects.all():
        project = Project.objects.create(
            customer=customer,
            name=customer.plan or f'{customer.name}项目',
            progress=customer.progress,
            plan=customer.plan,
            province=customer.province,
            city=customer.city,
            district=customer.district,
            business_owner_id=customer.business_owner_id,
            technical_owner_id=customer.technical_owner_id,
        )
        try:
            current_index = PROGRESS_STAGES.index(project.progress)
        except ValueError:
            current_index = 0
        if current_index >= len(PROGRESS_STAGES) - 1:
            continue
        target_progress = PROGRESS_STAGES[current_index + 1]
        title, roles = NEXT_TASKS[target_progress]
        for role in roles:
            assignee_id = (
                project.business_owner_id
                if role == 'business'
                else project.technical_owner_id
            )
            FollowUpTask.objects.create(
                project=project,
                title=title,
                target_progress=target_progress,
                role=role,
                assignee_id=assignee_id,
                due_at=due_at,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0003_update_customer_progress_stages'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=150, verbose_name='项目名称')),
                ('progress', models.CharField(default='新客资', max_length=50, verbose_name='当前进度')),
                ('plan', models.TextField(blank=True, verbose_name='施工方案')),
                ('province', models.CharField(blank=True, max_length=50, verbose_name='省')),
                ('city', models.CharField(blank=True, max_length=50, verbose_name='市')),
                ('district', models.CharField(blank=True, max_length=50, verbose_name='区县')),
                ('is_active', models.BooleanField(default=True, verbose_name='项目有效')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('business_owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='business_projects', to=settings.AUTH_USER_MODEL, verbose_name='商务负责人')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='projects', to='customers.customer', verbose_name='所属客户')),
                ('technical_owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='technical_projects', to=settings.AUTH_USER_MODEL, verbose_name='技术负责人')),
            ],
            options={
                'verbose_name': '客户项目',
                'verbose_name_plural': '客户项目',
                'ordering': ('-updated_at', 'id'),
            },
        ),
        migrations.CreateModel(
            name='FollowUpTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200, verbose_name='任务内容')),
                ('target_progress', models.CharField(max_length=50, verbose_name='目标进度')),
                ('role', models.CharField(choices=[('business', '商务'), ('technical', '技术')], max_length=20, verbose_name='负责岗位')),
                ('status', models.CharField(choices=[('pending', '待处理'), ('waiting', '等待客户'), ('completed', '已完成')], default='pending', max_length=20, verbose_name='任务状态')),
                ('due_at', models.DateTimeField(blank=True, null=True, verbose_name='计划完成时间')),
                ('completed_at', models.DateTimeField(blank=True, null=True, verbose_name='实际完成时间')),
                ('result', models.TextField(blank=True, verbose_name='跟进结果')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('assignee', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='follow_up_tasks', to=settings.AUTH_USER_MODEL, verbose_name='负责人')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='follow_up_tasks', to='customers.project', verbose_name='关联项目')),
            ],
            options={
                'verbose_name': '跟进任务',
                'verbose_name_plural': '跟进任务',
                'ordering': ('status', 'due_at', '-updated_at'),
            },
        ),
        migrations.AddConstraint(
            model_name='followuptask',
            constraint=models.UniqueConstraint(fields=('project', 'target_progress', 'role'), name='unique_project_progress_role_task'),
        ),
        migrations.RunPython(create_projects_and_tasks, migrations.RunPython.noop),
    ]
