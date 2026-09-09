@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    for /f "delims=" %%I in ('git -C "%CD%" rev-parse --path-format^=absolute --git-common-dir 2^>nul') do set "GIT_COMMON_DIR=%%I"
    if defined GIT_COMMON_DIR (
        for %%I in ("!GIT_COMMON_DIR!\..") do set "SHARED_ROOT=%%~fI"
        set "PYTHON_EXE=!SHARED_ROOT!\.venv\Scripts\python.exe"
        set "DJANGO_DATA_DIR=!SHARED_ROOT!\data"
    )
)
if not exist "%PYTHON_EXE%" (
    echo Python environment was not found. Please run setup.bat first.
    exit /b 1
)
"%PYTHON_EXE%" manage.py %*
