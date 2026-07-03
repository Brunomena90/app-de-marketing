import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { TrendingDown, Search, Plus, Trash2, Calendar, FileText, CheckCircle2 } from 'lucide-react';

const Egresos = () => {
    const { activeEmpresa, user } = useAuth();
    const [egresos, setEgresos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form state
    const [form, setForm] = useState({
        title: '',
        amount: '',
        category: 'Operativo',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    useEffect(() => {
        if (!activeEmpresa) return;

        const q = query(collection(db, 'finanzas_egresos'), orderBy('date', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const filtered = activeEmpresa === 'Todas' ? all : all.filter(d => (d.empresa || '') === activeEmpresa);
            setEgresos(filtered);
            setLoading(false);
        });

        return () => unsub();
    }, [activeEmpresa]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title || !form.amount || !form.date) {
            toast.error('Completa todos los campos requeridos');
            return;
        }

        try {
            await addDoc(collection(db, 'finanzas_egresos'), {
                ...form,
                amount: parseFloat(form.amount),
                empresa: activeEmpresa,
                createdBy: user?.name,
                createdAt: new Date().toISOString()
            });
            toast.success('Gasto registrado exitosamente');
            setIsModalOpen(false);
            setForm({ title: '', amount: '', category: 'Operativo', date: new Date().toISOString().split('T')[0], notes: '' });
        } catch (error) {
            toast.error('Error al registrar el gasto');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Seguro que deseas eliminar este registro de gasto?')) {
            try {
                await deleteDoc(doc(db, 'finanzas_egresos', id));
                toast.success('Gasto eliminado');
            } catch (error) {
                toast.error('Error al eliminar');
            }
        }
    };

    const filteredEgresos = egresos.filter(e => 
        e.title?.toLowerCase().includes(search.toLowerCase()) || 
        e.category?.toLowerCase().includes(search.toLowerCase())
    );

    const totalEgresos = filteredEgresos.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 rounded-xl">
                            <TrendingDown className="text-rose-500" size={32} />
                        </div>
                        Cuentas por Pagar (Egresos)
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Control de gastos operativos, pagos a proveedores y obligaciones.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                >
                    <Plus size={20} /> Registrar Gasto
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar gasto por título o categoría..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-200 outline-none transition-all shadow-sm"
                    />
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex flex-col justify-center items-center text-rose-800">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Mostrado</span>
                    <span className="text-xl font-black">S/. {totalEgresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-4">Concepto / Categoría</th>
                                <th className="p-4">Fecha</th>
                                <th className="p-4">Monto</th>
                                <th className="p-4">Notas</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-400">Cargando egresos...</td></tr>
                            ) : filteredEgresos.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-400">No se encontraron egresos.</td></tr>
                            ) : (
                                filteredEgresos.map(egreso => (
                                    <tr key={egreso.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{egreso.title}</p>
                                                    <span className="inline-flex px-2 py-0.5 mt-1 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                                        {egreso.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                                                <Calendar size={14} className="text-slate-400" /> {egreso.date}
                                            </span>
                                        </td>
                                        <td className="p-4 font-black text-rose-600">
                                            S/. {egreso.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate">
                                            {egreso.notes || '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDelete(egreso.id)}
                                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Nuevo Gasto */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                            <TrendingDown className="text-rose-500" /> Nuevo Registro de Gasto
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concepto / Título</label>
                                <input required autoFocus type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-200" placeholder="Ej: Pago de Servidores AWS" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto (S/.)</label>
                                    <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-200" placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</label>
                                    <input required type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-200" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría</label>
                                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-200">
                                    <option value="Operativo">Gasto Operativo</option>
                                    <option value="Planilla">Planilla / Nómina</option>
                                    <option value="Servicios">Servicios Básicos</option>
                                    <option value="Software">Licencias Software</option>
                                    <option value="Marketing">Marketing / Pauta</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas adicionales</label>
                                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-200 resize-none h-20" placeholder="Detalles extra del gasto..."></textarea>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-all text-sm">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all text-sm shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2">
                                    <CheckCircle2 size={18} /> Registrar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Egresos;
