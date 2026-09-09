from django.db import migrations, models


def normalize_unrecorded_status(apps, schema_editor):
    customer = apps.get_model('customers', 'Customer')
    customer.objects.filter(wechat_status='unknown').update(wechat_status='no')


class Migration(migrations.Migration):
    dependencies = [('customers', '0031_customer_source_choices')]

    operations = [
        migrations.RunPython(normalize_unrecorded_status, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='customer',
            name='wechat_status',
            field=models.CharField(
                '是否添加微信', max_length=10, default='no',
                choices=(('yes', '已添加'), ('no', '未添加'), ('rejected', '已添加未通过')),
            ),
        ),
    ]
