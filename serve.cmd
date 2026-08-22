@echo off
REM Double-click this to launch KLORA + a public tunnel (keeps running until you close the windows).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
