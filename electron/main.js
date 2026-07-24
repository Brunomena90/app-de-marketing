import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupAIManager } from './aiManager.js';
import { autoUpdater } from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure app only runs one instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true, // Hides the standard File Edit View menus
      icon: path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/pwa-512x512.png' : '../dist/pwa-512x512.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Development vs Production
    const isDev = process.env.VITE_DEV_SERVER_URL;
    
    if (isDev) {
      mainWindow.loadURL(isDev);
      // mainWindow.webContents.openDevTools(); // Optional: open devtools in dev mode
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show gracefully once ready to prevent flickering
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Make external links open in the user's default browser instead of the Electron window
    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    setupAIManager(mainWindow);
  }

  app.whenReady().then(() => {
    createWindow();
    ipcMain.handle('openFloatingWindow', (event, route) => {
      const isDev = process.env.VITE_DEV_SERVER_URL;
      const floatingWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, isDev ? '../public/pwa-512x512.png' : '../dist/pwa-512x512.png'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      });

      if (isDev) {
        floatingWindow.loadURL(`${isDev}#${route || '/'}`);
      } else {
        floatingWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: route || '/' });
      }

      floatingWindow.once('ready-to-show', () => {
        floatingWindow.show();
      });

      floatingWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: 'deny' };
      });
    });

    // Custom Folder Selection and File Saving
    ipcMain.handle('dialog:selectFolder', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      return result;
    });

    ipcMain.handle('fs:saveFile', async (event, { buffer, folderPath, fileName }) => {
      try {
        const fullPath = path.join(folderPath, fileName);
        fs.writeFileSync(fullPath, Buffer.from(buffer));
        return { success: true, path: fullPath };
      } catch (error) {
        console.error('Error saving file via IPC:', error);
        return { success: false, error: error.message };
      }
    });

    // Configurar Auto Updater
    autoUpdater.autoDownload = false;
    
    // Si estás en desarrollo, autoUpdater arrojará error si no hay un dev-app-update.yml.
    // Podemos evitar fallos feos configurando loggers o ignorando en dev
    // autoUpdater.logger = require('electron-log');
    // autoUpdater.logger.transports.file.level = 'info';

    ipcMain.handle('updater:check', () => {
      if (process.env.VITE_DEV_SERVER_URL) {
         // Simular en desarrollo
         setTimeout(() => mainWindow.webContents.send('updater:event', 'update-available', { version: 'Dev Test' }), 1000);
      } else {
         autoUpdater.checkForUpdates().catch(err => {
             mainWindow.webContents.send('updater:event', 'error', err.message);
         });
      }
    });

    ipcMain.handle('updater:download', () => {
      if (process.env.VITE_DEV_SERVER_URL) {
         let prog = 0;
         const interval = setInterval(() => {
             prog += 20;
             mainWindow.webContents.send('updater:event', 'download-progress', { percent: prog, bytesPerSecond: 1048576 });
             if (prog >= 100) {
                 clearInterval(interval);
                 mainWindow.webContents.send('updater:event', 'update-downloaded');
             }
         }, 1000);
      } else {
         autoUpdater.downloadUpdate().catch(err => {
             mainWindow.webContents.send('updater:event', 'error', err.message);
         });
      }
    });

    ipcMain.handle('updater:quitAndInstall', () => {
      if (process.env.VITE_DEV_SERVER_URL) {
          console.log('Quitting and installing...');
          app.quit();
      } else {
          autoUpdater.quitAndInstall();
      }
    });

    autoUpdater.on('update-available', (info) => {
      if (mainWindow) mainWindow.webContents.send('updater:event', 'update-available', info);
    });
    autoUpdater.on('update-not-available', (info) => {
      if (mainWindow) mainWindow.webContents.send('updater:event', 'update-not-available', info);
    });
    autoUpdater.on('download-progress', (progressObj) => {
      if (mainWindow) mainWindow.webContents.send('updater:event', 'download-progress', progressObj);
    });
    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow) mainWindow.webContents.send('updater:event', 'update-downloaded', info);
    });
    autoUpdater.on('error', (err) => {
      if (mainWindow) mainWindow.webContents.send('updater:event', 'error', err == null ? "unknown" : (err.stack || err).toString());
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
