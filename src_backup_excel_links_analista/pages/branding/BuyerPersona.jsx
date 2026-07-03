import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { User, Target, Zap, Search, Plus, Trash2, Edit3, ArrowLeft, StickyNote, Users, FileText, LayoutTemplate, Link as LinkIcon, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BuyerPersonaCard = ({ persona, onDelete, onEdit }) => {
    const [confirm, setConfirm] = useState(false);

    const handleDelete = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        try {
            await deleteDoc(doc(db, 'brand_personas', persona.id));
            toast.success('Persona eliminada');
            onDelete(persona.id);
        } catch { toast.error('Error al eliminar'); }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all flex flex-col h-full">
            <div className="p-5 flex items-start gap-4 border-b border-gray-800">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 text-2xl font-bold">
                    {persona.imageUrl ? (
                        <img src={persona.imageUrl} alt={persona.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                        persona.name.charAt(0).toUpperCase()
                    )}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="text-white font-bold text-lg truncate">{persona.name}</h3>
                    <p className="text-gray-400 text-sm truncate">{persona.occupation} • {persona.age} años</p>
                    <p className="text-gray-500 text-xs truncate mt-1">{persona.location}</p>
                </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col gap-4">
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Target size={12} className="text-blue-400" /> Objetivos</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{persona.goals || 'Sin definir'}</p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Zap size={12} className="text-cyan-400" /> Puntos de Dolor</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{persona.painPoints || 'Sin definir'}</p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Search size={12} className="text-indigo-400" /> Comportamiento</h4>
                    <p className="text-gray-300 text-sm leading-relaxed">{persona.behavior || 'Sin definir'}</p>
                </div>
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-2 shrink-0">
                <button onClick={() => onEdit(persona)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-medium flex items-center gap-1.5 transition-colors">
                    <Edit3 size={14} /> Editar
                </button>
                <button onClick={handleDelete} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${confirm ? 'bg-red-600/20 text-red-500' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'}`}>
                    <Trash2 size={14} /> {confirm ? 'Confirmar' : 'Eliminar'}
                </button>
            </div>
        </div>
    );
};

// --- MODALES ---

const PersonaModal = ({ onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState(initialData || {
        name: '', age: '', occupation: '', location: '', imageUrl: '',
        goals: '', painPoints: '', behavior: '', notes: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 py-10" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                    {initialData ? <Edit3 size={18} className="text-blue-400"/> : <Plus size={18} className="text-blue-400"/>} 
                    {initialData ? 'Editar Perfil de Persona' : 'Crear Nuevo Perfil'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase">Nombre *</label>
                            <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. Juan Pérez" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase">Edad</label>
                            <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. 35" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase">Ocupación / Cargo</label>
                            <input value={formData.occupation} onChange={e => setFormData({...formData, occupation: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. Gerente de Marketing" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase">Ubicación</label>
                            <input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Ej. Ciudad de México" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase">URL de Foto/Avatar</label>
                            <input value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="https://..." />
                        </div>
                    </div>

                    <hr className="border-gray-800" />

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2"><Target size={14}/> Objetivos y Metas</label>
                            <textarea value={formData.goals} onChange={e => setFormData({...formData, goals: e.target.value})} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" placeholder="¿Qué quiere lograr?" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2"><Zap size={14}/> Puntos de Dolor</label>
                            <textarea value={formData.painPoints} onChange={e => setFormData({...formData, painPoints: e.target.value})} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" placeholder="¿Qué problemas enfrenta?" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2"><Search size={14}/> Comportamiento</label>
                            <textarea value={formData.behavior} onChange={e => setFormData({...formData, behavior: e.target.value})} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" placeholder="Hábitos, preferencias, redes sociales..." />
                        </div>
                    </div>
                    
                    <div className="flex gap-4 pt-4 sticky bottom-0 bg-gray-900 pb-2">
                        <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-bold transition-all">Cancelar</button>
                        <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg">
                            {initialData ? 'Guardar Cambios' : 'Crear Perfil'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const FormularioModal = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 py-10" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                    <FileText size={18} className="text-indigo-400"/> Crear Formulario de Recolección
                </h2>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Título *</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Ej. Encuesta de Satisfacción" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Descripción</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" placeholder="Propósito del formulario..." />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase">Enlace (URL) *</label>
                        <input value={link} onChange={e => setLink(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="https://forms.google.com/..." />
                    </div>
                </div>
                <div className="flex gap-4 pt-6">
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-bold transition-all text-sm">Cancelar</button>
                    <button onClick={() => { if(title && link) { onSave({title, description, link}); onClose(); } else toast.error('Título y enlace son requeridos'); }} className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg text-sm">
                        Guardar Formulario
                    </button>
                </div>
            </div>
        </div>
    );
};

const TemplateModal = ({ onClose, onSave, initialData }) => {
    const [title, setTitle] = useState(initialData?.title || '');
    const [questions, setQuestions] = useState(initialData?.questions || []);

    const addQuestion = () => setQuestions([...questions, { id: Date.now(), text: '' }]);
    const removeQuestion = (id) => setQuestions(questions.filter(q => q.id !== id));
    const updateQuestion = (id, text) => setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 py-6" onClick={onClose}>
            <div className="bg-[#0d1117] border border-gray-700 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                
                <div className="flex items-center justify-between mb-8 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-fuchsia-600/10 flex items-center justify-center text-fuchsia-400">
                            <FileText size={24}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">{initialData ? 'Editor de Encuesta' : 'Nueva Encuesta de Marca'}</h2>
                            <p className="text-gray-500 text-xs">Define las preguntas para tu reporte PDF.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors">
                        <Plus size={24} className="rotate-45" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                    {/* Título */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-[0.2em] px-1">Título General</label>
                        <input 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-gray-900 border-0 border-b-2 border-gray-800 focus:border-fuchsia-500 rounded-none px-4 py-3 text-lg font-bold text-white transition-all placeholder:text-gray-700 outline-none" 
                            placeholder="Nombre de la encuesta..." 
                        />
                    </div>

                    {/* Preguntas */}
                    <div className="space-y-4 pt-4 border-t border-gray-800/50">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-[0.2em] px-1">Estructura de la Encuesta</label>
                            <button onClick={addQuestion} className="px-4 py-2 bg-fuchsia-600/10 hover:bg-fuchsia-600/20 text-fuchsia-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                                <Plus size={14}/> Añadir Pregunta
                            </button>
                        </div>

                        <div className="space-y-3">
                            {questions.map((q, i) => (
                                <div key={q.id} className="group relative flex gap-4 bg-gray-900/50 border border-gray-800 hover:border-fuchsia-500/30 rounded-2xl p-4 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex flex-col items-center gap-2 pt-1">
                                        <div className="w-6 h-6 rounded-lg bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 group-hover:bg-fuchsia-600/20 group-hover:text-fuchsia-400 transition-colors">
                                            {i + 1}
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <textarea 
                                            value={q.text} 
                                            onChange={e => updateQuestion(q.id, e.target.value)} 
                                            className="w-full bg-transparent border-0 text-white text-sm focus:outline-none resize-none p-0 min-h-[40px]"
                                            placeholder="Escribe aquí la pregunta o el campo del reporte..."
                                            rows={2}
                                        />
                                    </div>
                                    <button onClick={() => removeQuestion(q.id)} className="p-2 text-gray-700 hover:text-red-400 transition-colors self-start">
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            ))}

                            {questions.length === 0 && (
                                <div className="py-12 border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-50">
                                    <Plus size={24} className="text-gray-700" />
                                    <button onClick={addQuestion} className="text-xs font-bold text-gray-500 hover:text-white transition-colors">Pulsa para añadir la primera pregunta</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-4 pt-8 shrink-0">
                    <button onClick={() => { if(title) { onSave({title, type: 'Encuesta', questions}); onClose(); } else toast.error('El título es requerido'); }} className="flex-1 px-6 py-4 rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-all shadow-xl shadow-fuchsia-900/20 text-sm">
                        {initialData ? 'Guardar Cambios en Encuesta' : 'Publicar Encuesta'}
                    </button>
                </div>
            </div>
        </div>
    );
};



// --- COMPONENTE PRINCIPAL ---

const BuyerPersona = () => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();
    
    // States
    const [activeTab, setActiveTab] = useState('ideal'); // 'ideal', 'formularios', 'plantillas', 'notas'
    const [personas, setPersonas] = useState([]);
    const [formularios, setFormularios] = useState([]);
    const [plantillas, setPlantillas] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal controls
    const [showPersonaModal, setShowPersonaModal] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingPersona, setEditingPersona] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [respuestas, setRespuestas] = useState([]);
    const [viewingResponse, setViewingResponse] = useState(null);

    useEffect(() => {
        setLoading(true);
        const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;

        // Personas
        const qPer = empresa ? query(collection(db, 'brand_personas'), where('empresa', '==', empresa)) : query(collection(db, 'brand_personas'));
        const unsubPer = onSnapshot(qPer, (snap) => {
            setPersonas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
        }, (error) => console.error("Error fetching personas:", error));

        // Formularios (Respuestas)
        const qResp = empresa ? query(collection(db, 'brand_survey_responses'), where('empresa', '==', empresa)) : query(collection(db, 'brand_survey_responses'));
        const unsubResp = onSnapshot(qResp, (snap) => {
            setRespuestas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
        }, (error) => console.error("Error fetching responses:", error));

        // Plantillas
        const qTpl = empresa ? query(collection(db, 'brand_templates'), where('empresa', '==', empresa)) : query(collection(db, 'brand_templates'));
        const unsubTpl = onSnapshot(qTpl, (snap) => {
            setPlantillas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching templates:", error);
            setLoading(false);
        });

        // Timeout fallback en caso de error de conexión
        const timeout = setTimeout(() => setLoading(false), 5000);

        return () => {
            unsubPer();
            unsubResp();
            unsubTpl();
            clearTimeout(timeout);
        };
    }, [activeEmpresa]);

    // Handlers
    const handleSavePersona = async (formData) => {
        if (!formData.name) return toast.error('El nombre es requerido');
        try {
            const dataToSave = { ...formData, empresa: activeEmpresa === 'Todas' ? '' : activeEmpresa };
            if (editingPersona) {
                await updateDoc(doc(db, 'brand_personas', editingPersona.id), dataToSave);
                toast.success('Persona actualizada');
            } else {
                await addDoc(collection(db, 'brand_personas'), { ...dataToSave, createdAt: serverTimestamp() });
                toast.success('Persona creada');
            }
            setShowPersonaModal(false);
            setEditingPersona(null);
            // Auto-updated via onSnapshot
        } catch (error) { toast.error('Error al guardar'); }
    };

    const handleSaveForm = async (data) => {
        try {
            await addDoc(collection(db, 'brand_forms'), { ...data, empresa: activeEmpresa === 'Todas' ? '' : activeEmpresa, createdAt: serverTimestamp() });
            toast.success('Formulario guardado');
            // Auto-updated via onSnapshot
        } catch (error) { toast.error('Error al guardar formulario'); }
    };

    const handleSaveTemplate = async (data) => {
        try {
            const dataToSave = { ...data, empresa: activeEmpresa === 'Todas' ? '' : activeEmpresa };
            if (editingTemplate) {
                await updateDoc(doc(db, 'brand_templates', editingTemplate.id), dataToSave);
                toast.success('Plantilla actualizada');
            } else {
                await addDoc(collection(db, 'brand_templates'), { ...dataToSave, createdAt: serverTimestamp() });
                toast.success('Plantilla creada');
            }
            setShowTemplateModal(false);
            setEditingTemplate(null);
            // Auto-updated via onSnapshot
        } catch (error) { toast.error('Error al guardar plantilla'); }
    };

    const handleDeleteResponse = async (id) => {
        try { await deleteDoc(doc(db, 'brand_survey_responses', id)); toast.success('Respuesta eliminada'); setRespuestas(f => f.filter(x => x.id !== id)); } catch(e){}
    };
    const handleCopyLink = async (templateId) => {
        // En Vite/Electron, el origin puede ser http://localhost:5173 o parecido.
        // Si estamos en producción o en un build, podríamos necesitar usar una URL real,
        // pero por ahora usamos el origin actual.
        const link = `${window.location.origin}/encuesta/${templateId}`;
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
                toast.success('Enlace copiado al portapapeles');
            } else {
                // Fallback para entornos no seguros (HTTP local sin secure context, Electron, etc)
                const textArea = document.createElement("textarea");
                textArea.value = link;
                // Avoid scrolling to bottom
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.position = "fixed";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        toast.success('Enlace copiado al portapapeles');
                    } else {
                        toast.error('No se pudo copiar automáticamente');
                    }
                } catch (err) {
                    toast.error('Error al intentar copiar el enlace');
                }
                document.body.removeChild(textArea);
            }
        } catch (error) {
            console.error('Error copying text: ', error);
            toast.error('Error al intentar copiar el enlace');
        }
    };
    const handleDeleteTemplate = async (id) => {
        try { await deleteDoc(doc(db, 'brand_templates', id)); toast.success('Eliminado'); setPlantillas(p => p.filter(x => x.id !== id)); } catch(e){}
    };

    const handleExportPDF = (template) => {
        try {
            // Documento en A4 vertical (210mm x 297mm)
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210; 
            const margin = 20;
            
            // Header: Minimal Letterhead style
            doc.setTextColor(120, 120, 120);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(activeEmpresa?.toUpperCase() || 'ESTRATEGIA DE MARCA', margin, 15);

            // Title
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(template.title, margin, 35);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150, 150, 150);
            doc.text('Cuestionario Estratégico Preparatorio', margin, 42);

            if (!template.questions || template.questions.length === 0) {
                doc.setFontSize(10);
                doc.text('No hay preguntas configuradas.', margin, 60);
            } else {
                const tableData = template.questions.map((q, i) => [
                    `${i + 1}. ${q.text}`
                ]);

                autoTable(doc, {
                    startY: 55,
                    body: tableData,
                    theme: 'plain',
                    styles: { 
                        fontSize: 11, 
                        font: 'helvetica',
                        fontStyle: 'bold',
                        textColor: [40, 40, 40],
                        cellPadding: { top: 4, right: 0, bottom: 15, left: 0 }, // Reducimos espacio a 15mm para más densidad
                        overflow: 'linebreak',
                        valign: 'top'
                    },
                    columnStyles: {
                        0: { cellWidth: pageWidth - (margin * 2) }
                    },
                    margin: { left: margin, right: margin }
                });
            }

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(180, 180, 180);
                doc.text(`${activeEmpresa || 'Artories'}  |  Página ${i} de ${pageCount}`, pageWidth / 2, 285, { align: 'center' });
            }

            doc.save(`Cuestionario_${template.title.replace(/\s+/g, '_')}.pdf`);
            toast.success('PDF A4 generado con éxito');
        } catch (error) {
            console.error(error);
            toast.error('Error al generar el PDF');
        }
    };

    return (
        <div className="min-h-screen bg-[#0d1117] text-white flex flex-col relative overflow-hidden">
            <div className="px-4 sm:px-8 py-6 w-full max-w-7xl mx-auto flex-1">
                
                {/* Minimal Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/branding')} className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all">
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                            <User className="text-blue-400" size={24} /> Perfiles y Audiencia
                        </h1>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl mb-6 flex-wrap gap-1 w-full max-w-fit overflow-x-auto">
                    <button onClick={() => setActiveTab('ideal')} className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'ideal' ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-gray-400'}`}>
                        <Users size={16} /> Persona Ideal
                    </button>
                    <button onClick={() => setActiveTab('formularios')} className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'formularios' ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-gray-400'}`}>
                        <FileText size={16} /> Respuestas
                    </button>
                    <button onClick={() => setActiveTab('plantillas')} className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'plantillas' ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-gray-400'}`}>
                        <LayoutTemplate size={16} /> Formularios
                    </button>
                    <button onClick={() => setActiveTab('notas')} className={`flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'notas' ? 'bg-blue-600 text-white hover:bg-blue-600' : 'text-gray-400'}`}>
                        <StickyNote size={16} /> Notas
                    </button>
                </div>

                {/* Tab Content: Persona Ideal */}
                {activeTab === 'ideal' && (
                    <>
                        <div className="flex justify-end mb-6">
                             <button onClick={() => { setEditingPersona(null); setShowPersonaModal(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-lg">
                                <Plus size={16} /> Añadir Perfil
                            </button>
                        </div>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(3)].map((_, i) => <div key={i} className="h-80 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}
                            </div>
                        ) : personas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-gray-900 border border-gray-800 border-dashed rounded-2xl">
                                <Users size={48} className="text-gray-600 mb-4" />
                                <h2 className="text-gray-400 font-semibold mb-2">No tienes perfiles de Persona Ideal</h2>
                                <p className="text-gray-600 text-sm mb-4">Define a tu cliente ideal para segmentar mejor.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                {personas.map(p => <BuyerPersonaCard key={p.id} persona={p} onDelete={(id) => setPersonas(prev => prev.filter(x => x.id !== id))} onEdit={(p) => { setEditingPersona(p); setShowPersonaModal(true); }} />)}
                            </div>
                        )}
                    </>
                )}

                {/* Tab Content: Formularios (Respuestas) */}
                {activeTab === 'formularios' && (
                    <div className="max-w-4xl">
                        <div className="mb-6">
                            <h3 className="text-white font-bold text-lg">Bandeja de Respuestas</h3>
                            <p className="text-gray-500 text-sm">Visualiza las respuestas de los clientes a tus encuestas públicas.</p>
                        </div>
                        
                        <div className="space-y-3">
                            {respuestas.map(r => (
                                <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="font-bold text-white flex items-center gap-2">
                                                <User size={16} className="text-indigo-400"/> {r.respondentName || 'Anónimo'}
                                            </h4>
                                            <p className="text-gray-500 text-xs mt-1">Encuesta: <span className="font-semibold text-gray-300">{r.surveyTitle}</span></p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setViewingResponse(r)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors border border-gray-700">
                                                Ver Respuestas
                                            </button>
                                            <button onClick={() => handleDeleteResponse(r.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {respuestas.length === 0 && !loading && (
                                <div className="text-center py-10 bg-gray-900 border border-gray-800 rounded-xl border-dashed">
                                    <p className="text-gray-500 text-sm">No hay respuestas recibidas todavía.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Content: Plantillas */}
                {activeTab === 'plantillas' && (
                    <div className="max-w-4xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-white font-bold text-lg">Encuestas y Reportes</h3>
                                <p className="text-gray-500 text-sm">Genera cuestionarios listos para exportar en PDF.</p>
                            </div>
                            <button onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }} className="flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all shadow-lg shrink-0">
                                <Plus size={16} /> Nueva Encuesta
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {plantillas.map(t => (
                                <div key={t.id} onClick={() => { setEditingTemplate(t); setShowTemplateModal(true); }} className="p-5 bg-gray-900 border border-gray-800 rounded-xl hover:border-fuchsia-500/30 transition-all group cursor-pointer relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-400">
                                            <LayoutTemplate size={20}/>
                                        </div>
                                        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                                            <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded-md">{t.type}</span>
                                            {t.questions?.length > 0 && <span className="text-fuchsia-400 bg-fuchsia-500/10 px-2 py-1 rounded-md">{t.questions.length} Preguntas</span>}
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-wide flex-1">{t.title}</h4>
                                    
                                    <div className="flex gap-2 border-t border-gray-800 pt-4">
                                        <button onClick={(e) => { e.stopPropagation(); handleCopyLink(t.id); }} className="flex-1 flex justify-center items-center gap-1.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg">
                                            <LinkIcon size={14} /> Compartir Link
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleExportPDF(t); }} className="w-10 flex justify-center items-center py-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700" title="Exportar PDF Formulario Vacío">
                                            <Download size={14} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="w-10 flex justify-center items-center py-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg border border-gray-700 transition-colors" title="Eliminar">
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {plantillas.length === 0 && !loading && (
                                <div className="sm:col-span-2 text-center py-10 bg-gray-900 border border-gray-800 rounded-xl border-dashed">
                                    <p className="text-gray-500 text-sm">No hay plantillas creadas.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab Content: Notas */}
                {activeTab === 'notas' && (
                    <div className="max-w-4xl">
                         <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <StickyNote size={18} className="text-yellow-400" /> Notas Libres
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {personas.map(p => (
                                <div key={`note-${p.id}`} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                    <h4 className="font-bold text-sm text-blue-400 mb-2">{p.name}</h4>
                                    <textarea 
                                        className="w-full bg-transparent border-0 text-gray-300 text-sm focus:outline-none resize-none p-0 h-24" 
                                        placeholder="Escribe notas adicionales sobre este perfil aquí..."
                                        defaultValue={p.notes}
                                        onBlur={async (e) => {
                                            if (e.target.value !== p.notes) {
                                                await updateDoc(doc(db, 'brand_personas', p.id), { notes: e.target.value });
                                                toast.success('Nota guardada automáticamente');
                                                // Auto-updated via onSnapshot
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-gray-600 mt-2">Deselecciona para auto-guardar</p>
                                </div>
                            ))}
                            {personas.length === 0 && (
                                <p className="text-gray-500 text-sm">Crea una persona primero para asociarle notas.</p>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Viewer Modal para Respuestas */}
            {viewingResponse && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 py-10" onClick={() => setViewingResponse(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-2xl shadow-2xl max-h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="mb-6 pb-6 border-b border-gray-800">
                            <h2 className="text-xl font-bold text-white">{viewingResponse.surveyTitle}</h2>
                            <p className="text-gray-500 text-sm mt-1">Respondido por: <span className="text-indigo-400 font-bold">{viewingResponse.respondentName}</span></p>
                        </div>
                        <div className="space-y-6">
                            {viewingResponse.answers && viewingResponse.answers.map((ans, i) => (
                                <div key={i} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase">{i + 1}. {ans.question}</h4>
                                    <p className="text-white text-sm whitespace-pre-wrap">{ans.answer || <span className="text-gray-600 italic">No respondió</span>}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-4">
                            <button onClick={() => setViewingResponse(null)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-colors">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Render Modals */}
            {showPersonaModal && <PersonaModal onClose={() => {setShowPersonaModal(false); setEditingPersona(null);}} onSave={handleSavePersona} initialData={editingPersona} />}
            {showTemplateModal && <TemplateModal onClose={() => {setShowTemplateModal(false); setEditingTemplate(null);}} onSave={handleSaveTemplate} initialData={editingTemplate} />}
        </div>
    );
};

export default BuyerPersona;
