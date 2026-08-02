from django.db import migrations


PROGRESS_MAPPING = {
    '前期了解': '客户考察/来访完成',
    '需求确认': '深度需求沟通完成',
    '现场勘察': '现场勘查完成',
    '方案设计': '技术可行性确认',
    '方案确认': '技术方案验证汇报通过',
    '报价中': '技术方案验证汇报通过',
    '商务洽谈': '商务报价与合同签订',
    '已成交': '商务报价与合同签订',
}


def update_progress_stages(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    for old_stage, new_stage in PROGRESS_MAPPING.items():
        Customer.objects.filter(progress=old_stage).update(progress=new_stage)


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0002_customer'),
    ]

    operations = [
        migrations.RunPython(update_progress_stages, migrations.RunPython.noop),
    ]
