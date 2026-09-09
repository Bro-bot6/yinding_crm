from __future__ import annotations

import logging
import os
import sys
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


def resolve_shared_repository_root() -> Path:
    """Keep scheduled backups on the shared data directory in a Git worktree."""
    git_pointer = BASE_DIR / '.git'
    if not git_pointer.is_file():
        return BASE_DIR
    try:
        marker, raw_git_dir = git_pointer.read_text(encoding='utf-8').strip().split(':', 1)
        if marker.lower() != 'gitdir':
            return BASE_DIR
        git_dir = Path(raw_git_dir.strip())
        if not git_dir.is_absolute():
            git_dir = (BASE_DIR / git_dir).resolve()
        common_dir_file = git_dir / 'commondir'
        common_dir = (git_dir / common_dir_file.read_text(encoding='utf-8').strip()).resolve()
        if common_dir.name == '.git':
            return common_dir.parent
    except (OSError, ValueError):
        pass
    return BASE_DIR


SHARED_ROOT = resolve_shared_repository_root()
LOG_DIR = SHARED_ROOT / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w', encoding='utf-8')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w', encoding='utf-8')

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
    os.environ.setdefault('DJANGO_DATA_DIR', str(SHARED_ROOT / 'data'))

    import django
    from django.core.management import call_command

    django.setup()
    call_command('backup_crm', verbosity=0)
    logging.info('Scheduled CRM backup completed')
except Exception:
    logging.exception('Scheduled CRM backup failed')
    raise
