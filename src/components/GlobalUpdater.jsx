import React, { useState, useEffect, useRef } from 'react';
import { DownloadCloud, Check } from 'lucide-react';
import { toast } from 'sonner';

const GlobalUpdater = () => {
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isElectron, setIsElectron] = useState(false);
    const checkedRef = useRef(false);

    useEffect(() => {
        if (!window.electronAPI?.isElectron || !window.electronAPI.onUpdaterEvent) return;
        setIsElectron(true);

        // Auto-check on startup (only once)
        if (!checkedRef.current) {
            checkedRef.current = true;
            setTimeout(() => {
                window.electronAPI.checkForUpdates();
            }, 5000); // 5 seconds after app opens
        }

        const unsubscribe = window.electronAPI.onUpdaterEvent((eventName, data) => {
            switch(eventName) {
                case 'update-available':
                    setUpdateStatus('available');
                    toast.info('Actualización Disponible', { description: 'Hay una nueva versión de la app de escritorio lista para instalar.' });
                    break;
                case 'update-not-available':
                    // We only want to show this if manually checked, but since it's global, 
                    // we'll just quietly set to idle if it was auto-checking.
                    setUpdateStatus(prev => {
                        if (prev === 'checking') {
                            toast.success('Software Actualizado', { description: 'Tienes la última versión de la aplicación instalada.' });
                        }
                        return 'idle';
                    });
                    break;
                case 'download-progress':
                    setUpdateStatus('downloading');
                    if (data?.percent) {
                        setDownloadProgress(Math.round(data.percent));
                    }
                    break;
                case 'update-downloaded':
                    setUpdateStatus('downloaded');
                    toast.success('Descarga Completa', { description: 'La actualización está lista para ser instalada.' });
                    break;
                case 'error':
                    console.error('Error de actualización:', data);
                    setUpdateStatus(prev => {
                        // Solo mostramos error si fue iniciado manualmente (status checking)
                        if (prev === 'checking' || prev === 'downloading') {
                            toast.error('Error al actualizar', { description: typeof data === 'string' ? data : JSON.stringify(data) });
                        }
                        return 'idle';
                    });
                    break;
                default:
                    break;
            }
        });

        // Listen for manual check trigger from anywhere (like AppCenter)
        const handleManualCheck = () => {
            setUpdateStatus('checking');
            toast('Buscando actualizaciones...', { description: 'Comprobando si existe una nueva versión de la aplicación...' });
            window.electronAPI.checkForUpdates();
        };

        window.addEventListener('trigger-update-check', handleManualCheck);

        return () => {
            unsubscribe();
            window.removeEventListener('trigger-update-check', handleManualCheck);
        };
    }, []);

    const handleDownloadUpdate = () => {
        if (!window.electronAPI?.isElectron) return;
        setUpdateStatus('downloading');
        setDownloadProgress(0);
        window.electronAPI.downloadUpdate();
    };

    const handleInstallUpdate = () => {
        if (!window.electronAPI?.isElectron) return;
        window.electronAPI.quitAndInstall();
    };

    if (!isElectron) return null;

    if (updateStatus === 'idle' || updateStatus === 'checking') return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                    <DownloadCloud size={32} />
                </div>
                
                {updateStatus === 'available' && (
                    <>
                        <h3 className="text-xl font-bold text-white mb-2">¡Nueva actualización disponible!</h3>
                        <p className="text-gray-400 text-sm mb-6">Hemos lanzado una nueva versión del software. ¿Deseas descargar e instalarla ahora?</p>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setUpdateStatus('idle')} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium">Más tarde</button>
                            <button onClick={handleDownloadUpdate} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-indigo-500/20">Descargar</button>
                        </div>
                    </>
                )}
                
                {updateStatus === 'downloading' && (
                    <>
                        <h3 className="text-xl font-bold text-white mb-2">Descargando actualización...</h3>
                        <p className="text-gray-400 text-sm mb-6">Por favor, espera mientras preparamos la nueva versión.</p>
                        <div className="w-full bg-black/50 rounded-full h-3 mb-2 border border-white/5 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
                        </div>
                        <span className="text-xs text-indigo-400 font-bold">{downloadProgress}%</span>
                    </>
                )}

                {updateStatus === 'downloaded' && (
                    <>
                        <h3 className="text-xl font-bold text-white mb-2">¡Descarga completada!</h3>
                        <p className="text-gray-400 text-sm mb-6">La nueva versión está lista para instalarse. La aplicación se reiniciará automáticamente.</p>
                        <button onClick={handleInstallUpdate} className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-green-500/20 flex items-center justify-center gap-2">
                            <Check size={18} /> Instalar y Reiniciar
                        </button>
                        <button onClick={() => setUpdateStatus('idle')} className="w-full mt-3 px-4 py-2 text-gray-500 hover:text-white transition-colors text-xs">Instalar la próxima vez que abra la app</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default GlobalUpdater;
