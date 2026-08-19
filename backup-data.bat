@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Yinding CRM Data Backup

if not exist ".venv\Scripts\python.exe" (
    echo Python environment was not found.
    echo.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" manage.py backup_crm
if errorlevel 1 (
    echo Backup failed.
    echo.
    pause
    exit /b 1
)

echo.
echo Data backup and Excel export completed.
echo Database backups: %CD%\backups
echo Latest Excel file: %CD%\exports\客资总表.xlsx
echo.
echo This file contains customer and account data. Keep it private.
echo.
pause
