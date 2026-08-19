from django.db.backends.signals import connection_created
from django.dispatch import receiver


@receiver(connection_created, dispatch_uid='customers.configure_sqlite')
def configure_sqlite_connection(sender, connection, **kwargs):
    if connection.vendor != 'sqlite':
        return
    with connection.cursor() as cursor:
        cursor.execute('PRAGMA busy_timeout=30000')
        if connection.settings_dict.get('NAME') != ':memory:':
            cursor.execute('PRAGMA journal_mode=WAL')
            cursor.execute('PRAGMA synchronous=NORMAL')
