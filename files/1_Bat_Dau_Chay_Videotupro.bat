@echo off
chcp 65001 >nul
title VideoTuPro - He Thong Tao Video AI
cd /d "%~dp0"
echo ================================================================
echo           HỆ THỐNG TỰ ĐỘNG TẠO VIDEO AI - VIDEOTUPRO
echo ================================================================
echo Đang khởi động hệ thống tại địa chỉ: http://127.0.0.1:8765
echo Vui lòng giữ cửa sổ này trong suốt quá trình sử dụng!
echo.
if exist "%~dp0updater.py" (
    py -3.12 "%~dp0updater.py" --startup
    if errorlevel 9009 python "%~dp0updater.py" --startup
)
start "" http://127.0.0.1:8765
py -3.12 -m uvicorn app.main:app --host 127.0.0.1 --port 8765
if %ERRORLEVEL% NEQ 0 (
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8765
)
pause

