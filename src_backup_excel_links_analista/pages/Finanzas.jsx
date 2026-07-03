import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Activity, ArrowRight, Building2, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';

const Finanzas = () => {
    const { activeEmpresa } = useAuth();
    
    // Data states
    const [ordenes, setOrdenes] = useState([]);
    const [deals, setDeals] = useState([]);
    const [egresos, setEgresos] = useState([]);
    const [clientesFrecuentes, setClientesFrecuentes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeEmpresa) return;

        const filterByEmpresa = (docs) => activeEmpresa === 'Todas' ? docs : docs.filter(d => (d.empresa || '') === activeEmpresa);
        const unsubs = [];

        // 1. Órdenes facturadas (Ingresos confirmados)
        unsubs.push(onSnapshot(query(collection(db, 'ordenes_compra'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setOrdenes(filterByEmpresa(all));
        }));

        // 2. Deals cerrados (Ingresos por proyectos)
        unsubs.push(onSnapshot(query(collection(db, 'crm_deals'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setDeals(filterByEmpresa(all));
        }));

        // 3. Egresos (Gastos operativos)
        unsubs.push(onSnapshot(query(collection(db, 'finanzas_egresos'), orderBy('date', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setEgresos(filterByEmpresa(all));
        }));

        // 4. Ingresos recurrentes (Clientes frecuentes)
        unsubs.push(onSnapshot(query(collection(db, 'clientes_frecuentes'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setClientesFrecuentes(filterByEmpresa(all).filter(c => c.status === 'active'));
            setLoading(false);
        }));

        return () => unsubs.forEach(u => u());
    }, [activeEmpresa]);

    // Calcular métricas
    const { totalIngresos, totalEgresos, mrr } = useMemo(() => {
        // Ingresos de Órdenes Facturadas
        const ingresosOrdenes = ordenes.filter(o => o.status === 'Facturada').reduce((acc, curr) => acc + (curr.total || 0), 0);
        // Ingresos de Deals Cerrados
        const ingresosDeals = deals.filter(d => d.stageId === 'cerrado').reduce((acc, curr) => acc + (curr.amount || 0), 0);
        
        const totalI = ingresosOrdenes + ingresosDeals;
        const totalE = egresos.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        const recurringRevenue = clientesFrecuentes.reduce((acc, curr) => acc + (curr.amount || 0), 0);

        return { totalIngresos: totalI, totalEgresos: totalE, mrr: recurringRevenue };
    }, [ordenes, deals, egresos, clientesFrecuentes]);

    const beneficioNeto = totalIngresos - totalEgresos;
    const margen = totalIngresos > 0 ? Math.round((beneficioNeto / totalIngresos) * 100) : 0;

    // Gráfico de flujo de caja (mes a mes)
    const cashFlowData = useMemo(() => {
        const months = {};
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        // Initialize last 6 months
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            months[key] = { name: monthNames[d.getMonth()], ingresos: 0, egresos: 0 };
        }

        // Add income
        ordenes.filter(o => o.status === 'Facturada').forEach(o => {
            const d = new Date(o.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) months[key].ingresos += (o.total || 0);
        });
        deals.filter(d => d.stageId === 'cerrado').forEach(d => {
            const dateStr = d.updatedAt || d.createdAt;
            const dObj = new Date(dateStr);
            const key = `${dObj.getFullYear()}-${dObj.getMonth()}`;
            if (months[key]) months[key].ingresos += (d.amount || 0);
        });

        // Add expenses
        egresos.forEach(e => {
            const d = new Date(e.date + 'T00:00:00'); // Normalize date string
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) months[key].egresos += (e.amount || 0);
        });

        return Object.values(months);
    }, [ordenes, deals, egresos]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-xl">
                        <Wallet className="text-indigo-500" size={32} />
                    </div>
                    Dashboard Financiero
                </h1>
                <p className="text-slate-500 mt-2 max-w-xl flex items-center gap-2">
                    Visión general del estado económico y flujo de caja
                    {activeEmpresa && activeEmpresa !== 'Todas' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Building2 size={11} /> {activeEmpresa}
                        </span>
                    )}
                </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group hover:border-emerald-200 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 ring-4 ring-white">
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 mb-1">S/. {totalIngresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-bold text-slate-700">Ingresos Totales</p>
                    <p className="text-xs text-slate-500 mt-1">Facturado + Deals Cerrados</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group hover:border-rose-200 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 ring-4 ring-white">
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-slate-800 mb-1">S/. {totalEgresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-bold text-slate-700">Egresos Totales</p>
                    <p className="text-xs text-slate-500 mt-1">Gastos operativos y pagos</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 ring-4 ring-white">
                            <Activity size={24} />
                        </div>
                    </div>
                    <h3 className={`text-3xl font-black mb-1 ${beneficioNeto >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        S/. {beneficioNeto.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </h3>
                    <p className="text-sm font-bold text-slate-700">Beneficio Neto</p>
                    <p className="text-xs text-slate-500 mt-1">Margen operativo: {margen}%</p>
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 border border-indigo-800 shadow-lg flex flex-col relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl" />
                    <div className="flex justify-between items-start mb-4 relative">
                        <div className="w-12 h-12 rounded-full bg-indigo-800/50 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <div className="relative">
                        <h3 className="text-3xl font-black text-white mb-1">S/. {mrr.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm font-bold text-indigo-200">MRR Proyectado</p>
                        <p className="text-xs text-indigo-400 mt-1">Ingresos recurrentes (Clientes Frecs)</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cash Flow Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <BarChart3 size={18} className="text-indigo-500" /> Flujo de Caja (Últimos 6 meses)
                        </h3>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <RechartsTooltip 
                                    cursor={{ fill: '#F3F4F6' }} 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [`S/. ${value.toLocaleString()}`, '']}
                                />
                                <Bar dataKey="ingresos" name="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="egresos" name="Egresos" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Accesos Rápidos */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChartIcon size={18} className="text-indigo-500" /> Accesos Rápidos
                    </h3>
                    <div className="space-y-4 flex-1">
                        <Link to="/finanzas/cuentas-cobrar" className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200 transition-colors">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Cuentas por Cobrar</p>
                                    <p className="text-xs text-slate-500">Facturación e ingresos</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-slate-400 group-hover:text-emerald-500 transition-colors group-hover:translate-x-1" />
                        </Link>
                        
                        <Link to="/finanzas/egresos" className="group flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg group-hover:bg-rose-200 transition-colors">
                                    <TrendingDown size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm">Cuentas por Pagar</p>
                                    <p className="text-xs text-slate-500">Registro de gastos</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-slate-400 group-hover:text-rose-500 transition-colors group-hover:translate-x-1" />
                        </Link>

                        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50 mt-auto text-sm text-indigo-800 flex gap-2">
                            <DollarSign size={18} className="flex-shrink-0 text-indigo-500" />
                            <p>El módulo de finanzas está <strong>conectado directamente</strong> con Ventas. Las órdenes facturadas y tratos cerrados se reflejan automáticamente aquí.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Finanzas;
