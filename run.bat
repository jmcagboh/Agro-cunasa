@echo off
cd /d "%~dp0"
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
pip install -q -r backend\requirements.txt
if not exist .env copy .env.example .env
start "RotaSol API" cmd /c "cd /d %~dp0 && call .venv\Scripts\activate && uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"
cd frontend
if not exist node_modules call npm install
start "RotaSol Web" cmd /c "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1 --port 5173"
echo.
echo RotaSol : http://localhost:5173
echo API    : http://localhost:8000/docs
