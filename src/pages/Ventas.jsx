import React, { useState, useEffect } from 'react';
import { BadgeDollarSign, TrendingUp, Handshake, ShoppingCart, UserCheck, ArrowRight, Building2, Heart, Activity, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const Ventas = () => {
    const { activeEmpresa, user } = useAuth();

    const [counts, setCounts] = useState({
        cotizacionesEmitidas: 0,
        cotizacionesRecibidas: 0,
        ordenes: 0,
        deals: 0,
        clientesFrecuentes: 0,
        dealsMonto: 0
    });

    // Escucha en tiempo real y filtra por empresa
    useEffect(() => {
        if (!activeEmpresa) return;

        const filterByEmpresa = (docs) =>
            activeEmpresa === 'Todas'
                ? docs
                : docs.filter(d => (d.empresa || '') === activeEmpresa);

        const unsubs = [];

        unsubs.push(onSnapshot(query(collection(db, 'cotizaciones'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data() }));
            setCounts(prev => ({ ...prev, cotizacionesEmitidas: filterByEmpresa(all).length }));
        }));

        unsubs.push(onSnapshot(query(collection(db, 'crm_deals'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data() }));
            const filtered = filterByEmpresa(all);
            const montoActivos = filtered.filter(d => d.stageId !== 'cerrado' && d.stageId !== 'perdido').reduce((acc, curr) => acc + (curr.amount || 0), 0);
            setCounts(prev => ({ ...prev, deals: filtered.length, dealsMonto: montoActivos }));
        }));

        unsubs.push(onSnapshot(query(collection(db, 'clientes_frecuentes'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data() }));
            setCounts(prev => ({ ...prev, clientesFrecuentes: filterByEmpresa(all).filter(c => c.status === 'active').length }));
        }));

        unsubs.push(onSnapshot(query(collection(db, 'ordenes_compra'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data() }));
            setCounts(prev => ({ ...prev, ordenes: filterByEmpresa(all).filter(o => o.status !== 'Facturada' && o.status !== 'Cancelada').length }));
        }));

        return () => unsubs.forEach(u => u());
    }, [activeEmpresa]);

    const overviewCards = [
        {
            id: 'crm',
            title: '1. CRM & Pipeline',
            count: counts.deals,
            text: `Valor est.: S/. ${counts.dealsMonto.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            icon: <UserCheck size={24} />,
            route: '/ventas/crm',
            gradient: 'from-violet-500 to-purple-600',
            glow: 'bg-violet-500',
            bgIcon: 'bg-violet-500/20 text-violet-400'
        },
        {
            id: 'emitidas',
            title: '2. Cotizaciones',
            count: counts.cotizacionesEmitidas,
            text: 'Enviadas a clientes',
            icon: <TrendingUp size={24} />,
            route: '/ventas/cotizaciones-emitidas',
            gradient: 'from-emerald-500 to-teal-600',
            glow: 'bg-emerald-500',
            bgIcon: 'bg-emerald-500/20 text-emerald-400'
        },
        {
            id: 'ordenes',
            title: '3. Órdenes de Servicio',
            count: counts.ordenes,
            text: 'Contratos activos',
            icon: <ShoppingCart size={24} />,
            route: '/ventas/ordenes-compra',
            gradient: 'from-amber-500 to-orange-600',
            glow: 'bg-amber-500',
            bgIcon: 'bg-amber-500/20 text-amber-400'
        },
        {
            id: 'clientes',
            title: '4. Directorio de Clientes',
            count: counts.clientesFrecuentes,
            text: 'Cartera de clientes y suscripciones',
            icon: <Heart size={24} />,
            route: '/ventas/clientes-frecuentes',
            gradient: 'from-rose-500 to-pink-600',
            glow: 'bg-rose-500',
            bgIcon: 'bg-rose-500/20 text-rose-400'
        },
    ];

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Dot Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <Activity size={14} className="text-emerald-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Workspace Comercial</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                            Gestión de <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">Ventas</span>
                        </h1>
                        <p className="text-white/50 mt-3 text-sm max-w-xl leading-relaxed">
                            Control centralizado de ingresos, embudos de conversión, y fidelización. Conectado en tiempo real con el módulo de Finanzas.
                        </p>
                    </div>
                    {activeEmpresa && activeEmpresa !== 'Todas' && (
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md">
                            <Building2 size={18} className="text-emerald-400" />
                            <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Entorno Activo</p>
                                <p className="text-sm font-bold text-white">{activeEmpresa}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {overviewCards.map((card) => (
                        <Link
                            key={card.id}
                            to={card.route}
                            className="group relative rounded-3xl p-6 bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-500 flex flex-col overflow-hidden hover:shadow-2xl"
                        >
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${card.gradient} opacity-50 group-hover:opacity-100 transition-opacity`} />
                            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${card.glow} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />

                            <div className="flex justify-between items-start mb-6 relative">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${card.bgIcon} backdrop-blur-md group-hover:scale-110 transition-transform duration-500`}>
                                    {card.icon}
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 group-hover:text-white group-hover:bg-white/10 transition-all duration-300 group-hover:translate-x-1">
                                    <ArrowRight size={16} />
                                </div>
                            </div>

                            <div className="relative mt-auto">
                                <h3 className="text-4xl font-black text-white mb-2 tracking-tight">{card.count}</h3>
                                <p className="text-base font-bold text-white/90">{card.title}</p>
                                <p className="text-xs text-white/50 mt-1 font-medium">{card.text}</p>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Info Panel Premium */}
                <div className="grid grid-cols-1 gap-6">
                    <div className="relative rounded-[2rem] bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/20 p-8 overflow-hidden group">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                            <div className="w-16 h-16 shrink-0 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 ring-1 ring-emerald-500/30">
                                <Target size={32} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-white mb-2">Conexión con Finanzas Activa</h2>
                                <p className="text-white/60 text-sm leading-relaxed max-w-xl">
                                    Las órdenes facturadas y los tratos cerrados en este módulo se reflejan automáticamente como ingresos confirmados en el módulo financiero.
                                </p>
                            </div>
                            <Link to="/finanzas" className="shrink-0 inline-flex items-center gap-2 bg-emerald-500 text-white font-bold px-8 py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                Ir a Finanzas <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ventas;

