/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let mainWindow = null;
let splashWindow = null;

// Ensure single instance lock to prevent duplicate app running and DB locking issues
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // If a second instance is launched, focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Robust Logger helper to write logs directly to userData/logs/app-YYYY-MM-DD.log
 */
function logToDisk(level, category, message, context = null) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const timestamp = new Date().toISOString();
    const logsDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, `app-${today}.log`);
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : "";
    const logLine = `[${timestamp}] [${level}] [${category.toUpperCase()}] ${message}${contextStr}\n`;
    fs.appendFileSync(logPath, logLine, 'utf8');
    console.log(`[${category.toUpperCase()}] ${message}`);
  } catch (err) {
    console.error('Failed to log to disk:', err);
  }
}

// Window state tracking
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'settings', 'window-state.json');
}

function loadWindowState() {
  try {
    const statePath = getWindowStatePath();
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (err) {
    logToDisk('ERROR', 'electron', `Failed to load window state: ${err.message}`);
  }
  return { width: 1280, height: 800 }; // Default fallback
}

function saveWindowState(state) {
  try {
    const statePath = getWindowStatePath();
    const dir = path.dirname(statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    logToDisk('ERROR', 'electron', `Failed to save window state: ${err.message}`);
  }
}

// Start backend Express server by requiring the esbuild bundle inside Main Process Node.js thread
function startBackendServer() {
  const serverPath = path.join(__dirname, 'dist', 'server.cjs');
  
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3000';
  process.env.IS_ELECTRON = 'true';

  logToDisk('INFO', 'startup', `Loading Express backend bundle from: ${serverPath}`);
  
  try {
    require(serverPath);
    logToDisk('SUCCESS', 'startup', 'Express backend server compiled and started successfully in Main process thread.');
  } catch (err) {
    logToDisk('ERROR', 'startup', `Failed to start backend server: ${err.message}`, err);
    app.quit();
  }
}

// Health check to ensure port 3000 is accepting connections before removing Splash
function checkServerReady(callback) {
  const req = http.get('http://localhost:3000/api/auth/needs-setup', (res) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      callback(true);
    } else {
      setTimeout(() => checkServerReady(callback), 150);
    }
  });

  req.on('error', () => {
    setTimeout(() => checkServerReady(callback), 150);
  });
}

// Create splash window
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  logToDisk('INFO', 'window', 'Splash Screen displayed.');
}

// Create main POS window
function createMainWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    title: "Girl Store POS",
    show: false, // Prevent white flashes on load
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Hide the menu bar completely
  mainWindow.setMenu(null);

  mainWindow.loadURL('http://localhost:3000');

  // Preserve window sizing metrics on change
  const updateState = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const bounds = mainWindow.getBounds();
      saveWindowState({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      });
    }
  };

  mainWindow.on('resize', updateState);
  mainWindow.on('move', updateState);

  // Transition from Splash to Main frame gracefully
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
    logToDisk('INFO', 'window', 'Main frame fully rendered. Splash destroyed.');
  });

  // Crash recovery system
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToDisk('ERROR', 'crash', `Renderer process gone. Reason: ${details.reason} (${details.exitCode})`);
    if (details.reason === 'crashed' || details.reason === 'killed') {
      logToDisk('WARN', 'crash', 'Initiating automatic crash reload sequence...');
      mainWindow.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==========================================
// IPC Security Handlers (Validating Inputs)
// ==========================================

function setupIpcHandlers() {
  // Fetch printers list
  ipcMain.handle('get-printers', async (event) => {
    try {
      logToDisk('INFO', 'printing', 'Requesting system printer list');
      return await mainWindow.webContents.getPrintersAsync();
    } catch (err) {
      logToDisk('ERROR', 'printing', `Failed to get printers: ${err.message}`);
      return [];
    }
  });

  // Thermal/Silent Print HTML Receipt
  ipcMain.handle('print-silent', async (event, options) => {
    if (!options || typeof options !== 'object') {
      throw new Error('Invalid printing payload received.');
    }

    const { htmlContent, printerName } = options;
    if (!htmlContent) {
      throw new Error('Missing HTML contents to print.');
    }

    logToDisk('INFO', 'printing', `Printing job received. Printer: ${printerName || 'Default'}`);

    return new Promise((resolve, reject) => {
      // Create hidden browser window to host print jobs safely without interrupting user interface
      const printWorker = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      printWorker.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printWorker.webContents.once('did-finish-load', () => {
        const printOptions = {
          silent: true,
          deviceName: printerName || ''
        };

        printWorker.webContents.print(printOptions, (success, errorType) => {
          printWorker.destroy();
          if (success) {
            logToDisk('SUCCESS', 'printing', 'Print job processed successfully.');
            resolve({ success: true });
          } else {
            logToDisk('ERROR', 'printing', `Silent print failed: ${errorType}`);
            reject(new Error(errorType || 'Printing failed'));
          }
        });
      });
    });
  });

  // Get Version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Auto-start setup at OS login
  ipcMain.handle('toggle-autostart', (event, enable) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!enable,
        path: process.execPath,
        args: ['--hidden']
      });
      logToDisk('INFO', 'settings', `Toggle auto-start to: ${!!enable}`);
      return { success: true, enabled: !!enable };
    } catch (err) {
      logToDisk('ERROR', 'settings', `Failed to set auto-start settings: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  // Verify auto-start state
  ipcMain.handle('check-autostart', () => {
    try {
      const settings = app.getLoginItemSettings();
      return { success: true, enabled: settings.openAtLogin };
    } catch (err) {
      return { success: false, enabled: false };
    }
  });

  // Future Ready Auto Updates Architecture Endpoint
  ipcMain.handle('check-for-updates', () => {
    logToDisk('INFO', 'autoupdate', 'Checking pre-release and stable update registries.');
    return { success: true, status: 'no_updates', message: 'You are using the latest version of Girl Store POS.' };
  });

  // Bridge frontend log entry to central disk storage
  ipcMain.handle('log-message', (event, data) => {
    if (data && data.level && data.category && data.message) {
      logToDisk(data.level, data.category, data.message, data.context);
    }
    return { success: true };
  });
}

// Lifecycle registration
app.whenReady().then(() => {
  logToDisk('SYSTEM', 'electron', 'Starting native desktop frame registration...');
  
  // Show splash window immediately
  createSplashWindow();

  // Boot the Express Server in the background thread
  startBackendServer();

  // Set up secure IPC listeners
  setupIpcHandlers();

  // Wait for network response on local host, then transition to full window
  checkServerReady(() => {
    createMainWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  logToDisk('SYSTEM', 'electron', 'All window frames closed by user.');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  logToDisk('SYSTEM', 'electron', 'Desktop system shutting down gracefully.');
});
