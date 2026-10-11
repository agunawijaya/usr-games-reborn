@echo off
rem Starts the Hall on http://localhost:5173 and opens it in the default browser.
rem Every game, native or hosted, is played from the Hall. Close this window or press Ctrl+C to stop.
rem Kept free of labels and goto: .gitattributes checks it out with LF endings, which trips cmd's label search.

setlocal
cd /d "%~dp0"
title /usr/games Reborn
set "HALL_URL=http://localhost:5173/"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or newer is needed. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm is needed. Install it with: npm install -g pnpm
  pause
  exit /b 1
)

rem A server already listening on the port means the Hall is up; just show it.
netstat -ano | findstr "LISTENING" | findstr ":5173 " >nul
if not errorlevel 1 (
  echo The Hall is already running. Opening %HALL_URL%
  start "" "%HALL_URL%"
  exit /b 0
)

if not exist "node_modules\" (
  echo First run: installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo Installing dependencies failed; see the messages above.
    pause
    exit /b 1
  )
)

echo Starting the Hall at %HALL_URL%
echo The browser opens by itself once the server is ready. Close this window to stop playing.
echo.
call pnpm dev --open
if errorlevel 1 pause
