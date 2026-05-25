@echo off
setlocal
cd /d %~dp0

echo [pic_video_0515] starting backend on :18765 ...
start "pic_video_0515 backend" cmd /k "cd backend && (if not exist .venv python -m venv .venv) && call .venv\Scripts\activate && pip install -q -r requirements.txt && python main.py"

echo [pic_video_0515] starting frontend on :5173 ...
start "pic_video_0515 frontend" cmd /k "cd frontend && (if not exist node_modules npm install) && npm run dev"

echo Both services launched in separate windows.
endlocal
