import React, { useState, useEffect } from 'react';
import { Handshake, Plus, Search, FileText, Calendar, User, Edit2, Trash2, ExternalLink, Building2, Activity } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const CotizacionesRecibidas = () => {
    const { activeEmpresa, user } = useAuth();
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'cotizaciones_recibidas'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const filtered = activeEmpresa === 'Todas'
                ? all
                : all.filter(d => (d.empresa || '') === activeEmpresa);
            setQuotations(filtered);
            setLoading(false);
        });
        return () => unsub();
    }, [activeEmpresa]);

    const filtered = quotations.filter(q =>
        q.providerName?.toLowerCase().includes(search.toLowerCase()) ||
        q.concept?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl flex flex-col">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan-800/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <Activity size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Proveedores</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            Cotizaciones <span className="text-blue-400">Recibidas</span>
                        </h1>
                        <p className="text-white/50 text-sm mt-3 max-w-lg leading-relaxed flex items-center gap-2">
                            Gestiona y compara las propuestas económicas de tus proveedores.
                            {activeEmpresa && activeEmpresa !== 'Todas' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80 border border-white/20 uppercase tracking-widest">
                                    {activeEmpresa}
                                </span>
                            )}
                        </p>
                    </div>
                    <button className="flex items-center justify-center gap-2 bg-blue-500 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-blue-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                        <Plus size={20} /> Registrar Cotización
                    </button>
                </div>

                {/* Search */}
                <div className="relative max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-blue-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por proveedor o concepto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/[0.05] outline-none transition-all shadow-xl"
                    />
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center h-64 text-white/30 font-bold uppercase tracking-widest animate-pulse">
                        Cargando cotizaciones...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white/[0.02] rounded-[32px] border border-white/5 p-16 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-2xl">
                            <Handshake size={40} className="text-white/20" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Bandeja Vacía</h3>
                        <p className="text-white/40 text-sm max-w-md">
                            {search ? 'No hay resultados para tu búsqueda.' : 'Almacena aquí las cotizaciones de tus proveedores para evaluarlas y aprobarlas.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map(q => (
                            <div key={q.id} className="group relative bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-500 flex flex-col overflow-hidden hover:shadow-2xl">
                                {/* Resplandor */}
                                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-blue-500 opacity-[0.02] group-hover:opacity-10 blur-2xl transition-opacity" />
                                
                                <div className="flex items-center gap-4 mb-5 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-white/50 flex items-center justify-center shrink-0">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-white truncate mb-1">{q.providerName}</h3>
                                        <p className="text-[11px] font-bold text-white/40 flex items-center gap-1.5 uppercase tracking-wider">
                                            <Calendar size={12} className="text-white/30" /> {q.date}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 mb-5 relative z-10">
                                    <p className="text-sm font-medium text-white/60 line-clamp-2 leading-relaxed">
                                        {q.concept}
                                    </p>
                                </div>

                                <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center relative z-10">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-widest block mb-1">Monto Total</span>
                                        <span className="text-2xl font-black text-white leading-none">
                                            <span className="text-base text-white/40 mr-1">S/.</span>
                                            {q.total?.toFixed(2)}
                                        </span>
                                    </div>
                                    <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/70 hover:text-white transition-all border border-white/5">
                                        <ExternalLink size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CotizacionesRecibidas;
