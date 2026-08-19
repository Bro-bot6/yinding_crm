from __future__ import annotations

import logging
import os
import secrets
import socket
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
LOG_DIR = BASE_DIR / 'logs'
PORT = int(os.environ.get('CRM_PORT', '8000'))


def discover_lan_ip() -> str:
    candidates: list[str] = []
    try:
        candidates.extend(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(('192.168.1.1', 9))
            candidates.append(sock.getsockname()[0])
    except OSError:
        pass
    for address in candidates:
        if address and not address.startswith(('127.', '169.254.')):
            return address
    return '127.0.0.1'


def load_secret_key() -> str:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    secret_file = DATA_DIR / 'secret.key'
    if secret_file.exists():
        return secret_file.read_text(encoding='utf-8').strip()
    secret = secrets.token_urlsafe(64)
    temporary = secret_file.with_suffix('.tmp')
    temporary.write_text(secret, encoding='utf-8')
    os.replace(temporary, secret_file)
    return secret


def configure_environment(lan_ip: str) -> None:
    hostname = socket.gethostname()
    allowed_hosts = {
        '127.0.0.1',
        'localhost',
        hostname,
        f'{hostname}.local',
        lan_ip,
    }
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.environ.setdefault('DJANGO_DEBUG', 'False')
    os.environ.setdefault('DJANGO_SECRET_KEY', load_secret_key())
    os.environ.setdefault('DJANGO_DATA_DIR', str(DATA_DIR))
    os.environ.setdefault('DJANGO_ALLOWED_HOSTS', ','.join(sorted(allowed_hosts)))


def configure_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(
        LOG_DIR / 'server.log',
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8',
    )
    handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s %(name)s: %(message)s',
    ))
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers.clear()
    root_logger.addHandler(handler)


def write_access_guide(lan_ip: str) -> None:
    hostname = socket.gethostname()
    guide = DATA_DIR / '公司同事访问地址.txt'
    guide.write_text(
        '银鼎客资管理系统（公司内网）\n\n'
        f'电脑优先访问：http://{hostname}:{PORT}\n'
        f'备用 IP 地址：http://{lan_ip}:{PORT}\n\n'
        '使用条件：电脑或手机需要连接公司同一个局域网/Wi-Fi。\n'
        '本机管理地址：http://127.0.0.1:8000\n',
        encoding='utf-8-sig',
    )


def main() -> None:
    os.chdir(BASE_DIR)
    sys.path.insert(0, str(BASE_DIR))
    lan_ip = discover_lan_ip()
    configure_environment(lan_ip)
    configure_logging()
    write_access_guide(lan_ip)

    from django.core.management import call_command
    from django.core.wsgi import get_wsgi_application
    from waitress import serve

    application = get_wsgi_application()
    try:
        call_command('backup_crm', verbosity=0)
    except Exception:
        logging.getLogger(__name__).exception('Startup backup failed')

    logging.getLogger(__name__).info(
        'CRM server starting on 0.0.0.0:%s; LAN address=%s',
        PORT,
        lan_ip,
    )
    serve(
        application,
        host='0.0.0.0',
        port=PORT,
        threads=8,
        channel_timeout=120,
        clear_untrusted_proxy_headers=True,
    )


if __name__ == '__main__':
    main()
