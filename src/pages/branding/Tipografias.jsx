import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Type, Plus, Trash2, ExternalLink, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const FONT_CATEGORIES = ['Sans-serif', 'Serif', 'Monospace', 'Display', 'Script', 'Otra'];

const FontPreviewCard = ({ font, onDelete }) => {
    const [confirm, setConfirm] = useState(false);
    const catColor = {
        'Sans-serif': 'bg-violet-600/20 text-violet-300',
        'Serif': 'bg-amber-600/20 text-amber-300',
        'Monospace': 'bg-emerald-600/20 text-emerald-300',
        'Display': 'bg-pink-600/20 text-pink-300',
        'Script': 'bg-orange-600/20 text-orange-300',
    }[font.category] || 'bg-gray-700 text-gray-300';

    const handleDelete = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        try {
            await deleteDoc(doc(db, 'brand_fonts', font.id));
            toast.success('Tipografía eliminada');
            onDelete(font.id);
        } catch { toast.error('Error al eliminar'); }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all group">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${catColor}`}>{font.category}</span>
                    {font.isHeading && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-violet-600 text-white">Títulos</span>}
                    {font.isBody && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">Cuerpo</span>}
                </div>
                <button
                    onClick={handleDelete}
                    className={`p-1.5 rounded-lg transition-all ${confirm ? 'bg-red-600 text-white' : 'text-gray-700 hover:text-red-400 hover:bg-red-400/10'}`}
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Font name preview */}
            <div className="border border-gray-800 bg-gray-800/30 rounded-xl p-4 mb-3">
                <p className="text-xs text-gray-500 font-medium mb-2">{font.name}</p>
                <p className="text-white text-2xl font-bold leading-tight" style={{ fontFamily: `'${font.name}', ${font.fallback || 'sans-serif'}` }}>
                    Aa Bb Cc
                </p>
                <p className="text-gray-400 text-sm mt-1" style={{ fontFamily: `'${font.name}', ${font.fallback || 'sans-serif'}` }}>
                    The quick brown fox jumps over the lazy dog.
                </p>
                {font.sampleText && (
                    <p className="text-gray-300 text-sm mt-2 italic" style={{ fontFamily: `'${font.name}', ${font.fallback || 'sans-serif'}` }}>
                        "{font.sampleText}"
                    </p>
                )}
            </div>

            {font.weights && font.weights.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {font.weights.map(w => (
                        <span key={w} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-lg font-mono">{w}</span>
                    ))}
                </div>
            )}

            {font.googleFontUrl && (
                <a
                    href={font.googleFontUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
                >
                    <ExternalLink size={11} /> Ver en Google Fonts
                </a>
            )}
        </div>
    );
};

const NewFontModal = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Sans-serif');
    const [weights, setWeights] = useState([]);
    const [isHeading, setIsHeading] = useState(false);
    const [isBody, setIsBody] = useState(false);
    const [sampleText, setSampleText] = useState('');
    const [googleFontUrl, setGoogleFontUrl] = useState('');
    const [saving, setSaving] = useState(false);

    const WEIGHT_OPTIONS = ['100','200','300','400','500','600','700','800','900'];
    const toggleWeight = (w) => setWeights(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);

    const handleSave = async () => {
        if (!name.trim()) return toast.error('El nombre es requerido');
        setSaving(true);
        try {
            await onSave({ name: name.trim(), category, weights, isHeading, isBody, sampleText, googleFontUrl });
            onClose();
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                    <Type size={18} className="text-pink-400" /> Nueva Tipografía
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Nombre de la fuente *</label>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            placeholder="Ej: Inter, Montserrat, Poppins..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-500/60 placeholder:text-gray-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Categoría</label>
                        <select
                            value={category} onChange={e => setCategory(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-500/60"
                        >
                            {FONT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Pesos disponibles</label>
                        <div className="flex flex-wrap gap-2">
                            {WEIGHT_OPTIONS.map(w => (
                                <button
                                    key={w}
                                    onClick={() => toggleWeight(w)}
                                    className={`text-xs px-3 py-1.5 rounded-lg font-mono transition-all ${weights.includes(w) ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {w}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isHeading} onChange={e => setIsHeading(e.target.checked)} className="accent-violet-600" />
                            <span className="text-sm text-gray-300">Títulos</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isBody} onChange={e => setIsBody(e.target.checked)} className="accent-violet-600" />
                            <span className="text-sm text-gray-300">Cuerpo</span>
                        </label>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Texto de muestra</label>
                        <input
                            value={sampleText} onChange={e => setSampleText(e.target.value)}
                            placeholder="Frase representativa de la marca..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-500/60 placeholder:text-gray-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Google Fonts URL</label>
                        <input
                            value={googleFontUrl} onChange={e => setGoogleFontUrl(e.target.value)}
                            placeholder="https://fonts.google.com/..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-500/60 placeholder:text-gray-600"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-all text-sm font-semibold">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-bold text-sm transition-all disabled:opacity-60">
                        {saving ? 'Guardando...' : 'Añadir Tipografía'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Tipografias = () => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();

    const [fonts, setFonts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchFonts = async () => {
        setLoading(true);
        try {
            const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
            const q = empresa
                ? query(collection(db, 'brand_fonts'), where('empresa', '==', empresa), orderBy('createdAt', 'desc'))
                : query(collection(db, 'brand_fonts'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setFonts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchFonts(); }, [activeEmpresa]);

    const handleSave = async (data) => {
        const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
        await addDoc(collection(db, 'brand_fonts'), { ...data, empresa: empresa || '', createdAt: serverTimestamp() });
        toast.success('Tipografía añadida');
        fetchFonts();
    };

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
                            <Type className="text-pink-400" size={24} /> Tipografías
                        </h1>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all shadow-lg shrink-0 w-full sm:w-auto justify-center"
                    >
                        <Plus size={16} /> Nueva Tipografía
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-48 animate-pulse"><div className="h-full bg-gray-800 rounded-xl" /></div>)}
                    </div>
                ) : fonts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-pink-600/10 flex items-center justify-center mb-4">
                            <Type size={28} className="text-pink-400" />
                        </div>
                        <p className="text-white font-bold text-lg mb-2">Sin tipografías aún</p>
                        <p className="text-gray-500 text-sm mb-6">Añade las fuentes de marca de tu empresa.</p>
                        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all">
                            <Plus size={16} /> Añadir Tipografía
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {fonts.map(f => <FontPreviewCard key={f.id} font={f} onDelete={id => setFonts(prev => prev.filter(x => x.id !== id))} />)}
                    </div>
                )}
            </div>
            {showModal && <NewFontModal onClose={() => setShowModal(false)} onSave={handleSave} />}
        </div>
    );
};

export default Tipografias;
