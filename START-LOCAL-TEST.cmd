@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js version 20 or later from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\nodemailer\package.json" (
  echo Installing website dependencies. Internet access is needed for this first step.
  call npm ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    echo Dependencies could not be installed.
    pause
    exit /b 1
  )
)
call npm run dev:test
pause
