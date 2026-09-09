from django.db import migrations


def archive_automatic_customer_identities(apps, schema_editor):
    PartnershipIdentity = apps.get_model('customers', 'PartnershipIdentity')
    PartnershipIdentity.objects.filter(
        identity_type='customer',
        is_active=True,
        created_by__isnull=True,
        notes='',
    ).update(is_active=False)


def restore_automatic_customer_identities(apps, schema_editor):
    PartnershipIdentity = apps.get_model('customers', 'PartnershipIdentity')
    PartnershipIdentity.objects.filter(
        identity_type='customer',
        is_active=False,
        created_by__isnull=True,
        notes='',
    ).update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ('customers', '0020_project_commercial_notes_project_contract_amount_and_more'),
    ]

    operations = [
        migrations.RunPython(
            archive_automatic_customer_identities,
            restore_automatic_customer_identities,
        ),
    ]
