from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0025_require_project_name'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='grade',
            field=models.CharField(default='C', max_length=1, verbose_name='客户等级'),
        ),
    ]
