from django.db import migrations, models


def keep_latest_active_identity(apps, schema_editor):
    PartnershipIdentity = apps.get_model('customers', 'PartnershipIdentity')
    active_customer_ids = (
        PartnershipIdentity.objects
        .filter(is_active=True)
        .values_list('customer_id', flat=True)
        .distinct()
    )
    for customer_id in active_customer_ids.iterator():
        keep_id = (
            PartnershipIdentity.objects
            .filter(customer_id=customer_id, is_active=True)
            .order_by('-updated_at', '-id')
            .values_list('id', flat=True)
            .first()
        )
        PartnershipIdentity.objects.filter(
            customer_id=customer_id,
            is_active=True,
        ).exclude(id=keep_id).update(is_active=False)


class Migration(migrations.Migration):
    dependencies = [
        ('customers', '0023_customer_cooperation_status'),
    ]

    operations = [
        migrations.RunPython(keep_latest_active_identity, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='partnershipidentity',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_active=True),
                fields=('customer',),
                name='unique_active_customer_partnership_identity',
            ),
        ),
    ]
