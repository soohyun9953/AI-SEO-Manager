@echo off
rem Starts the local backend (port 8002) and frontend (port 3000), then opens the browser.
rem Close the two opened console windows to stop the servers.
setlocal
set "ROOT=%~dp0"

if not exist "%ROOT%frontend\node_modules" (
  echo node_modules not found - running npm install first...
  pushd "%ROOT%frontend"
  call npm install
  popd
)

start "SEO Backend (8002)" cmd /k "cd /d %ROOT%backend && python -m uvicorn main:app --port 8002"
start "SEO Frontend (3000)" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo Waiting for the servers to start...
timeout /t 10 /nobreak >nul
start "" "http://localhost:3000"
endlocal
