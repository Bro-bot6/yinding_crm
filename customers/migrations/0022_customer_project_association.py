import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def associate_existing_projects(apps, schema_editor):
    Project = apps.get_model('customers', 'Project')
    Association = apps.get_model('customers', 'CustomerProjectAssociation')
    Association.objects.bulk_create(
        [
            Association(customer_id=customer_id, project_id=project_id)
            for project_id, customer_id in Project.objects.values_list('id', 'customer_id').iterator()
        ],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0021_archive_automatic_customer_identities'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerProjectAssociation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='关联时间')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_customer_project_associations', to=settings.AUTH_USER_MODEL, verbose_name='关联人')),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_associations', to='customers.customer', verbose_name='关联客户')),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='customer_associations', to='customers.project', verbose_name='客资项目案例')),
            ],
            options={
                'verbose_name': '客户项目案例关联',
                'verbose_name_plural': '客户项目案例关联',
                'ordering': ('created_at', 'id'),
                'constraints': [models.UniqueConstraint(fields=('customer', 'project'), name='unique_customer_project_association')],
            },
        ),
        migrations.RunPython(associate_existing_projects, migrations.RunPython.noop),
    ]
