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
node server.js
pause
