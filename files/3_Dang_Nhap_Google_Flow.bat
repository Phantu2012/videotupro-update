@echo off
chcp 65001 >nul
title Mo 4 Profile Trinh Duyet - Dang Nhap Google Flow
cd /d "%~dp0"
echo ================================================================
echo           MỞ 4 PROFILE TRÌNH DUYỆT VÀO GOOGLE FLOW
echo ================================================================
echo Đang mở 4 Profile Chrome vào trang Google Flow...
py -3.12 launch_all_flow.py
if %ERRORLEVEL% NEQ 0 (
    python launch_all_flow.py
)
echo.
echo ================================================================
echo 👉 Kiểm tra các cửa sổ Chrome vừa mở. Đăng nhập tài khoản Google.
echo ================================================================
pause

