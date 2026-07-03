import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Users, Search, Play, Pause, Trash2, TrendingUp, Briefcase, Plus, Activity } from 'lucide-react';

const ClientesFrecuentes = () => {
    const { activeEmpresa, user } = useAuth();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!activeEmpresa) return;

        const q = query(collection(db, 'clientes_frecuentes'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const filtered = activeEmpresa === 'Todas' ? all : all.filter(d => (d.empresa || '') === activeEmpresa);
            setClientes(filtered);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching clientes frecuentes:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [activeEmpresa]);

    const handleToggleStatus = async (cliente) => {
        try {
            const newStatus = cliente.status === 'active' ? 'inactive' : 'active';
            await updateDoc(doc(db, 'clientes_frecuentes', cliente.id), {
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
            toast.success(`Cliente ${newStatus === 'active' ? 'activado' : 'desactivado'}`);
        } catch (error) {
            toast.error('Error al actualizar estado');
        }
    };

    const handleRecontratacion = async (cliente) => {
        try {
            // Create a new deal in prospeccion
            await addDoc(collection(db, 'crm_deals'), {
                title: `Recontratación - ${cliente.company}`,
                company: cliente.company,
                amount: cliente.amount || 0,
                stageId: 'prospeccion',
                empresa: cliente.empresa || activeEmpresa,
                createdBy: user?.name || 'Sistema',
                createdAt: new Date().toISOString()
            });
            toast.success('Nueva oportunidad de recontratación creada en CRM');
        } catch (error) {
            toast.error('Error al iniciar recontratación');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Eliminar definitivamente este cliente frecuente?')) {
            try {
                await deleteDoc(doc(db, 'clientes_frecuentes', id));
                toast.success('Cliente eliminado');
            } catch (error) {
                toast.error('Error al eliminar');
            }
        }
    };

    const filteredClientes = clientes.filter(c => 
        c.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl flex flex-col">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-rose-800/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between gap-6 items-end">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <Activity size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Fidelización</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            Clientes <span className="text-blue-400">Frecuentes</span>
                        </h1>
                        <p className="text-white/50 text-sm mt-3 max-w-lg leading-relaxed flex items-center gap-2">
                            Gestión de retención, pagos continuos y reactivación de cuentas.
                            {activeEmpresa && activeEmpresa !== 'Todas' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80 border border-white/20 uppercase tracking-widest">
                                    {activeEmpresa}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-blue-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:bg-white/[0.05] outline-none transition-all shadow-xl"
                        />
                    </div>
                </div>

                {/* Table container */}
                <div className="bg-white/[0.02] rounded-3xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/40 border-b border-white/10 text-white/50 text-[10px] uppercase tracking-widest font-bold">
                                    <th className="p-5">Cliente / Empresa</th>
                                    <th className="p-5">Estado</th>
                                    <th className="p-5">Monto Base</th>
                                    <th className="p-5">Fecha Registro</th>
                                    <th className="p-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="p-16 text-center text-white/30 font-bold uppercase tracking-widest animate-pulse">Cargando clientes...</td>
                                    </tr>
                                ) : filteredClientes.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-16 text-center text-white/30 font-bold">No se encontraron clientes frecuentes.</td>
                                    </tr>
                                ) : (
                                    filteredClientes.map(cliente => (
                                        <tr key={cliente.id} className="hover:bg-white/[0.04] transition-colors group">
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl border ${cliente.status === 'active' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                                        {cliente.company?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-base">{cliente.company}</p>
                                                        <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mt-1">{cliente.empresa}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                                                    cliente.status === 'active' 
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] ${cliente.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                                                    {cliente.status === 'active' ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <span className="font-black text-white text-lg">
                                                    <span className="text-white/30 text-sm mr-1">S/.</span>
                                                    {cliente.amount?.toLocaleString() || '0'}
                                                </span>
                                            </td>
                                            <td className="p-5 text-sm font-semibold text-white/50">
                                                {new Date(cliente.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-5">
                                                <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleToggleStatus(cliente)}
                                                        className={`p-2.5 rounded-xl transition-all border ${
                                                            cliente.status === 'active' 
                                                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                        }`}
                                                        title={cliente.status === 'active' ? 'Desactivar Cliente' : 'Activar Cliente'}
                                                    >
                                                        {cliente.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                                                    </button>
                                                    
                                                    {cliente.status === 'inactive' && (
                                                        <button
                                                            onClick={() => handleRecontratacion(cliente)}
                                                            className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all"
                                                            title="Iniciar búsqueda de recontratación"
                                                        >
                                                            <TrendingUp size={18} />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handleDelete(cliente.id)}
                                                        className="p-2.5 bg-white/5 text-white/30 border border-white/10 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
                                                        title="Eliminar permanentemente"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientesFrecuentes;
