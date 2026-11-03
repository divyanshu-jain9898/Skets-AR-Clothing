@echo off
setlocal
title Vastra AR
cd /d "%~dp0"
echo.
echo   Vastra AR - virtual try-on for Indian wear
echo.

rem 1) Prebuilt site: serve it with the built-in PowerShell server (nothing to install)
if exist "dist\index.html" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve.ps1" -Root "%~dp0dist" -Port 5173
  if not errorlevel 1 goto :eof
  echo   The PowerShell server could not start. Trying Node.js instead...
)

rem 2) Fallback / development: run the Vite dev server (needs Node.js 20+)
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js was not found. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo   Installing dependencies - first run only, this takes a minute...
  call npm install
)
call npx vite --port 5173 --open
pause
