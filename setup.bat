@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Customer CRM First-time Setup

echo.
echo ========================================
echo   Customer CRM - First-time Setup
echo ========================================
echo.

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
    where python >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
    echo Python was not found.
    echo Please install Python 3.12 or newer, then run this file again.
    echo https://www.python.org/downloads/windows/
    echo.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo [1/4] Creating the virtual environment...
    %PYTHON_CMD% -m venv .venv
    if errorlevel 1 goto SETUP_FAILED
) else (
    echo [1/4] The virtual environment already exists.
)

echo [2/4] Installing project dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto SETUP_FAILED

echo [3/4] Preparing the database...
".venv\Scripts\python.exe" manage.py migrate
if errorlevel 1 goto SETUP_FAILED

echo [4/4] Checking the project...
".venv\Scripts\python.exe" manage.py check
if errorlevel 1 goto SETUP_FAILED

echo.
echo Setup completed. The website will now start.
echo.
call run.bat
exit /b %errorlevel%

:SETUP_FAILED
echo.
echo Setup failed. Keep this window open and send a screenshot of the error.
echo.
pause
exit /b 1
