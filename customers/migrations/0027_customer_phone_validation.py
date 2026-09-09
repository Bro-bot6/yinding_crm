import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0026_alter_customer_grade'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customer',
            name='phone',
            field=models.CharField(
                max_length=11,
                validators=[
                    django.core.validators.RegexValidator(
                        '^\\d{11}$',
                        '联系电话必须为11位数字',
                    ),
                ],
                verbose_name='联系电话',
            ),
        ),
    ]
