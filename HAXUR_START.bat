@echo off
title HAXUR LIVE GAMES AUTOSTART
color 0B
cd /d "%~dp0"

echo ================================
echo      HAXUR LIVE GAMES
echo ================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js nincs telepitve.
  echo Toltsd le: https://nodejs.org
  pause
  exit /b
)

if not exist node_modules (
  echo Elso inditas, csomagok telepitese...
  npm install
)

echo Szerver indul...
node server.js
pause
