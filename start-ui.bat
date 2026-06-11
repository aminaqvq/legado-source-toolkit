@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

cd /d "%~dp0"

title Legado Source Toolkit GUI

echo ========================================
echo   Legado Source Toolkit GUI
echo ========================================
echo.

:: ── Check Node.js ──
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 20+ from:
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%

:: ── Check pnpm ──
where pnpm >nul 2>nul
if errorlevel 1 (
    echo [INFO] pnpm not found. Trying to enable Corepack...
    corepack enable >nul 2>nul
)
where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm not found. Please install pnpm:
    echo   npm install -g pnpm
    echo   or enable Corepack: corepack enable
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('pnpm -v') do set PNPM_VER=%%v
echo [OK] pnpm %PNPM_VER%

:: ── Check node_modules ──
if not exist "node_modules\" (
    echo.
    echo [INFO] Dependencies not installed (node_modules not found).
    echo.
    set /p INSTALL_DEPS=Install dependencies now? [Y/N]:
    if /i "!INSTALL_DEPS!"=="Y" (
        echo.
        echo [INFO] Installing dependencies...
        call pnpm install
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

:: ── Start GUI ──
echo.
echo [INFO] Starting GUI...
echo [INFO] Backend API: http://127.0.0.1:5178
echo [INFO] API Health:  http://127.0.0.1:5178/api/health
echo.
echo       Opening browser in a few seconds...
echo       Keep this window open while using the tool.
echo.

:: Delay before opening browser (allow server to boot)
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:5178

:: Launch the server (foreground — blocks here)
call pnpm gui

:: If server stops, pause so user sees the output
echo.
echo [INFO] Server has stopped.
pause
