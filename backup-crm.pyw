from __future__ import annotations

import logging
import os
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    filename=LOG_DIR / 'backup.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    encoding='utf-8',
)

try:
    os.chdir(BASE_DIR)
    sys.path.insert(0, str(BASE_DIR))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.environ.setdefault('DJANGO_DEBUG', 'False')
    os.environ.setdefault('DJANGO_DATA_DIR', str(BASE_DIR / 'data'))

    import django
    from django.core.management import call_command

    django.setup()
    call_command('backup_crm', verbosity=0)
    logging.info('Scheduled CRM backup completed')
except Exception:
    logging.exception('Scheduled CRM backup failed')
    raise
