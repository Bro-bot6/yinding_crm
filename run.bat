@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PYTHONW_EXE=%CD%\.venv\Scripts\pythonw.exe"
set "HIDDEN_LAUNCHER=%CD%\start-crm-hidden.pyw"

if not exist "%PYTHONW_EXE%" (
    echo.
    echo Python environment was not found.
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
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
