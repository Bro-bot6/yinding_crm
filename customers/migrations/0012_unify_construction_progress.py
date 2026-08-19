from django.db import migrations


def unify_construction_progress(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    Project = apps.get_model('customers', 'Project')

    legacy_stages = ('A段施工完成', 'B段施工完成')
    Customer.objects.filter(progress__in=legacy_stages).update(
        progress='试验段施工完成',
    )
    Project.objects.filter(progress__in=legacy_stages).update(
        progress='试验段施工完成',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0011_progressupdatereadreceipt'),
    ]

    operations = [
        migrations.RunPython(
            unify_construction_progress,
            migrations.RunPython.noop,
        ),
    ]
