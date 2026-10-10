from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import os
import sqlite3
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description='Save a dated local CRM data archive.')
    parser.add_argument('--code-dir', type=Path, default=ROOT)
    args = parser.parse_args()
    code_dir = args.code_dir.resolve()
    if not (code_dir / 'manage.py').is_file():
        raise RuntimeError(f'CRM code directory is unavailable: {code_dir}')

    log_dir = ROOT / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=log_dir / 'daily-archive.log',
        level=logging.INFO,
        format='%(asctime)s %(levelname)s: %(message)s',
        encoding='utf-8',
    )
    for name in ('stdout', 'stderr'):
        if getattr(sys, name) is None:
            setattr(sys, name, open(os.devnull, 'w', encoding='utf-8'))

    os.chdir(code_dir)
    sys.path.insert(0, str(code_dir))
    os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
    os.environ['DJANGO_DATA_DIR'] = str(ROOT / 'data')
    os.environ.setdefault('DJANGO_DEBUG', 'False')

    import django
    from django.conf import settings
    from django.core.management import call_command
    from django.utils import timezone

    django.setup()
    archive_dir = ROOT / 'backups' / 'daily'
    archive_dir.mkdir(parents=True, exist_ok=True)
    output = io.StringIO()
    call_command('backup_crm', stdout=output, verbosity=0)
    produced_paths = [Path(line.strip()) for line in output.getvalue().splitlines() if line.strip()]
    database = next((path for path in produced_paths if path.suffix == '.sqlite3'), None)
    if database is None or not database.is_file():
        raise RuntimeError('The backup did not complete; another backup may still be running.')
    stamp = database.stem.removeprefix('crm-')
    export_dir = code_dir / 'exports'
    fallback_excel = export_dir / f'客资总表-{stamp}.xlsx'
    excel = fallback_excel if fallback_excel.is_file() else export_dir / '客资总表.xlsx'
    if not excel.is_file():
        raise RuntimeError('The customer Excel export is missing.')

    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as snapshot:
        integrity = snapshot.execute('PRAGMA integrity_check').fetchall()
    if integrity != [('ok',)]:
        raise RuntimeError(f'Database integrity check failed: {integrity}')

    destination = archive_dir / f'crm-archive-{stamp}.zip'
    temporary = archive_dir / f'.crm-archive-{stamp}-{os.getpid()}.tmp'
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            archive.write(database, 'crm.sqlite3')
            archive.write(excel, '客资总表.xlsx')
            media_root = getattr(settings, 'MEDIA_ROOT', '')
            if media_root:
                media_dir = Path(media_root)
                if media_dir.is_dir():
                    for file in sorted(media_dir.rglob('*')):
                        if file.is_file():
                            archive.write(file, str(Path('media') / file.relative_to(media_dir)))
            manifest = {
                'created_at': timezone.localtime().isoformat(),
                'timezone': settings.TIME_ZONE,
                'database_sha256': hashlib.sha256(database.read_bytes()).hexdigest(),
                'code_directory': str(code_dir),
            }
            archive.writestr('manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
            archive.writestr('存档说明.txt',
                '银鼎客资系统每日存档\n\n'
                'crm.sqlite3：完整数据库，含客户、项目、员工账号和业务记录。\n'
                '客资总表.xlsx：方便查看的业务数据导出。\n'
                'media/（若存在）：上传附件。\n\n'
                '恢复数据库前请停止客资服务并另存当前数据库，避免覆盖现有数据。\n'
                '每日存档保存在 E:\\yinding_crm\\backups\\daily，不自动删除历史存档。\n')
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise RuntimeError('Archive verification failed.')
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)
    logging.info('Daily CRM archive completed: %s (%s bytes)', destination, destination.stat().st_size)
    print(destination)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        logging.exception('Daily CRM archive failed')
        raise
