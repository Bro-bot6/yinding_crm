from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


PROGRESS_STAGES = (
    '需求对接',
    '技术验证',
    '客户深度沟通',
    '方案与报价',
    '合同签订',
    '项目实施跟进',
    '售后维护与需求挖掘',
)


def assign_existing_updates_to_intervals(apps, schema_editor):
    ProjectProgressUpdate = apps.get_model('customers', 'ProjectProgressUpdate')
    for item in ProjectProgressUpdate.objects.select_related('project').iterator():
        try:
            current_index = PROGRESS_STAGES.index(item.project.progress)
        except ValueError:
            current_index = 0
        from_index = min(current_index, len(PROGRESS_STAGES) - 2)
        item.from_progress = PROGRESS_STAGES[from_index]
        item.to_progress = PROGRESS_STAGES[from_index + 1]
        item.occurred_at = item.created_at
        item.save(update_fields=('from_progress', 'to_progress', 'occurred_at'))


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0018_sync_tasks_for_core_progress_stages'),
    ]

    operations = [
        migrations.CreateModel(
            name='MaterialExperiment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stable_material', models.CharField(blank=True, max_length=150, verbose_name='稳定材料')),
                ('day_7_data', models.TextField(blank=True, verbose_name='7天数据')),
                ('day_14_data', models.TextField(blank=True, verbose_name='14天数据')),
                ('day_28_data', models.TextField(blank=True, verbose_name='28天数据')),
                ('technical_message', models.TextField(blank=True, verbose_name='技术方留言')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_material_experiments', to=settings.AUTH_USER_MODEL, verbose_name='创建人')),
                ('project', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='material_experiment', to='customers.project', verbose_name='关联项目')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_material_experiments', to=settings.AUTH_USER_MODEL, verbose_name='最后修改人')),
            ],
            options={
                'verbose_name': '材料实验档案',
                'verbose_name_plural': '材料实验档案',
            },
        ),
        migrations.AddField(
            model_name='projectprogressupdate',
            name='from_progress',
            field=models.CharField(default='需求对接', max_length=50, verbose_name='前置正式阶段'),
        ),
        migrations.AddField(
            model_name='projectprogressupdate',
            name='occurred_at',
            field=models.DateTimeField(default=django.utils.timezone.now, verbose_name='记录时间'),
        ),
        migrations.AddField(
            model_name='projectprogressupdate',
            name='to_progress',
            field=models.CharField(default='技术验证', max_length=50, verbose_name='后置正式阶段'),
        ),
        migrations.RunPython(assign_existing_updates_to_intervals, migrations.RunPython.noop),
        migrations.AlterModelOptions(
            name='projectprogressupdate',
            options={'ordering': ('occurred_at', 'id'), 'verbose_name': '项目进度更新', 'verbose_name_plural': '项目进度更新'},
        ),
    ]
