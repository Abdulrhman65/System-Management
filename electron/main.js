import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startServer } from '../server/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Performance: Enable V8 code caching for faster subsequent launches
app.commandLine.appendSwitch('js-flags', '--optimize-for-size');
app.commandLine.appendSwitch('enable-features', 'V8VmFuture');

let mainWindow;
let dbInstance = null;
let serverInstance = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    }
  });

  // Show window IMMEDIATELY with a loading screen (no waiting for server)
  mainWindow.loadFile(join(__dirname, 'loading.html')).catch(console.error);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // Start server in parallel while the loading screen is already visible
  const dbPath = join(app.getPath('userData'), 'database.db');

  try {
    const { port, db, server } = await startServer(dbPath, 0);
    dbInstance = db;
    serverInstance = server;

    // Once server is ready, navigate to the actual app (with slight delay to allow loading screen to render)
    setTimeout(() => {
      mainWindow.loadURL(`http://127.0.0.1:${port}`).catch(err => {
        console.error('Failed to load main URL:', err);
        mainWindow.loadFile(join(__dirname, 'error.html'), { query: { msg: err.message } }).catch(console.error);
      });
    }, 1000);
  } catch (err) {
    console.error('Failed to start server:', err);
    mainWindow.loadFile(join(__dirname, 'error.html'), { query: { msg: err.message } }).catch(console.error);
  }
}

// ===== GRACEFUL SHUTDOWN =====
function cleanupAndQuit() {
  // Close the Express server
  if (serverInstance) {
    try { serverInstance.close(); } catch { /* ignore */ }
    serverInstance = null;
  }

  // Close the database safely
  if (dbInstance) {
    try { dbInstance.close(); } catch { /* ignore */ }
    dbInstance = null;
  }
}

// ===== IPC HANDLERS =====
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'اختر مكان حفظ النسخ الاحتياطية'
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  cleanupAndQuit();
});

app.on('window-all-closed', () => {
  cleanupAndQuit();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
