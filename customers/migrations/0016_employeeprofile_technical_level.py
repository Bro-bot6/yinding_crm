from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0015_visitorrecord_multiple_contacts_and_hosts'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeprofile',
            name='technical_level',
            field=models.PositiveSmallIntegerField(
                default=1,
                help_text='1-5级，数字越大，在技术进度汇总中排序越靠前。',
                verbose_name='技术等级',
            ),
        ),
    ]
