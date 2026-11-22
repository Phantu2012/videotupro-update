@echo off
chcp 65001 >nul
title Cai dat Ban Do Dong - VideoTuPro
cd /d "%~dp0"
echo ================================================================
echo      CAI DAT CHE DO "BAN DO DONG" (Motion Graphics + Countryball)
echo      Chi can chay 1 lan tren moi may. Can ket noi Internet.
echo ================================================================
echo.

set "PY_CMD=python"
where py >nul 2>&1
if errorlevel 1 goto :py_done
set "PY_CMD=py"
py -3.12 --version >nul 2>&1
if errorlevel 1 goto :py_done
set "PY_CMD=py -3.12"
:py_done

echo [1/4] Kiem tra Node.js...
where node >nul 2>&1
if not errorlevel 1 goto :node_ok
if exist "C:\Program Files\nodejs\node.exe" goto :node_path
echo     Chua co Node.js - dang tu cai ban LTS bang winget (vui long cho)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
:node_path
set "PATH=C:\Program Files\nodejs;%PATH%"
where node >nul 2>&1
if not errorlevel 1 goto :node_ok
echo.
echo [LOI] Khong cai duoc Node.js tu dong.
echo       Hay tai ban LTS tai https://nodejs.org , cai dat xong roi chay lai file nay.
pause
exit /b 1
:node_ok
node -v

echo.
echo [2/4] Cai thu vien Python (numpy, scipy, soundfile)...
%PY_CMD% -m pip install numpy scipy soundfile --quiet

echo.
echo [3/4] Cai thu vien Node va trinh duyet Chromium rieng cho bo dung (~200MB)...
cd /d "%~dp0engines\bando"
call npm install --no-audit --no-fund
call npx playwright install chromium
if errorlevel 1 call npx playwright install chromium-headless-shell

echo.
echo [4/4] Tao thu vien nhac nen va hieu ung am thanh (1-3 phut)...
set "PATH=%~dp0ffmpeg;%PATH%"
%PY_CMD% audio\build_audio.py

cd /d "%~dp0"
echo.
echo ================================================================
echo  HOAN TAT! Mo tool, vao 1 video da co kich ban va giong doc,
echo  bam nut "Dung Ban Do Dong" tren thanh cong cu.
echo ================================================================
pause
