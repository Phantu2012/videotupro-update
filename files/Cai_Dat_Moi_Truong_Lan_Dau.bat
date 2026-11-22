@echo off
chcp 65001 >nul
title Cai Dat Thu Vien Cho VideoTuPro (Chay 1 lan duy nhat)
cd /d "%~dp0"
echo ================================================================
echo      CÀI ĐẶT THƯ VIỆN CHO VIDEOTUPRO (CHẠY 1 LẦN DUY NHẤT)
echo ================================================================
echo Yêu cầu: Máy tính đã cài Python 3.10, 3.11 hoặc 3.12 (tích chọn Add Python to PATH).
echo.
echo Đang cài đặt các thư viện cần thiết từ requirements.txt...
py -3.12 -m pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    python -m pip install -r requirements.txt
)
echo.
echo ================================================================
echo ✔ CÀI ĐẶT MÔI TRƯỜNG THÀNH CÔNG!
echo Bây giờ bạn có thể nhấp đúp vào:
echo  1. [2_Dang_Nhap_Muse_Ai.bat] để đăng nhập tài khoản làm video.
echo  2. [1_Bat_Dau_Chay_Videotupro.bat] để bắt đầu làm việc.
echo ================================================================
pause

