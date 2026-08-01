import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, Plus, Search, FileText, Calendar, User, Edit2, Trash2, ExternalLink, ChevronDown, Check, ArrowRightCircle, Target, Activity } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore';
import QuotationModal from '../../components/QuotationModal';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

// ─── Estados para facturas (simplificado) ──
const STATUSES = [
    { value: 'Por facturar',label: 'Por facturar',  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', dot: 'bg-indigo-400', hoverBg: 'hover:bg-indigo-500/20' },
    { value: 'Facturado',   label: 'Facturado',     color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',       dot: 'bg-teal-400', hoverBg: 'hover:bg-teal-500/20' },
];

const getStatusConfig = (status) => STATUSES.find(s => s.value === status) || STATUSES[0];

// ─── Dropdown de estado en tarjeta (Dark Mode) ───────────────────────────────
const StatusDropdown = ({ quotation, onFacturado }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);
    const currentStatus = quotation.status || 'Por facturar';
    const cfg = getStatusConfig(currentStatus);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChange = async (newStatus) => {
        if (newStatus === currentStatus) { setOpen(false); return; }
        setLoading(true);
        try {
            await updateDoc(doc(db, 'cotizaciones', quotation.id), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });

            toast.success(`Estado actualizado a: ${newStatus}`);
            if (newStatus === 'Facturado') {
                onFacturado?.();
            }
        } catch(e) {
            console.error(e);
            toast.error('Error al actualizar el estado');
        } finally {
            setLoading(false);
            setOpen(false);
        }
    };

    return (
        <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(!open)}
                disabled={loading}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all hover:shadow-lg active:scale-95 ${cfg.color} ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shadow-[0_0_8px_currentColor]`} />
                {currentStatus}
                <ChevronDown size={12} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 p-2 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                    {STATUSES.map(s => (
                        <button
                            key={s.value}
                            onClick={() => handleChange(s.value)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left group ${s.value === currentStatus ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                        >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot} shadow-[0_0_8px_currentColor]`} />
                            <span className="flex-1">{s.label}</span>
                            {s.value === currentStatus && <Check size={14} className="text-white flex-shrink-0" />}
                        </button>
                    ))}
                    <div className="mt-2 pt-2 border-t border-white/5 px-3 pb-1">
                        <p className="text-[9px] text-white/30 leading-relaxed font-medium">
                            Al cambiar a Facturado, se enviará al panel de Facturación.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Componente principal (Dark Mode) ─────────────────────────────────────────
const PorFacturar = () => {
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

    const visibleAll = quotations.filter(q => {
        if (q.status !== 'Por facturar') return false; // Solo mostramos pendientes de facturar
        if (activeEmpresa && activeEmpresa !== 'Todas') {
            return (q.empresa || 'Todas') === activeEmpresa;
        }
        return true;
    });

    const filtered = visibleAll.filter(q => {
        return (
            q.clientName?.toLowerCase().includes(search.toLowerCase()) ||
            q.issuerName?.toLowerCase().includes(search.toLowerCase())
        );
    });

    const handleDelete = (id) => {
        toast('¿Eliminar documento?', {
            action: {
                label: 'Eliminar',
                onClick: async () => {
                    try {
                        await deleteDoc(doc(db, 'cotizaciones', id));
                        toast.success('Documento eliminado');
                    } catch { toast.error('Error al eliminar'); }
                }
            },
            cancel: { label: 'Cancelar' }
        });
    };

    const handleEdit = (q) => { setSelectedQuotation(q); setIsModalOpen(true); };
    const handleCreate = () => { setSelectedQuotation({ status: 'Por facturar' }); setIsModalOpen(true); };

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-800/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <Activity size={14} className="text-indigo-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Emisión de Facturas</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            Documentos <span className="text-indigo-400">Por Facturar</span>
                        </h1>
                        <p className="text-white/50 text-sm mt-3 max-w-lg leading-relaxed">
                            Gestiona y emite las facturas pendientes conectadas a tus clientes y Finanzas.
                        </p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center justify-center gap-2 bg-indigo-500 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-indigo-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
                    >
                        <Plus size={20} /> Emitir Factura
                    </button>
                </div>

                {/* Buscador */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 relative group h-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-white/30 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por cliente o responsable..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-full min-h-[64px] bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white/[0.05] outline-none transition-all"
                        />
                    </div>
                    <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/20 border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-center items-center text-indigo-400 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 z-10 mb-1">Total Por Facturar</span>
                        <span className="text-3xl font-black z-10">{filtered.length}</span>
                    </div>
                </div>

                {/* Contenido */}
                {loading ? (
                    <div className="p-20 text-center text-white/30 font-bold animate-pulse">Cargando documentos...</div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white/[0.02] rounded-[32px] border border-white/5 p-16 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-2xl">
                            <FileText size={40} className="text-white/20" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No hay facturas pendientes</h3>
                        <p className="text-white/40 text-sm max-w-md">
                            {search
                                ? 'Ningún documento coincide con los filtros aplicados.'
                                : 'Todo al día. No tienes cotizaciones pendientes de facturar.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((q) => {
                            const cfg = getStatusConfig(q.status);

                            return (
                                <div
                                    key={q.id}
                                    className="group relative bg-white/[0.02] border border-white/10 rounded-[2rem] p-6 hover:bg-white/[0.04] transition-all duration-500 flex flex-col overflow-hidden hover:shadow-2xl hover:border-white/20"
                                >
                                    <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.dot} opacity-50 group-hover:opacity-100 transition-opacity`} />
                                    <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full ${cfg.dot} opacity-[0.03] group-hover:opacity-10 blur-2xl transition-opacity`} />

                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
                                        <button onClick={() => handleEdit(q)} className="p-2.5 bg-white/10 text-white/70 rounded-xl hover:bg-white/20 hover:text-white transition-all backdrop-blur-md" title="Editar">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(q.id)} className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 hover:text-red-300 transition-all backdrop-blur-md" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 mb-6 relative z-10">
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border bg-white/5 border-white/10 text-white/50">
                                            <FileText size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-16">
                                            <h3 className="text-lg font-black text-white truncate mb-1">{q.clientName}</h3>
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider">
                                                <Calendar size={12} className="text-white/30" /> {q.date}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 mb-5 relative z-30">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Servicio / Proyecto</span>
                                            <StatusDropdown quotation={q} />
                                        </div>
                                        <p className="text-sm font-medium text-white/80 line-clamp-2 leading-relaxed">
                                            {q.items?.[0]?.description || 'Sin descripción'}
                                        </p>
                                    </div>

                                    <div className="flex items-end justify-between mt-auto relative z-10">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest mb-1.5">Responsable</span>
                                            <span className="text-xs font-bold text-white/60 flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg w-fit">
                                                <User size={12} className="text-white/40" /> {q.issuerName}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest block mb-1">Monto Total</span>
                                            <span className="text-3xl font-black text-white leading-none tracking-tight">
                                                <span className="text-lg text-white/40 font-bold mr-1">{q.currency}</span> 
                                                {q.total?.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    <button onClick={() => handleEdit(q)} className="mt-6 w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/5 hover:border-white/20 relative z-10">
                                        <ExternalLink size={16} /> Abrir Documento
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <QuotationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                quotation={selectedQuotation}
                defaultStatus="Por facturar" // We can pass a prop if needed, for now modifying the logic inside QuotationModal is advanced
            />
        </div>
    );
};

export default PorFacturar;
