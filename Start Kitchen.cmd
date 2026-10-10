@echo off
setlocal
cd /d "%~dp0"
if not exist "client\node_modules" (
  call npm.cmd --prefix client ci
  if errorlevel 1 goto failed
)
call npm.cmd --prefix client run build
if errorlevel 1 goto failed
echo.
echo Open http://127.0.0.1:5080 after the server starts.
echo Keep this window open. Press Ctrl+C to stop the kitchen.
dotnet run --project server
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo The kitchen could not start. See the error above.
pause
exit /b 1
