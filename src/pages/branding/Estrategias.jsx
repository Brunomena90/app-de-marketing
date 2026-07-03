import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { TrendingUp, Plus, Trash2, Edit3, ArrowLeft, Target, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EstrategiaCard = ({ estrategia, onDelete, onEdit }) => {
    const [confirm, setConfirm] = useState(false);

    const handleDelete = async () => {
        if (!confirm) { setConfirm(true); setTimeout(() => setConfirm(false), 3000); return; }
        try {
            await deleteDoc(doc(db, 'brand_estrategias', estrategia.id));
            toast.success('Estrategia eliminada');
            onDelete(estrategia.id);
        } catch { toast.error('Error al eliminar'); }
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition-all flex flex-col h-full">
            <div className="p-5 flex items-start gap-4 border-b border-gray-800">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20 text-purple-400">
                    <Target size={20} />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="text-white font-bold text-lg truncate pr-2">{estrategia.title}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${estrategia.status === 'Activa' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {estrategia.status}
                        </span>
                    </div>
                    <p className="text-gray-400 text-xs truncate">Público: {estrategia.targetAudience || 'General'}</p>
                </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col gap-4">
                <div>
                     <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descripción</h4>
                     <p className="text-gray-300 text-sm leading-relaxed">{estrategia.description || 'Sin definir'}</p>
                </div>
                <div>
                     <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Diferenciador</h4>
                     <p className="text-gray-300 text-sm leading-relaxed">{estrategia.differentiator || 'Sin definir'}</p>
                </div>
                 <div>
                     <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Métricas de Éxito (KPIs)</h4>
                     <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{estrategia.kpis || 'Sin definir'}</p>
                </div>
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-2 shrink-0">
                <button onClick={() => onEdit(estrategia)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs font-medium flex items-center gap-1.5 transition-colors">
                    <Edit3 size={14} /> Editar
                </button>
                <button onClick={handleDelete} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${confirm ? 'bg-red-600/20 text-red-500' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'}`}>
                    <Trash2 size={14} /> {confirm ? 'Confirmar' : 'Eliminar'}
                </button>
            </div>
        </div>
    );
};

const Estrategias = () => {
    const { activeEmpresa } = useAuth();
    const navigate = useNavigate();
    const [estrategias, setEstrategias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('lista'); 
    
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '', description: '', differentiator: '', kpis: '', targetAudience: '', status: 'Activa'
    });

    const fetchEstrategias = async () => {
        setLoading(true);
        try {
            const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
            const q = empresa
                ? query(collection(db, 'brand_estrategias'), where('empresa', '==', empresa))
                : query(collection(db, 'brand_estrategias'));
            const snap = await getDocs(q);
            setEstrategias(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchEstrategias(); }, [activeEmpresa]);

    const handleEdit = (e) => {
        setFormData({
            title: e.title || '', description: e.description || '', differentiator: e.differentiator || '',
            kpis: e.kpis || '', targetAudience: e.targetAudience || '', status: e.status || 'Activa'
        });
        setEditingId(e.id);
        setActiveTab('formulario');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.title) return toast.error('El título es requerido');
        
        try {
            const empresa = activeEmpresa === 'Todas' ? null : activeEmpresa;
            const dataToSave = { ...formData, empresa: empresa || '' };
            
            if (editingId) {
                await updateDoc(doc(db, 'brand_estrategias'), editingId, dataToSave);
                toast.success('Estrategia actualizada');
            } else {
                await addDoc(collection(db, 'brand_estrategias'), { ...dataToSave, createdAt: serverTimestamp() });
                toast.success('Estrategia creada');
            }
            
            setFormData({ title: '', description: '', differentiator: '', kpis: '', targetAudience: '', status: 'Activa'});
            setEditingId(null);
            fetchEstrategias();
            setActiveTab('lista');
        } catch (error) {
            toast.error('Error al guardar');
        }
    };

    return (
        <div className="min-h-screen bg-[#0d1117] text-white">
            <div className="px-4 sm:px-8 py-6">
                
                {/* Minimal Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/branding')} className="p-2 bg-gray-900 border border-gray-800 rounded-xl text-gray-400 hover:text-white transition-all">
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                            <TrendingUp className="text-purple-400" size={24} /> Estrategias
                        </h1>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-900 border border-gray-800 p-1 rounded-xl mb-6 max-w-fit">
                    <button onClick={() => setActiveTab('lista')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'lista' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <List size={16} /> Estrategias
                    </button>
                    <button onClick={() => { setActiveTab('formulario'); setEditingId(null); setFormData({title: '', description: '', differentiator: '', kpis: '', targetAudience: '', status: 'Activa'}); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'formulario' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        <Plus size={16} /> Formulario
                    </button>
                </div>

                {/* Tab Content: Lista */}
                {activeTab === 'lista' && (
                    <>
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />)}
                            </div>
                        ) : estrategias.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-gray-900 border border-gray-800 border-dashed rounded-2xl">
                                <TrendingUp size={48} className="text-gray-600 mb-4" />
                                <h2 className="text-gray-400 font-semibold mb-2">No tienes estrategias configuradas</h2>
                                <button onClick={() => setActiveTab('formulario')} className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-bold text-sm transition-all shadow-lg">
                                    Crear Nueva Estrategia
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {estrategias.map(e => <EstrategiaCard key={e.id} estrategia={e} onDelete={(id) => setEstrategias(prev => prev.filter(x => x.id !== id))} onEdit={handleEdit} />)}
                            </div>
                        )}
                    </>
                )}

                {/* Tab Content: Formulario */}
                {activeTab === 'formulario' && (
                    <div className="max-w-3xl bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 flex flex-col gap-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            {editingId ? <Edit3 size={18} className="text-purple-400"/> : <Plus size={18} className="text-purple-400"/>} 
                            {editingId ? 'Editar Estrategia' : 'Crear Nueva Estrategia'}
                        </h2>
                        
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2 sm:col-span-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase">Título de Estrategia *</label>
                                    <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="Ej. Posicionamiento en mercado joven" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase">Público Objetivo</label>
                                    <input value={formData.targetAudience} onChange={e => setFormData({...formData, targetAudience: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500" placeholder="Ej. Millennials y Gen Z" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase">Estado</label>
                                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500">
                                        <option value="Activa">Activa</option>
                                        <option value="En Desarrollo">En Desarrollo</option>
                                        <option value="Completada">Completada</option>
                                    </select>
                                </div>
                            </div>

                            <hr className="border-gray-800" />

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase">Descripción / Plan de Acción</label>
                                    <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" placeholder="¿En qué consiste esta estrategia?" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase">Diferenciador principal</label>
                                    <textarea value={formData.differentiator} onChange={e => setFormData({...formData, differentiator: e.target.value})} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" placeholder="¿Qué te hace diferente?" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-400 uppercase">Métricas de Éxito (KPIs)</label>
                                    <textarea value={formData.kpis} onChange={e => setFormData({...formData, kpis: e.target.value})} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" placeholder="Ej. Aumento de 20% en engagement..." />
                                </div>
                            </div>
                            
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setActiveTab('lista')} className="px-6 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-bold transition-all">Cancelar</button>
                                <button type="submit" className="flex-1 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-lg">
                                    {editingId ? 'Guardar Cambios' : 'Crear Estrategia'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Estrategias;
