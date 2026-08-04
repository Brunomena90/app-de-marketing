import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, execFile } from 'child_process';
import os from 'os';
import { setupAIManager } from './aiManager.js';
import { autoUpdater } from 'electron-updater';
import { readPsd, initializeCanvas } from 'ag-psd';
import { Jimp } from 'jimp';

// Mock Canvas para ag-psd en el backend (solo extrae ImageData)
initializeCanvas(
  () => { throw new Error('Canvas no soportado nativamente en el backend') },
  (width, height) => ({ width, height, data: new Uint8Array(width * height * 4) })
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase V8 Memory limit to 8GB to support huge PSB files
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

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
      title: 'Artories Management Suite (Escritorio)',
      autoHideMenuBar: true, // Hides the standard File Edit View menus
      icon: path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/pwa-512x512.png' : '../dist/pwa-512x512.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    // Prevent the web page <title> from overriding our desktop title
    mainWindow.on('page-title-updated', (evt) => {
      evt.preventDefault();
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

    ipcMain.handle('dialog:selectFile', async (event, options) => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        ...options
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

    // Motor Local PSD (Python)
    ipcMain.handle('fs:processPsdLocally', async (event, filePath) => {
      return new Promise((resolve) => {
        try {
          const tempDir = os.tmpdir();
          
          // La ruta al script de python
          let scriptPath = path.join(__dirname, '../electron/psd_extractor.py');
          if (!fs.existsSync(scriptPath)) {
            // Fallback para producción si el script está en otro lado
            scriptPath = path.join(process.resourcesPath, 'electron', 'psd_extractor.py');
          }
          
          // Ejecutamos Python (asumiendo que 'python' está en el PATH)
          // El script extraerá las imágenes al tempDir y devolverá un JSON
          execFile('python', [scriptPath, filePath, tempDir], { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
              console.error('Python execution error:', error);
              resolve({ success: false, error: error.message || String(stderr) });
              return;
            }
            
            try {
              const result = JSON.parse(stdout.trim());
              
              // Convertir file:/// a DataURL para evitar restricciones de webSecurity de Electron
              if (result.success && result.layers) {
                for (const layer of result.layers) {
                  if (layer.url && layer.url.startsWith('file:///')) {
                    const localPath = layer.url.replace('file:///', '').replace(/\//g, '\\');
                    if (fs.existsSync(localPath)) {
                      const buffer = fs.readFileSync(localPath);
                      layer.url = `data:image/png;base64,${buffer.toString('base64')}`;
                      // Opcional: borrar el archivo temporal
                      fs.unlinkSync(localPath);
                    }
                  }
                }
              }
              
              resolve(result);
            } catch (parseError) {
              console.error('Error parsing Python output:', parseError);
              resolve({ success: false, error: 'Respuesta inválida del motor nativo' });
            }
          });
          
        } catch (error) {
          console.error('Error in PSD handler:', error);
          resolve({ success: false, error: error.message });
        }
      });
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
          autoUpdater.quitAndInstall(true, true);
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
