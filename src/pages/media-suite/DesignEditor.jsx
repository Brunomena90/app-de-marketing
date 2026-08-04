import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Text as KonvaText, Image as KonvaImage, Transformer, Line } from 'react-konva';
import { ArrowLeft, Save, Type, Square, Image as ImageIcon, Trash2, Palette, PenTool, Layers, Eye, EyeOff, MousePointer2, X, FileImage, FilePlus, Hand } from 'lucide-react';
import { saveAsset } from '../../lib/mediaStore';
import { toast } from 'sonner';

// Componente para imágenes dentro de Konva
const URLImage = ({ image, draggable, onClick, onTap }) => {
    const [img] = useState(() => {
        const i = new window.Image();
        i.src = image.src;
        return i;
    });

    return (
        <KonvaImage
            image={img}
            x={image.x}
            y={image.y}
            width={image.width}
            height={image.height}
            opacity={image.opacity !== undefined ? image.opacity : 1}
            draggable={draggable}
            onClick={onClick}
            onTap={onTap}
            id={image.id}
        />
    );
};

export default function DesignEditor() {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('start'); // 'start', 'editor'
    const [canvasConfig, setCanvasConfig] = useState({ width: 1080, height: 1080, unit: 'px', orientation: 'landscape', mode: 'RGB', bitDepth: 8 });
    const [shapes, setShapes] = useState([]);
    const [selectedId, selectShape] = useState(null);
    const [tool, setTool] = useState('select'); // 'select', 'brush', 'hand'
    
    // Zoom y Pan
    const [stageScale, setStageScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
    const containerRef = useRef(null);
    
    const isDrawing = useRef(false);
    const stageRef = useRef(null);
    const trRef = useRef(null);
    const fileInputRef = useRef(null);
    const psdInputRef = useRef(null);

    React.useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setContainerSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight
                });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, [activeView]);

    const fitCanvasToScreen = (w, h) => {
        if (containerRef.current) {
            const { offsetWidth, offsetHeight } = containerRef.current;
            const scale = Math.min((offsetWidth - 60) / w, (offsetHeight - 60) / h);
            const finalScale = scale > 0 ? scale : 1;
            setStageScale(finalScale);
            // Center the canvas
            setStagePos({
                x: (offsetWidth - w * finalScale) / 2,
                y: (offsetHeight - h * finalScale) / 2
            });
        }
    };

    const handleMouseDown = (e) => {
        const clickedOnEmpty = e.target === e.target.getStage() || e.target.id() === 'canvas-bg';
        
        if (tool === 'select' && clickedOnEmpty) {
            selectShape(null);
            return;
        }

        if (tool === 'brush') {
            isDrawing.current = true;
            const pos = e.target.getStage().getPointerPosition();
            const relativePos = {
                x: (pos.x - stagePos.x) / stageScale,
                y: (pos.y - stagePos.y) / stageScale
            };
            const newLine = {
                id: `path_${Date.now()}`,
                type: 'path',
                points: [relativePos.x, relativePos.y],
                stroke: '#3b82f6',
                strokeWidth: 4 / stageScale, // Adjust brush size based on scale?
                tension: 0.5,
                lineCap: 'round',
                lineJoin: 'round',
                visible: true,
                name: 'Trazo Vectorial'
            };
            setShapes([...shapes, newLine]);
        }
    };

    const handleMouseMove = (e) => {
        if (!isDrawing.current || tool !== 'brush') {
            return;
        }
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        const relativePos = {
            x: (pos.x - stagePos.x) / stageScale,
            y: (pos.y - stagePos.y) / stageScale
        };
        let lastLine = shapes[shapes.length - 1];
        lastLine.points = lastLine.points.concat([relativePos.x, relativePos.y]);
        
        // update last line
        shapes.splice(shapes.length - 1, 1, lastLine);
        setShapes(shapes.concat());
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    const handleWheel = (e) => {
        e.evt.preventDefault();
        if (e.evt.ctrlKey || e.evt.metaKey) {
            // Zoom
            const scaleBy = 1.1;
            const stage = stageRef.current;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
            setStageScale(newScale);
            setStagePos({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            });
        } else {
            // Pan
            setStagePos({
                x: stagePos.x - e.evt.deltaX,
                y: stagePos.y - e.evt.deltaY
            });
        }
    };

    // Funciones para añadir elementos
    const addRect = () => {
        const newRect = {
            id: `rect_${Date.now()}`,
            type: 'rect',
            x: 100, y: 100,
            width: 150, height: 100,
            fill: '#3b82f6',
            visible: true,
            name: 'Rectángulo'
        };
        setShapes([...shapes, newRect]);
        setTool('select');
    };

    const addText = () => {
        const newText = {
            id: `text_${Date.now()}`,
            type: 'text',
            text: 'Nuevo Texto',
            x: 150, y: 150,
            fontSize: 40,
            fill: '#ffffff',
            visible: true,
            name: 'Texto'
        };
        setShapes([...shapes, newText]);
        setTool('select');
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const newImage = {
                id: `img_${Date.now()}`,
                type: 'image',
                src: event.target.result,
                x: 100, y: 100,
                width: 200, height: 200,
                visible: true,
                name: file.name
            };
            setShapes([...shapes, newImage]);
            setTool('select');
        };
        reader.readAsDataURL(file);
    };

    const handleOpenFileClick = async () => {
        const isElectron = navigator.userAgent.toLowerCase().includes('electron');
        
        if (isElectron && window.electronAPI && window.electronAPI.selectFile) {
            // Usar el selector nativo de OS para evitar el límite de Chromium
            try {
                const result = await window.electronAPI.selectFile({
                    filters: [{ name: 'Photoshop Document', extensions: ['psd', 'psb'] }]
                });
                
                if (!result.canceled && result.filePaths.length > 0) {
                    processNativeFile(result.filePaths[0]);
                }
            } catch (error) {
                console.error('Error selecting file natively:', error);
                toast.error('Error al abrir el selector de archivos');
            }
        } else {
            // Fallback web
            if (psdInputRef.current) {
                psdInputRef.current.click();
            }
        }
    };

    const processNativeFile = async (filePath) => {
        const loadingToast = toast.loading('Procesando archivo PSD/PSB nativo (backend)...');
        try {
            const response = await window.electronAPI.processPsdLocally(filePath);
            
            if (!response.success) {
                throw new Error(response.error);
            }
            
            if (response.layers && response.layers.length > 0) {
                const newShapes = response.layers.map(layer => ({
                    id: `psd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'image',
                    src: layer.url,
                    x: layer.x,
                    y: layer.y,
                    width: layer.width,
                    height: layer.height,
                    visible: layer.visible,
                    name: layer.name,
                    opacity: layer.opacity
                }));
                
                setShapes(newShapes.reverse());
                const w = response.width || 800;
                const h = response.height || 600;
                setCanvasConfig({ ...canvasConfig, width: w, height: h });
                toast.success('Archivo importado correctamente', { id: loadingToast });
                setActiveView('editor');
                // Use setTimeout to allow DOM to render and container to be measured
                setTimeout(() => fitCanvasToScreen(w, h), 50);
            } else {
                toast.info('No se encontraron capas válidas o vacías', { id: loadingToast });
            }
            setTool('select');
        } catch (error) {
            console.error('Frontend error processing PSD:', error);
            toast.error(`Error al procesar el archivo: ${error.message || 'Error desconocido'}`, { 
                id: loadingToast, 
                duration: 10000
            });
        }
    };

    const handlePsdUpload = async (e) => {
        // En la versión web (fallback), ya no podemos soportar PSD pesados porque movimos el motor al backend.
        // Pero mantendremos un placeholder si es necesario, o lanzamos error.
        toast.error('El soporte para archivos de Photoshop está reservado para la aplicación de escritorio debido al alto uso de recursos.');
        if (psdInputRef.current) psdInputRef.current.value = '';
    };

    const removeSelected = () => {
        if (selectedId) {
            setShapes(shapes.filter(s => s.id !== selectedId));
            selectShape(null);
        }
    };

    const toggleLayerVisibility = (id) => {
        setShapes(shapes.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
    };

    const moveLayerUp = (index) => {
        if (index === shapes.length - 1) return;
        const newShapes = [...shapes];
        const temp = newShapes[index];
        newShapes[index] = newShapes[index + 1];
        newShapes[index + 1] = temp;
        setShapes(newShapes);
    };

    const moveLayerDown = (index) => {
        if (index === 0) return;
        const newShapes = [...shapes];
        const temp = newShapes[index];
        newShapes[index] = newShapes[index - 1];
        newShapes[index - 1] = temp;
        setShapes(newShapes);
    };

    const handleCreateNew = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        let w = parseInt(formData.get('width'));
        let h = parseInt(formData.get('height'));
        
        if (formData.get('orientation') === 'portrait' && w > h) {
            [w, h] = [h, w]; // Swap
        } else if (formData.get('orientation') === 'landscape' && h > w) {
            [w, h] = [h, w]; // Swap
        }

        setCanvasConfig({
            width: w,
            height: h,
            unit: formData.get('unit'),
            orientation: formData.get('orientation'),
            mode: formData.get('mode'),
            bitDepth: parseInt(formData.get('bitDepth'))
        });
        setShapes([]);
        setActiveView('editor');
    };

    const closeDocument = () => {
        setActiveView('start');
        setShapes([]);
        selectShape(null);
        setStageScale(1);
        setStagePos({ x: 0, y: 0 });
    };


    // Manejar exportación
    const handleSaveToHub = () => {
        if (!stageRef.current) return;
        
        const previousSelection = selectedId;
        selectShape(null);
        
        setTimeout(() => {
            const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
            
            fetch(dataURL)
                .then(res => res.blob())
                .then(async blob => {
                    const timestamp = new Date().getTime();
                    const key = `design_${timestamp}.png`;
                    const success = await saveAsset(key, blob);
                    if (success) {
                        toast.success('Diseño guardado en el Hub Local');
                    } else {
                        toast.error('Error al guardar diseño');
                    }
                    selectShape(previousSelection);
                });
        }, 50);
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
                        <Palette className="w-5 h-5 text-fuchsia-400" />
                        <h1 className="font-semibold text-white">Diseñador Avanzado</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {activeView === 'editor' && (
                        <button 
                            onClick={closeDocument}
                            className="p-1.5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg flex items-center transition-colors"
                            title="Cerrar Documento"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                    <button 
                        onClick={handleSaveToHub}
                        className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Guardar
                    </button>
                </div>
            </header>

            <input 
                type="file" 
                ref={psdInputRef} 
                onChange={handlePsdUpload} 
                accept=".psd,.psb" 
                className="hidden" 
            />

            {/* Main Workspace */}
            {activeView === 'start' ? (
                <main className="flex-1 flex overflow-hidden items-center justify-center p-8">
                    <div className="flex w-full max-w-4xl gap-8">
                        {/* Abrir Existente */}
                        <div className="flex-1 bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 text-blue-400">
                                <FileImage className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Abrir Archivo</h2>
                            <p className="text-zinc-400 mb-8 max-w-sm">Carga un archivo de Photoshop (.psd, .psb) para continuar trabajando con todas tus capas.</p>
                            <button 
                                onClick={handleOpenFileClick} 
                                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl flex items-center gap-2 transition-colors"
                            >
                                Seleccionar Archivo
                            </button>
                        </div>

                        {/* Nuevo Documento */}
                        <form onSubmit={handleCreateNew} className="flex-1 bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-8 flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-400">
                                    <FilePlus className="w-6 h-6" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Nuevo Documento</h2>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Ancho</label>
                                    <input type="number" name="width" defaultValue="1080" required className="w-full bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500" />
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Alto</label>
                                    <input type="number" name="height" defaultValue="1080" required className="w-full bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Unidad</label>
                                    <select name="unit" className="w-full bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500">
                                        <option value="px">Píxeles</option>
                                        <option value="cm">Centímetros</option>
                                        <option value="mm">Milímetros</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Orientación</label>
                                    <select name="orientation" className="w-full bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500">
                                        <option value="portrait">Vertical</option>
                                        <option value="landscape">Horizontal</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Modo de Color</label>
                                    <select name="mode" className="w-full bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500">
                                        <option value="RGB">RGB</option>
                                        <option value="CMYK">CMYK</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-zinc-400 mb-1">Profundidad (bits)</label>
                                    <select name="bitDepth" className="w-full bg-[#111] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-fuchsia-500">
                                        <option value="8">8 bits</option>
                                        <option value="16">16 bits</option>
                                        <option value="32">32 bits</option>
                                    </select>
                                </div>
                            </div>

                            <button type="submit" className="w-full py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-medium rounded-xl transition-colors mt-auto">
                                Crear Lienzo
                            </button>
                        </form>
                    </div>
                </main>
            ) : (
                <main className="flex-1 flex overflow-hidden">
                {/* Tools Sidebar */}
                <aside className="w-16 border-r border-zinc-800 bg-[#0a0a0a] flex flex-col items-center py-4 gap-4 shrink-0">
                    <button onClick={() => setTool('select')} className={`p-3 rounded-xl transition-colors ${tool === 'select' ? 'bg-fuchsia-600/20 text-fuchsia-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Seleccionar">
                        <MousePointer2 className="w-6 h-6" />
                    </button>
                    <button onClick={() => setTool('brush')} className={`p-3 rounded-xl transition-colors ${tool === 'brush' ? 'bg-fuchsia-600/20 text-fuchsia-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Pincel Vectorial">
                        <PenTool className="w-6 h-6" />
                    </button>
                    <button onClick={() => setTool('hand')} className={`p-3 rounded-xl transition-colors ${tool === 'hand' ? 'bg-fuchsia-600/20 text-fuchsia-400' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`} title="Mover Lienzo (Mano)">
                        <Hand className="w-6 h-6" />
                    </button>
                    <button onClick={addRect} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Añadir Rectángulo">
                        <Square className="w-6 h-6" />
                    </button>
                    <button onClick={addText} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Añadir Texto">
                        <Type className="w-6 h-6" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Añadir Imagen">
                        <ImageIcon className="w-6 h-6" />
                    </button>
                    <button onClick={() => psdInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Importar PSD/PSB">
                        <Layers className="w-6 h-6 text-blue-400" />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    
                    <div className="h-px w-8 bg-zinc-800 my-2"></div>
                    
                    <button onClick={removeSelected} disabled={!selectedId} className="p-3 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl disabled:opacity-30" title="Eliminar Seleccionado">
                        <Trash2 className="w-6 h-6" />
                    </button>
                </aside>

                {/* Canvas Area */}
                <div 
                    className={`flex-1 bg-[#111] relative overflow-hidden ${
                        tool === 'brush' ? 'cursor-crosshair' : 
                        tool === 'hand' ? (isDrawing.current ? 'cursor-grabbing' : 'cursor-grab') : 
                        'cursor-default'
                    }`} 
                    id="canvas-container"
                    ref={containerRef}
                >
                        <Stage 
                            width={containerSize.width} 
                            height={containerSize.height} 
                            scaleX={stageScale}
                            scaleY={stageScale}
                            x={stagePos.x}
                            y={stagePos.y}
                            draggable={tool === 'hand'}
                            onDragStart={() => {
                                if (tool === 'hand') isDrawing.current = true;
                            }}
                            onDragEnd={(e) => {
                                if (tool === 'hand') {
                                    isDrawing.current = false;
                                    setStagePos({ x: e.target.x(), y: e.target.y() });
                                }
                            }}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMousemove={handleMouseMove}
                            onMouseup={handleMouseUp}
                            onTouchStart={handleMouseDown}
                            onTouchMove={handleMouseMove}
                            onTouchEnd={handleMouseUp}
                            ref={stageRef}
                        >
                            <Layer>
                                {/* Background Rect representing the Canvas Canvas */}
                                <Rect 
                                    id="canvas-bg"
                                    x={0} 
                                    y={0} 
                                    width={canvasConfig.width} 
                                    height={canvasConfig.height} 
                                    fill="white" 
                                    shadowColor="black"
                                    shadowBlur={20}
                                    shadowOpacity={0.5}
                                />
                                {shapes.map((shape) => {
                                    if (shape.visible === false) return null;
                                    
                                    const isSelectable = tool === 'select';

                                    if (shape.type === 'rect') {
                                        return (
                                            <Rect
                                                key={shape.id}
                                                id={shape.id}
                                                x={shape.x}
                                                y={shape.y}
                                                width={shape.width}
                                                height={shape.height}
                                                fill={shape.fill}
                                                opacity={shape.opacity || 1}
                                                draggable={isSelectable}
                                                onClick={() => isSelectable && selectShape(shape.id)}
                                                onTap={() => isSelectable && selectShape(shape.id)}
                                            />
                                        );
                                    }
                                    if (shape.type === 'text') {
                                        return (
                                            <KonvaText
                                                key={shape.id}
                                                id={shape.id}
                                                x={shape.x}
                                                y={shape.y}
                                                text={shape.text}
                                                fontSize={shape.fontSize}
                                                fill={shape.fill}
                                                opacity={shape.opacity || 1}
                                                draggable={isSelectable}
                                                onClick={() => isSelectable && selectShape(shape.id)}
                                                onTap={() => isSelectable && selectShape(shape.id)}
                                            />
                                        );
                                    }
                                    if (shape.type === 'image') {
                                        return (
                                            <URLImage 
                                                key={shape.id} 
                                                image={shape} 
                                                draggable={isSelectable}
                                                onClick={() => isSelectable && selectShape(shape.id)}
                                                onTap={() => isSelectable && selectShape(shape.id)}
                                            />
                                        );
                                    }
                                    if (shape.type === 'path') {
                                        return (
                                            <Line
                                                key={shape.id}
                                                id={shape.id}
                                                points={shape.points}
                                                stroke={shape.stroke}
                                                strokeWidth={shape.strokeWidth}
                                                tension={shape.tension}
                                                lineCap={shape.lineCap}
                                                lineJoin={shape.lineJoin}
                                                opacity={shape.opacity || 1}
                                                draggable={isSelectable}
                                                onClick={() => isSelectable && selectShape(shape.id)}
                                                onTap={() => isSelectable && selectShape(shape.id)}
                                            />
                                        );
                                    }
                                    return null;
                                })}
                                {/* Transformer */}
                                {tool === 'select' && (
                                    <Transformer
                                        ref={(node) => {
                                            if (node && selectedId) {
                                                const selectedNode = stageRef.current.findOne('#' + selectedId);
                                                if (selectedNode) {
                                                    node.nodes([selectedNode]);
                                                    node.getLayer().batchDraw();
                                                }
                                            }
                                        }}
                                    />
                                )}
                            </Layer>
                        </Stage>
                </div>

                {/* Right Sidebar - Layers */}
                <aside className="w-64 border-l border-zinc-800 bg-[#0a0a0a] flex flex-col shrink-0">
                    <div className="p-4 border-b border-zinc-800">
                        <h2 className="font-semibold text-white mb-2">Propiedades</h2>
                        {selectedId ? (
                            <div className="text-sm text-zinc-400">
                                <p>Selección actual:</p>
                                <p className="font-mono text-xs mt-1 text-fuchsia-400 break-all">{selectedId}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500">Usa la herramienta Selección para elegir un elemento.</p>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                        <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                            <Layers className="w-4 h-4" /> Capas
                        </h2>
                        {shapes.length === 0 ? (
                            <p className="text-xs text-zinc-500 text-center py-4">No hay elementos</p>
                        ) : (
                            [...shapes].reverse().map((shape, index, arr) => {
                                // originalIndex es en el array original 'shapes'
                                const originalIndex = arr.length - 1 - index;
                                return (
                                    <div 
                                        key={shape.id} 
                                        className={`flex items-center justify-between p-2 rounded-lg border text-sm transition-colors cursor-pointer ${
                                            selectedId === shape.id 
                                                ? 'border-fuchsia-500 bg-fuchsia-500/10' 
                                                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                                        }`}
                                        onClick={() => {
                                            setTool('select');
                                            selectShape(shape.id);
                                        }}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(shape.id); }}
                                                className="text-zinc-400 hover:text-white"
                                            >
                                                {shape.visible !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
                                            </button>
                                            <span className="text-zinc-300 truncate w-24" title={shape.name || shape.type}>
                                                {shape.name || shape.type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveLayerUp(originalIndex); }}
                                                disabled={originalIndex === shapes.length - 1}
                                                className="p-1 text-zinc-500 hover:text-white disabled:opacity-20"
                                            >
                                                ▲
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveLayerDown(originalIndex); }}
                                                disabled={originalIndex === 0}
                                                className="p-1 text-zinc-500 hover:text-white disabled:opacity-20"
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
                </main>
            )}
        </div>
    );
}
