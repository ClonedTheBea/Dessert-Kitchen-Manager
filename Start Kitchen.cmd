@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Serve-Kitchen.ps1"
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo The kitchen could not start. See the error above.
pause
exit /b 1
