import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Text as KonvaText, Image as KonvaImage, Transformer } from 'react-konva';
import { ArrowLeft, Save, Type, Square, Image as ImageIcon, Download, Trash2, Palette } from 'lucide-react';
import { saveAsset } from '../../lib/mediaStore';
import { toast } from 'sonner';

// Componente para imágenes dentro de Konva
const URLImage = ({ image }) => {
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
            draggable
            id={image.id}
        />
    );
};

export default function DesignEditor() {
    const navigate = useNavigate();
    const [shapes, setShapes] = useState([]);
    const [selectedId, selectShape] = useState(null);
    const stageRef = useRef(null);
    const trRef = useRef(null);
    const fileInputRef = useRef(null);

    const checkDeselect = (e) => {
        // Deseleccionar si hace clic en el fondo (el Stage)
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
            selectShape(null);
        }
    };

    // Funciones para añadir elementos
    const addRect = () => {
        const newRect = {
            id: `rect_${Date.now()}`,
            type: 'rect',
            x: 100, y: 100,
            width: 150, height: 100,
            fill: '#3b82f6'
        };
        setShapes([...shapes, newRect]);
    };

    const addText = () => {
        const newText = {
            id: `text_${Date.now()}`,
            type: 'text',
            text: 'Nuevo Texto',
            x: 150, y: 150,
            fontSize: 40,
            fill: '#ffffff'
        };
        setShapes([...shapes, newText]);
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
            };
            setShapes([...shapes, newImage]);
        };
        reader.readAsDataURL(file);
    };

    const removeSelected = () => {
        if (selectedId) {
            setShapes(shapes.filter(s => s.id !== selectedId));
            selectShape(null);
        }
    };

    // Manejar exportación
    const handleSaveToHub = () => {
        if (!stageRef.current) return;
        
        // Quitar la selección temporalmente para que no salga el cuadro transformador en la exportación
        const previousSelection = selectedId;
        selectShape(null);
        
        setTimeout(() => {
            const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
            
            // Convertir Base64 a Blob
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
                    selectShape(previousSelection); // Restaurar selección
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
                        <h1 className="font-semibold text-white">Diseñador Gráfico (Local)</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleSaveToHub}
                        className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Enviar al Hub
                    </button>
                </div>
            </header>

            {/* Main Workspace */}
            <main className="flex-1 flex overflow-hidden">
                {/* Tools Sidebar */}
                <aside className="w-16 border-r border-zinc-800 bg-[#0a0a0a] flex flex-col items-center py-4 gap-4 shrink-0">
                    <button onClick={addRect} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Añadir Rectángulo">
                        <Square className="w-6 h-6" />
                    </button>
                    <button onClick={addText} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Añadir Texto">
                        <Type className="w-6 h-6" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl" title="Añadir Imagen">
                        <ImageIcon className="w-6 h-6" />
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
                <div className="flex-1 bg-[#111] relative overflow-hidden flex items-center justify-center p-6" id="canvas-container">
                    <div className="bg-white shadow-2xl ring-1 ring-zinc-800/50">
                        <Stage 
                            width={800} 
                            height={600} 
                            onMouseDown={checkDeselect}
                            onTouchStart={checkDeselect}
                            ref={stageRef}
                        >
                            <Layer>
                                {shapes.map((shape) => {
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
                                                draggable
                                                onClick={() => selectShape(shape.id)}
                                                onTap={() => selectShape(shape.id)}
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
                                                draggable
                                                onClick={() => selectShape(shape.id)}
                                                onTap={() => selectShape(shape.id)}
                                            />
                                        );
                                    }
                                    if (shape.type === 'image') {
                                        return (
                                            <URLImage 
                                                key={shape.id} 
                                                image={shape} 
                                            />
                                        );
                                    }
                                    return null;
                                })}
                                {/* Transformer para redimensionar el seleccionado */}
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
                            </Layer>
                        </Stage>
                    </div>
                </div>

                {/* Right Sidebar - Properties */}
                <aside className="w-64 border-l border-zinc-800 bg-[#0a0a0a] flex flex-col shrink-0 p-4">
                    <h2 className="font-semibold text-white mb-4">Propiedades</h2>
                    {selectedId ? (
                        <div className="text-sm text-zinc-400">
                            <p>Elemento seleccionado:</p>
                            <p className="font-mono text-xs mt-1 text-fuchsia-400">{selectedId}</p>
                            <p className="mt-4 text-xs">Usa los manejadores del lienzo para redimensionar o rotar el elemento.</p>
                        </div>
                    ) : (
                        <p className="text-sm text-zinc-500">Selecciona un elemento en el lienzo para ver sus propiedades.</p>
                    )}
                </aside>
            </main>
        </div>
    );
}
