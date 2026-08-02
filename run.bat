@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "SITE_URL=http://127.0.0.1:8000/"
set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"
set "MANAGE_FILE=%CD%\manage.py"
set "LOG_FILE=%CD%\server-error.log"

title Customer CRM Launcher

if not exist "%PYTHON_EXE%" (
    echo.
    echo Python environment was not found.
    echo Expected: %PYTHON_EXE%
    echo.
    pause
    exit /b 1
)

netstat -ano | findstr /C:":8000" | findstr /C:"LISTENING" >nul
if not errorlevel 1 goto SITE_READY

echo.
echo Starting website service...
start "Customer CRM Server" /min "%ComSpec%" /d /c ""%PYTHON_EXE%" "%MANAGE_FILE%" runserver 127.0.0.1:8000 1>>"%LOG_FILE%" 2>>&1"

for /L %%I in (1,1,15) do (
    ping 127.0.0.1 -n 2 >nul
    netstat -ano | findstr /C:":8000" | findstr /C:"LISTENING" >nul
    if not errorlevel 1 goto SITE_READY
)

echo.
echo The website did not start. The error log is:
echo %LOG_FILE%
echo.
if exist "%LOG_FILE%" type "%LOG_FILE%"
echo.
pause
exit /b 1

:SITE_READY
echo.
echo Website is ready: %SITE_URL%
start "" "%SITE_URL%"
exit /b 0
