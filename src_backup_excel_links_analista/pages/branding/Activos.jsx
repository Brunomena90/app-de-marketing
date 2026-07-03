import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Image, Plus, Trash2, Download, Tag, Search, Filter, Grid, List, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const ASSET_TYPES = ['Logo', 'Icono', 'Imagen', 'Banner', 'Ilustración', 'Patrón', 'Otro'];

const AssetCard = ({ asset, view, onDelete }) => {
    const [confirm, setConfirm] = useState(false);
    const typeColor = {
        'Logo': 'bg-violet-600/20 text-violet-300',
        'Icono': 'bg-blue-600/20 text-blue-300',
        'Imagen': 'bg-emerald-600/20 text-emerald-300',
        'Banner': 'bg-orange-600/20 text-orange-300',
        'Ilustración': 'bg-pink-600/20 text-pink-300',
    }[asset.type] || 'bg-gray-700 text-gray-300';

    const handleDelete = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        try {
            await deleteDoc(doc(db, 'brand_assets', asset.id));
            toast.success('Activo eliminado');
            onDelete(asset.id);
        } catch { toast.error('Error al eliminar'); }
    };

    if (view === 'list') {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-gray-700 transition-all">
                <div className="w-12 h-12 rounded-xl bg-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                    {asset.url ? (
                        <img src={asset.url} alt={asset.name} className="w-full h-full object-contain" />
                    ) : (
                        <Image size={20} className="text-gray-600" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{asset.name}</p>
                    {asset.description && <p className="text-gray-500 text-xs truncate">{asset.description}</p>}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${typeColor}`}>{asset.type}</span>
                {asset.tags?.length > 0 && (
                    <div className="hidden md:flex gap-1">
                        {asset.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-1">
                    {asset.url && (
                        <a href={asset.url} target="_blank" download className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 transition-all">
                            <Download size={14} />
                        </a>
                    )}
                    <button onClick={handleDelete} className={`p-1.5 rounded-lg transition-all ${confirm ? 'bg-red-600 text-white' : 'text-gray-700 hover:text-red-400 hover:bg-red-400/10'}`}>
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all group">
            <div className="aspect-video bg-gray-800 flex items-center justify-center relative overflow-hidden">
                {asset.url ? (
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-contain p-4" />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Image size={32} />
                        <span className="text-xs">Sin preview</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    {asset.url && (
                        <a href={asset.url} target="_blank" download
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
                        >
                            <Download size={16} />
                        </a>
                    )}
                    <button onClick={handleDelete} className={`p-2 rounded-xl transition-all hover:scale-110 ${confirm ? 'bg-red-600' : 'bg-white/10 hover:bg-red-600'} text-white`}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-white font-semibold text-sm truncate">{asset.name}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${typeColor}`}>{asset.type}</span>
                </div>
                {asset.description && <p className="text-gray-500 text-xs mb-2 line-clamp-2">{asset.description}</p>}
                {asset.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {asset.tags.map(t => (
                            <span key={t} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Tag size={8} /> {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const NewAssetModal = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('Logo');
    const [description, setDescription] = useState('');
    const [url, setUrl] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState([]);
    const [saving, setSaving] = useState(false);

    const addTag = () => {
        const t = tagInput.trim().toLowerCase();
        if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
    };

    const handleSave = async () => {
        if (!name.trim()) return toast.error('El nombre es requerido');
        setSaving(true);
        try {
            await onSave({ name: name.trim(), type, description, url, tags });
            onClose();
        } catch { toast.error('Error al guardar'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
                    <Image size={18} className="text-fuchsia-400" /> Nuevo Activo de Marca
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Nombre *</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Logo Principal" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fuchsia-500/60 placeholder:text-gray-600" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Tipo</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fuchsia-500/60">
                            {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">URL del archivo</label>
                        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fuchsia-500/60 placeholder:text-gray-600" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Descripción</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Notas sobre el uso de este activo..." className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fuchsia-500/60 placeholder:text-gray-600 resize-none" />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Etiquetas</label>
                        <div className="flex gap-2">
                            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Añadir etiqueta..." className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-fuchsia-500/60 placeholder:text-gray-600" />
                            <button onClick={addTag} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition-all">+</button>
                        </div>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {tags.map(t => (
                                    <span key={t} className="flex items-center gap-1 text-xs bg-fuchsia-600/20 text-fuchsia-300 px-2 py-0.5 rounded-full">
                                        {t}
                                        <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-white ml-0.5">×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-all text-sm font-semibold">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-bold text-sm transition-all disabled:opacity-60">
                        {saving ? 'Guardando...' : 'Guardar Activo'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Activos = () => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();

    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [view, setView] = useState('grid');
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('Todos');

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
            const q = empresa
                ? query(collection(db, 'brand_assets'), where('empresa', '==', empresa), orderBy('createdAt', 'desc'))
                : query(collection(db, 'brand_assets'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(q);
            setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAssets(); }, [activeEmpresa]);

    const handleSave = async (data) => {
        const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
        await addDoc(collection(db, 'brand_assets'), { ...data, empresa: empresa || '', createdAt: serverTimestamp() });
        toast.success('Activo añadido');
        fetchAssets();
    };

    const filtered = assets
        .filter(a => filterType === 'Todos' || a.type === filterType)
        .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.tags || []).some(t => t.includes(search.toLowerCase())));

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
                            <Image className="text-fuchsia-400" size={24} /> Activos de Marca
                        </h1>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all shadow-lg shrink-0 w-full sm:w-auto justify-center"
                    >
                        <Plus size={16} /> Nuevo Activo
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar activos..."
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-gray-600 placeholder:text-gray-600"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-gray-500" />
                        <select
                            value={filterType} onChange={e => setFilterType(e.target.value)}
                            className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-gray-600"
                        >
                            <option>Todos</option>
                            {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
                        <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-400'}`}><Grid size={15} /></button>
                        <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-600 hover:text-gray-400'}`}><List size={15} /></button>
                    </div>
                </div>

                {loading ? (
                    <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
                        {[...Array(6)].map((_, i) => <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-40 animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-fuchsia-600/10 flex items-center justify-center mb-4">
                            <Image size={28} className="text-fuchsia-400" />
                        </div>
                        <p className="text-white font-bold text-lg mb-2">{search || filterType !== 'Todos' ? 'Sin resultados' : 'Sin activos aún'}</p>
                        <p className="text-gray-500 text-sm mb-6">{search ? 'Intenta con otros términos.' : 'Empieza subiendo el primer activo de tu marca.'}</p>
                        {!search && <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all"><Plus size={16} /> Añadir Activo</button>}
                    </div>
                ) : (
                    <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
                        {filtered.map(a => (
                            <AssetCard key={a.id} asset={a} view={view} onDelete={id => setAssets(prev => prev.filter(x => x.id !== id))} />
                        ))}
                    </div>
                )}
            </div>
            {showModal && <NewAssetModal onClose={() => setShowModal(false)} onSave={handleSave} />}
        </div>
    );
};

export default Activos;
