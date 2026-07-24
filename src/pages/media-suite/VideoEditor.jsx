import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Play, Pause, Video as VideoIcon, Save, Layers, Clock } from 'lucide-react';
import { saveAsset } from '../../lib/mediaStore';
import { toast } from 'sonner';

export default function VideoEditor() {
    const navigate = useNavigate();
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const videoRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleVideoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setVideoFile(file);
        
        const url = URL.createObjectURL(file);
        setVideoUrl(url);
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = videoRef.current.currentTime;
            const total = videoRef.current.duration;
            setProgress((current / total) * 100);
            if (!duration) setDuration(total);
        }
    };

    const handleSeek = (e) => {
        const seekTo = (e.target.value / 100) * duration;
        if (videoRef.current) {
            videoRef.current.currentTime = seekTo;
            setProgress(e.target.value);
        }
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleSaveToHub = async () => {
        if (!videoFile) return;
        
        // Exportación básica al Hub. 
        // En la versión FFmpeg se procesaría el video antes de guardar.
        const timestamp = new Date().getTime();
        const key = `video_${timestamp}_${videoFile.name}`;
        
        const success = await saveAsset(key, videoFile);
        if (success) {
            toast.success('Video guardado en el Hub Local');
        } else {
            toast.error('Error al guardar video');
        }
    };

    return (
        <div className="min-h-full h-screen w-full bg-[#050505] text-zinc-300 flex flex-col">
            {/* Topbar */}
            <header className="h-14 border-b border-zinc-800 bg-[#0a0a0a] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/media-suite')}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <VideoIcon className="w-5 h-5 text-amber-400" />
                        <h1 className="font-semibold text-white">Editor de Video (Local)</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        Importar Video
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleVideoUpload} 
                        accept="video/*" 
                        className="hidden" 
                    />
                    
                    <button 
                        onClick={handleSaveToHub}
                        disabled={!videoFile}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium text-sm rounded-lg flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Exportar al Hub
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Panel Superior: Previsualizador y Assets */}
                <div className="flex-[2] flex border-b border-zinc-800">
                    {/* Left Sidebar - Hub Assets */}
                    <aside className="w-64 border-r border-zinc-800 bg-[#0a0a0a] p-4 flex flex-col">
                        <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
                            <Layers className="w-4 h-4 text-amber-400" />
                            Archivos del Proyecto
                        </h2>
                        <div className="flex-1 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center p-4 text-center">
                            <p className="text-sm text-zinc-500">Aquí aparecerán los archivos traídos del Media Hub (Fotos, Audios).</p>
                        </div>
                    </aside>

                    {/* Centro - Reproductor */}
                    <div className="flex-1 bg-[#111] relative flex items-center justify-center p-4">
                        {!videoUrl ? (
                            <div className="text-center">
                                <VideoIcon className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                                <p className="text-zinc-500">Importa un video para comenzar</p>
                            </div>
                        ) : (
                            <div className="w-full h-full flex flex-col">
                                <video 
                                    ref={videoRef}
                                    src={videoUrl}
                                    className="w-full h-full max-h-[50vh] bg-black rounded-lg shadow-2xl"
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={() => setIsPlaying(false)}
                                    onClick={togglePlay}
                                />
                                
                                {/* Controles de Reproducción Minimalistas */}
                                <div className="mt-4 flex items-center gap-4 bg-zinc-900/50 p-3 rounded-xl backdrop-blur-sm border border-zinc-800">
                                    <button 
                                        onClick={togglePlay}
                                        className="w-10 h-10 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black rounded-full"
                                    >
                                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                                    </button>
                                    
                                    <span className="text-xs font-mono w-12 text-zinc-400">
                                        {formatTime(videoRef.current?.currentTime || 0)}
                                    </span>
                                    
                                    <input 
                                        type="range" 
                                        min="0" max="100" 
                                        value={progress}
                                        onChange={handleSeek}
                                        className="flex-1 accent-amber-500 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer"
                                    />
                                    
                                    <span className="text-xs font-mono w-12 text-zinc-400">
                                        {formatTime(duration)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel Inferior: Línea de Tiempo (Timeline) */}
                <div className="flex-1 min-h-[250px] bg-[#0a0a0a] flex flex-col">
                    <div className="h-10 border-b border-zinc-800 bg-[#111] flex items-center px-4 gap-2">
                        <Clock className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-400 font-medium tracking-wider uppercase">Línea de Tiempo</span>
                    </div>
                    
                    <div className="flex-1 overflow-x-auto p-4 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDM5LjVoNDBNMzkuNSAwdi00MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')]">
                        
                        {/* Cabezal de reproducción visual */}
                        {videoFile && (
                            <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                style={{ left: `calc(1rem + ${progress}%)` }}
                            >
                                <div className="w-3 h-3 bg-red-500 rotate-45 -ml-[5px] -mt-1 rounded-sm"></div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 min-w-max">
                            {/* Pista de Video */}
                            <div className="flex items-center gap-4">
                                <div className="w-24 shrink-0 text-xs text-zinc-500 font-medium">V1 (Video)</div>
                                <div className="h-12 bg-zinc-900 rounded-lg flex-1 relative border border-zinc-800 overflow-hidden flex items-center justify-center text-zinc-700">
                                    {videoFile ? (
                                        <div className="absolute inset-0 bg-amber-500/20 border border-amber-500/50 rounded-lg flex items-center px-2">
                                            <span className="text-xs text-amber-500 font-medium truncate">{videoFile.name}</span>
                                        </div>
                                    ) : 'Pista Vacía'}
                                </div>
                            </div>
                            
                            {/* Pista de Audio */}
                            <div className="flex items-center gap-4">
                                <div className="w-24 shrink-0 text-xs text-zinc-500 font-medium">A1 (Audio)</div>
                                <div className="h-12 bg-zinc-900 rounded-lg flex-1 relative border border-zinc-800 overflow-hidden flex items-center justify-center text-zinc-700">
                                     {videoFile ? (
                                        <div className="absolute inset-0 bg-emerald-500/20 border border-emerald-500/50 rounded-lg flex items-center px-2">
                                            <span className="text-xs text-emerald-500 font-medium truncate">Audio Original</span>
                                        </div>
                                    ) : 'Pista Vacía'}
                                </div>
                            </div>
                            
                            {/* Pista de Gráficos/Overlays */}
                            <div className="flex items-center gap-4">
                                <div className="w-24 shrink-0 text-xs text-zinc-500 font-medium">G1 (Gráficos)</div>
                                <div className="h-12 bg-zinc-900 rounded-lg flex-1 relative border border-zinc-800 border-dashed flex items-center justify-center text-zinc-700">
                                    <span className="text-xs">Arrastra un diseño del Hub aquí</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
