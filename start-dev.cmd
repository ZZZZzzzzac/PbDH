@echo off
setlocal
pushd "%~dp0"

node scripts\restart-dev.mjs
if errorlevel 1 (
  echo.
  echo Development servers failed to start. Check the error above.
  pause
  popd
  exit /b 1
)

start "" "http://localhost:5173"
popd
