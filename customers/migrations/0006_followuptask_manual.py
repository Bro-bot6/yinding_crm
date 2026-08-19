from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0005_tomorrowitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='followuptask',
            name='is_manual',
            field=models.BooleanField(default=False, verbose_name='项目内临时任务'),
        ),
        migrations.RemoveConstraint(
            model_name='followuptask',
            name='unique_project_progress_role_task',
        ),
        migrations.AddConstraint(
            model_name='followuptask',
            constraint=models.UniqueConstraint(
                condition=models.Q(('is_manual', False)),
                fields=('project', 'target_progress', 'role'),
                name='unique_project_progress_role_task',
            ),
        ),
    ]
