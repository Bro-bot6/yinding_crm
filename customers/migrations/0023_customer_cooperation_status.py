from django.db import migrations, models


def backfill_cooperation_status(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    PartnershipIdentity = apps.get_model('customers', 'PartnershipIdentity')
    AgencyAuthorization = apps.get_model('customers', 'AgencyAuthorization')
    BusinessContract = apps.get_model('customers', 'BusinessContract')
    ProjectAssociation = apps.get_model('customers', 'CustomerProjectAssociation')

    cooperating_ids = set(PartnershipIdentity.objects.filter(
        is_active=True,
    ).values_list('customer_id', flat=True))
    cooperating_ids.update(AgencyAuthorization.objects.exclude(
        agreement_status__in=('terminated', 'expired'),
    ).values_list('customer_id', flat=True))
    cooperating_ids.update(BusinessContract.objects.exclude(
        status='terminated',
    ).values_list('customer_id', flat=True))
    cooperating_ids.update(
        customer_id
        for customer_id, project_customer_id in ProjectAssociation.objects.values_list(
            'customer_id', 'project__customer_id',
        ).iterator()
        if customer_id != project_customer_id
    )
    if cooperating_ids:
        Customer.objects.filter(id__in=cooperating_ids).update(
            cooperation_status='cooperating',
        )


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0022_customer_project_association'),
    ]

    operations = [
        migrations.AddField(
            model_name='customer',
            name='cooperation_status',
            field=models.CharField(
                choices=[
                    ('none', '未建立合作关系'),
                    ('cooperating', '已建立合作关系'),
                ],
                default='none',
                max_length=20,
                verbose_name='合作关系状态',
            ),
        ),
        migrations.RunPython(backfill_cooperation_status, migrations.RunPython.noop),
    ]
