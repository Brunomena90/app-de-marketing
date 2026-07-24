import localforage from 'localforage';

// Configuración de la instancia principal para la Media Suite
export const mediaStore = localforage.createInstance({
    name: 'ArtoriesMediaSuite',
    storeName: 'assets', // Tablas para guardar los Blobs/Files
    description: 'Almacenamiento local para los assets multimedia sin necesidad de backend'
});

// Funciones de utilidad para manejar los assets
export const saveAsset = async (key, blobOrFile) => {
    try {
        await mediaStore.setItem(key, blobOrFile);
        
        if (window.electronAPI && window.electronAPI.isElectron) {
            const exportPath = localStorage.getItem('exportFolderPath');
            if (exportPath) {
                const arrayBuffer = await blobOrFile.arrayBuffer();
                await window.electronAPI.saveFileToDisk({
                    buffer: arrayBuffer,
                    folderPath: exportPath,
                    fileName: key
                });
            }
        } else {
            const url = URL.createObjectURL(blobOrFile);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = key;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
        }

        return true;
    } catch (err) {
        console.error('Error guardando asset:', err);
        return false;
    }
};

export const getAsset = async (key) => {
    try {
        return await mediaStore.getItem(key);
    } catch (err) {
        console.error('Error obteniendo asset:', err);
        return null;
    }
};

export const removeAsset = async (key) => {
    try {
        await mediaStore.removeItem(key);
        return true;
    } catch (err) {
        console.error('Error eliminando asset:', err);
        return false;
    }
};

export const getAllAssets = async () => {
    try {
        const keys = await mediaStore.keys();
        const assets = await Promise.all(keys.map(async (key) => {
            const file = await mediaStore.getItem(key);
            return { key, file };
        }));
        return assets;
    } catch (err) {
        console.error('Error obteniendo todos los assets:', err);
        return [];
    }
};
