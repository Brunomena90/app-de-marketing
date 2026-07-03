import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Palette, Plus, Trash2, Copy, Check, Pipette, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const DEFAULT_COLORS = ['#7C3AED', '#DB2777', '#4F46E5', '#F59E0B', '#10B981'];

const ColorSwatch = ({ color, label, onCopy }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(color);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        if (onCopy) onCopy(color);
    };
    return (
        <div className="group relative flex flex-col items-center gap-2">
            <button
                onClick={handleCopy}
                className="w-14 h-14 rounded-2xl border-2 border-white/10 hover:border-white/30 shadow-lg hover:scale-110 transition-all duration-200 relative overflow-hidden focus:outline-none"
                style={{ backgroundColor: color }}
                title={`Copiar ${color}`}
            >
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copied ? <Check size={16} className="text-white" /> : <Copy size={14} className="text-white" />}
                </span>
            </button>
            <span className="text-[10px] text-gray-400 font-mono">{color.toUpperCase()}</span>
            {label && <span className="text-[10px] text-gray-500 text-center max-w-[60px] truncate">{label}</span>}
        </div>
    );
};

const PaletteCard = ({ palette, onDelete }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDelete = async () => {
        if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return; }
        try {
            await deleteDoc(doc(db, 'brand_palettes', palette.id));
            toast.success('Paleta eliminada');
            onDelete(palette.id);
        } catch { toast.error('Error al eliminar'); }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all group">
            {/* Gradient preview */}
            <div
                className="h-16 rounded-xl mb-4 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${palette.colors.join(', ')})` }}
            >
                <div className="absolute inset-0 bg-black/10" />
                {palette.isPrimary && (
                    <span className="absolute top-2 right-2 bg-violet-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Principal</span>
                )}
            </div>

            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="text-white font-bold text-sm">{palette.name}</h3>
                    {palette.description && <p className="text-gray-500 text-xs mt-0.5">{palette.description}</p>}
                </div>
                <button
                    onClick={handleDelete}
                    className={`p-1.5 rounded-lg transition-all text-xs ${confirmDelete ? 'bg-red-600 text-white' : 'text-gray-600 hover:text-red-400 hover:bg-red-400/10'}`}
                    title={confirmDelete ? 'Confirmar eliminación' : 'Eliminar'}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            <div className="flex gap-2 flex-wrap">
                {palette.colors.map((c, i) => (
                    <ColorSwatch key={i} color={c} />
                ))}
            </div>
        </div>
    );
};

const NewPaletteModal = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [colors, setColors] = useState(['#7C3AED', '#DB2777']);
    const [isPrimary, setIsPrimary] = useState(false);
    const [saving, setSaving] = useState(false);

    const addColor = () => { if (colors.length < 8) setColors([...colors, '#6B7280']); };
    const removeColor = (i) => { if (colors.length > 1) setColors(colors.filter((_, idx) => idx !== i)); };
    const updateColor = (i, val) => setColors(colors.map((c, idx) => idx === i ? val : c));

    const handleSave = async () => {
        if (!name.trim()) return toast.error('El nombre es requerido');
        setSaving(true);
        try {
            await onSave({ name: name.trim(), description: description.trim(), colors, isPrimary });
            onClose();
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                    <Palette size={18} className="text-violet-400" /> Nueva Paleta
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Nombre *</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Colores Primarios"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/60 placeholder:text-gray-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Descripción</label>
                        <input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Opcional"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500/60 placeholder:text-gray-600"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Colores</label>
                            <button onClick={addColor} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium">
                                <Plus size={12} /> Añadir
                            </button>
                        </div>
                        <div className="space-y-2">
                            {colors.map((c, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={c}
                                        onChange={e => updateColor(i, e.target.value)}
                                        className="w-10 h-10 rounded-xl border border-gray-700 cursor-pointer bg-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={c.toUpperCase()}
                                        onChange={e => updateColor(i, e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-violet-500/60"
                                    />
                                    <button onClick={() => removeColor(i)} className="text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div
                            onClick={() => setIsPrimary(!isPrimary)}
                            className={`w-10 h-5 rounded-full transition-colors relative ${isPrimary ? 'bg-violet-600' : 'bg-gray-700'}`}
                        >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrimary ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-sm text-gray-300">Paleta principal</span>
                    </label>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-all text-sm font-semibold">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm transition-all disabled:opacity-60">
                        {saving ? 'Guardando...' : 'Crear Paleta'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Paletas = () => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();

    const [palettes, setPalettes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchPalettes = async () => {
        setLoading(true);
        try {
            const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
            const q = empresa
                ? query(collection(db, 'brand_palettes'), where('empresa', '==', empresa), orderBy('createdAt', 'desc'))
                : query(collection(db, 'brand_palettes'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setPalettes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchPalettes(); }, [activeEmpresa]);

    const handleSave = async (data) => {
        const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
        await addDoc(collection(db, 'brand_palettes'), {
            ...data,
            empresa: empresa || '',
            createdAt: serverTimestamp(),
        });
        toast.success('Paleta creada');
        fetchPalettes();
    };

    const handleDelete = (id) => setPalettes(prev => prev.filter(p => p.id !== id));

    return (
        <div className="min-h-screen bg-[#0d1117] text-white">
            <div className="px-8 py-8">
                {/* Minimal Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/branding')} className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all shrink-0">
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                            <Palette className="text-violet-400" size={24} /> Paletas de Color
                        </h1>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all shadow-lg shrink-0 w-full sm:w-auto justify-center"
                    >
                        <Plus size={16} /> Nueva Paleta
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 animate-pulse">
                                <div className="h-16 rounded-xl bg-gray-800 mb-4" />
                                <div className="h-4 bg-gray-800 rounded w-1/2 mb-2" />
                                <div className="flex gap-2 mt-3">{[...Array(4)].map((_, j) => <div key={j} className="w-14 h-14 rounded-2xl bg-gray-800" />)}</div>
                            </div>
                        ))}
                    </div>
                ) : palettes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-violet-600/10 flex items-center justify-center mb-4">
                            <Pipette size={28} className="text-violet-400" />
                        </div>
                        <p className="text-white font-bold text-lg mb-2">Sin paletas aún</p>
                        <p className="text-gray-500 text-sm mb-6">Crea tu primera paleta de color de marca.</p>
                        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all">
                            <Plus size={16} /> Crear Paleta
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {palettes.map(p => (
                            <PaletteCard key={p.id} palette={p} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </div>
            {showModal && <NewPaletteModal onClose={() => setShowModal(false)} onSave={handleSave} />}
        </div>
    );
};

export default Paletas;
