import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Save, Image as ImageIcon, SlidersHorizontal, Wand2, Crop, Eraser, CircleDashed, Clock, MoreHorizontal, Pipette, Info, Tag } from 'lucide-react';
import { saveAsset } from '../../lib/mediaStore';
import { toast } from 'sonner';

// Componente Interactivo Curva de Tonos
    const LrToneCurve = ({ curveState, onDrag, onCommit }) => {
        const svgRef = useRef(null);
        const lastClickRef = useRef({ time: 0, x: 0, y: 0 });
        const [draggingPoint, setDraggingPoint] = useState(null);
        const [localPoints, setLocalPoints] = useState(curveState.points[curveState.channel]);

        useEffect(() => { setLocalPoints(curveState.points[curveState.channel]); }, [curveState]);

        const getMouseCoords = (e) => {
            const rect = svgRef.current.getBoundingClientRect();
            let x = ((e.clientX - rect.left) / rect.width) * 255;
            let y = 255 - (((e.clientY - rect.top) / rect.height) * 255);
            return { x: Math.max(0, Math.min(255, x)), y: Math.max(0, Math.min(255, y)) };
        };

        const deletePoint = (idx, e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (idx > 0 && idx < localPoints.length - 1) {
                const newPoints = localPoints.filter((_, i) => i !== idx);
                setLocalPoints(newPoints);
                setDraggingPoint(null);
                if (onDrag) onDrag(newPoints);
                if (onCommit) onCommit(newPoints);
            }
        };

        const handlePointerDown = (e) => {
            const { x, y } = getMouseCoords(e);
            const now = Date.now();
            const lastClick = lastClickRef.current;
            
            let foundIdx = -1, minDist = 15;
            localPoints.forEach((p, i) => {
                const dist = Math.hypot(p.x - x, p.y - y);
                if (dist < minDist) { minDist = dist; foundIdx = i; }
            });

            // Lógica manual de "Doble Tap/Clic" (temporal y espacial) independiente del DOM
            const isDoubleClickTime = now - lastClick.time < 400;
            const isSameSpot = Math.hypot(lastClick.x - x, lastClick.y - y) < 20;

            if (foundIdx > 0 && foundIdx < localPoints.length - 1) {
                // Borrar el punto si es doble clic o clic derecho nativo
                if ((isDoubleClickTime && isSameSpot) || e.button === 2) {
                    if (e.preventDefault) e.preventDefault();
                    if (e.stopPropagation) e.stopPropagation();
                    
                    const newPoints = localPoints.filter((_, i) => i !== foundIdx);
                    setLocalPoints(newPoints);
                    setDraggingPoint(null);
                    if (onDrag) onDrag(newPoints);
                    if (onCommit) onCommit(newPoints);
                    
                    lastClickRef.current = { time: 0, x: 0, y: 0 };
                    return;
                }
            }

            lastClickRef.current = { time: now, x, y };

            // Ignorar click derecho si falló la zona
            if (e.button === 2) return;

            e.target.setPointerCapture(e.pointerId);

            let newPoints = [...localPoints];
            if (foundIdx !== -1) {
                setDraggingPoint(foundIdx);
            } else {
                newPoints.push({ x, y });
                newPoints.sort((a, b) => a.x - b.x);
                const newIdx = newPoints.findIndex(p => p.x === x && p.y === y);
                setLocalPoints(newPoints);
                setDraggingPoint(newIdx);
                if (onDrag) onDrag(newPoints);
            }
        };

        const handlePointerMove = (e) => {
            if (draggingPoint === null) return;
            const { x, y } = getMouseCoords(e);
            const newPoints = [...localPoints];
            
            const leftBound = draggingPoint > 0 ? newPoints[draggingPoint - 1].x + 1 : 0;
            const rightBound = draggingPoint < newPoints.length - 1 ? newPoints[draggingPoint + 1].x - 1 : 255;
            const safeX = Math.max(leftBound, Math.min(rightBound, x));
            
            newPoints[draggingPoint] = { x: safeX, y };
            setLocalPoints(newPoints);
            if (onDrag) onDrag(newPoints);
        };

        const handlePointerUp = (e) => {
            e.target.releasePointerCapture(e.pointerId);
            if (draggingPoint !== null) {
                setDraggingPoint(null);
                if (onCommit) onCommit(localPoints);
            }
        };

        const polylinePoints = localPoints.map(p => `${p.x},${255 - p.y}`).join(' ');
        const colors = { rgb: 'white', red: '#ef4444', green: '#22c55e', blue: '#3b82f6' };
        const strokeColor = colors[curveState.channel];

        return (
            <svg 
                ref={svgRef} viewBox="0 0 255 255" 
                className="w-full h-full cursor-crosshair touch-none overflow-visible"
                style={{ padding: '4px' }}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp} onContextMenu={(e) => e.preventDefault()}
            >
                <line x1="85" y1="0" x2="85" y2="255" stroke="#3f3f46" strokeWidth="1" />
                <line x1="170" y1="0" x2="170" y2="255" stroke="#3f3f46" strokeWidth="1" />
                <line x1="0" y1="85" x2="255" y2="85" stroke="#3f3f46" strokeWidth="1" />
                <line x1="0" y1="170" x2="255" y2="170" stroke="#3f3f46" strokeWidth="1" />
                <line x1="0" y1="255" x2="255" y2="0" stroke="#52525b" strokeWidth="1.5" />
                <polyline points={polylinePoints} fill="none" stroke={strokeColor} strokeWidth="2.5" />
                {localPoints.map((p, i) => (
                    <circle 
                        key={i} 
                        cx={p.x} cy={255 - p.y} 
                        r="6" 
                        fill={strokeColor} 
                        stroke="#18181b" 
                        strokeWidth="2" 
                        className="cursor-grab hover:stroke-zinc-400 transition-colors" 
                        onDoubleClick={(e) => deletePoint(i, e)}
                        onContextMenu={(e) => deletePoint(i, e)}
                    />
                ))}
            </svg>
        );
    };

// Componente de Slider Personalizado (Optimizado con Local State)
    const LrSlider = ({ label, value, defaultValue = 0, min, max, onDrag, onCommit, step = 1, gradientTrack = null, hideValue = false }) => {
        const [localVal, setLocalVal] = useState(value);

        // Sincronizar si el valor externo cambia (ej. botón reset)
        useEffect(() => { setLocalVal(value); }, [value]);

        const handleInput = (e) => {
            const val = e.target.value;
            setLocalVal(val);
            if (onDrag) onDrag(val);
        };

        const handleRelease = (e) => {
            if (onCommit) onCommit(e.target.value);
        };

        const handleDoubleClick = () => {
            setLocalVal(defaultValue);
            if (onDrag) onDrag(defaultValue);
            if (onCommit) onCommit(defaultValue);
        };

        return (
            <div className="flex flex-col gap-1 mb-2 group" onDoubleClick={handleDoubleClick}>
                {!hideValue && (
                    <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-300">
                        <span className="cursor-pointer hover:text-white transition-colors">{label}</span>
                        <span>{localVal > 0 && !['Temp', 'Matiz'].includes(label) ? `+${Number(localVal).toFixed(step < 1 ? 2 : 0)}` : Number(localVal).toFixed(step < 1 ? 2 : 0)}</span>
                    </div>
                )}
                <div className="relative flex items-center h-5 mt-1 group cursor-pointer">
                    {/* Track visual (Fondo) */}
                    <div className="absolute w-full h-0.5 bg-zinc-700 rounded-full z-0 pointer-events-none">
                        {gradientTrack && (
                            <div className={`absolute inset-0 rounded-full ${gradientTrack}`}></div>
                        )}
                    </div>
                    
                    {/* Input nativo con área de arrastre */}
                    <input 
                        type="range" 
                        min={min} max={max} step={step}
                        value={localVal}
                        onChange={handleInput}
                        onMouseUp={handleRelease}
                        onTouchEnd={handleRelease}
                        className="absolute z-10 w-full h-full appearance-none bg-transparent outline-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none 
                                   [&::-webkit-slider-thumb]:w-3.5 
                                   [&::-webkit-slider-thumb]:h-3.5 
                                   [&::-webkit-slider-thumb]:bg-zinc-200 
                                   [&::-webkit-slider-thumb]:rounded-full 
                                   [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_#18181b]
                                   [&::-webkit-slider-thumb]:cursor-grab
                                   active:[&::-webkit-slider-thumb]:cursor-grabbing
                                   [&::-webkit-slider-thumb]:transition-transform
                                   group-hover:[&::-webkit-slider-thumb]:scale-110"
                    />
                </div>
                {hideValue && <span className="text-[11px] font-semibold text-zinc-400 mt-1">{label}</span>}
            </div>
        );
    };

const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
};

const hslToRgb = (h, s, l) => {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r * 255, g * 255, b * 255];
};

export default function PhotoEditor() {
    const navigate = useNavigate();
    const [imageObj, setImageObj] = useState(null);
    const [fileName, setFileName] = useState('');
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const originalImageDataRef = useRef(null);

    // Ajustes Básicos
    const [filters, setFilters] = useState({
        exposicion: 0,
        contraste: 0,
        iluminaciones: 0,
        sombras: 0,
        blancos: 0,
        negros: 0,
        temp: 4300,
        matiz: 12,
        intensidad: 28,
        saturacion: 0,
    });

    const [colorMixerActiveColor, setColorMixerActiveColor] = useState('red');
    const [colorMixerFilters, setColorMixerFilters] = useState({
        red: { tono: 0, saturacion: 0, luminancia: 0 },
        orange: { tono: 0, saturacion: 0, luminancia: 0 },
        yellow: { tono: 0, saturacion: 0, luminancia: 0 },
        green: { tono: 0, saturacion: 0, luminancia: 0 },
        cyan: { tono: 0, saturacion: 0, luminancia: 0 },
        blue: { tono: 0, saturacion: 0, luminancia: 0 },
        purple: { tono: 0, saturacion: 0, luminancia: 0 },
        magenta: { tono: 0, saturacion: 0, luminancia: 0 },
    });

    const [accordions, setAccordions] = useState({
        luz: true,
        curva: true,
        color: true,
    });

    const toggleAccordion = (section) => {
        setAccordions(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // --- ESTADOS Y LÓGICA DE LA CURVA DE PUNTOS ---
    const [curveState, setCurveState] = useState({
        channel: 'rgb',
        points: {
            rgb: [{x: 0, y: 0}, {x: 255, y: 255}],
            red: [{x: 0, y: 0}, {x: 255, y: 255}],
            green: [{x: 0, y: 0}, {x: 255, y: 255}],
            blue: [{x: 0, y: 0}, {x: 255, y: 255}],
        },
        refineSaturation: 100, // Perfeccionar saturación slider
    });
    const svgRef = useRef(null);
    const [draggingPoint, setDraggingPoint] = useState(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new window.Image();
            img.onload = () => {
                setImageObj(img);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const funcRRef = useRef(null);
    const funcGRef = useRef(null);
    const funcBRef = useRef(null);

    // Dibuja la imagen original en el canvas SOLO UNA VEZ al cargarla
    useEffect(() => {
        if (!imageObj || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        const maxDim = 1200; 
        let width = imageObj.width;
        let height = imageObj.height;
        
        if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = width * ratio;
            height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(imageObj, 0, 0, width, height);
        originalImageDataRef.current = ctx.getImageData(0, 0, width, height);
        
        applyFiltersToDOM(filters, curveState);
    }, [imageObj]); 

    const applyHSLFiltersToImageData = useCallback((sourceImageData, mixerFilters) => {
        const hasChanges = Object.values(mixerFilters).some(c => c.tono !== 0 || c.saturacion !== 0 || c.luminancia !== 0);
        if (!hasChanges) return sourceImageData;

        const newImageData = new ImageData(
            new Uint8ClampedArray(sourceImageData.data),
            sourceImageData.width,
            sourceImageData.height
        );
        const data = newImageData.data;
        const colorRanges = {
            red: { center: 0, width: 30 },
            orange: { center: 30, width: 25 },
            yellow: { center: 60, width: 25 },
            green: { center: 120, width: 50 },
            cyan: { center: 180, width: 30 },
            blue: { center: 240, width: 50 },
            purple: { center: 280, width: 30 },
            magenta: { center: 320, width: 30 }
        };

        for (let i = 0; i < data.length; i += 4) {
            let [h, s, l] = rgbToHsl(data[i], data[i+1], data[i+2]);
            let hueDeg = h * 360;
            
            let totalHOffset = 0;
            let totalSOffset = 0;
            let totalLOffset = 0;

            for (const [colorName, range] of Object.entries(colorRanges)) {
                const f = mixerFilters[colorName];
                if (f.tono === 0 && f.saturacion === 0 && f.luminancia === 0) continue;

                let dist = Math.abs(hueDeg - range.center);
                if (colorName === 'red') dist = Math.min(dist, Math.abs(hueDeg - 360));

                if (dist < range.width) {
                    const factor = Math.cos((dist / range.width) * (Math.PI / 2));
                    totalHOffset += (f.tono / 100) * range.width * factor;
                    totalSOffset += (f.saturacion / 100) * factor;
                    totalLOffset += (f.luminancia / 100) * factor;
                }
            }

            if (totalHOffset !== 0 || totalSOffset !== 0 || totalLOffset !== 0) {
                hueDeg = (hueDeg + totalHOffset + 360) % 360;
                s = Math.max(0, Math.min(1, s + totalSOffset));
                l = Math.max(0, Math.min(1, l + totalLOffset));

                const [r, g, b] = hslToRgb(hueDeg / 360, s, l);
                data[i] = r;
                data[i+1] = g;
                data[i+2] = b;
            }
        }
        return newImageData;
    }, []);

    useEffect(() => {
        if (!canvasRef.current || !originalImageDataRef.current) return;
        
        let rafId = requestAnimationFrame(() => {
            const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
            const hslData = applyHSLFiltersToImageData(originalImageDataRef.current, colorMixerFilters);
            ctx.putImageData(hslData, 0, 0);
        });
        
        return () => cancelAnimationFrame(rafId);
    }, [colorMixerFilters, applyHSLFiltersToImageData]); 

    
    const generateTable = (points) => {
        const sorted = [...points].sort((a,b) => a.x - b.x);
        const table = [];
        for (let i = 0; i <= 255; i++) {
            let p1 = sorted[0], p2 = sorted[sorted.length-1];
            for (let j = 0; j < sorted.length - 1; j++) {
                if (i >= sorted[j].x && i <= sorted[j+1].x) {
                    p1 = sorted[j];
                    p2 = sorted[j+1];
                    break;
                }
            }
            if (p2.x === p1.x) table[i] = p1.y;
            else {
                const t = (i - p1.x) / (p2.x - p1.x);
                table[i] = p1.y + t * (p2.y - p1.y);
            }
        }
        return table;
    };

    const updateCurveFilterDOM = (currentCurveState, currentFilters) => {
        const rgbTable = generateTable(currentCurveState.points.rgb);
        const redTable = generateTable(currentCurveState.points.red);
        const greenTable = generateTable(currentCurveState.points.green);
        const blueTable = generateTable(currentCurveState.points.blue);

        const applyLuz = (val, f) => {
            if (!f) return val;
            let res = val;
            const x = val / 255;
            
            if (f.sombras) res += (f.sombras / 100) * 255 * 0.4 * Math.max(0, 1 - Math.abs(x - 0.25) * 3);
            if (f.iluminaciones) res += (f.iluminaciones / 100) * 255 * 0.4 * Math.max(0, 1 - Math.abs(x - 0.75) * 3);
            if (f.negros) res += (f.negros / 100) * 255 * 0.3 * Math.max(0, 1 - (x * 4));
            if (f.blancos) res += (f.blancos / 100) * 255 * 0.3 * Math.max(0, 1 - ((1 - x) * 4));
            
            return Math.max(0, Math.min(255, res));
        };

        const finalR = rgbTable.map(val => (redTable[Math.round(applyLuz(val, currentFilters))] || 0) / 255);
        const finalG = rgbTable.map(val => (greenTable[Math.round(applyLuz(val, currentFilters))] || 0) / 255);
        const finalB = rgbTable.map(val => (blueTable[Math.round(applyLuz(val, currentFilters))] || 0) / 255);

        if (funcRRef.current) funcRRef.current.setAttribute('tableValues', finalR.map(n=>n.toFixed(3)).join(' '));
        if (funcGRef.current) funcGRef.current.setAttribute('tableValues', finalG.map(n=>n.toFixed(3)).join(' '));
        if (funcBRef.current) funcBRef.current.setAttribute('tableValues', finalB.map(n=>n.toFixed(3)).join(' '));
    };

    const applyFiltersToDOM = (currentFilters, currentCurveState = curveState) => {
        if (!canvasRef.current) return;
        const brightness = 100 + (currentFilters.exposicion * 20);
        const contrast = 100 + currentFilters.contraste; 
        const sepia = currentFilters.temp > 5000 ? (currentFilters.temp - 5000) / 100 : 0;
        const saturate = Math.max(0, 100 + (currentFilters.saturacion || 0) + ((currentFilters.intensidad || 0) * 0.5));
        const hue = currentFilters.matiz || 0;
        
        updateCurveFilterDOM(currentCurveState, currentFilters);
        canvasRef.current.style.filter = `brightness(${brightness}%) contrast(${contrast}%) sepia(${sepia}%) saturate(${saturate}%) hue-rotate(${hue}deg) url(#toneCurve)`;
    };

    const handleFilterDrag = (filterName, value) => {
        const simulatedFilters = { ...filters, [filterName]: parseFloat(value) };
        applyFiltersToDOM(simulatedFilters);
    };

    const handleFilterCommit = (filterName, value) => {
        setFilters(prev => ({ ...prev, [filterName]: parseFloat(value) }));
    };

    const handleSaveToHub = async () => {
        if (!canvasRef.current || !imageObj) return;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = imageObj.width;
        exportCanvas.height = imageObj.height;
        const ctx = exportCanvas.getContext('2d');
        
        const brightness = 100 + (filters.exposicion * 20);
        const contrast = 100 + filters.contraste; 
        const sepia = filters.temp > 5000 ? (filters.temp - 5000) / 100 : 0;
        const saturate = Math.max(0, 100 + (filters.saturacion || 0) + ((filters.intensidad || 0) * 0.5));
        const hue = filters.matiz || 0;
        
        ctx.drawImage(imageObj, 0, 0);
        const origData = ctx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
        const hslData = applyHSLFiltersToImageData(origData, colorMixerFilters);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportCanvas.width;
        tempCanvas.height = exportCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(hslData, 0, 0);

        ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) sepia(${sepia}%) saturate(${saturate}%) hue-rotate(${hue}deg)`;
        ctx.drawImage(tempCanvas, 0, 0);

        exportCanvas.toBlob(async (blob) => {
            if (!blob) return toast.error('Error al generar la imagen');
            const timestamp = new Date().getTime();
            const key = `photo_${timestamp}.png`;
            const success = await saveAsset(key, blob);
            if (success) toast.success('Imagen guardada en el Hub Local');
            else toast.error('Error al guardar en el Hub');
        }, 'image/png');
    };

    
    return (
        <div className="min-h-full h-screen w-full bg-[#18181b] text-zinc-300 flex flex-col font-sans select-none">
            {/* Filtro SVG oculto para la Curva de Tonos acelerado por GPU */}
            <svg width="0" height="0" className="absolute pointer-events-none">
                <filter id="toneCurve" colorInterpolationFilters="sRGB">
                    <feComponentTransfer>
                        <feFuncR type="table" tableValues="0 1" ref={funcRRef} />
                        <feFuncG type="table" tableValues="0 1" ref={funcGRef} />
                        <feFuncB type="table" tableValues="0 1" ref={funcBRef} />
                    </feComponentTransfer>
                </filter>
            </svg>

            {/* Topbar */}
            <header className="h-12 border-b border-zinc-800 bg-[#18181b] flex items-center justify-between px-4 shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/media-suite')}
                        className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-blue-400" />
                        <h1 className="text-xs font-semibold text-zinc-200">Adobe Lightroom - Core</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium rounded text-zinc-200 flex items-center gap-2 transition-colors"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        Importar
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    
                    <button 
                        onClick={handleSaveToHub}
                        disabled={!imageObj}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded flex items-center gap-2 transition-colors"
                    >
                        <Save className="w-3.5 h-3.5" />
                        Exportar
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 flex overflow-hidden">
                {/* Image Area */}
                <div className="flex-1 bg-[#121212] relative overflow-hidden flex items-center justify-center p-8">
                    {!imageObj ? (
                        <div className="text-center">
                            <ImageIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                            <p className="text-sm text-zinc-500 font-medium">Importar foto para editar</p>
                        </div>
                    ) : (
                        <canvas 
                            ref={canvasRef} 
                            className="max-w-full max-h-full object-contain block shadow-2xl transition-none"
                        />
                    )}
                </div>

                {/* Right Sidebar Container */}
                <div className="flex shrink-0 h-full border-l border-zinc-800 bg-[#18181b]">
                    
                    {/* Inner Edit Panel */}
                    <aside className="w-[310px] flex flex-col h-full overflow-y-auto scrollbar-hide">
                        
                        {/* Histogram Mockup */}
                        <div className="h-32 bg-[#1f1f23] border-b border-zinc-800 relative p-2 overflow-hidden flex items-end">
                            <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full opacity-70">
                                <path d="M0,50 L0,40 Q10,10 20,30 T40,20 T60,10 T80,25 T100,40 L100,50 Z" fill="rgba(239,68,68,0.4)" />
                                <path d="M0,50 L0,45 Q15,5 25,20 T45,15 T65,30 T85,15 T100,45 L100,50 Z" fill="rgba(34,197,94,0.4)" />
                                <path d="M0,50 L0,30 Q5,0 15,25 T35,35 T55,10 T75,20 T100,35 L100,50 Z" fill="rgba(59,130,246,0.4)" />
                                <path d="M0,50 L0,35 Q10,15 20,25 T40,20 T60,20 T80,20 T100,40 L100,50 Z" fill="rgba(255,255,255,0.2)" />
                            </svg>
                        </div>

                        <div className="p-4 flex flex-col gap-4 pb-20">
                            {/* Editar Header */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-zinc-200">Editar</span>
                                <div className="flex gap-1">
                                    <button className="px-2 py-0.5 bg-[#27272a] hover:bg-[#3f3f46] text-[10px] font-semibold text-zinc-300 rounded border border-zinc-700/50">Auto</button>
                                    <button className="px-2 py-0.5 bg-[#27272a] hover:bg-[#3f3f46] text-[10px] font-semibold text-zinc-300 rounded border border-zinc-700/50">B y N</button>
                                    <button className="px-2 py-0.5 bg-[#27272a] hover:bg-[#3f3f46] text-[10px] font-semibold text-zinc-300 rounded border border-zinc-700/50">HDR</button>
                                    <button className="px-1.5 py-0.5 hover:bg-[#3f3f46] text-zinc-400 rounded"><Info size={14} /></button>
                                </div>
                            </div>

                            <hr className="border-zinc-800" />

                            {/* LUZ Section */}
                            <div>
                                <button 
                                    onClick={() => toggleAccordion('luz')}
                                    className="w-full flex items-center gap-2 text-xs font-bold text-zinc-200 mb-3 hover:text-white"
                                >
                                    <svg className={`w-3 h-3 transition-transform ${accordions.luz ? '' : '-rotate-90'}`} viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    Luz
                                </button>
                                
                                {accordions.luz && (
                                    <div className="pl-5 space-y-4 pr-2">
                                        <LrSlider label="Exposición" value={filters.exposicion} defaultValue={0} min={-5} max={5} step={0.01} onDrag={(v) => handleFilterDrag('exposicion', v)} onCommit={(v) => handleFilterCommit('exposicion', v)} />
                                        <LrSlider label="Contraste" value={filters.contraste} defaultValue={0} min={-100} max={100} step={1} onDrag={(v) => handleFilterDrag('contraste', v)} onCommit={(v) => handleFilterCommit('contraste', v)} />
                                        <LrSlider label="Iluminaciones" value={filters.iluminaciones} defaultValue={0} min={-100} max={100} step={1} onDrag={(v) => handleFilterDrag('iluminaciones', v)} onCommit={(v) => handleFilterCommit('iluminaciones', v)} />
                                        <LrSlider label="Sombras" value={filters.sombras} defaultValue={0} min={-100} max={100} step={1} onDrag={(v) => handleFilterDrag('sombras', v)} onCommit={(v) => handleFilterCommit('sombras', v)} />
                                        <LrSlider label="Blancos" value={filters.blancos} defaultValue={0} min={-100} max={100} step={1} onDrag={(v) => handleFilterDrag('blancos', v)} onCommit={(v) => handleFilterCommit('blancos', v)} />
                                        <LrSlider label="Negros" value={filters.negros} defaultValue={0} min={-100} max={100} step={1} onDrag={(v) => handleFilterDrag('negros', v)} onCommit={(v) => handleFilterCommit('negros', v)} />
                                    </div>
                                )}
                            </div>

                            {/* CURVA DE PUNTOS Section */}
                            <div className="bg-[#18181b] rounded-lg overflow-hidden border border-zinc-800/80 mt-2">
                                <button 
                                    onClick={() => toggleAccordion('curva')}
                                    className="w-full flex items-center justify-between p-2.5 bg-[#0a0a0a] hover:bg-[#111111] transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-zinc-800 rounded flex items-center justify-center border border-zinc-700/50">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21c3 0 7-1 7-8s5-8 11-8"/></svg>
                                        </div>
                                        <span className="text-xs font-bold text-zinc-200">Curva de puntos</span>
                                    </div>
                                    <svg className={`w-3 h-3 text-zinc-400 transition-transform ${accordions.curva ? '' : '-rotate-90'}`} viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                
                                {accordions.curva && (
                                    <div className="p-3 bg-[#0a0a0a]">
                                        {/* Selectores de canal */}
                                        <div className="flex justify-center gap-3 mb-4">
                                            {['rgb', 'red', 'green', 'blue'].map((ch) => {
                                                const colors = {
                                                    'rgb': { bg: 'bg-zinc-300', border: 'border-zinc-500' },
                                                    'red': { bg: 'bg-red-500', border: 'border-red-900' },
                                                    'green': { bg: 'bg-green-500', border: 'border-green-900' },
                                                    'blue': { bg: 'bg-blue-500', border: 'border-blue-900' },
                                                };
                                                const isActive = curveState.channel === ch;
                                                return (
                                                    <button 
                                                        key={ch}
                                                        onClick={() => setCurveState(prev => ({ ...prev, channel: ch }))}
                                                        className={`w-3 h-3 rounded-full flex items-center justify-center border-2 ${isActive ? 'border-zinc-400' : colors[ch].border} transition-colors`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full ${colors[ch].bg} ${!isActive && ch !== 'rgb' ? 'opacity-0' : ''}`}></div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        
                                        {/* Editor de Curva Interactivo */}
                                        <div className="h-44 bg-[#1e1e1e] border border-zinc-800 rounded-md relative flex items-center justify-center mb-3">
                                            <LrToneCurve 
                                                curveState={curveState} 
                                                onDrag={(pts) => {
                                                    const newState = { ...curveState, points: { ...curveState.points, [curveState.channel]: pts } };
                                                    updateCurveFilterDOM(newState);
                                                }}
                                                onCommit={(pts) => {
                                                    const newState = { ...curveState, points: { ...curveState.points, [curveState.channel]: pts } };
                                                    setCurveState(newState);
                                                }}
                                            />
                                        </div>

                                        {/* Perfeccionar Saturación */}
                                        <div className="px-1">
                                            <LrSlider 
                                            label="Perfeccionar saturación" 
                                            value={curveState.refineSaturation} 
                                            defaultValue={100}
                                            min={0} max={100} 
                                            onDrag={(v) => setCurveState(p => ({ ...p, refineSaturation: parseInt(v) }))} 
                                            onCommit={(v) => setCurveState(p => ({ ...p, refineSaturation: parseInt(v) }))} 
                                            hideValue={true}
                                        />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <hr className="border-zinc-800 my-2" />

                            {/* COLOR Section */}
                            <div>
                                <button 
                                    onClick={() => toggleAccordion('color')}
                                    className="w-full flex items-center gap-2 text-xs font-bold text-zinc-200 mb-3 hover:text-white"
                                >
                                    <svg className={`w-3 h-3 transition-transform ${accordions.color ? '' : '-rotate-90'}`} viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    Color
                                </button>
                                
                                {accordions.color && (
                                    <div className="pl-5 space-y-4 pr-2">
                                        <div className="flex items-center justify-between text-xs mb-2">
                                            <span className="font-semibold text-zinc-400">Equilibrio de blancos</span>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-zinc-300">Como se tomó</span>
                                                <svg width="8" height="5" viewBox="0 0 10 6" fill="none" className="text-zinc-400"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                <div className="w-5 h-5 bg-[#27272a] rounded flex items-center justify-center ml-1 cursor-pointer hover:bg-[#3f3f46]">
                                                    <Pipette size={12} className="text-zinc-400" />
                                                </div>
                                            </div>
                                        </div>

                                        <LrSlider 
                                            label="Temp" 
                                            value={filters.temp} 
                                            defaultValue={4300}
                                            min={2000} max={50000} 
                                            onDrag={(v) => handleFilterDrag('temp', v)} 
                                            onCommit={(v) => handleFilterCommit('temp', v)} 
                                            gradientTrack="bg-gradient-to-r from-blue-500 via-[#fcf5eb] to-yellow-500"
                                        />
                                        <LrSlider 
                                            label="Matiz" 
                                            value={filters.matiz} 
                                            defaultValue={12}
                                            min={-150} max={150} 
                                            onDrag={(v) => handleFilterDrag('matiz', v)} 
                                            onCommit={(v) => handleFilterCommit('matiz', v)} 
                                            gradientTrack="bg-gradient-to-r from-green-500 via-gray-300 to-fuchsia-500"
                                        />
                                        <LrSlider 
                                            label="Intensidad" 
                                            value={filters.intensidad} 
                                            defaultValue={28}
                                            min={-100} max={100} 
                                            onDrag={(v) => handleFilterDrag('intensidad', v)} 
                                            onCommit={(v) => handleFilterCommit('intensidad', v)} 
                                            gradientTrack="bg-gradient-to-r from-[#6b7280] to-[#eab308]"
                                        />
                                        <LrSlider 
                                            label="Saturación" 
                                            value={filters.saturacion} 
                                            defaultValue={0}
                                            min={-100} max={100} 
                                            onDrag={(v) => handleFilterDrag('saturacion', v)} 
                                            onCommit={(v) => handleFilterCommit('saturacion', v)} 
                                            gradientTrack="bg-gradient-to-r from-[#6b7280] to-[#ef4444]"
                                        />

                                        {/* Mezclador de colores Sub-panel */}
                                        <div className="bg-[#09090b] rounded-lg p-3 mt-4">
                                            <div className="flex items-center justify-between mb-3 cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    <CircleDashed size={14} className="text-zinc-500" />
                                                    <span className="text-[11px] font-bold text-zinc-200">Mezclador de colores</span>
                                                </div>
                                                <svg className="w-2.5 h-2.5 text-zinc-400" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="text-[10px] font-bold text-zinc-400">Ajustar</span>
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-200 cursor-pointer">
                                                    Color
                                                    <svg className="w-2.5 h-2.5" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mb-5 px-1">
                                                {['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'].map(color => {
                                                    const hexMap = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7', magenta: '#d946ef' };
                                                    const hex = hexMap[color];
                                                    const isSelected = colorMixerActiveColor === color;
                                                    return (
                                                        <div key={color} 
                                                             className="w-3.5 h-3.5 rounded-full cursor-pointer flex items-center justify-center transition-all"
                                                             style={{ border: `1.5px solid ${hex}`, backgroundColor: isSelected ? hex : 'transparent' }}
                                                             onClick={() => setColorMixerActiveColor(color)}>
                                                            {isSelected && <div className="w-[4px] h-[4px] bg-white rounded-full"></div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <LrSlider 
                                                label="Tono" 
                                                value={colorMixerFilters[colorMixerActiveColor].tono} 
                                                defaultValue={0}
                                                min={-100} max={100} 
                                                onDrag={(v) => setColorMixerFilters(prev => ({ ...prev, [colorMixerActiveColor]: { ...prev[colorMixerActiveColor], tono: v } }))} 
                                                onCommit={(v) => setColorMixerFilters(prev => ({ ...prev, [colorMixerActiveColor]: { ...prev[colorMixerActiveColor], tono: v } }))} 
                                                gradientTrack="bg-gradient-to-r from-[#d946ef] via-zinc-700 to-[#eab308]"
                                            />
                                            <LrSlider 
                                                label="Saturación" 
                                                value={colorMixerFilters[colorMixerActiveColor].saturacion} 
                                                defaultValue={0}
                                                min={-100} max={100} 
                                                onDrag={(v) => setColorMixerFilters(prev => ({ ...prev, [colorMixerActiveColor]: { ...prev[colorMixerActiveColor], saturacion: v } }))} 
                                                onCommit={(v) => setColorMixerFilters(prev => ({ ...prev, [colorMixerActiveColor]: { ...prev[colorMixerActiveColor], saturacion: v } }))} 
                                                gradientTrack={
                                                    colorMixerActiveColor === 'red' ? 'bg-gradient-to-r from-zinc-600 to-red-500' :
                                                    colorMixerActiveColor === 'orange' ? 'bg-gradient-to-r from-zinc-600 to-orange-500' :
                                                    colorMixerActiveColor === 'yellow' ? 'bg-gradient-to-r from-zinc-600 to-yellow-500' :
                                                    colorMixerActiveColor === 'green' ? 'bg-gradient-to-r from-zinc-600 to-green-500' :
                                                    colorMixerActiveColor === 'cyan' ? 'bg-gradient-to-r from-zinc-600 to-cyan-500' :
                                                    colorMixerActiveColor === 'blue' ? 'bg-gradient-to-r from-zinc-600 to-blue-500' :
                                                    colorMixerActiveColor === 'purple' ? 'bg-gradient-to-r from-zinc-600 to-purple-500' :
                                                    'bg-gradient-to-r from-zinc-600 to-fuchsia-500'
                                                }
                                            />
                                            <LrSlider 
                                                label="Luminancia" 
                                                value={colorMixerFilters[colorMixerActiveColor].luminancia} 
                                                defaultValue={0}
                                                min={-100} max={100} 
                                                onDrag={(v) => setColorMixerFilters(prev => ({ ...prev, [colorMixerActiveColor]: { ...prev[colorMixerActiveColor], luminancia: v } }))} 
                                                onCommit={(v) => setColorMixerFilters(prev => ({ ...prev, [colorMixerActiveColor]: { ...prev[colorMixerActiveColor], luminancia: v } }))} 
                                                gradientTrack="bg-gradient-to-r from-black via-[#7f1d1d] to-white"
                                            />
                                        </div>

                                        {/* Color de punto Sub-panel */}
                                        <div className="bg-[#09090b] rounded-lg p-3 mt-2">
                                            <div className="flex items-center justify-between cursor-pointer mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3.5 h-3.5 rounded border-[1.5px] border-zinc-600 flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></div>
                                                    </div>
                                                    <span className="text-[11px] font-bold text-zinc-200">Color de punto</span>
                                                </div>
                                                <svg className="w-2.5 h-2.5 text-zinc-400" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            </div>
                                            
                                            <div className="mt-4 flex items-center justify-between">
                                                <div className="bg-[#3b82f6] text-white text-[10px] font-semibold py-2 px-3 rounded shadow-sm cursor-pointer relative">
                                                    Seleccione un color de su foto
                                                    {/* Flecha a la derecha */}
                                                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-[#3b82f6] rotate-45"></div>
                                                </div>
                                                <div className="w-6 h-6 bg-[#27272a] rounded flex items-center justify-center cursor-pointer hover:bg-[#3f3f46]">
                                                    <Pipette size={12} className="text-zinc-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* Far Right Tools Column */}
                    <div className="w-[45px] bg-[#18181b] border-l border-zinc-800 flex flex-col items-center py-4 gap-4 shrink-0">
                        {[
                            { icon: Wand2, id: 'wand' },
                            { icon: Crop, id: 'crop' },
                            { icon: Eraser, id: 'heal' },
                            { icon: CircleDashed, id: 'mask' },
                        ].map((tool) => (
                            <button 
                                key={tool.id}
                                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                            >
                                <tool.icon size={16} strokeWidth={2} />
                            </button>
                        ))}
                        
                        <div className="relative w-10 h-10 flex items-center justify-center">
                            <div className="absolute left-0 w-0.5 h-6 bg-white rounded-r"></div>
                            <div className="w-8 h-8 flex items-center justify-center text-zinc-900 bg-zinc-200 rounded">
                                <SlidersHorizontal size={16} strokeWidth={2.5} />
                            </div>
                        </div>

                        {[
                            { icon: Clock, id: 'history' },
                        ].map((tool) => (
                            <button 
                                key={tool.id}
                                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                            >
                                <tool.icon size={16} strokeWidth={2} />
                            </button>
                        ))}

                        <button className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors mt-2">
                            <MoreHorizontal size={16} />
                        </button>

                        <div className="mt-auto flex flex-col gap-4">
                            <button className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors">
                                <Tag size={16} />
                            </button>
                            <button className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors">
                                <Info size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
