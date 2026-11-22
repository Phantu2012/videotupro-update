@echo off
chcp 65001 >nul
title Mở Tất Cả Profile Chrome Đăng Nhập Tài Khoản
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
    set "PY_CMD=py -3.12"
    py -3.12 --version >nul 2>&1
    if errorlevel 1 set "PY_CMD=py"
) else (
    set "PY_CMD=python"
)

echo ========================================================
echo   MỞ CỬA SỔ TẤT CẢ PROFILE ĐỂ ĐĂNG NHẬP TÀI KHOẢN
echo ========================================================
echo.
%PY_CMD% launch_all_visible.py
echo.
echo Giữ cửa sổ này hoặc nhấn phím bất kỳ để đóng...
pause >nul
