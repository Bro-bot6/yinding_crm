from django.conf import settings
from django.db import migrations, models


def copy_legacy_visitor_people(apps, schema_editor):
    VisitorRecord = apps.get_model('customers', 'VisitorRecord')
    for record in VisitorRecord.objects.all().iterator():
        update_fields = []
        if record.contact_name:
            record.visitor_contacts = [{'name': record.contact_name, 'role': ''}]
            update_fields.append('visitor_contacts')
        if update_fields:
            record.save(update_fields=update_fields)
        if record.host_id:
            record.hosts.add(record.host_id)


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0014_visitorrecord_remarks'),
    ]

    operations = [
        migrations.AddField(
            model_name='visitorrecord',
            name='visitor_contacts',
            field=models.JSONField(blank=True, default=list, verbose_name='来访客户负责人'),
        ),
        migrations.AddField(
            model_name='visitorrecord',
            name='hosts',
            field=models.ManyToManyField(
                blank=True,
                related_name='hosted_visitor_records_as_member',
                to=settings.AUTH_USER_MODEL,
                verbose_name='接待人员',
            ),
        ),
        migrations.RunPython(copy_legacy_visitor_people, migrations.RunPython.noop),
    ]
