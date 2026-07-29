@echo off
title TVP Start

cd /d "C:\Users\not31\Desktop\tvp"

if not exist "server\index.js" (
    echo [ERROR] server\index.js was not found.
    pause
    exit /b 1
)

if not exist "C:\cloudflared\cloudflared.exe" (
    echo [ERROR] C:\cloudflared\cloudflared.exe was not found.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found.
    pause
    exit /b 1
)

start "TVP Node Server" cmd /k "cd /d C:\Users\not31\Desktop\tvp && node server\index.js"

timeout /t 2 /nobreak >nul

start "TVP Cloudflare Tunnel" cmd /k "cd /d C:\cloudflared && cloudflared.exe tunnel --url http://localhost:3000"

timeout /t 2 /nobreak >nul

start "" "https://www.tving.com"

exit
