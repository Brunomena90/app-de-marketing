import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Video, Music, PenTool, LayoutTemplate, ArrowRight, ArrowLeft, HardDrive, Trash2, FolderOpen, FileText } from 'lucide-react';
import { getAllAssets, removeAsset } from '../../lib/mediaStore';
import { toast } from 'sonner';

export default function MediaHub() {
    const navigate = useNavigate();
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportFolder, setExportFolder] = useState(localStorage.getItem('exportFolderPath') || '');

    const handleSelectFolder = async () => {
        if (window.electronAPI && window.electronAPI.selectFolder) {
            const result = await window.electronAPI.selectFolder();
            if (result && !result.canceled && result.filePaths.length > 0) {
                const path = result.filePaths[0];
                setExportFolder(path);
                localStorage.setItem('exportFolderPath', path);
            }
        }
    };

    const loadAssets = async () => {
        setLoading(true);
        const savedAssets = await getAllAssets();
        setAssets(savedAssets);
        setLoading(false);
    };

    useEffect(() => {
        loadAssets();
    }, []);

    const handleDeleteAsset = async (key) => {
        const success = await removeAsset(key);
        if (success) {
            toast.success('Asset eliminado');
            loadAssets();
        } else {
            toast.error('Error al eliminar asset');
        }
    };

    const modules = [
        {
            title: 'Editor de Fotos',
            description: 'Retoque de color, exposición y filtros estilo Lightroom.',
            icon: Image,
            color: 'text-blue-400',
            bg: 'bg-blue-400/10',
            border: 'border-blue-400/20',
            route: '/media-suite/photo',
        },
        {
            title: 'Diseñador Gráfico',
            description: 'Capas, textos y composiciones estilo Photoshop.',
            icon: PenTool,
            color: 'text-fuchsia-400',
            bg: 'bg-fuchsia-400/10',
            border: 'border-fuchsia-400/20',
            route: '/media-suite/design',
        },
        {
            title: 'Editor de Audio',
            description: 'Cortes, pistas y ecualización estilo Audition.',
            icon: Music,
            color: 'text-emerald-400',
            bg: 'bg-emerald-400/10',
            border: 'border-emerald-400/20',
            route: '/media-suite/audio',
        },
        {
            title: 'Editor de Video',
            description: 'Línea de tiempo y renderizado local estilo CapCut.',
            icon: Video,
            color: 'text-amber-400',
            bg: 'bg-amber-400/10',
            border: 'border-amber-400/20',
            route: '/media-suite/video',
        },
        {
            title: 'Editor de PDF',
            description: 'Visualiza, anota, firma y manipula páginas estilo Acrobat.',
            icon: FileText,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/20',
            route: '/media-suite/pdf',
        }
    ];

    return (
        <div className="min-h-full w-full bg-[#0a0a0a] text-zinc-300 p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <button 
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-fit text-sm font-medium bg-zinc-900/50 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Centro de Módulos
                    </button>
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <LayoutTemplate className="w-8 h-8 text-violet-500" />
                            Suite Multimedia Local
                        </h1>
                        <p className="text-zinc-400 max-w-2xl">
                            Tus proyectos se procesan y almacenan 100% en tu dispositivo, sin depender de servidores.
                            Envía recursos entre los diferentes módulos para crear contenido de forma conectada.
                        </p>
                    </div>
                </div>


                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {modules.map((mod, idx) => (
                        <div
                            key={idx}
                            onClick={() => navigate(mod.route)}
                            className={`group cursor-pointer rounded-2xl border ${mod.border} bg-[#111111] p-6 hover:bg-[#151515] transition-all duration-300 flex flex-col justify-between hover:-translate-y-1`}
                        >
                            <div className="space-y-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${mod.bg}`}>
                                    <mod.icon className={`w-6 h-6 ${mod.color}`} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-violet-400 transition-colors">
                                        {mod.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 leading-relaxed">
                                        {mod.description}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">
                                Abrir módulo <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Local Storage Hub */}
                <div className="mt-12">
                    <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <HardDrive className="w-5 h-5 text-zinc-400" />
                                Almacenamiento Local (Hub)
                            </h2>
                            {window.electronAPI && window.electronAPI.isElectron && (
                                <button 
                                    onClick={handleSelectFolder}
                                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 border border-zinc-700 hover:border-zinc-600 truncate max-w-[300px]"
                                    title={exportFolder || 'Seleccionar carpeta de exportación en tu PC'}
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    {exportFolder || 'Elegir carpeta destino...'}
                                </button>
                            )}
                        </div>
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">
                            {assets.length} Archivos
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-xl">
                            <HardDrive className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                            <h3 className="text-white font-medium mb-1">Sin archivos locales</h3>
                            <p className="text-sm text-zinc-500">
                                Los archivos exportados desde los módulos aparecerán aquí.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {assets.map((asset) => {
                                const isImage = asset.file?.type?.startsWith('image/');
                                const isVideo = asset.file?.type?.startsWith('video/');
                                const isAudio = asset.file?.type?.startsWith('audio/');
                                
                                // Generar URL para preview local
                                const objectUrl = asset.file ? URL.createObjectURL(asset.file) : null;

                                return (
                                    <div key={asset.key} className="bg-[#111] border border-zinc-800 rounded-xl p-3 relative group">
                                        <button 
                                            onClick={() => handleDeleteAsset(asset.key)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        
                                        <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                                            {isImage && objectUrl && (
                                                <img src={objectUrl} alt={asset.key} className="w-full h-full object-cover" />
                                            )}
                                            {isVideo && objectUrl && (
                                                <video src={objectUrl} className="w-full h-full object-cover" />
                                            )}
                                            {isAudio && (
                                                <Music className="w-8 h-8 text-emerald-500/50" />
                                            )}
                                            {!isImage && !isVideo && !isAudio && (
                                                <HardDrive className="w-8 h-8 text-zinc-700" />
                                            )}
                                        </div>
                                        <div className="truncate text-xs font-medium text-zinc-300" title={asset.key}>
                                            {asset.key}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 mt-1">
                                            {asset.file?.type || 'Desconocido'}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
