@echo off
if not exist .venv (python -m venv .venv)
call .venv\Scripts\activate
pip install -r backend\requirements.txt
if not exist .env copy .env.example .env
uvicorn backend.app.main:app --reload
