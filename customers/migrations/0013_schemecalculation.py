from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0012_unify_construction_progress'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SchemeCalculation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=150, verbose_name='测算单标题')),
                ('layer_count', models.PositiveSmallIntegerField(default=1, verbose_name='结构层数')),
                ('layers', models.JSONField(default=list, verbose_name='结构层数据')),
                ('remarks', models.TextField(blank=True, verbose_name='备注')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='创建时间')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='更新时间')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_scheme_calculations', to=settings.AUTH_USER_MODEL, verbose_name='创建人')),
                ('project', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='scheme_calculation', to='customers.project', verbose_name='关联项目')),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_scheme_calculations', to=settings.AUTH_USER_MODEL, verbose_name='最后修改人')),
            ],
            options={
                'verbose_name': '施工方案测算',
                'verbose_name_plural': '施工方案测算',
            },
        ),
    ]
