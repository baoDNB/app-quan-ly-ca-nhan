@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chưa tìm thấy Node.js trên máy.
  echo Hãy cài Node.js rồi chạy lại tệp này.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Đang cài thư viện lần đầu...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
start "" http://127.0.0.1:4320
call npm run dev
pause
