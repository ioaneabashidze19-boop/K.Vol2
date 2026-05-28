@echo off
title KavShare Launcher
echo ========================================================
echo   KavShare - Starting Development Environment
echo ========================================================
echo.
echo 1. Opening default web browser at http://localhost:3000...
start http://localhost:3000
echo.
echo 2. Launching Next.js development server...
echo.
npm run dev
pause
