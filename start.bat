@echo off
title WorkLink Fullstack Launcher (PostgreSQL)
cd /d "%~dp0"

echo ========================================================
echo        KHOI DONG HE THONG WORKLINK (POSTGRESQL)
echo ========================================================
echo Thu muc du an: %CD%
echo.

echo [1/2] Dang khoi dong Backend API Server (Port 5000)...
start "WorkLink Backend Server (Port 5000)" cmd /k "npm.cmd run server"

echo [2/2] Dang khoi dong Frontend Vite React (Port 5173)...
start "WorkLink Frontend App (Port 5173)" cmd /k "npm.cmd run dev"

ping 127.0.0.1 -n 5 >nul
echo.
echo ========================================================
echo   HE THONG DA SAN SANG!
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:5000
echo ========================================================
start http://localhost:5173
