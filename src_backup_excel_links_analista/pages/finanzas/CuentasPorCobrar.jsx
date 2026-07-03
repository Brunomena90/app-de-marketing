import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { TrendingUp, Search, Building2, ExternalLink, Calendar, ShoppingCart, UserCheck, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const CuentasPorCobrar = () => {
    const { activeEmpresa } = useAuth();
    const [ordenes, setOrdenes] = useState([]);
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!activeEmpresa) return;

        const filterByEmpresa = (docs) => activeEmpresa === 'Todas' ? docs : docs.filter(d => (d.empresa || '') === activeEmpresa);
        const unsubs = [];

        // Fetch Orders (Facturadas y Entregadas que representan ingresos o cuentas por cobrar)
        unsubs.push(onSnapshot(query(collection(db, 'ordenes_compra'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            // Filtramos solo las que están en estado avanzado
            setOrdenes(filterByEmpresa(all).filter(o => ['Facturada', 'Entregada'].includes(o.status)));
        }));

        // Fetch Deals (Cerrados)
        unsubs.push(onSnapshot(query(collection(db, 'crm_deals'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setDeals(filterByEmpresa(all).filter(d => d.stageId === 'cerrado'));
            setLoading(false);
        }));

        return () => unsubs.forEach(u => u());
    }, [activeEmpresa]);

    // Unificamos las cuentas por cobrar / ingresos confirmados
    const transacciones = useMemo(() => {
        const list = [];
        ordenes.forEach(o => {
            list.push({
                id: o.id,
                type: 'Orden de Compra',
                title: o.title,
                client: o.supplier,
                amount: o.total,
                date: o.date || o.createdAt.split('T')[0],
                status: o.status,
                route: '/ventas/ordenes-compra',
                icon: <ShoppingCart size={18} />
            });
        });
        deals.forEach(d => {
            list.push({
                id: d.id,
                type: 'Trato CRM',
                title: d.title,
                client: d.company,
                amount: d.amount,
                date: (d.updatedAt || d.createdAt).split('T')[0],
                status: 'Cerrado/Ganado',
                route: '/ventas/crm',
                icon: <UserCheck size={18} />
            });
        });

        // Sort by date desc
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        return list;
    }, [ordenes, deals]);

    const filtered = transacciones.filter(t => 
        t.title?.toLowerCase().includes(search.toLowerCase()) || 
        t.client?.toLowerCase().includes(search.toLowerCase())
    );

    const totalCobrar = filtered.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between gap-4 items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <TrendingUp className="text-emerald-500" size={32} />
                        </div>
                        Cuentas por Cobrar (Ingresos)
                    </h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        Ingresos automatizados desde el módulo de Ventas.
                        {activeEmpresa && activeEmpresa !== 'Todas' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Building2 size={10} /> {activeEmpresa}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente o título..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-200 outline-none transition-all shadow-sm"
                    />
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col justify-center items-center text-emerald-800">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Total Mostrado</span>
                    <span className="text-xl font-black">S/. {totalCobrar.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold">
                                <th className="p-4">Concepto / Cliente</th>
                                <th className="p-4">Origen</th>
                                <th className="p-4">Fecha Cierre</th>
                                <th className="p-4">Estado</th>
                                <th className="p-4">Monto</th>
                                <th className="p-4 text-right">Ver</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Sincronizando con Ventas...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No hay ingresos registrados aún.</td></tr>
                            ) : (
                                filtered.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-bold text-slate-800">{t.title}</p>
                                                <p className="text-xs text-slate-500">{t.client}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
                                                {t.icon} {t.type}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                                                <Calendar size={14} className="text-slate-400" /> {t.date}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                                <CheckCircle size={12} /> {t.status}
                                            </span>
                                        </td>
                                        <td className="p-4 font-black text-emerald-600">
                                            S/. {t.amount?.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Link
                                                to={t.route}
                                                className="inline-flex p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Ir a Ventas"
                                            >
                                                <ExternalLink size={16} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CuentasPorCobrar;
