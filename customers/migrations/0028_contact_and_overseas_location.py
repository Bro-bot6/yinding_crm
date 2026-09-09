from django.db import migrations, models


class Migration(migrations.Migration):
    # Additive migration: blank country preserves every existing domestic location.
    dependencies = [('customers', '0027_customer_phone_validation')]

    operations = [
        migrations.AlterField(
            model_name='customer', name='phone',
            field=models.CharField('联系方式', max_length=100),
        ),
        migrations.AddField(
            model_name='customer', name='country',
            field=models.CharField('国外国家 / 地区', max_length=100, blank=True),
        ),
        migrations.AddField(
            model_name='project', name='country',
            field=models.CharField('国外国家 / 地区', max_length=100, blank=True),
        ),
    ]
