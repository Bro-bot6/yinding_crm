from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('customers', '0030_personal_calendar')]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='source',
            field=models.CharField(
                choices=[('抖音', '抖音'), ('视频号', '视频号'), ('服务号', '服务号'), ('朋友介绍', '朋友介绍')],
                default='抖音', max_length=30, verbose_name='客资来源',
            ),
        ),
    ]
