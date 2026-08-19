from django.db import migrations, models


STAGE_MAPPING = {
    '新客资': '需求对接',
    '前期了解': '需求对接',
    '需求确认': '需求对接',
    '客户考察/来访完成': '客户深度沟通',
    '深度需求沟通完成': '客户深度沟通',
    '现场勘察': '客户深度沟通',
    '现场勘查完成': '客户深度沟通',
    '寄样与实验完成': '技术验证',
    '技术可行性确认': '技术验证',
    '方案设计': '技术验证',
    '方案确认': '方案与报价',
    '报价中': '方案与报价',
    '技术方案验证汇报通过': '方案与报价',
    '商务洽谈': '方案与报价',
    '商务报价与合同签订': '合同签订',
    '已成交': '合同签订',
    '技术交底完成': '项目实施跟进',
    '试验段施工完成': '项目实施跟进',
    'A段施工完成': '项目实施跟进',
    'B段施工完成': '项目实施跟进',
    '客户满意度回访完成': '售后维护与需求挖掘',
}


def migrate_progress_stages(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    Project = apps.get_model('customers', 'Project')
    FollowUpTask = apps.get_model('customers', 'FollowUpTask')

    for old_stage, new_stage in STAGE_MAPPING.items():
        Customer.objects.filter(progress=old_stage).update(progress=new_stage)
        Project.objects.filter(progress=old_stage).update(progress=new_stage)

    system_tasks = list(
        FollowUpTask.objects.filter(is_manual=False).order_by('-completed_at', '-updated_at', '-id')
    )
    grouped = {}
    for task in system_tasks:
        mapped_stage = STAGE_MAPPING.get(task.target_progress, task.target_progress)
        grouped.setdefault((task.project_id, mapped_stage, task.role), []).append(task)

    for tasks in grouped.values():
        for duplicate in tasks[1:]:
            duplicate.is_manual = True
            duplicate.save(update_fields=('is_manual',))

    for task in FollowUpTask.objects.all().iterator():
        mapped_stage = STAGE_MAPPING.get(task.target_progress)
        if mapped_stage and task.target_progress != mapped_stage:
            task.target_progress = mapped_stage
            task.save(update_fields=('target_progress',))


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0016_employeeprofile_technical_level'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='progress',
            field=models.CharField(default='需求对接', max_length=30, verbose_name='项目进度'),
        ),
        migrations.AlterField(
            model_name='project',
            name='progress',
            field=models.CharField(default='需求对接', max_length=50, verbose_name='当前进度'),
        ),
        migrations.RunPython(migrate_progress_stages, migrations.RunPython.noop),
    ]
