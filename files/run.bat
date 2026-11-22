@echo off
chcp 65001 >nul
title VideoStudio - AI Auto Video & Google Flow Veo 3 Ultra
cd /d "%~dp0"

echo ========================================================
echo        VIDEOSTUDIO - AI AUTO VIDEO PLATFORM
echo ========================================================
echo.

where py >nul 2>&1
if %errorlevel%==0 (
    set "PY_CMD=py -3.12"
    py -3.12 --version >nul 2>&1
    if errorlevel 1 set "PY_CMD=py"
) else (
    set "PY_CMD=python"
)

echo [1/3] Dang kiem tra thu vien Python...
%PY_CMD% -m pip install -r requirements.txt --quiet

echo [2/3] Dang mo giao dien Web tai http://127.0.0.1:8765 ...
start "" http://127.0.0.1:8765

echo [3/3] Dang khoi chay Server VideoStudio (Port 8765)...
echo (Giu cua so nay mo khi su dung tool. Nhan Ctrl+C de tat)
echo.
%PY_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port 8765
pause
