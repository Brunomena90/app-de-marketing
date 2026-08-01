import React, { useState, useEffect } from 'react';
import { Search, FileText, Calendar, User, ExternalLink, Target, CheckCircle2, RotateCcw } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import QuotationModal from '../../components/QuotationModal';
import { useAuth } from '../../context/AuthContext';

const Facturacion = () => {
    const { activeEmpresa } = useAuth();
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState(null);

    useEffect(() => {
        const q = query(collection(db, 'cotizaciones'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Solo mostramos las facturadas
    const visibleAll = quotations.filter(q => {
        if (q.status !== 'Facturado') return false;
        if (activeEmpresa && activeEmpresa !== 'Todas') {
            return (q.empresa || 'Todas') === activeEmpresa;
        }
        return true;
    });

    const filtered = visibleAll.filter(q => 
        q.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        q.issuerName?.toLowerCase().includes(search.toLowerCase())
    );

    const handleView = (q) => { setSelectedQuotation(q); setIsModalOpen(true); };

    const handleUndo = async (id, e) => {
        e.stopPropagation();
        try {
            await updateDoc(doc(db, 'cotizaciones', id), {
                status: 'Por facturar',
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error al deshacer facturación:", error);
        }
    };

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-800/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <CheckCircle2 size={14} className="text-teal-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Documentos Cerrados</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            Facturación <span className="text-teal-400">Completada</span>
                        </h1>
                        <p className="text-white/50 text-sm mt-3 max-w-lg leading-relaxed">
                            Historial de cotizaciones que han sido procesadas, facturadas y registradas exitosamente.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 relative group h-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-white/30 group-focus-within:text-teal-400 transition-colors" size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por cliente o responsable..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-full min-h-[64px] bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:bg-white/[0.05] outline-none transition-all"
                        />
                    </div>
                    <div className="bg-gradient-to-br from-teal-900/40 to-emerald-900/20 border border-teal-500/20 rounded-2xl p-4 flex flex-col justify-center items-center text-teal-400 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/10 rounded-full blur-xl" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 z-10 mb-1">Total Facturadas</span>
                        <span className="text-3xl font-black z-10">{filtered.length}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center text-white/30 font-bold animate-pulse">Cargando datos de facturación...</div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white/[0.02] rounded-[32px] border border-white/5 p-16 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-2xl">
                            <FileText size={40} className="text-white/20" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No hay facturación registrada</h3>
                        <p className="text-white/40 text-sm max-w-md">
                            {search ? 'Ninguna cotización facturada coincide con la búsqueda.' : 'Aún no hay cotizaciones que hayan sido marcadas como facturadas.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((q) => (
                            <div key={q.id} className="group relative bg-white/[0.02] border rounded-[2rem] p-6 hover:bg-white/[0.04] transition-all duration-500 flex flex-col overflow-hidden hover:shadow-2xl border-teal-500/30">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-teal-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-teal-400 opacity-[0.03] group-hover:opacity-10 blur-2xl transition-opacity" />

                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
                                    <button onClick={(e) => handleUndo(q.id, e)} className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl hover:bg-orange-500/20 hover:text-orange-300 transition-all backdrop-blur-md border border-orange-500/20" title="Deshacer y devolver a Por Facturar">
                                        <RotateCcw size={14} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 mb-6 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border bg-teal-500/10 border-teal-500/20 text-teal-400">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="text-lg font-black text-white truncate mb-1">{q.clientName}</h3>
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider">
                                            <Calendar size={12} className="text-white/30" /> {q.date}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 mb-5 relative z-30">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Servicio / Proyecto</span>
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-teal-500/10 text-teal-400 border-teal-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_currentColor]" />
                                            Facturado
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-white/80 line-clamp-2 leading-relaxed">
                                        {q.items?.[0]?.description || 'Sin descripción'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 relative z-10">
                                    <Target size={14} className="text-teal-400 flex-shrink-0" />
                                    <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">Registrado en Cuentas por Cobrar</span>
                                </div>

                                <div className="flex items-end justify-between mt-auto relative z-10">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest mb-1.5">Responsable</span>
                                        <span className="text-xs font-bold text-white/60 flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg w-fit">
                                            <User size={12} className="text-white/40" /> {q.issuerName}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-teal-400 tracking-widest block mb-1">Monto Total</span>
                                        <span className="text-3xl font-black text-white leading-none tracking-tight">
                                            <span className="text-lg text-white/40 font-bold mr-1">{q.currency}</span> 
                                            {q.total?.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <button onClick={() => handleView(q)} className="mt-6 w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/5 hover:border-white/20 relative z-10">
                                    <ExternalLink size={16} /> Ver Detalles
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <QuotationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                quotation={selectedQuotation}
            />
        </div>
    );
};

export default Facturacion;
