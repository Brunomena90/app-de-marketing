import React, { useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Activity, ArrowRight, Building2, BarChart3, PieChart as PieChartIcon, Info, Filter, FileText, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '../../../context/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const PanelPrincipal = ({ ordenes, deals, egresos, clientesFrecuentes, movimientosAlmacen = [], ventasDirectas = [], cotizaciones = [] }) => {
    const { activeEmpresa } = useAuth();

    // State para filtros de fecha
    const [useDateFilter, setUseDateFilter] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [modalEgresosOpen, setModalEgresosOpen] = useState(false);

    // Filtrar data por fecha si aplica
    const filterByDate = (dateStr) => {
        if (!useDateFilter || (!startDate && !endDate)) return true;
        if (!dateStr) return false;
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;

        if (startDate && new Date(startDate) > d) return false;
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (end < d) return false;
        }
        return true;
    };

    const filteredOrdenes = useMemo(() => ordenes.filter(o => filterByDate(o.createdAt)), [ordenes, useDateFilter, startDate, endDate]);
    const filteredDeals = useMemo(() => deals.filter(d => filterByDate(d.updatedAt || d.createdAt)), [deals, useDateFilter, startDate, endDate]);
    const filteredEgresos = useMemo(() => egresos.filter(e => filterByDate(e.date + 'T00:00:00')), [egresos, useDateFilter, startDate, endDate]);
    const filteredMovimientos = useMemo(() => movimientosAlmacen.filter(m => filterByDate(m.createdAt?.toDate ? m.createdAt.toDate() : m.createdAt)), [movimientosAlmacen, useDateFilter, startDate, endDate]);
    const filteredVentasDirectas = useMemo(() => ventasDirectas.filter(v => filterByDate(v.createdAt?.toDate ? v.createdAt.toDate() : v.createdAt)), [ventasDirectas, useDateFilter, startDate, endDate]);
    const filteredCotizaciones = useMemo(() => cotizaciones.filter(c => filterByDate(c.updatedAt || c.createdAt)), [cotizaciones, useDateFilter, startDate, endDate]);

    // Calcular métricas
    const { totalIngresos, totalEgresos, mrr, detallesEgresos, cuentasPorCobrar, cuentasPorPagar } = useMemo(() => {
        // 1. Ingresos Operativos
        const ingresosOrdenes = filteredOrdenes.filter(o => o.status === 'Facturada' || o.status === 'Facturado').reduce((acc, curr) => acc + (curr.subtotal || curr.total || 0), 0);
        const ingresosDeals = filteredDeals.filter(d => d.stageId === 'cerrado').reduce((acc, curr) => acc + (curr.subtotal || curr.amount || 0), 0);
        const ingresosVentasDirectas = filteredVentasDirectas.reduce((acc, curr) => acc + (curr.subtotal || curr.total || 0), 0);
        
        // Excluimos las salidas de almacén que fueron generadas por ventas directas para no duplicar ingresos
        const ingresosAlmacen = filteredMovimientos.filter(m => m.tipo === 'salida' && !String(m.nota || '').startsWith('Venta Directa')).reduce((acc, curr) => acc + (Number(curr.cantidad || 0) * Number(curr.precioVentaUnitario || 0)), 0);
        
        const ingresosCotizaciones = filteredCotizaciones.filter(c => c.status === 'Facturado').reduce((acc, curr) => acc + (curr.total || 0), 0);
        
        const totalI = ingresosOrdenes + ingresosDeals + ingresosVentasDirectas + ingresosAlmacen + ingresosCotizaciones;
        
        // 2. Costo de Ventas (COGS)
        // Costo de los productos físicos vendidos (salidas de almacén)
        const cogsAlmacen = filteredMovimientos.filter(m => m.tipo === 'salida').reduce((acc, curr) => acc + (Number(curr.cantidad || 0) * Number(curr.costoUnitario || 0)), 0);
        // Costo de los servicios vendidos (no generan salidas de almacén)
        const cogsServicios = filteredVentasDirectas.reduce((acc, curr) => {
            return acc + (curr.items || []).reduce((itemAcc, item) => {
                if (item.esServicio) return itemAcc + (Number(item.precioCosto || 0) * Number(item.cantidad || 0));
                return itemAcc;
            }, 0);
        }, 0);
        
        const totalCostoVentas = cogsAlmacen + cogsServicios;
        
        // 3. Gastos Operativos (Sólo Pagados)
        const gastosOperativos = filteredEgresos.filter(e => !e.status || e.status === 'Pagado').reduce((acc, curr) => acc + (curr.amount || 0), 0);
        
        // Total Egresos (Estado de Resultados) = Costo de Ventas + Gastos Operativos
        const totalE = gastosOperativos + totalCostoVentas;

        const recurringRevenue = clientesFrecuentes.reduce((acc, curr) => acc + (curr.amount || 0), 0);

        // 4. Cuentas por Cobrar (Pendientes de cobro)
        const cobrarCotizaciones = filteredCotizaciones.filter(c => c.status === 'Por facturar' || c.status === 'Aprobada').reduce((acc, curr) => acc + (curr.total || 0), 0);
        const cobrarOrdenes = filteredOrdenes.filter(o => o.status === 'Entregada').reduce((acc, curr) => acc + (curr.total || 0), 0);
        const cuentasPorCobrar = cobrarCotizaciones + cobrarOrdenes;

        // 5. Cuentas por Pagar (Egresos pendientes)
        const cuentasPorPagar = filteredEgresos.filter(e => e.status === 'Pendiente').reduce((acc, curr) => acc + (curr.amount || 0), 0);

        const detallesEgresos = {
            gastosOperativos,
            cogsAlmacen,
            cogsServicios,
            desgloseOperativo: filteredEgresos.filter(e => !e.status || e.status === 'Pagado').reduce((acc, e) => {
                const cat = e.category || 'Otros';
                acc[cat] = (acc[cat] || 0) + (e.amount || 0);
                return acc;
            }, {})
        };

        return { 
            totalIngresos: totalI, 
            totalEgresos: totalE, 
            mrr: recurringRevenue,
            detallesEgresos,
            cuentasPorCobrar,
            cuentasPorPagar
        };
    }, [filteredOrdenes, filteredDeals, filteredEgresos, clientesFrecuentes, filteredMovimientos, filteredVentasDirectas, filteredCotizaciones]);

    const beneficioNeto = totalIngresos - totalEgresos;
    const margen = totalIngresos > 0 ? Math.round((beneficioNeto / totalIngresos) * 100) : 0;

    // Gráfico de flujo de caja
    const cashFlowData = useMemo(() => {
        const months = {};
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            months[key] = { name: monthNames[d.getMonth()], ingresos: 0, egresos: 0 };
        }

        filteredOrdenes.filter(o => o.status === 'Facturada').forEach(o => {
            const d = new Date(o.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) months[key].ingresos += (o.total || 0);
        });
        filteredDeals.filter(d => d.stageId === 'cerrado').forEach(d => {
            const dateStr = d.updatedAt || d.createdAt;
            if(!dateStr) return;
            const dObj = new Date(dateStr);
            const key = `${dObj.getFullYear()}-${dObj.getMonth()}`;
            if (months[key]) months[key].ingresos += (d.amount || 0);
        });
        filteredEgresos.forEach(e => {
            if(!e.date) return;
            const d = new Date(e.date + 'T00:00:00');
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) months[key].egresos += (e.amount || 0);
        });

        // Add Almacen movements to Cash Flow
        filteredMovimientos.forEach(m => {
            if(!m.createdAt) return;
            const d = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (months[key]) {
                if (m.tipo === 'salida') {
                    months[key].ingresos += (Number(m.cantidad || 0) * Number(m.precioVentaUnitario || 0));
                } else if (m.tipo === 'entrada') {
                    months[key].egresos += (Number(m.cantidad || 0) * Number(m.costoUnitario || 0));
                }
            }
        });

        return Object.values(months);
    }, [filteredOrdenes, filteredDeals, filteredEgresos, filteredMovimientos]);

    const categoryData = useMemo(() => {
        const categories = {};
        
        filteredEgresos.forEach(e => {
            const cat = e.category || 'Otros Egresos';
            categories[cat] = (categories[cat] || 0) + (e.amount || 0);
        });
        
        filteredMovimientos.filter(m => m.tipo === 'entrada').forEach(m => {
            const cat = 'Compras Almacén';
            categories[cat] = (categories[cat] || 0) + (Number(m.cantidad || 0) * Number(m.costoUnitario || 0));
        });

        // Ingresos
        filteredOrdenes.filter(o => o.status === 'Facturada').forEach(o => {
            const cat = 'Ventas Facturadas';
            categories[cat] = (categories[cat] || 0) + (o.total || 0);
        });
        filteredDeals.filter(d => d.stageId === 'cerrado').forEach(d => {
            const cat = 'Proyectos Cerrados';
            categories[cat] = (categories[cat] || 0) + (d.amount || 0);
        });
        filteredMovimientos.filter(m => m.tipo === 'salida').forEach(m => {
            const cat = 'Salidas Almacén (Ventas)';
            categories[cat] = (categories[cat] || 0) + (Number(m.cantidad || 0) * Number(m.precioVentaUnitario || 0));
        });

        return Object.entries(categories).map(([name, value]) => ({ name, value })).filter(c => c.value > 0);
    }, [filteredEgresos, filteredMovimientos, filteredOrdenes, filteredDeals]);

    const COLORS = ['#649a4a', '#F43F5E', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#14B8A6'];

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text(`Reporte Financiero - ${activeEmpresa || 'Todas las Empresas'}`, 14, 15);
        if (useDateFilter && (startDate || endDate)) {
            doc.setFontSize(10);
            doc.text(`Filtro: ${startDate || 'Inicio'} a ${endDate || 'Fin'}`, 14, 22);
        }
        
        // Tabla Resumen
        doc.autoTable({
            startY: 30,
            head: [['Concepto', 'Monto (S/.)']],
            body: [
                ['Ingresos Totales', totalIngresos.toFixed(2)],
                ['Egresos Totales', totalEgresos.toFixed(2)],
                ['Beneficio Neto', beneficioNeto.toFixed(2)],
                ['MRR Proyectado', mrr.toFixed(2)],
            ],
            theme: 'grid',
            headStyles: { fillColor: [100, 154, 74] }
        });

        // Tabla Categorías
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 10,
            head: [['Categoría', 'Monto (S/.)']],
            body: categoryData.map(c => [c.name, c.value.toFixed(2)]),
            theme: 'grid',
            headStyles: { fillColor: [100, 154, 74] }
        });

        doc.save(`Reporte_Financiero_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportExcel = () => {
        const dataResumen = [
            { Concepto: 'Ingresos Totales', Monto: totalIngresos },
            { Concepto: 'Egresos Totales', Monto: totalEgresos },
            { Concepto: 'Beneficio Neto', Monto: beneficioNeto },
            { Concepto: 'MRR Proyectado', Monto: mrr },
        ];
        
        const dataCategorias = categoryData.map(c => ({ Categoría: c.name, Monto: c.value }));

        const wb = XLSX.utils.book_new();
        const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
        const wsCategorias = XLSX.utils.json_to_sheet(dataCategorias);

        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
        XLSX.utils.book_append_sheet(wb, wsCategorias, 'Categorías');

        XLSX.writeFile(wb, `Reporte_Financiero_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-10">
            {/* Header & Controles */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-[#4a7238]/20 rounded-xl">
                            <Wallet className="text-[#649a4a]" size={32} />
                        </div>
                        Dashboard Financiero
                    </h1>
                    <p className="text-gray-400 mt-2 max-w-xl flex items-center gap-2">
                        Visión general del estado económico y flujo de caja
                        {activeEmpresa && activeEmpresa !== 'Todas' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#4a7238]/20 text-[#85cc63] border border-[#649a4a]/30">
                                <Building2 size={11} /> {activeEmpresa}
                            </span>
                        )}
                    </p>
                </div>

                {/* Filtros y Exportaciones */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 bg-[#111520] border border-white/10 rounded-xl p-2">
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pl-1 pr-2">
                            <input type="checkbox" checked={useDateFilter} onChange={(e) => setUseDateFilter(e.target.checked)} className="rounded border-gray-600 bg-gray-800 text-[#649a4a] focus:ring-[#649a4a]" />
                            <Filter size={14}/> Filtro
                        </label>
                        {useDateFilter && (
                            <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#171b26] border border-white/5 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-[#649a4a]/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                                <span className="text-gray-500">-</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[#171b26] border border-white/5 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-[#649a4a]/50 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg transition-colors text-sm font-bold">
                            <FileText size={16} /> PDF
                        </button>
                        <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-lg transition-colors text-sm font-bold">
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-[#111520] rounded-2xl p-6 border border-white/5 shadow-xl flex flex-col relative overflow-hidden group hover:border-[#649a4a]/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-[#4a7238]/10 flex items-center justify-center text-[#649a4a] border border-[#649a4a]/20">
                            <TrendingUp size={24} />
                        </div>
                        <div className="relative group cursor-pointer p-1">
                            <Info size={16} className="text-gray-500 hover:text-white transition-colors" />
                            <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-xs text-gray-300">
                                <strong>Cálculo:</strong> Suma de Órdenes Facturadas + Deals Cerrados (Ventas) + Ventas Directas POS + Valor de Salidas de Stock + Cotizaciones Facturadas.
                            </div>
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-1">S/. {totalIngresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-bold text-gray-400">Ingresos Totales</p>
                    <p className="text-xs text-gray-500 mt-1">Facturado + Deals + POS + Almacén + Cotizaciones</p>
                </div>

                <div onClick={() => setModalEgresosOpen(true)} className="bg-[#111520] rounded-2xl p-6 border border-white/5 shadow-xl flex flex-col relative overflow-hidden group cursor-pointer hover:border-rose-500/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                            <TrendingDown size={24} />
                        </div>
                        <div className="relative group cursor-pointer p-1">
                            <Info size={16} className="text-gray-500 hover:text-white transition-colors" />
                            <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-xs text-gray-300">
                                <strong>Cálculo:</strong> Suma de Gastos Operativos (Pagos realizados) + Costo de Ventas (COGS de productos y servicios).
                            </div>
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-1">S/. {totalEgresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-bold text-gray-400">Egresos Totales</p>
                    <p className="text-xs text-gray-500 mt-1">Gastos Operativos + Costo de Ventas</p>
                </div>

                <div className="bg-[#111520] rounded-2xl p-6 border border-white/5 shadow-xl flex flex-col relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <Activity size={24} />
                        </div>
                        <div className="relative group cursor-pointer p-1">
                            <Info size={16} className="text-gray-500 hover:text-white transition-colors" />
                            <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-xs text-gray-300">
                                <strong>Cálculo:</strong> Ingresos Totales menos Egresos Totales. Representa la rentabilidad general.
                            </div>
                        </div>
                    </div>
                    <h3 className={`text-3xl font-black mb-1 ${beneficioNeto >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                        S/. {beneficioNeto.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </h3>
                    <p className="text-sm font-bold text-gray-400">Beneficio Neto</p>
                    <p className="text-xs text-gray-500 mt-1">Margen operativo: {margen}%</p>
                </div>

                <div className="bg-gradient-to-br from-[#1a2517] to-[#111520] rounded-2xl p-6 border border-[#649a4a]/30 shadow-xl flex flex-col relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#4a7238]/20 rounded-full blur-3xl" />
                    <div className="flex justify-between items-start mb-4 relative">
                        <div className="w-12 h-12 rounded-full bg-[#4a7238]/20 border border-[#649a4a]/30 flex items-center justify-center text-[#85cc63]">
                            <DollarSign size={24} />
                        </div>
                        <div className="relative group cursor-pointer p-1">
                            <Info size={16} className="text-[#649a4a] hover:text-white transition-colors" />
                            <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 border border-[#649a4a]/30 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-xs text-gray-300">
                                <strong>Cálculo:</strong> Suma de montos de Clientes Frecuentes (activos). Proyección mensual.
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <h3 className="text-3xl font-black text-white mb-1">S/. {mrr.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                        <p className="text-sm font-bold text-[#85cc63]">MRR Proyectado</p>
                        <p className="text-xs text-gray-500 mt-1">Ingresos recurrentes</p>
                    </div>
                </div>

                <Link to="/finanzas/cuentas-cobrar" className="bg-[#111520] rounded-2xl p-6 border border-white/5 shadow-xl flex flex-col relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <Activity size={24} />
                        </div>
                        <div className="relative group cursor-pointer p-1">
                            <Info size={16} className="text-gray-500 hover:text-white transition-colors" />
                            <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-xs text-gray-300">
                                <strong>Cálculo:</strong> Suma de Cotizaciones "Por Facturar" o "Aprobadas" y Órdenes de Compra "Entregadas".
                            </div>
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-1">S/. {cuentasPorCobrar.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-bold text-gray-400">Cuentas por Cobrar</p>
                    <p className="text-xs text-gray-500 mt-1">Dinero pendiente de cobro</p>
                </Link>

                <Link to="/finanzas/egresos" className="bg-[#111520] rounded-2xl p-6 border border-white/5 shadow-xl flex flex-col relative overflow-hidden group hover:border-orange-500/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                            <Wallet size={24} />
                        </div>
                        <div className="relative group cursor-pointer p-1">
                            <Info size={16} className="text-gray-500 hover:text-white transition-colors" />
                            <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 text-xs text-gray-300">
                                <strong>Cálculo:</strong> Suma de Egresos en estado "Pendiente".
                            </div>
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-white mb-1">S/. {cuentasPorPagar.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                    <p className="text-sm font-bold text-gray-400">Cuentas por Pagar</p>
                    <p className="text-xs text-gray-500 mt-1">Facturas y deudas pendientes</p>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cash Flow Chart */}
                <div className="bg-[#111520] rounded-2xl shadow-xl border border-white/5 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <BarChart3 size={18} className="text-[#649a4a]" /> Flujo de Caja (Últimos 6 meses)
                        </h3>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <RechartsTooltip 
                                    cursor={{ fill: 'rgba(30, 41, 59, 0.5)' }} 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                    formatter={(value) => [`S/. ${value.toLocaleString()}`, '']}
                                />
                                <Bar dataKey="ingresos" name="Ingresos" fill="#649a4a" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="egresos" name="Egresos" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart Categorías */}
                <div className="bg-[#111520] rounded-2xl shadow-xl border border-white/5 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <PieChartIcon size={18} className="text-[#649a4a]" /> Gráfica de Categorías
                        </h3>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                                    formatter={(value) => [`S/. ${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`, '']}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Accesos Rápidos */}
                <div className="bg-[#111520] rounded-2xl shadow-xl border border-white/5 p-6 flex flex-col lg:col-span-2">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                        <PieChartIcon size={18} className="text-[#649a4a]" /> Accesos Rápidos
                    </h3>
                    <div className="space-y-4 flex-1">
                        <Link to="/finanzas/cuentas-cobrar" className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#171b26] hover:bg-[#4a7238]/10 hover:border-[#649a4a]/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#4a7238]/20 text-[#649a4a] rounded-lg group-hover:bg-[#4a7238]/30 transition-colors">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">Cuentas por Cobrar</p>
                                    <p className="text-xs text-gray-400">Facturación e ingresos</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-slate-500 group-hover:text-[#649a4a] transition-colors group-hover:translate-x-1" />
                        </Link>
                        
                        <Link to="/finanzas/egresos" className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#171b26] hover:bg-rose-900/20 hover:border-rose-500/30 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg group-hover:bg-rose-500/20 transition-colors">
                                    <TrendingDown size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-white text-sm">Cuentas por Pagar</p>
                                    <p className="text-xs text-gray-400">Registro de gastos</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-slate-500 group-hover:text-rose-500 transition-colors group-hover:translate-x-1" />
                        </Link>

                        <div className="p-4 rounded-xl border border-[#649a4a]/20 bg-[#4a7238]/10 mt-auto text-sm text-[#85cc63] flex gap-3">
                            <DollarSign size={18} className="flex-shrink-0 text-[#649a4a]" />
                            <p>El módulo de finanzas está <strong>conectado directamente</strong> con Ventas y <strong>Almacenes</strong>.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Detalle de Egresos */}
            {modalEgresosOpen && (
                <div onClick={() => setModalEgresosOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 rounded-3xl shadow-2xl bg-gray-900 border border-white/10 relative max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <div className="p-2 bg-rose-500/20 text-rose-500 rounded-lg">
                                    <TrendingDown size={20} />
                                </div>
                                Detalle de Egresos
                            </h3>
                            <button onClick={() => setModalEgresosOpen(false)} className="text-gray-500 hover:text-white font-bold px-3 py-1 bg-gray-800 rounded-lg">X</button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="bg-[#171b26] p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                    Costo de Ventas (COGS)
                                    <span className="text-white ml-auto">S/ {((detallesEgresos?.cogsAlmacen || 0) + (detallesEgresos?.cogsServicios || 0)).toFixed(2)}</span>
                                </h4>
                                <div className="space-y-2 text-sm pl-4 border-l border-white/10">
                                    <div className="flex justify-between text-gray-300">
                                        <span>Productos físicos (Almacén)</span>
                                        <span className="font-medium">S/ {detallesEgresos?.cogsAlmacen?.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span>Servicios vendidos</span>
                                        <span className="font-medium">S/ {detallesEgresos?.cogsServicios?.toFixed(2) || '0.00'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#171b26] p-4 rounded-xl border border-white/5">
                                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                                    Gastos Operativos
                                    <span className="text-white ml-auto">S/ {detallesEgresos?.gastosOperativos?.toFixed(2) || '0.00'}</span>
                                </h4>
                                <div className="space-y-2 text-sm pl-4 border-l border-white/10">
                                    {Object.entries(detallesEgresos?.desgloseOperativo || {}).map(([cat, val]) => (
                                        <div key={cat} className="flex justify-between text-gray-300">
                                            <span>{cat}</span>
                                            <span className="font-medium">S/ {val?.toFixed(2) || '0.00'}</span>
                                        </div>
                                    ))}
                                    {Object.keys(detallesEgresos?.desgloseOperativo || {}).length === 0 && (
                                        <div className="text-gray-500 italic">No hay gastos registrados</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-lg font-black text-rose-500">
                            <span>TOTAL EGRESOS</span>
                            <span>S/ {totalEgresos.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PanelPrincipal;
