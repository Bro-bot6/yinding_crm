from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('customers', '0028_contact_and_overseas_location')]

    operations = [
        migrations.AddField(
            model_name='customer', name='wechat_status',
            field=models.CharField(
                '是否添加微信', max_length=10, default='unknown',
                choices=(('unknown', '未记录'), ('yes', '是'), ('no', '否')),
            ),
        ),
    ]
