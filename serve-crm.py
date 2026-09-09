from __future__ import annotations

import logging
import os
import secrets
import socket
import sys
from ipaddress import ip_address, ip_network
from logging.handlers import RotatingFileHandler
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


def resolve_shared_repository_root() -> Path:
    """Return the main checkout when this server is launched from a Git worktree."""
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
        if not common_dir_file.exists():
            return BASE_DIR
        common_dir = (git_dir / common_dir_file.read_text(encoding='utf-8').strip()).resolve()
        if common_dir.name == '.git':
            return common_dir.parent
    except (OSError, ValueError):
        pass
    return BASE_DIR


SHARED_ROOT = resolve_shared_repository_root()
DATA_DIR = Path(os.environ.get('DJANGO_DATA_DIR', SHARED_ROOT / 'data'))
LOG_DIR = Path(os.environ.get('CRM_LOG_DIR', SHARED_ROOT / 'logs'))
PORT = int(os.environ.get('CRM_PORT', '8000'))


def ensure_standard_streams() -> None:
    """Django management commands still expect streams under pythonw.exe."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w', encoding='utf-8')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w', encoding='utf-8')


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
    unique_candidates = list(dict.fromkeys(
        address for address in candidates
        if address and not address.startswith(('127.', '169.254.'))
    ))
    preferred_networks = (
        ip_network('192.168.0.0/16'),
        ip_network('10.0.0.0/8'),
        ip_network('172.16.0.0/12'),
    )
    # VPN/代理软件常创建 198.18.0.0/15 等虚拟网卡，系统解析顺序并不稳定。
    # 优先选择 RFC1918 局域网地址，避免重启后将虚拟网卡写入 ALLOWED_HOSTS。
    for network in preferred_networks:
        for address in unique_candidates:
            try:
                if ip_address(address) in network:
                    return address
            except ValueError:
                continue
    if unique_candidates:
        return unique_candidates[0]
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


def ensure_port_available() -> None:
    """Fail with a useful log message before doing startup work."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('0.0.0.0', PORT))
    except OSError as exc:
        raise RuntimeError(
            f'Cannot start CRM: TCP port {PORT} is already in use or unavailable: {exc}'
        ) from exc


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
    ensure_standard_streams()
    os.chdir(BASE_DIR)
    sys.path.insert(0, str(BASE_DIR))
    lan_ip = discover_lan_ip()
    configure_environment(lan_ip)
    configure_logging()
    logger = logging.getLogger(__name__)
    logger.info(
        'CRM process starting; pid=%s; code=%s; data=%s; logs=%s',
        os.getpid(),
        BASE_DIR,
        DATA_DIR,
        LOG_DIR,
    )
    ensure_port_available()
    write_access_guide(lan_ip)

    import django
    from django.core.management import call_command
    from django.core.wsgi import get_wsgi_application
    from waitress import serve

    django.setup()
    logger.info('Preparing static assets and database schema')
    call_command('collectstatic', interactive=False, verbosity=0)
    try:
        call_command('backup_crm', database_only=True, verbosity=0)
    except Exception:
        logger.exception('Pre-migration database backup failed')
        raise
    call_command('migrate', interactive=False, verbosity=0)

    application = get_wsgi_application()
    try:
        call_command('backup_crm', verbosity=0)
    except Exception:
        logger.exception('Startup backup failed')

    logger.info(
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
    logger.warning('Waitress server returned; CRM process is stopping')


if __name__ == '__main__':
    try:
        main()
    except BaseException:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        if not logging.getLogger().handlers:
            configure_logging()
        logging.getLogger(__name__).exception('CRM server stopped unexpectedly')
        raise
