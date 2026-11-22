@echo off
chcp 65001 >nul
title Tat Toan Bo Tool & Trinh Duyet
cd /d "%~dp0"
echo ================================================================
echo               TẮT HỆ THỐNG VIDEOTUPRO & PROFILE
echo ================================================================
echo Đang tắt tiến trình uvicorn và giải phóng các cổng kết nối...
taskkill /F /IM uvicorn.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":58879" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":58880" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":58881" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":58882" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
echo.
echo ✔ ĐÃ TẮT HỆ THỐNG VÀ GIẢI PHÓNG CỔNG THÀNH CÔNG!
echo ================================================================
pause

