@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PYTHONW_EXE=%CD%\.venv\Scripts\pythonw.exe"
set "HIDDEN_LAUNCHER=%CD%\start-crm-hidden.pyw"

if not exist "%PYTHONW_EXE%" (
    for /f "delims=" %%I in ('git -C "%CD%" rev-parse --path-format^=absolute --git-common-dir 2^>nul') do set "GIT_COMMON_DIR=%%I"
    if defined GIT_COMMON_DIR (
        for %%I in ("!GIT_COMMON_DIR!\..") do set "SHARED_ROOT=%%~fI"
        set "PYTHONW_EXE=!SHARED_ROOT!\.venv\Scripts\pythonw.exe"
    )
    if not exist "!PYTHONW_EXE!" (
        echo.
        echo Python environment was not found.
        echo Please run setup.bat first.
        echo.
        pause
        exit /b 1
    )
)

if not exist "%HIDDEN_LAUNCHER%" (
    echo.
    echo Hidden launcher was not found:
    echo %HIDDEN_LAUNCHER%
    echo.
    pause
    exit /b 1
)

start "" "%PYTHONW_EXE%" "%HIDDEN_LAUNCHER%"
exit /b 0
