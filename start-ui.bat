@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

title Legado Source Toolkit Dev Launcher

echo ========================================
echo   Legado Source Toolkit Dev Launcher
echo ========================================
echo.

rem Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 20+.
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node.js %NODE_VER%

rem Check pnpm.cmd
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
    echo [INFO] pnpm.cmd not found. Trying to enable Corepack...
    call corepack enable >nul 2>nul
)

where pnpm.cmd >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm.cmd not found.
    echo Please install pnpm:
    echo npm install -g pnpm
    echo.
    echo Or enable Corepack:
    echo corepack enable
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('pnpm.cmd -v') do set "PNPM_VER=%%v"
echo [OK] pnpm %PNPM_VER%

rem Check dependencies
if not exist "node_modules\" (
    echo.
    echo [INFO] Dependencies not installed.
    set /p "INSTALL_DEPS=Install dependencies now? [Y/N]: "

    if /i "!INSTALL_DEPS!"=="Y" (
        echo.
        echo [INFO] Installing dependencies...
        call pnpm.cmd install
        if errorlevel 1 (
            echo [ERROR] pnpm install failed.
            pause
            exit /b 1
        )
        echo [OK] Dependencies installed.
    ) else (
        echo [ERROR] Dependencies are required. Please run: pnpm install
        pause
        exit /b 1
    )
)

echo.
echo [INFO] Starting backend API...
echo [INFO] Backend:    http://127.0.0.1:5178
echo [INFO] API Health: http://127.0.0.1:5178/api/health
echo.

start "LS-Toolkit Backend API" cmd /k "cd /d "%~dp0" && pnpm.cmd gui"

echo [INFO] Starting Web UI...
echo [INFO] Web UI:     http://127.0.0.1:5173
echo.

start "LS-Toolkit Web UI" cmd /k "cd /d "%~dp0" && pnpm.cmd web:dev"

echo [INFO] Opening browser...
timeout /t 5 /nobreak >nul
start "" http://127.0.0.1:5173

echo.
echo ========================================
echo   LS-Toolkit started in development mode
echo ========================================
echo.
echo Web UI:     http://127.0.0.1:5173
echo Backend:    http://127.0.0.1:5178
echo API Health: http://127.0.0.1:5178/api/health
echo.
echo Two command windows were opened:
echo - LS-Toolkit Backend API
echo - LS-Toolkit Web UI
echo.
echo Close those windows to stop the services.
echo.
pause
