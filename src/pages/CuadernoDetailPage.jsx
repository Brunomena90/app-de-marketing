import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Printer, FileText, CheckCircle2, AlignLeft, Video, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ScenePickerModal from '../components/ScenePickerModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const CuadernoDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin, activeEmpresa, hasGlobalAccess } = useAuth();
    const [notebook, setNotebook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [noteContent, setNoteContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Check permissions
    useEffect(() => {
        if (!isAdmin && user?.role?.toLowerCase().trim() !== 'editor') {
            toast.error("No tienes permisos para acceder a esta sección");
            navigate('/dashboard');
        }
    }, [user, navigate, isAdmin]);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "cuadernos", id), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                
                // Validación Multi-Tenant Estricta
                const nbEmpresa = data.empresa || 'GRUCOIN';
                if (activeEmpresa !== 'Todas' && nbEmpresa !== activeEmpresa) {
                    toast.error("No tienes acceso a este cuaderno (pertenece a otra empresa)");
                    navigate('/cuadernos');
                    return;
                }

                setNotebook(prev => {
                    if (!prev && data.type === 'nota') {
                        setNoteContent(data.content || '');
                    }
                    return data;
                });
            } else {
                toast.error("El cuaderno no existe");
                navigate('/cuadernos');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, navigate, activeEmpresa]);

    const handleSaveNote = async () => {
        setIsSaving(true);
        try {
            await updateDoc(doc(db, "cuadernos", id), { content: noteContent });
            toast.success("Nota guardada");
        } catch (error) {
            toast.error("Error al guardar la nota");
        }
        setIsSaving(false);
    };

    const setCuadernoType = async (type) => {
        try {
            await updateDoc(doc(db, "cuadernos", id), { type });
            toast.success(type === 'nota' ? "Cuaderno configurado como Nota" : "Cuaderno configurado como Guía");
        } catch (error) {
            toast.error("Error al configurar el tipo");
        }
    };

    const handleImportScenes = async (data) => {
        try {
            const sectionExists = notebook.sections?.some(s => s.requestId === data.requestId);

            let newSections = [...(notebook.sections || [])];

            if (sectionExists) {
                // Agregar escenas a sección existente
                newSections = newSections.map(s => {
                    if (s.requestId === data.requestId) {
                        return { ...s, scenes: [...s.scenes, ...data.scenes] };
                    }
                    return s;
                });
            } else {
                // Crear nueva sección
                newSections.push(data);
            }

            await updateDoc(doc(db, "cuadernos", id), { sections: newSections });
            toast.success("Escenas importadas");
        } catch (error) {
            console.error(error);
            toast.error("Error al importar");
        }
    };

    const removeSection = async (index) => {
        const newSections = notebook.sections.filter((_, i) => i !== index);
        await updateDoc(doc(db, "cuadernos", id), { sections: newSections });
    };

    const toggleSceneCompletion = async (sectionIndex, sceneIndex) => {
        try {
            const section = notebook.sections[sectionIndex];
            const scene = section.scenes[sceneIndex];
            const newStatus = !scene.completed;

            // 1. Actualizar cuaderno
            const newSections = [...notebook.sections];
            newSections[sectionIndex].scenes[sceneIndex] = { ...scene, completed: newStatus };
            await updateDoc(doc(db, "cuadernos", id), { sections: newSections });

            // 2. Sincronizar con solicitud original
            if (section.requestId) {
                const reqRef = doc(db, "solicitudes_contenido", section.requestId);
                const reqSnap = await getDoc(reqRef);
                if (reqSnap.exists()) {
                    const reqData = reqSnap.data();
                    const newChecklist = [...(reqData.checklist || [])];

                    // Buscar la escena por índice original o por texto (fallback)
                    let indexToUpdate = -1;
                    if (scene.originalIndex !== undefined && newChecklist[scene.originalIndex]?.text === scene.text) {
                        indexToUpdate = scene.originalIndex;
                    } else {
                        // Buscar por coincidencia exacta de texto
                        indexToUpdate = newChecklist.findIndex(item => item.text === scene.text);
                    }

                    if (indexToUpdate !== -1) {
                        newChecklist[indexToUpdate].completed = newStatus;
                        await updateDoc(reqRef, { checklist: newChecklist });
                    }
                }
            }
            toast.success(newStatus ? "Escena realizada" : "Escena pendiente");
        } catch (error) {
            console.error(error);
            toast.error("Error al sincronizar");
        }
    };

    const removeScene = async (sectionIndex, sceneIndex) => {
        const newSections = [...notebook.sections];
        newSections[sectionIndex].scenes = newSections[sectionIndex].scenes.filter((_, i) => i !== sceneIndex);
        await updateDoc(doc(db, "cuadernos", id), { sections: newSections });
        toast.success("Escena eliminada del cuaderno");
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header Corporativo - Sin Colores
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("CUADERNO DE PRODUCCIÓN", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Proyecto: ${notebook.title}`, pageWidth / 2, 28, { align: 'center' });
        doc.text(`Generado el: ${new Date().toLocaleDateString()} | Por: ${notebook.createdBy || user?.name}`, pageWidth / 2, 33, { align: 'center' });

        let currentY = 45;

        if (!notebook.sections || notebook.sections.length === 0) {
            doc.text("Este cuaderno no contiene escenas importadas.", 20, currentY);
        } else {
            notebook.sections.forEach((section, sIdx) => {
                // Título de la Sección (Solicitud)
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0);
                doc.text(section.requestTitle.toUpperCase(), 20, currentY);
                currentY += 5;

                // Tabla de Escenas
                const rows = section.scenes.map(scene => [
                    scene.completed ? "[X]" : "[ ]",
                    scene.text,
                    scene.type
                ]);

                autoTable(doc, {
                    startY: currentY,
                    theme: 'grid',
                    head: [['ESTADO', 'ESCENA / TAREA', 'TIPO']],
                    body: rows,
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                    styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
                    columnStyles: {
                        0: { cellWidth: 20, halign: 'center' },
                        2: { cellWidth: 35 }
                    },
                    margin: { left: 20, right: 20 }
                });

                currentY = doc.lastAutoTable.finalY + 15;

                // Salto de página si se acaba el espacio
                if (currentY > 250 && sIdx < notebook.sections.length - 1) {
                    doc.addPage();
                    currentY = 20;
                }
            });
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Artories Management Suite - Cuaderno de Escenas | Página ${i} de ${pageCount}`, pageWidth / 2, 285, { align: 'center' });
        }

        doc.save(`Cuaderno_${notebook.title.replace(/\s+/g, '_')}.pdf`);
        toast.success("PDF Exportado correctamente");
    };

    if (loading) return <div className="h-screen flex items-center justify-center font-medium text-gray-400 italic animate-pulse">Cargando documento...</div>;

    const currentType = notebook.type || (notebook.sections?.length > 0 ? 'guia' : null);

    if (!currentType) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative">
                <button onClick={() => navigate('/cuadernos')} className="absolute top-6 left-6 p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                    <ArrowLeft size={24} />
                </button>
                <div className="max-w-3xl w-full">
                    <h2 className="text-3xl font-black text-gray-800 mb-2 text-center">{notebook.title}</h2>
                    <p className="text-gray-500 mb-10 text-center">Selecciona el tipo de cuaderno que deseas crear</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button onClick={() => setCuadernoType('nota')} className="bg-white p-10 rounded-3xl shadow-sm border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all group text-left flex flex-col items-center">
                            <div className="p-6 bg-blue-50 text-blue-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                                <AlignLeft size={48} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Crear una Nota</h3>
                            <p className="text-gray-500 text-center text-sm">Un espacio libre con editor de texto enriquecido para tomar apuntes, crear listas y estructurar ideas.</p>
                        </button>
                        <button onClick={() => setCuadernoType('guia')} className="bg-white p-10 rounded-3xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all group text-left flex flex-col items-center">
                            <div className="p-6 bg-purple-50 text-purple-600 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                                <Video size={48} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Crear Guía de Producción</h3>
                            <p className="text-gray-500 text-center text-sm">Importa escenas y checklist de tus solicitudes para organizar tu plan de grabación consolidado.</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (currentType === 'nota') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pb-20">
                <div className="sticky top-0 z-40 bg-[#141414]/90 backdrop-blur-md border-b border-[#2a2a2a] px-6 py-3 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/cuadernos')} className="p-2 hover:bg-[#2a2a2a] rounded-full transition-colors text-gray-400">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-sm font-bold text-gray-100 line-clamp-1">{notebook.title}</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cuaderno de Notas</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleSaveNote} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-xs font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                            <Save size={16} /> {isSaving ? "Guardando..." : "Guardar Nota"}
                        </button>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto mt-10 md:mt-16 bg-[#141414] border border-[#2a2a2a] shadow-2xl min-h-[11in] p-12 md:p-20 relative animate-in fade-in slide-in-from-bottom-5 duration-700 editor-container">
                    <div className="mb-10">
                        <h2 className="text-4xl font-black text-gray-100 tracking-tight outline-none">{notebook.title}</h2>
                        <div className="h-1 w-20 bg-blue-600 mt-6 rounded-full"></div>
                    </div>
                    <ReactQuill 
                        theme="snow" 
                        value={noteContent} 
                        onChange={setNoteContent} 
                        className="h-full min-h-[500px]"
                        placeholder="Escribe tus notas aquí..."
                        modules={{
                            toolbar: [
                                [{ 'header': [1, 2, 3, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                ['link'],
                                ['clean']
                            ]
                        }}
                    />
                </div>
                
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .editor-container .ql-container { font-size: 16px; border: none !important; font-family: inherit; }
                    .editor-container .ql-toolbar { border: none !important; border-bottom: 2px solid #2a2a2a !important; margin-bottom: 1rem; padding-bottom: 1rem; }
                    .editor-container .ql-editor { padding: 0; min-height: 500px; color: #e5e5e5; }
                    .editor-container .ql-editor.ql-blank::before { color: #555 !important; font-style: normal; }
                    .editor-container .ql-snow .ql-stroke { stroke: #888; }
                    .editor-container .ql-snow .ql-fill { fill: #888; }
                    .editor-container .ql-snow .ql-picker { color: #888; }
                    .editor-container .ql-snow .ql-picker-options { background-color: #1a1a1a; border-color: #333; }
                    .editor-container .ql-snow .ql-picker-item:hover { color: #fff; }
                ` }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100/50 pb-20">
            {/* TOOLBAR */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/cuadernos')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-gray-800 line-clamp-1">{notebook.title}</h1>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Cuaderno de Escenas</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-bold transition-all border border-gray-200"
                    >
                        <FileText size={16} /> Exportar PDF
                    </button>
                    <button
                        onClick={() => setIsPickerOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95"
                    >
                        <Plus size={16} /> Importar Escenas
                    </button>
                </div>
            </div>

            {/* WORD-LIKE SHEET CONTAINER */}
            <div className="max-w-4xl mx-auto mt-10 md:mt-16 bg-white shadow-2xl min-h-[11in] p-12 md:p-20 relative animate-in fade-in slide-in-from-bottom-5 duration-700">
                {/* PAGE HEADER */}
                <div className="flex items-center gap-4 border-b-2 border-gray-100 pb-8 mb-12">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                        <FileText size={40} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">{notebook.title}</h2>
                        <p className="text-gray-400 font-medium">Plan de Grabación Consolidado</p>
                    </div>
                </div>

                {/* CONTENT */}
                <div className="space-y-12">
                    {notebook.sections && notebook.sections.length > 0 ? (
                        notebook.sections.map((section, sIdx) => (
                            <div key={section.requestId} className="group relative">
                                {/* SECTION HEADER */}
                                <div className="flex justify-between items-end mb-4 border-b border-gray-50 pb-2">
                                    <h3 className="text-lg font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                                        <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                                        {section.requestTitle}
                                    </h3>
                                    <button
                                        onClick={() => removeSection(sIdx)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-red-300 hover:text-red-500 transition-all scale-90"
                                        title="Eliminar Sección"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* SCENES LIST */}
                                <div className="space-y-3 pl-4">
                                    {section.scenes.map((scene, scIdx) => (
                                        <div
                                            key={scIdx}
                                            className={`flex items-start gap-4 p-4 rounded-xl border transition-all group ${scene.completed ? 'bg-green-50/30 border-green-100' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'
                                                }`}
                                        >
                                            <button
                                                onClick={() => toggleSceneCompletion(sIdx, scIdx)}
                                                className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${scene.completed
                                                    ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                                    : 'border-gray-300 bg-white hover:border-blue-400'
                                                    }`}
                                            >
                                                {scene.completed && <CheckCircle2 size={14} />}
                                            </button>
                                            <div className="flex-1 min-w-0" onClick={() => toggleSceneCompletion(sIdx, scIdx)}>
                                                <p className={`text-gray-800 leading-relaxed font-medium transition-all cursor-pointer ${scene.completed ? 'text-gray-400 line-through decoration-green-200' : ''}`}>
                                                    {scene.text}
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded tracking-widest transition-all ${scene.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                        {scene.type}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeScene(sIdx, scIdx);
                                                }}
                                                className="opacity-40 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Eliminar solo de este cuaderno"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* ADD BUTTON BETWEEN/AFTER SECTIONS */}
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={() => setIsPickerOpen(true)}
                                        className="bg-gray-900 text-white p-1 rounded-full shadow-lg hover:bg-blue-600 transition-all hover:scale-110"
                                        title="Importar aquí"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-20 text-center flex flex-col items-center border-2 border-dashed border-gray-100 rounded-3xl">
                            <div className="p-6 bg-gray-50 rounded-full mb-4 text-gray-200">
                                <Plus size={64} />
                            </div>
                            <p className="text-gray-400 font-medium text-lg">Tu cuaderno está vacío</p>
                            <p className="text-sm text-gray-300 mb-6">Empieza importando las escenas de tus solicitudes</p>
                            <button
                                onClick={() => setIsPickerOpen(true)}
                                className="bg-blue-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95"
                            >
                                Seleccionar Escenas
                            </button>
                        </div>
                    )}

                    {/* FINAL ADD BUTTON IF NOT EMPTY */}
                    {notebook.sections?.length > 0 && (
                        <div className="pt-8 flex justify-center border-t border-gray-50">
                            <button
                                onClick={() => setIsPickerOpen(true)}
                                className="flex items-center gap-2 text-gray-300 hover:text-blue-600 font-bold transition-colors group"
                            >
                                <div className="p-2 border-2 border-dashed border-gray-200 group-hover:border-blue-200 rounded-full">
                                    <Plus size={20} />
                                </div>
                                <span>Añadir más escenas</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* FOOTER DECORATION */}
                <div className="absolute bottom-10 left-12 right-12 flex justify-between items-center text-[10px] text-gray-300 font-bold uppercase tracking-widest border-t border-gray-50 pt-4 opacity-50">
                    <span>GCI - Sistema de Gestión</span>
                    <div className="flex gap-4">
                        <span>{new Date().toLocaleDateString()}</span>
                        <span>Pág 1</span>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            <ScenePickerModal
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onImport={handleImportScenes}
                existingSections={notebook.sections || []}
            />

            {/* PRINT STYLES */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .bg-gray-100\\/50 { background-color: white !important; }
                    .sticky, .p-2, button { display: none !important; }
                    .max-w-4xl { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; }
                    body { padding: 0 !important; margin: 0 !important; }
                    .group/scene { border: none !important; padding-left: 0 !important; }
                    .pb-20 { padding-bottom: 0 !important; }
                    .mt-10, .md\\:mt-16 { margin-top: 0 !important; }
                }
            ` }} />
        </div>
    );
};

export default CuadernoDetailPage;
