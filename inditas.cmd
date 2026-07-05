@echo off
cd /d "%~dp0"
echo Magasepito app inditasa...
echo.
npm.cmd run dev -- --host 127.0.0.1 --port 5173
pause
