const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    checkHardware: () => ipcRenderer.invoke('ai:checkHardware'),
    downloadModel: (modelId) => ipcRenderer.invoke('ai:downloadModel', modelId),
    onDownloadProgress: (callback) => {
        const listener = (event, data) => callback(data);
        ipcRenderer.on('ai:downloadProgress', listener);
        return () => ipcRenderer.removeListener('ai:downloadProgress', listener); // return cleanup function
    },
    startModel: (modelId) => ipcRenderer.invoke('ai:startModel', modelId),
    stopModel: () => ipcRenderer.invoke('ai:stopModel'),
    searchWeb: (query) => ipcRenderer.invoke('ai:searchWeb', query),
    searchMaps: (query) => ipcRenderer.invoke('ai:searchMaps', query),
    getModelStatus: (modelId) => ipcRenderer.invoke('ai:getModelStatus', modelId),
    onModelLog: (callback) => {
        const listener = (event, log) => callback(log);
        ipcRenderer.on('ai:modelLog', listener);
        return () => ipcRenderer.removeListener('ai:modelLog', listener);
    },
    openFloatingWindow: (route) => ipcRenderer.invoke('openFloatingWindow', route),
    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
    onUpdaterEvent: (callback) => {
        const listener = (event, eventName, data) => callback(eventName, data);
        ipcRenderer.on('updater:event', listener);
        return () => ipcRenderer.removeListener('updater:event', listener);
    }
});
