import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Download, FileSpreadsheet, Presentation, RotateCcw, FileCog, Monitor } from 'lucide-react';
import { toast } from 'sonner';

export default function FileConverter() {
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [conversionType, setConversionType] = useState('');
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [resultFile, setResultFile] = useState(null);
    const fileInputRef = useRef(null);
    const isDesktop = Boolean(window.electronAPI && window.electronAPI.convertDocument);

    const conversionOptions = [
        { id: 'word-to-pdf', label: 'Word a PDF', icon: FileText, from: '.docx,.doc', toExt: '.pdf' },
        { id: 'pdf-to-word', label: 'PDF a Word', icon: FileText, from: '.pdf', toExt: '.docx' },
        { id: 'excel-to-pdf', label: 'Excel a PDF', icon: FileSpreadsheet, from: '.xlsx,.xls', toExt: '.pdf' },
        { id: 'pdf-to-excel', label: 'PDF a Excel', icon: FileSpreadsheet, from: '.pdf', toExt: '.xlsx' },
        { id: 'ppt-to-pdf', label: 'PPT a PDF', icon: Presentation, from: '.pptx,.ppt', toExt: '.pdf' },
        { id: 'pdf-to-ppt', label: 'PDF a PPT', icon: Presentation, from: '.pdf', toExt: '.pptx' },
    ];

    const handleFileDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelection(droppedFile);
        }
    };

    const handleFileSelection = (selectedFile) => {
        if (!conversionType) {
            toast.error('Primero selecciona el tipo de conversión');
            return;
        }
        
        const option = conversionOptions.find(o => o.id === conversionType);
        const fileExtension = '.' + selectedFile.name.split('.').pop().toLowerCase();
        
        if (!option.from.includes(fileExtension) && option.from !== '.*') {
            toast.error(`Formato de archivo inválido. Se espera: ${option.from}`);
            return;
        }
        
        setFile(selectedFile);
        setResultFile(null);
        setProgress(0);
    };

    const handleConvert = () => {
        if (!file || !conversionType) return;

        setIsConverting(true);
        setProgress(0);

        // Simulando el proceso de conversión
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    completeConversion().catch(console.error);
                    return 100;
                }
                return prev + Math.floor(Math.random() * 15) + 5;
            });
        }, 300);
    };

    const completeConversion = async () => {
        setIsConverting(false);
        const option = conversionOptions.find(o => o.id === conversionType);
        const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
        const newFileName = `${originalName}_convertido${option.toExt}`;
        
        try {
            toast.loading("Procesando conversión en LibreOffice...", { id: 'convert-toast' });
            const arrayBuffer = await file.arrayBuffer();
            const result = await window.electronAPI.convertDocument({
                buffer: arrayBuffer,
                fileName: file.name,
                toExt: option.toExt
            });

            if (result.success) {
                const blob = new Blob([result.buffer], { type: option.toExt === '.pdf' ? 'application/pdf' : 'application/octet-stream' });
                const generatedFile = new File([blob], newFileName, { type: option.toExt === '.pdf' ? 'application/pdf' : 'application/octet-stream' });
                setResultFile(generatedFile);
                toast.success('Conversión completada con éxito', { id: 'convert-toast' });
            } else {
                toast.error('Error en conversión: ' + result.error, { id: 'convert-toast' });
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al procesar el archivo', { id: 'convert-toast' });
        }
    };

    const handleDownload = () => {
        if (!resultFile) return;
        const url = URL.createObjectURL(resultFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = resultFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const reset = () => {
        setFile(null);
        setResultFile(null);
        setProgress(0);
        setIsConverting(false);
    };

    return (
        <div className="min-h-screen w-full bg-[#0a0a0a] text-zinc-300 p-6 flex flex-col">
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                
                {/* Header */}
                <div className="flex flex-col gap-4 mb-8">
                    <button 
                        onClick={() => navigate('/media-suite')}
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-fit text-sm font-medium bg-zinc-900/50 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver a Suite Multimedia
                    </button>
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <FileCog className="w-8 h-8 text-indigo-500" />
                            Conversor de Formatos Documentales
                        </h1>
                        <p className="text-zinc-400">
                            Convierte archivos PDF, Word, Excel y PowerPoint rápidamente de forma simulada y local.
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-8 flex flex-col flex-1">
                    
                    {!isDesktop ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-zinc-800/50 text-zinc-400 rounded-full flex items-center justify-center mb-6">
                                <Monitor className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Función Exclusiva de Escritorio</h2>
                            <p className="text-zinc-400 max-w-md">
                                Debes instalarlo en una PC o laptop para utilizar la conversión de documentos. 
                                Esta herramienta requiere procesamiento local avanzado (LibreOffice) que no está disponible en la versión web o móvil.
                            </p>
                        </div>
                    ) : !resultFile ? (
                        <>
                            {/* Selector de tipo de conversión */}
                            <div className="mb-8">
                                <label className="block text-sm font-medium text-zinc-400 mb-3">1. Selecciona el tipo de conversión:</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {conversionOptions.map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setConversionType(opt.id); setFile(null); }}
                                            className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 ${
                                                conversionType === opt.id 
                                                ? 'bg-indigo-500/10 border-indigo-500 text-white' 
                                                : 'bg-[#151515] border-zinc-800 text-zinc-400 hover:bg-[#1a1a1a] hover:border-zinc-700'
                                            }`}
                                        >
                                            <opt.icon className={`w-5 h-5 ${conversionType === opt.id ? 'text-indigo-400' : 'text-zinc-500'}`} />
                                            <span className="font-medium text-sm">{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dropzone */}
                            {conversionType && (
                                <div className="flex-1 flex flex-col">
                                    <label className="block text-sm font-medium text-zinc-400 mb-3">2. Sube tu archivo:</label>
                                    <div 
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleFileDrop}
                                        className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors ${
                                            file ? 'border-indigo-500 bg-indigo-500/5' : 'border-zinc-700 bg-[#151515] hover:border-zinc-500 hover:bg-[#1a1a1a]'
                                        }`}
                                    >
                                        {!file ? (
                                            <>
                                                <Upload className="w-12 h-12 text-zinc-600 mb-4" />
                                                <h3 className="text-lg font-medium text-white mb-2">Arrastra tu archivo aquí</h3>
                                                <p className="text-zinc-500 text-sm mb-6">o haz clic para explorar</p>
                                                <button 
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-6 py-2.5 bg-[#222] hover:bg-[#333] text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                                                >
                                                    Explorar archivos
                                                </button>
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    className="hidden" 
                                                    accept={conversionOptions.find(o => o.id === conversionType)?.from}
                                                    onChange={(e) => handleFileSelection(e.target.files[0])}
                                                />
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center w-full max-w-md">
                                                <FileText className="w-16 h-16 text-indigo-400 mb-4" />
                                                <h3 className="text-lg font-medium text-white mb-2 truncate max-w-full">{file.name}</h3>
                                                <p className="text-zinc-500 text-sm mb-8">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                
                                                {isConverting ? (
                                                    <div className="w-full space-y-3">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-zinc-400">Procesando...</span>
                                                            <span className="text-indigo-400 font-medium">{progress}%</span>
                                                        </div>
                                                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                                                                style={{ width: progress + '%' }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-4">
                                                        <button 
                                                            onClick={reset}
                                                            className="px-6 py-2.5 bg-transparent hover:bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button 
                                                            onClick={handleConvert}
                                                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
                                                        >
                                                            Convertir ahora
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                                <Download className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">¡Conversión Exitosa!</h2>
                            <p className="text-zinc-400 mb-8 max-w-md">
                                Tu archivo ha sido convertido de forma simulada y está listo para descargar.
                            </p>
                            
                            <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-zinc-800 rounded-xl mb-8 w-full max-w-md text-left">
                                <FileText className="w-8 h-8 text-emerald-400 shrink-0" />
                                <div className="overflow-hidden">
                                    <p className="text-white font-medium truncate">{resultFile.name}</p>
                                    <p className="text-zinc-500 text-xs">{(resultFile.size / 1024).toFixed(2)} KB</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button 
                                    onClick={reset}
                                    className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Convertir otro
                                </button>
                                <button 
                                    onClick={handleDownload}
                                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Descargar Archivo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
