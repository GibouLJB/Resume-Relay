@echo off
setlocal
chcp 65001 >nul
where.exe node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 22+ is required. Install it from https://nodejs.org/ and reopen this launcher.
  pause
  exit /b 1
)
node.exe "%~dp0plugins\codex-resume\runtime\cli.mjs" %*
set "RESUME_EXIT=%ERRORLEVEL%"
if "%~1"=="" pause
exit /b %RESUME_EXIT%
