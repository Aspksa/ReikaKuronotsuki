@echo off
rem Reika Kuronotsuki launcher. Keep this file ASCII-only: cmd.exe misreads non-ASCII text in .bat files.
setlocal
chcp 65001 >nul
title Reika Kuronotsuki
cd /d "%~dp0"

echo Reika Kuronotsuki: checking and running tests...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\start.ps1" -Step check
if errorlevel 1 (
  echo.
  echo Launch cancelled: see the errors above.
  pause
  exit /b 1
)

rem Tests passed: start the server and the tray icon in a hidden window, then close this one.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launcher\start.ps1" -Step run
exit /b 0
