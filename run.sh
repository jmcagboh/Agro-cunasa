#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r backend/requirements.txt
if [[ ! -f .env ]]; then cp .env.example .env; fi
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 &
api_pid=$!
cd frontend
if [[ ! -d node_modules ]]; then npm install; fi
npm run dev -- --host 127.0.0.1 --port 5173 &
web_pid=$!
echo "RotaSol : http://localhost:5173"
echo "API     : http://localhost:8000/docs"
trap 'kill $api_pid $web_pid' INT TERM
wait
