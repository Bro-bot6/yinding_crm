from __future__ import annotations

import ctypes
import socket
import subprocess
import time
import webbrowser
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


def resolve_shared_repository_root() -> Path:
    git_pointer = BASE_DIR / ".git"
    if not git_pointer.is_file():
        return BASE_DIR
    try:
        marker, raw_git_dir = git_pointer.read_text(encoding="utf-8").strip().split(":", 1)
        if marker.lower() != "gitdir":
            return BASE_DIR
        git_dir = Path(raw_git_dir.strip())
        if not git_dir.is_absolute():
            git_dir = (BASE_DIR / git_dir).resolve()
        common_dir_file = git_dir / "commondir"
        if not common_dir_file.exists():
            return BASE_DIR
        common_dir = (git_dir / common_dir_file.read_text(encoding="utf-8").strip()).resolve()
        if common_dir.name == ".git":
            return common_dir.parent
    except (OSError, ValueError):
        pass
    return BASE_DIR


SHARED_ROOT = resolve_shared_repository_root()
HOST = "127.0.0.1"
PORT = 8000
SITE_URL = f"http://{HOST}:{PORT}/"
PYTHONW = next(
    (
        candidate
        for candidate in (
            BASE_DIR / ".venv" / "Scripts" / "pythonw.exe",
            SHARED_ROOT / ".venv" / "Scripts" / "pythonw.exe",
        )
        if candidate.exists()
    ),
    BASE_DIR / ".venv" / "Scripts" / "pythonw.exe",
)
SERVER_SCRIPT = BASE_DIR / "serve-crm.py"
LOG_DIR = SHARED_ROOT / "logs"
LOG_FILE = LOG_DIR / "launcher.log"


def show_error(message: str) -> None:
    ctypes.windll.user32.MessageBoxW(None, message, "银鼎客资系统", 0x10)


def server_is_ready() -> bool:
    try:
        with socket.create_connection((HOST, PORT), timeout=0.5):
            return True
    except OSError:
        return False


def start_server() -> bool:
    if not PYTHONW.exists():
        show_error(
            "未找到项目运行环境。请先运行 setup.bat，或联系维护人员。\n\n"
            f"缺少文件：{PYTHONW}"
        )
        return False

    if not SERVER_SCRIPT.exists():
        show_error(f"Server script was not found:\n\n{SERVER_SCRIPT}")
        return False

    creation_flags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as log_file:
        subprocess.Popen(
            [
                str(PYTHONW),
                str(SERVER_SCRIPT),
            ],
            cwd=BASE_DIR,
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=log_file,
            close_fds=True,
            creationflags=creation_flags,
        )

    # First start after an update can include static collection and migrations.
    for _ in range(120):
        if server_is_ready():
            return True
        time.sleep(0.5)

    show_error(
        "网站启动失败，请把日志文件发给维护人员：\n\n"
        f"{LOG_FILE}"
    )
    return False


if server_is_ready() or start_server():
    webbrowser.open(SITE_URL)
