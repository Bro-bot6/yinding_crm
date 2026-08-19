from __future__ import annotations

import ctypes
import socket
import subprocess
import time
import webbrowser
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000
SITE_URL = f"http://{HOST}:{PORT}/"
PYTHONW = BASE_DIR / ".venv" / "Scripts" / "pythonw.exe"
SERVER_SCRIPT = BASE_DIR / "serve-crm.py"
LOG_DIR = BASE_DIR / "logs"
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

    for _ in range(30):
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
