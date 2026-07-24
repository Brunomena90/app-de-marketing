import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Upload, Play, Pause, Music, Volume2 } from 'lucide-react';
import { saveAsset } from '../../lib/mediaStore';
import { toast } from 'sonner';
import WaveSurfer from 'wavesurfer.js';

export default function AudioEditor() {
    const navigate = useNavigate();
    const [audioFile, setAudioFile] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    
    const waveformRef = useRef(null);
    const wavesurfer = useRef(null);
    const fileInputRef = useRef(null);

    // Inicializar WaveSurfer
    useEffect(() => {
        if (waveformRef.current && !wavesurfer.current) {
            wavesurfer.current = WaveSurfer.create({
                container: waveformRef.current,
                waveColor: '#34d399', // emerald-400
                progressColor: '#059669', // emerald-600
                cursorColor: '#ffffff',
                barWidth: 2,
                barRadius: 3,
                responsive: true,
                height: 150,
                normalize: true,
            });

            wavesurfer.current.on('play', () => setIsPlaying(true));
            wavesurfer.current.on('pause', () => setIsPlaying(false));
            wavesurfer.current.on('finish', () => setIsPlaying(false));
        }

        return () => {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
        };
    }, []);

    const handleAudioUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAudioFile(file);
        
        const objectUrl = URL.createObjectURL(file);
        if (wavesurfer.current) {
            wavesurfer.current.load(objectUrl);
        }
    };

    const handlePlayPause = useCallback(() => {
        if (wavesurfer.current) {
            wavesurfer.current.playPause();
        }
    }, []);

    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (wavesurfer.current) {
            wavesurfer.current.setVolume(newVolume);
        }
    };

    const handleSaveToHub = async () => {
        if (!audioFile) return;

        // Para un MVP sin procesamiento complejo por Web Audio API,
        // simplemente guardamos el archivo de audio original en el Hub.
        // En una versión más avanzada se usaría un AudioContext para renderizar cortes/volumen.
        
        const timestamp = new Date().getTime();
        const key = `audio_${timestamp}_${audioFile.name}`;
        
        const success = await saveAsset(key, audioFile);
        if (success) {
            toast.success('Audio guardado en el Hub Local');
        } else {
            toast.error('Error al guardar audio');
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
                        <Music className="w-5 h-5 text-emerald-400" />
                        <h1 className="font-semibold text-white">Editor de Audio (Local)</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        Cargar Audio
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleAudioUpload} 
                        accept="audio/*" 
                        className="hidden" 
                    />
                    
                    <button 
                        onClick={handleSaveToHub}
                        disabled={!audioFile}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Enviar al Hub
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 flex flex-col overflow-hidden p-6 gap-6">
                
                <div className="flex-1 bg-[#111] rounded-2xl border border-zinc-800 flex flex-col p-6 shadow-2xl relative overflow-hidden">
                    {!audioFile ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <Music className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-500">Carga un archivo de audio para visualizar la onda sonora</p>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-white font-medium">{audioFile.name}</h2>
                        </div>
                    )}
                    
                    {/* Contenedor de la forma de onda */}
                    <div 
                        ref={waveformRef} 
                        className={`w-full h-[150px] mb-6 ${!audioFile ? 'opacity-0' : 'opacity-100'}`}
                    />

                    {/* Controles de Reproducción */}
                    {audioFile && (
                        <div className="flex items-center justify-between bg-black/40 p-4 rounded-xl mt-auto">
                            <button 
                                onClick={handlePlayPause}
                                className="w-12 h-12 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black rounded-full transition-colors"
                            >
                                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                            </button>
                            
                            <div className="flex items-center gap-3 w-48">
                                <Volume2 className="w-4 h-4 text-zinc-400" />
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.01" 
                                    value={volume}
                                    onChange={handleVolumeChange}
                                    className="w-full accent-emerald-500"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
