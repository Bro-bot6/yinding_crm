from django.db import migrations, models


def fill_missing_project_names(apps, schema_editor):
    Project = apps.get_model('customers', 'Project')
    for project in Project.objects.all().only('id', 'name').iterator():
        if not str(project.name or '').strip():
            project.name = f'历史项目 #{project.id}'
            project.save(update_fields=('name',))


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0024_single_active_partnership_identity'),
    ]

    operations = [
        migrations.RunPython(
            fill_missing_project_names,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='project',
            constraint=models.CheckConstraint(
                condition=~models.Q(name=''),
                name='project_name_not_empty',
            ),
        ),
    ]
