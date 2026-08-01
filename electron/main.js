import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import os from 'os';
import { setupAIManager } from './aiManager.js';
import { autoUpdater } from 'electron-updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure app only runs one instance
const gotTheLock = app.requestSingleInstanceLock();
let fileToOpen = null;

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;
  // If mainWindow is already created, send it immediately
  const win = BrowserWindow.getAllWindows()[0];
  if (win && win.webContents) {
    win.webContents.send('external-file-open', filePath);
  }
});

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;
  
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const passedFile = commandLine.find(arg => arg.toLowerCase().endsWith('.pdf'));
      if (passedFile) {
        mainWindow.webContents.send('external-file-open', passedFile);
      }
    }
  });

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

    mainWindow.webContents.on('did-finish-load', () => {
      if (fileToOpen) {
        mainWindow.webContents.send('external-file-open', fileToOpen);
        fileToOpen = null;
      }
    });
  }

  app.whenReady().then(() => {
    // Parse arguments for Windows/Linux on cold start
    if (process.platform !== 'darwin') {
      const args = process.argv.slice(1);
      const passedFile = args.find(arg => arg.toLowerCase().endsWith('.pdf'));
      if (passedFile) {
        fileToOpen = passedFile;
      }
    }

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

    ipcMain.handle('fs:readFile', async (event, filePath) => {
      try {
        const buffer = fs.readFileSync(filePath);
        return { success: true, buffer, name: path.basename(filePath) };
      } catch (error) {
        console.error('Error reading file via IPC:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('fs:convertDocument', async (event, { buffer, fileName, toExt }) => {
      try {
        const tempDir = os.tmpdir();
        const inputPath = path.join(tempDir, `input_${Date.now()}_${fileName}`);
        
        // El comando convert-to usa la extensión como formato de salida
        const format = toExt.replace('.', '');
        const outputFileName = `input_${Date.now()}_${fileName}`.replace(/\.[^/.]+$/, "") + `.${format}`;
        const outputPath = path.join(tempDir, outputFileName);

        fs.writeFileSync(inputPath, Buffer.from(buffer));

        let sofficeCmd = 'soffice';
        if (process.platform === 'win32') {
          sofficeCmd = '"C:\\Program Files\\LibreOffice\\program\\soffice.exe"';
        } else if (process.platform === 'darwin') {
          sofficeCmd = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
        }

        const cmd = `${sofficeCmd} --headless --convert-to ${format} "${inputPath}" --outdir "${tempDir}"`;
        
        return new Promise((resolve) => {
          exec(cmd, (error, stdout, stderr) => {
            try {
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              
              if (error || !fs.existsSync(outputPath)) {
                console.error("LibreOffice Error:", error || stderr);
                resolve({ success: false, error: error?.message || 'Error en conversión local' });
                return;
              }

              const resultBuffer = fs.readFileSync(outputPath);
              fs.unlinkSync(outputPath);
              
              resolve({ success: true, buffer: resultBuffer });
            } catch (e) {
              resolve({ success: false, error: e.message });
            }
          });
        });
      } catch (error) {
        console.error('Error in fs:convertDocument:', error);
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
             const errMsg = err.message.includes('404') 
               ? 'No se encontró la actualización en GitHub (El repositorio podría ser privado o no hay releases publicadas).'
               : err.message;
             mainWindow.webContents.send('updater:event', 'error', errMsg);
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
