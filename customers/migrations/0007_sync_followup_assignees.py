from django.db import migrations


def sync_followup_assignees(apps, schema_editor):
    Project = apps.get_model('customers', 'Project')
    FollowUpTask = apps.get_model('customers', 'FollowUpTask')

    for project in Project.objects.select_related('customer').iterator():
        business_owner_id = project.customer.business_owner_id
        technical_owner_id = project.customer.technical_owner_id
        Project.objects.filter(id=project.id).update(
            business_owner_id=business_owner_id,
            technical_owner_id=technical_owner_id,
        )
        FollowUpTask.objects.filter(
            project_id=project.id,
            role='business',
        ).update(assignee_id=business_owner_id)
        FollowUpTask.objects.filter(
            project_id=project.id,
            role='technical',
        ).update(assignee_id=technical_owner_id)


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0006_followuptask_manual'),
    ]

    operations = [
        migrations.RunPython(sync_followup_assignees, migrations.RunPython.noop),
    ]
