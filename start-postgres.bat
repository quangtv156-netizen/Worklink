@echo off
title Khoi dong PostgreSQL Container (Docker)
cd /d "%~dp0"

echo ========================================================
echo   KHOI DONG CO SO DU LIEU POSTGRESQL 16 (DOCKER)
echo ========================================================
echo.

docker compose up -d postgres

if %errorlevel% neq 0 (
  echo.
  echo [CANH BAO] Khong the khoi dong Docker.
  echo Hay chac chan rang ung dung Docker Desktop da duoc bat len!
  echo.
  pause
) else (
  echo.
  echo ========================================================
  echo  [THANH CONG] PostgreSQL da san sang tai localhost:5432!
  echo ========================================================
  timeout /t 3
)
