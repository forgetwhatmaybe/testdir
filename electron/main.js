/* eslint-disable */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
const BACKEND_PORT = 18765;
const FRONTEND_DEV_URL = 'http://localhost:5173';

let mainWindow = null;
let backendProcess = null;

function getBackendDir() {
  return isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(process.resourcesPath, 'backend');
}

function getPythonExecutable() {
  // 优先使用项目内 .venv
  const venv = isDev
    ? path.join(__dirname, '..', 'backend', '.venv', 'Scripts', 'python.exe')
    : path.join(process.resourcesPath, 'backend', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venv)) return venv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function waitForBackend(maxMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (Date.now() - start > maxMs) reject(new Error('backend timeout'));
        else setTimeout(tick, 300);
      });
      req.on('error', () => {
        if (Date.now() - start > maxMs) reject(new Error('backend timeout'));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

function startBackend() {
  const py = getPythonExecutable();
  const dir = getBackendDir();
  console.log('[electron] starting backend:', py, 'in', dir);
  backendProcess = spawn(py, ['main.py'], {
    cwd: dir,
    env: { ...process.env, PIC_VIDEO_PORT: String(BACKEND_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  backendProcess.stderr.on('data', (d) => process.stderr.write(`[backend] ${d}`));
  backendProcess.on('exit', (code) => console.log('[backend] exited', code));
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    try { backendProcess.kill(); } catch {}
    backendProcess = null;
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(FRONTEND_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  startBackend();
  try {
    await waitForBackend();
  } catch (e) {
    dialog.showErrorBox('启动失败', '后端服务无法启动，请检查 Python 环境与 backend/requirements.txt 是否安装。');
  }
  await createWindow();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', stopBackend);
process.on('exit', stopBackend);
process.on('SIGINT', () => { stopBackend(); process.exit(0); });
