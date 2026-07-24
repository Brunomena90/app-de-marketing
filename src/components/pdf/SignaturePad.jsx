import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, Upload, PenTool } from 'lucide-react';

export default function SignaturePad({ onSave, onClose }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState('draw'); // 'draw' or 'upload'
    const [color, setColor] = useState('#000000');
    const [uploadedImageSrc, setUploadedImageSrc] = useState(null);
    const fileInputRef = useRef(null);

    const colors = [
        { name: 'Negro', value: '#000000' },
        { name: 'Azul', value: '#0050d2' },
        { name: 'Rojo', value: '#d20000' }
    ];

    // Configurar color al dibujar
    useEffect(() => {
        if (mode === 'draw') {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }
        } else if (mode === 'upload' && uploadedImageSrc) {
            // Re-procesar la imagen con el nuevo color
            processImage(uploadedImageSrc, color);
        }
    }, [color, mode, uploadedImageSrc]);

    const startDrawing = (e) => {
        if (mode !== 'draw') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || mode !== 'draw') return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setUploadedImageSrc(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        
        // Restaurar strokeStyle si es draw
        if (mode === 'draw') {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    };

    const hexToRgb = (hex) => {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    const processImage = (src, targetColor) => {
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate scale to fit inside canvas preserving aspect ratio
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;

            ctx.drawImage(img, x, y, w, h);

            // Get pixels
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const rgbColor = hexToRgb(targetColor);

            // 1. Calcular el brillo promedio (fondo del papel)
            let totalBrightness = 0;
            let pixelCount = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] > 0) {
                    totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
                    pixelCount++;
                }
            }
            const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 255;
            
            // 2. Establecer un umbral dinámico (ligeramente más oscuro que el fondo promedio)
            // Si el papel es gris, el umbral baja automáticamente
            const threshold = Math.min(avgBrightness * 0.88, 210);

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                const a = data[i+3];

                if (a === 0) continue;

                const brightness = (r + g + b) / 3;

                // Umbral dinámico para quitar fondo
                if (brightness > threshold) {
                    data[i+3] = 0; // Transparente
                } else {
                    // Es un píxel de la tinta. Calcular opacidad.
                    const opacity = Math.max(0, 1 - (brightness / threshold)); 
                    data[i] = rgbColor.r;
                    data[i+1] = rgbColor.g;
                    data[i+2] = rgbColor.b;
                    // Aumentar un poco la opacidad para que la tinta se vea más sólida
                    data[i+3] = Math.floor(Math.min(1, opacity * 1.5) * 255);
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
        };
        img.src = src;
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event.target.result;
                setUploadedImageSrc(src);
            };
            reader.readAsDataURL(file);
        }
    };

    const saveSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pixelBuffer = new Uint32Array(ctx.getImageData(0,0, canvas.width, canvas.height).data.buffer);
        const hasContent = pixelBuffer.some(c => c !== 0);
        
        if (!hasContent) {
            alert('Por favor, dibuje o cargue su firma primero.');
            return;
        }

        const dataURL = canvas.toDataURL('image/png');
        onSave(dataURL);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1e1e1e] border border-[#333] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-[#333] bg-[#252525]">
                    <h3 className="text-white font-semibold tracking-wide">Insertar Firma</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex border-b border-[#333]">
                    <button
                        onClick={() => { setMode('draw'); clearCanvas(); }}
                        className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${mode === 'draw' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <PenTool className="w-4 h-4" /> Dibujar
                    </button>
                    <button
                        onClick={() => { setMode('upload'); clearCanvas(); }}
                        className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 transition-colors ${mode === 'upload' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-900/10' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Upload className="w-4 h-4" /> Cargar Imagen
                    </button>
                </div>
                
                <div className="p-6 flex flex-col items-center bg-zinc-900 relative">
                    <p className="text-sm text-zinc-400 mb-4 w-full text-center">
                        {mode === 'draw' ? 'Firme dentro del recuadro blanco' : 'Sube una foto clara de tu firma en papel'}
                    </p>
                    
                    <div className="bg-white rounded-xl overflow-hidden shadow-inner w-full flex justify-center relative border-2 border-dashed border-zinc-400" style={{ cursor: mode === 'draw' ? 'crosshair' : 'default', height: 204 }}>
                        <canvas
                            ref={canvasRef}
                            width={400}
                            height={200}
                            className="touch-none bg-transparent"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseOut={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        {mode === 'upload' && !uploadedImageSrc && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/90 backdrop-blur-sm z-10 pointer-events-none transition-opacity">
                                <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                                <span className="text-zinc-600 font-medium text-sm">Haz clic aquí para seleccionar</span>
                                <span className="text-zinc-400 text-xs mt-1">El fondo se eliminará mágicamente ✨</span>
                            </div>
                        )}
                        {mode === 'upload' && (
                             <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageUpload}
                                ref={fileInputRef}
                                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                title="Sube una foto de tu firma"
                             />
                        )}
                    </div>

                    {/* Selector de colores */}
                    <div className="flex gap-4 mt-6 items-center w-full justify-center bg-[#252525] p-3 rounded-lg border border-[#333]">
                        <span className="text-sm font-medium text-zinc-300">Color de tinta:</span>
                        {colors.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setColor(c.value)}
                                className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${color === c.value ? 'scale-110 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'border-[#444] hover:scale-105'}`}
                                style={{ backgroundColor: c.value }}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 border-t border-[#333] bg-[#252525]">
                    <button 
                        onClick={clearCanvas}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Borrar
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-[#333] rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={saveSignature}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                        >
                            <Check className="w-4 h-4" />
                            Insertar Firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
