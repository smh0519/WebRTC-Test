@echo off
title WebRTC-Test Controller
echo ==========================================
echo Starting WebRTC-Test (Next.js Only)
echo ==========================================

echo [1/3] Starting LiveKit Server (Docker)...
docker compose up -d livekit

echo [2/3] Waiting 5 seconds for LiveKit...
timeout /t 5 >nul

echo [3/3] Starting Frontend (Next.js)...
echo Chrome will open automatically in 5 seconds.

REM Launch Chrome in a separate non-blocking process
start "" cmd /c "timeout /t 5 >nul && start chrome http://localhost:3000"

cd frontend
npm run dev
