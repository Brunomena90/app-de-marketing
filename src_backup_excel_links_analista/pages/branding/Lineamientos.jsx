import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Layers, Plus, Trash2, Edit3, ChevronDown, ChevronUp, BookOpen, Lightbulb, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const SECTION_TYPES = [
    'Visión y Misión',
    'Tono de Voz',
    'Uso del Logo',
    'Colores de Marca',
    'Tipografía',
    'Iconografía',
    'Fotografía',
    'Espaciado y Márgenes',
    'Do\'s and Don\'ts',
    'Plantillas',
    'Otro'
];

const GuidelineItem = ({ item, onDelete, onEdit }) => {
    const [open, setOpen] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const priorityColor = { Alta: 'bg-red-600/20 text-red-300', Media: 'bg-amber-600/20 text-amber-300', Baja: 'bg-emerald-600/20 text-emerald-300' }[item.priority] || 'bg-gray-700 text-gray-300';

    const handleDelete = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        try {
            await deleteDoc(doc(db, 'brand_guidelines', item.id));
            toast.success('Lineamiento eliminado');
            onDelete(item.id);
        } catch { toast.error('Error al eliminar'); }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-4 p-5 text-left"
            >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[10px] font-bold bg-indigo-600/20 text-indigo-300 px-2 py-0.5 rounded-full">{item.section}</span>
                        {item.priority && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityColor}`}>{item.priority}</span>}
                    </div>
                    <p className="text-white font-semibold text-sm truncate">{item.title}</p>
                </div>
                {open ? <ChevronUp size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
            </button>
            {open && (
                <div className="px-5 pb-5 border-t border-gray-800">
                    <p className="text-gray-400 text-sm mt-4 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    {item.examples && (
                        <div className="mt-4 p-3 bg-indigo-600/5 border border-indigo-600/20 rounded-xl">
                            <p className="text-indigo-300 text-xs font-semibold mb-1.5 flex items-center gap-1.5"><Lightbulb size={12} /> Ejemplos</p>
                            <p className="text-gray-400 text-xs whitespace-pre-wrap">{item.examples}</p>
                        </div>
                    )}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => onEdit(item)}
                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-all"
                        >
                            <Edit3 size={12} /> Editar
                        </button>
                        <button
                            onClick={handleDelete}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all ${confirm ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-red-400 hover:bg-red-400/10'}`}
                        >
                            <Trash2 size={12} /> {confirm ? 'Confirmar' : 'Eliminar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const GuidelineModal = ({ onClose, onSave, initial }) => {
    const [title, setTitle] = useState(initial?.title || '');
    const [section, setSection] = useState(initial?.section || 'Uso del Logo');
    const [content, setContent] = useState(initial?.content || '');
    const [examples, setExamples] = useState(initial?.examples || '');
    const [priority, setPriority] = useState(initial?.priority || 'Media');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) return toast.error('Título y contenido son requeridos');
        setSaving(true);
        try {
            await onSave({ title: title.trim(), section, content: content.trim(), examples: examples.trim(), priority });
            onClose();
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                    <Layers size={18} className="text-indigo-400" /> {initial ? 'Editar' : 'Nuevo'} Lineamiento
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Sección</label>
                        <select value={section} onChange={e => setSection(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/60">
                            {SECTION_TYPES.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Título *</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Zona de exclusión del logo" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder:text-gray-600" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Contenido / Descripción *</label>
                        <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Describe la regla o lineamiento de marca..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder:text-gray-600 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Ejemplos (opcional)</label>
                        <textarea value={examples} onChange={e => setExamples(e.target.value)} rows={3} placeholder="Casos de uso, ejemplos correctos e incorrectos..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/60 placeholder:text-gray-600 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Prioridad</label>
                        <div className="flex gap-2">
                            {['Alta', 'Media', 'Baja'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPriority(p)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${priority === p
                                        ? p === 'Alta' ? 'bg-red-600 text-white' : p === 'Media' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-all text-sm font-semibold">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm transition-all disabled:opacity-60">
                        {saving ? 'Guardando...' : initial ? 'Actualizar' : 'Crear Lineamiento'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Lineamientos = () => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [activeSection, setActiveSection] = useState('Todos');

    const fetch = async () => {
        setLoading(true);
        try {
            const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
            const q = empresa
                ? query(collection(db, 'brand_guidelines'), where('empresa', '==', empresa), orderBy('createdAt', 'desc'))
                : query(collection(db, 'brand_guidelines'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [activeEmpresa]);

    const handleSave = async (data) => {
        const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
        if (editing) {
            await updateDoc(doc(db, 'brand_guidelines', editing.id), data);
            toast.success('Lineamiento actualizado');
        } else {
            await addDoc(collection(db, 'brand_guidelines'), { ...data, empresa: empresa || '', createdAt: serverTimestamp() });
            toast.success('Lineamiento creado');
        }
        setEditing(null);
        fetch();
    };

    const sections = ['Todos', ...new Set(items.map(i => i.section))];
    const filtered = activeSection === 'Todos' ? items : items.filter(i => i.section === activeSection);

    return (
        <div className="min-h-screen bg-[#0d1117] text-white">
            <div className="px-8 py-8">
                {/* Minimal Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/branding')} className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all shrink-0">
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                            <Layers className="text-indigo-400" size={24} /> Lineamientos
                        </h1>
                    </div>
                    <button
                        onClick={() => { setEditing(null); setShowModal(true); }}
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all shadow-lg shrink-0 w-full sm:w-auto justify-center"
                    >
                        <Plus size={16} /> Nuevo Lineamiento
                    </button>
                </div>

                {/* Section filter */}
                {sections.length > 1 && (
                    <div className="flex gap-2 flex-wrap mb-6">
                        {sections.map(s => (
                            <button
                                key={s}
                                onClick={() => setActiveSection(s)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${activeSection === s ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 flex items-center justify-center mb-4">
                            <Layers size={28} className="text-indigo-400" />
                        </div>
                        <p className="text-white font-bold text-lg mb-2">Sin lineamientos aún</p>
                        <p className="text-gray-500 text-sm mb-6">Documenta las reglas de uso de la identidad visual.</p>
                        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all">
                            <Plus size={16} /> Crear Lineamiento
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(item => (
                            <GuidelineItem
                                key={item.id}
                                item={item}
                                onDelete={id => setItems(prev => prev.filter(x => x.id !== id))}
                                onEdit={(it) => { setEditing(it); setShowModal(true); }}
                            />
                        ))}
                    </div>
                )}
            </div>
            {showModal && (
                <GuidelineModal
                    onClose={() => { setShowModal(false); setEditing(null); }}
                    onSave={handleSave}
                    initial={editing}
                />
            )}
        </div>
    );
};

export default Lineamientos;
