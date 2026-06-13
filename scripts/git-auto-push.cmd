@echo off
REM Auto-push commits to GitHub after each local commit (Windows).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0git-auto-push.ps1"
