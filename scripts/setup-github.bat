@echo off
cd /d "%~dp0.."
echo EasyTicketing - GitHub setup
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-github.ps1"
echo.
pause
