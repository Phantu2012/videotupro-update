@echo off
chcp 65001 >nul
title Mo 4 Profile Trinh Duyet - Dang Nhap Muse.ai
cd /d "%~dp0"
echo ================================================================
echo           MỞ 4 PROFILE TRÌNH DUYỆT VÀO MUSE.AI
echo ================================================================
echo Đang mở 4 Profile Chrome vào trang Muse.ai...
py -3.12 launch_all_muse.py
if %ERRORLEVEL% NEQ 0 (
    python launch_all_muse.py
)
echo.
echo ================================================================
echo 👉 Kiểm tra các cửa sổ Chrome vừa mở. Đăng nhập tài khoản Muse.ai.
echo Sau khi đăng nhập xong, bạn có thể tạo video tự động!
echo ================================================================
pause

