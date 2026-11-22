@echo off
chcp 65001 >nul
title Quản Lý Profile Chrome & Proxy (VideoStudio)
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
echo       QUẢN LÝ PROFILE TRÌNH DUYỆT & PROXY
echo ========================================================
echo Đang mở cửa sổ quản lý...
%PY_CMD% QuanLyProfile.py
