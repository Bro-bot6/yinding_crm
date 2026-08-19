from django.apps import AppConfig


class CustomersConfig(AppConfig):
    name = 'customers'

    def ready(self):
        from . import database  # noqa: F401
        from . import signals  # noqa: F401
