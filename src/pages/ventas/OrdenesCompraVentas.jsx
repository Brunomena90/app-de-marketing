import React, { useState, useEffect, useRef } from 'react';
import {
    ShoppingCart, Plus, Search, FileText, Calendar,
    Building2, ChevronDown, Check, Edit2, Trash2, ArrowUpRight, Link2, Activity
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

// ─── Ciclo de vida completo de una Orden de Compra (Dark Mode) ────────────────
const ORDER_STATUSES = [
    { value: 'En proceso',   label: 'En proceso',   color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',     dot: 'bg-amber-400',   bar: 'bg-amber-400', hoverBg: 'hover:bg-amber-500/20' },
    { value: 'Aprobada',     label: 'Aprobada',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',        dot: 'bg-blue-400',    bar: 'bg-blue-400', hoverBg: 'hover:bg-blue-500/20' },
    { value: 'En producción',label: 'En producción', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',  dot: 'bg-purple-400',  bar: 'bg-purple-400', hoverBg: 'hover:bg-purple-500/20' },
    { value: 'Entregada',    label: 'Entregada',     color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',           dot: 'bg-sky-400',     bar: 'bg-sky-400', hoverBg: 'hover:bg-sky-500/20' },
    { value: 'Facturada',    label: 'Facturada',     color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',dot:'bg-emerald-400', bar: 'bg-emerald-400', hoverBg: 'hover:bg-emerald-500/20' },
    { value: 'Cancelada',    label: 'Cancelada',     color: 'bg-red-500/10 text-red-400 border-red-500/20',           dot: 'bg-red-400',     bar: 'bg-red-400', hoverBg: 'hover:bg-red-500/20' },
];

const getOrderStatus = (status) => ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];

// ─── Progreso de estados (excluyendo Cancelada) ───────────────────────────────
const PROGRESS_STEPS = ['En proceso', 'Aprobada', 'En producción', 'Entregada', 'Facturada'];

const OrderProgress = ({ status }) => {
    const currentIdx = PROGRESS_STEPS.indexOf(status);
    if (status === 'Cancelada') return (
        <div className="flex items-center gap-2 py-2">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Orden cancelada</span>
        </div>
    );
    return (
        <div className="flex items-center gap-1 w-full mt-2">
            {PROGRESS_STEPS.map((step, idx) => {
                const done = idx <= currentIdx;
                const active = idx === currentIdx;
                return (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 ${done ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/5 border border-white/10'} ${active ? 'ring-4 ring-emerald-500/20' : ''}`}>
                                {done && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <span className={`text-[8px] font-bold text-center leading-tight hidden sm:block ${active ? 'text-emerald-400' : done ? 'text-white/60' : 'text-white/20'}`} style={{ width: 44 }}>
                                {step}
                            </span>
                        </div>
                        {idx < PROGRESS_STEPS.length - 1 && (
                            <div className="flex-1 h-0.5 mb-4 rounded-full overflow-hidden bg-white/5 relative">
                                <div className={`absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ${idx < currentIdx ? 'w-full' : 'w-0'}`} />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ─── Dropdown de estado para órdenes ─────────────────────────────────────────
const OrderStatusDropdown = ({ orderId, currentStatus }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef(null);
    const cfg = getOrderStatus(currentStatus);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChange = async (newStatus) => {
        if (newStatus === currentStatus) { setOpen(false); return; }
        setLoading(true);
        try {
            await updateDoc(doc(db, 'ordenes_compra', orderId), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
            toast.success(`Orden actualizada: ${newStatus}`);
        } catch {
            toast.error('Error al actualizar');
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
                {currentStatus || 'En proceso'}
                <ChevronDown size={12} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 p-2 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-xl">
                    {ORDER_STATUSES.map(s => (
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
                </div>
            )}
        </div>
    );
};

// ─── Módulo principal (Dark Mode) ─────────────────────────────────────────────
const OrdenesCompraVentas = () => {
    const { activeEmpresa } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');

    useEffect(() => {
        const q = query(collection(db, 'ordenes_compra'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const byEmpresa = activeEmpresa === 'Todas' ? all : all.filter(d => (d.empresa || '') === activeEmpresa);
            setOrders(byEmpresa);
            setLoading(false);
        });
        return () => unsub();
    }, [activeEmpresa]);

    const handleDelete = (id) => {
        toast('¿Eliminar esta orden?', {
            action: {
                label: 'Eliminar',
                onClick: async () => {
                    try {
                        await deleteDoc(doc(db, 'ordenes_compra', id));
                        toast.success('Orden eliminada');
                    } catch { toast.error('Error al eliminar'); }
                }
            },
            cancel: { label: 'Cancelar' }
        });
    };

    const visibleAll = orders;
    const filtered = visibleAll.filter(o => {
        if (statusFilter !== 'Todos' && o.status !== statusFilter) return false;
        return (
            o.title?.toLowerCase().includes(search.toLowerCase()) ||
            o.supplier?.toLowerCase().includes(search.toLowerCase()) ||
            o.cotizacionRef?.toLowerCase().includes(search.toLowerCase())
        );
    });

    const counts = ORDER_STATUSES.reduce((acc, s) => {
        acc[s.value] = visibleAll.filter(o => o.status === s.value).length;
        return acc;
    }, {});

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-800/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-white/10 mb-4 shadow-md">
                            <Activity size={14} className="text-emerald-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Ejecución Comercial</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            Órdenes de <span className="text-emerald-400">Compra</span>
                        </h1>
                        <p className="text-white/50 text-sm mt-3 max-w-lg leading-relaxed flex items-center gap-2">
                            Trazabilidad completa: desde la aprobación hasta la facturación.
                            {activeEmpresa && activeEmpresa !== 'Todas' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80 border border-white/20">
                                    <Building2 size={10} /> {activeEmpresa}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setStatusFilter('Todos')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${statusFilter === 'Todos' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-gray-900 text-white/60 border-white/10 hover:bg-gray-800 hover:text-white'}`}
                    >
                        Todas ({visibleAll.length})
                    </button>
                    {ORDER_STATUSES.map(s => (
                        <button
                            key={s.value}
                            onClick={() => setStatusFilter(s.value)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${statusFilter === s.value ? `${s.color} shadow-lg ring-1 ring-current` : `bg-gray-900 text-white/60 border-white/10 hover:text-white`}`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shadow-[0_0_8px_currentColor]`} />
                            {s.label} {counts[s.value] > 0 && <span className="opacity-60 ml-1">({counts[s.value]})</span>}
                        </button>
                    ))}
                </div>

                {/* Buscador */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-emerald-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, descripción o ref COT-..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-gray-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-gray-950 outline-none transition-all"
                        />
                    </div>
                    <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/20 border border-amber-500/20 rounded-2xl p-4 flex flex-col justify-center items-center text-amber-400 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl" />
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 z-10 mb-1">Total Filtradas</span>
                        <span className="text-3xl font-black z-10">{filtered.length}</span>
                    </div>
                </div>

                {/* Contenido */}
                {loading ? (
                    <div className="p-20 text-center text-white/30 font-bold animate-pulse">Cargando órdenes...</div>
                ) : filtered.length === 0 ? (
                    <div className="bg-gray-900 rounded-[32px] border border-white/10 p-16 flex flex-col items-center justify-center text-center shadow-xl">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-6 ring-1 ring-white/10 shadow-2xl">
                            <ShoppingCart size={40} className="text-white/20" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No hay resultados</h3>
                        <p className="text-white/40 text-sm max-w-md">
                            {search || statusFilter !== 'Todos'
                                ? 'Ninguna orden coincide con los filtros aplicados.'
                                : 'Las órdenes se generan automáticamente cuando apruebas una cotización en el panel anterior.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((o) => {
                            const cfg = getOrderStatus(o.status);

                            return (
                                <div
                                    key={o.id}
                                    className="group relative bg-gray-900 border border-white/10 rounded-[2rem] p-6 hover:bg-gray-800/90 hover:border-white/20 transition-all duration-300 flex flex-col overflow-hidden shadow-xl [transform:translateZ(0)]"
                                >
                                    {/* Acento superior de color */}
                                    <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.dot} opacity-50 group-hover:opacity-100 transition-opacity`} />
                                    
                                    {/* Resplandor radial de estado */}
                                    <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full ${cfg.dot} opacity-[0.03] group-hover:opacity-10 blur-2xl transition-opacity`} />

                                    {/* Acciones Hover */}
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
                                        <button onClick={() => handleDelete(o.id)} className="p-2.5 bg-gray-800 text-red-400 rounded-xl hover:bg-red-600 hover:text-white transition-all border border-white/5" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Header de Tarjeta */}
                                    <div className="flex items-center gap-4 mb-6 relative z-10">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border bg-white/5 border-white/10 text-white/50`}>
                                            <ShoppingCart size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0 pr-10">
                                            <h3 className="text-lg font-black text-white truncate mb-1">{o.title}</h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider">
                                                    <Calendar size={12} className="text-white/30" /> {o.date}
                                                </span>
                                                {o.cotizacionRef && (
                                                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                        <Link2 size={10} /> {o.cotizacionRef}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Panel de Progreso */}
                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 mb-5 relative z-30">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest">Seguimiento</span>
                                            <OrderStatusDropdown orderId={o.id} currentStatus={o.status} />
                                        </div>
                                        <OrderProgress status={o.status} />
                                    </div>

                                    {/* Concepto */}
                                    <p className="text-sm font-medium text-white/60 line-clamp-2 leading-relaxed mb-6 px-1 relative z-10">
                                        {o.items?.[0]?.description || (Array.isArray(o.notes) ? o.notes.join(' • ') : o.notes) || 'Sin descripción'}
                                    </p>

                                    {/* Footer */}
                                    <div className="flex items-end justify-between mt-auto relative z-10 pt-4 border-t border-white/5">
                                        <div className="flex flex-col max-w-[50%]">
                                            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest mb-1.5">Cliente Proveedor</span>
                                            <span className="text-xs font-bold text-white/80 truncate pr-2">
                                                {o.supplier}
                                            </span>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest block mb-1">Monto Total</span>
                                            <span className="text-2xl font-black text-white leading-none tracking-tight">
                                                <span className="text-base text-white/40 font-bold mr-1">{o.currency}</span> 
                                                {o.total?.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdenesCompraVentas;
