@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Customer CRM Data Backup

if not exist "db.sqlite3" (
    echo Database db.sqlite3 was not found.
    echo.
    pause
    exit /b 1
)

if not exist "private-backup" mkdir "private-backup"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
set "BACKUP_FILE=private-backup\db-%STAMP%.sqlite3"

copy /y "db.sqlite3" "%BACKUP_FILE%" >nul
if errorlevel 1 (
    echo Backup failed.
    echo.
    pause
    exit /b 1
)

echo.
echo Data backup completed:
echo %CD%\%BACKUP_FILE%
echo.
echo This file contains customer and account data. Keep it private.
echo.
pause
