@echo off
chcp 65001 >nul
echo Dang tat Server VideoStudio tren cong 8765...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo Da tat tien trinh PID %%a.
)
echo Hoan tat!
timeout /t 2 >nul
