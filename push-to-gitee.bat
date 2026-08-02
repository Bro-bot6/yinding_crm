@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Upload Customer CRM to Gitee

echo.
echo ========================================
echo   Upload Customer CRM to Gitee
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo Git was not found. Please install Git for Windows first.
    echo https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo The Gitee remote repository is not configured.
    echo.
    pause
    exit /b 1
)

echo Uploading the main branch...
echo A Gitee login or authorization window may appear.
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo Upload failed. Keep this window open and send a screenshot of the error.
    echo.
    pause
    exit /b 1
)

echo.
echo Upload completed successfully.
echo Repository: https://gitee.com/niko789/yinding-crm
echo.
pause
