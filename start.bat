@echo off
setlocal EnableDelayedExpansion

REM Get script directory (works with Chinese paths)
set "SCRIPT_DIR=%~dp0"
set "PYTHON=C:\Users\Mr.bai\.real\.bin\python-3.12-windows-x64\python.exe"

echo Starting Multi-Agent Security System...
echo Project: %SCRIPT_DIR%
echo.

REM Start Detection Center (Flask) in new window
start "Detection Center" cmd /k "%PYTHON% "%SCRIPT_DIR%backend\detection_center.py""

timeout /t 2 /nobreak >nul

REM Start Agent Registry (FastAPI) in new window
start "Agent Registry" cmd /k "%PYTHON% "%SCRIPT_DIR%backend\agent_registry.py""

timeout /t 2 /nobreak >nul

REM Start Frontend (React) in new window
start "Frontend" cmd /k "cd /d "%SCRIPT_DIR%frontend" && npm start"

echo.
echo All services starting...
echo - Detection Center: http://localhost:5000
echo - Agent Registry:   http://localhost:8000
echo - Frontend:         http://localhost:3000
echo.
echo Check the three new windows for service logs.
pause
