import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRequests } from '../context/RequestContext';
import {
    BarChart3, CheckCircle, Clock, FileVideo, TrendingUp, Filter, Calendar as CalendarIcon, ChevronDown, Check, Info, AlertCircle, PlayCircle, X, ExternalLink, RotateCcw, FileQuestion, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, Sector, LineChart, Line
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';

// --- HELPERS (HOISTED FOR PERFORMANCE) ---
const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} />
            <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
        </g>
    );
};



const Dashboard = () => {
    const { requests } = useRequests();
    const { user } = useAuth();
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();

    // --- 1. ESTADOS CON PERSISTENCIA ---
    const [useDateFilter, setUseDateFilter] = useState(() => sessionStorage.getItem('dashUseDate') === 'true');
    const [startDate, setStartDate] = useState(() => sessionStorage.getItem('dashStartDate') || "");
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('dashEndDate') || "");
    const [barGrouping, setBarGrouping] = useState(() => {
        return user?.dashboardPreferences?.barGrouping || sessionStorage.getItem('dashBarGrouping') || 'day';
    });

    useEffect(() => {
        if (user?.dashboardPreferences?.barGrouping) {
            setBarGrouping(user.dashboardPreferences.barGrouping);
        }
    }, [user]);

    const [selectedPieAreas, setSelectedPieAreas] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('dashPieAreas')) || []; } catch { return []; }
    });

    useEffect(() => sessionStorage.setItem('dashUseDate', useDateFilter), [useDateFilter]);
    useEffect(() => sessionStorage.setItem('dashStartDate', startDate), [startDate]);
    useEffect(() => sessionStorage.setItem('dashEndDate', endDate), [endDate]);
    useEffect(() => sessionStorage.setItem('dashBarGrouping', barGrouping), [barGrouping]);
    useEffect(() => sessionStorage.setItem('dashPieAreas', JSON.stringify(selectedPieAreas)), [selectedPieAreas]);

    const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
    const areaMenuRef = useRef(null);
    const [drilldown, setDrilldown] = useState({ open: false, title: "", items: [] });
    // --- TENDENCIA TASA CIERRE ---
    const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
    const [trendYear, setTrendYear] = useState(currentYear);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (areaMenuRef.current && !areaMenuRef.current.contains(event.target)) setIsAreaDropdownOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizeDate = (val) => {
        if (!val) return null;
        try {
            const dateObj = val.seconds ? new Date(val.seconds * 1000) : new Date(val);
            if (isNaN(dateObj)) return null;
            return dateObj;
        } catch (e) { return null; }
    };

    const formatDateString = (dateObj) => dateObj.toISOString().split('T')[0];

    // --- DATA FILTRADA ---
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            if (req.archived) return false;
            const reqDate = normalizeDate(req.requestDate || req.createdAt);
            if (!reqDate) return false;
            const reqDateStr = formatDateString(reqDate);
            const reqYear = reqDate.getFullYear();

            if (useDateFilter) {
                if (startDate && endDate) return reqDateStr >= startDate && reqDateStr <= endDate;
                return true;
            } else {
                return reqYear === currentYear;
            }
        });
    }, [requests, useDateFilter, startDate, endDate, currentYear]);

    // --- CÁLCULO DE TARJETAS ---
    const stats = useMemo(() => {
        const total = filteredRequests.length;
        let completed = 0, revision = 0, inProcess = 0, requested = 0;

        filteredRequests.forEach(req => {
            const totalTasks = req.checklist?.length || 0;
            const completedTasks = req.checklist?.filter(t => t.completed).length || 0;
            const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
            const hasLink = !!(req.finalLink || req.link);

            if (req.status && req.status.startsWith('Completado')) {
                completed++;
            } else if (hasLink && percent === 100) {
                revision++;
            } else if (req.status === 'En Proceso' || percent > 0) {
                inProcess++;
            } else {
                requested++;
            }
        });

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, revision, inProcess, requested, completionRate };
    }, [filteredRequests]);

    // --- DATA GRÁFICOS ---
    const barChartData = useMemo(() => {
        const data = {};
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

        filteredRequests.forEach(req => {
            const date = normalizeDate(req.requestDate || req.createdAt);
            if (!date) return;
            let key, sortKey;

            if (barGrouping === 'day') {
                key = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                sortKey = date.getTime();
            } else if (barGrouping === 'year') {
                key = date.getFullYear().toString();
                sortKey = date.getFullYear();
            } else {
                key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                sortKey = date.getFullYear() * 100 + date.getMonth();
            }

            if (!data[key]) data[key] = { name: key, solicitudes: 0, sortKey, items: [] };
            data[key].solicitudes += 1;
            data[key].items.push(req);
        });

        const sortedData = Object.values(data).sort((a, b) => a.sortKey - b.sortKey);
        if (!useDateFilter && sortedData.length > 7) {
            return sortedData.slice(-7);
        }
        return sortedData;
    }, [filteredRequests, barGrouping, useDateFilter]);

    const pieChartData = useMemo(() => {
        const counts = {};
        filteredRequests.forEach(req => {
            const area = req.area || 'Sin Área';
            if (!counts[area]) counts[area] = { value: 0, items: [] };
            counts[area].value += 1;
            counts[area].items.push(req);
        });

        let result = Object.keys(counts).map(key => ({ name: key, value: counts[key].value, items: counts[key].items }));

        if (selectedPieAreas.length > 0) {
            result = result.filter(item => selectedPieAreas.includes(item.name));
        }

        result.sort((a, b) => b.value - a.value);

        if (selectedPieAreas.length === 0) {
            result = result.slice(0, 5);
        }
        return result;
    }, [filteredRequests, selectedPieAreas]);

    const availableYears = useMemo(() => {
        const years = new Set(requests.map(req => {
            const d = normalizeDate(req.requestDate || req.createdAt);
            return d ? d.getFullYear() : null;
        }).filter(Boolean));
        return Array.from(years).sort((a, b) => b - a);
    }, [requests]);

    const trendChartData = useMemo(() => {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const data = monthNames.map(name => ({ name, total: 0, completed: 0, rate: 0 }));

        requests.forEach(req => {
            const date = normalizeDate(req.requestDate || req.createdAt);
            if (!date || date.getFullYear() !== trendYear) return;

            const monthIdx = date.getMonth();
            data[monthIdx].total += 1;

            const totalTasks = req.checklist?.length || 0;
            const completedTasks = req.checklist?.filter(t => t.completed).length || 0;
            const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
            const hasLink = !!(req.finalLink || req.link);

            if (req.status && req.status.startsWith('Completado')) {
                data[monthIdx].completed += 1;
            }
        });

        return data.map(d => ({
            ...d,
            rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
        }));
    }, [requests, trendYear]);

    // --- EXPORTAR REPORTE ---
    const handleExportReport = () => {
        toast.promise(new Promise(async (resolve, reject) => {
            try {
                const doc = new jsPDF();
                const now = new Date();
                
                // 1. HEADER
                doc.setFillColor(37, 99, 235); // Azul Primario
                doc.rect(0, 0, 210, 40, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont("helvetica", "bold");
                doc.text("REPORTE DE GESTIÓN", 105, 18, { align: 'center' });
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Generado el: ${now.toLocaleString()} | Usuario: ${user?.name || 'Sistema'}`, 105, 28, { align: 'center' });

                // 2. FILTROS ACTUALES
                doc.setTextColor(0, 0, 0);
                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.text("CONFIGURACIÓN DEL REPORTE:", 14, 50);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.text(`Periodo: ${useDateFilter ? `${startDate} / ${endDate}` : `Año Actual (${currentYear})`}`, 14, 56);
                doc.text(`Agrupación Gráficos: ${barGrouping === 'day' ? 'Día' : barGrouping === 'month' ? 'Mes' : 'Año'}`, 14, 61);

                // 3. TABLA DE MÉTRICAS (KPIs)
                autoTable(doc, {
                    startY: 70,
                    theme: 'grid',
                    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
                    head: [['Métrica de Rendimiento', 'Valor Actual']],
                    body: [
                        ['Total de Solicitudes (Filtro)', stats.total],
                        ['Solicitados (Sin Iniciar)', stats.requested],
                        ['En Proceso', stats.inProcess],
                        ['En Revisión', stats.revision],
                        ['Completados', stats.completed],
                        ['Tasa de Cierre Global (%)', `${stats.completionRate}%`]
                    ],
                    styles: { fontSize: 10, cellPadding: 3 }
                });

                // 4. TABLA DE TENDENCIA (TASA DE CIERRE MENSUAL)
                // Usamos trendChartData que es el que pidió el usuario expresamente
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text(`DETALLE DE TASA DE CIERRE - AÑO ${trendYear}:`, 14, doc.lastAutoTable.finalY + 15);
                
                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 20,
                    theme: 'striped',
                    headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
                    head: [['Mes', 'Total Solicitado', 'Completados', 'Tasa de Cierre (%)']],
                    body: trendChartData.map(d => [
                        d.name,
                        d.total,
                        d.completed,
                        `${d.rate}%`
                    ]),
                    styles: { fontSize: 9, halign: 'center' },
                    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }
                });

                // 5. DISTRIBUCIÓN POR ÁREA
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text("DISTRIBUCIÓN POR ÁREA (TOP ACTIVIDAD):", 14, doc.lastAutoTable.finalY + 15);

                autoTable(doc, {
                    startY: doc.lastAutoTable.finalY + 20,
                    theme: 'grid',
                    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
                    head: [['Área', 'Número de Solicitudes', 'Participación (%)']],
                    body: pieChartData.map(d => {
                        const totalPie = pieChartData.reduce((acc, curr) => acc + curr.value, 0);
                        const percent = totalPie > 0 ? ((d.value / totalPie) * 100).toFixed(1) : 0;
                        return [d.name, d.value, `${percent}%`];
                    }),
                    styles: { fontSize: 9 }
                });

                // Footer
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150);
                    doc.text(`Mod. MkT - Gestión de Solicitudes | Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
                }

                doc.save(`Reporte_Dashboard_${now.toISOString().split('T')[0]}.pdf`);
                resolve();
            } catch (error) {
                console.error(error);
                reject(error);
            }
        }), {
            loading: 'Preparando reporte...',
            success: '¡Reporte exportado con éxito!',
            error: 'Ocurrió un error al exportar el reporte'
        });
    };

    // Handlers
    const handleBarClick = (entry) => { if (entry && entry.items) setDrilldown({ open: true, title: `Solicitudes: ${entry.name}`, items: entry.items }); };
    const handlePieClick = (data) => { if (data) setDrilldown({ open: true, title: `Área: ${data.name}`, items: data.items }); };

    const handleGroupingChange = async (newVal) => {
        setBarGrouping(newVal);
        sessionStorage.setItem('dashBarGrouping', newVal);
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { 'dashboardPreferences.barGrouping': newVal });
            } catch (e) { console.error("Error persisting pref", e); }
        }
    };
    const clearDateFilter = () => { setUseDateFilter(false); setStartDate(""); setEndDate(""); };

    const availableAreas = useMemo(() => Array.from(new Set(filteredRequests.map(r => r.area || 'Sin Área'))).sort(), [filteredRequests]);
    const PIE_COLORS = [
        '#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#0891B2',
        '#EA580C', '#65A30D', '#059669', '#4F46E5', '#BE185D'
    ];

    const MetricHeader = ({ label, tooltip }) => (
        <div className="flex items-center gap-1 mb-1 group cursor-help relative z-10">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
            <div className="relative">
                <Info size={12} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center leading-tight">{tooltip}</div>
            </div>
        </div>
    );

    const [activeAreaName, setActiveAreaName] = useState(null);
    const [animationActive, setAnimationActive] = useState(true);

    useEffect(() => {
        setAnimationActive(true);
        setActiveAreaName(null);
        const timer = setTimeout(() => setAnimationActive(false), 2000);
        return () => clearTimeout(timer);
    }, [pieChartData]);

    const onPieEnter = (data) => setActiveAreaName(data.name);
    const onPieLeave = () => setActiveAreaName(null);

    const renderCustomLabels = (props) => {
        const RADIAN = Math.PI / 180;
        const { cx, cy, midAngle, innerRadius, outerRadius, percent, value, fill } = props;
        const lineOffset = isMobile ? 15 : 30;
        const horizontalOffset = isMobile ? 10 : 22;
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        const sx = cx + (outerRadius) * cos;
        const sy = cy + (outerRadius) * sin;
        const mx = cx + (outerRadius + lineOffset) * cos;
        const my = cy + (outerRadius + lineOffset) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * horizontalOffset;
        const ey = my;
        const textAnchor = cos >= 0 ? 'start' : 'end';
        return (
            <g>
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
                <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
                <text x={ex + (cos >= 0 ? 1 : -1) * (isMobile ? 8 : 12)} y={ey} textAnchor={textAnchor} fill="#333" className={`font-bold ${isMobile ? 'text-[10px]' : 'text-xs'}`} dy={-3}>{user?.role !== 'solicitante' ? ` ${(percent * 100).toFixed(0)}%` : ''}</text>
                <text x={ex + (cos >= 0 ? 1 : -1) * (isMobile ? 8 : 12)} y={ey} textAnchor={textAnchor} fill="#999" className="text-[10px]" dy={10}>{`(${value} Sol.)`}</text>
            </g>
        );
    };

    const renderLegend = (props) => {
        const { payload } = props;
        return (
            <ul className={`pl-4 ${isMobile ? 'flex flex-wrap justify-center gap-x-4 gap-y-2 mt-8' : 'space-y-1'}`}>
                {payload.map((entry, index) => {
                    const isDimmed = activeAreaName && activeAreaName !== entry.value;
                    const isActive = activeAreaName === entry.value;
                    return (
                        <li
                            key={`item-${index}`}
                            className={`flex items-center gap-2 text-[11px] transition-opacity duration-200 cursor-pointer ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
                            onMouseEnter={() => setActiveAreaName(entry.value)}
                            onMouseLeave={() => setActiveAreaName(null)}
                        >
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className={`text-gray-600 font-medium ${isActive ? 'font-bold text-gray-900' : ''}`}>{entry.value}</span>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <div className="space-y-6 pb-10">

            {/* HEADER */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="flex items-center justify-between w-full xl:w-auto gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard General</h1>
                    <button 
                        onClick={handleExportReport}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-black transition-all active:scale-95 shadow-sm"
                    >
                        <FileDown size={18} /> Exportar Reporte
                    </button>
                </div>
                <div className={`flex flex-col sm:flex-row items-center gap-3 bg-gray-50 p-2 rounded-lg border transition-colors ${useDateFilter ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer select-none"><input type="checkbox" checked={useDateFilter} onChange={(e) => setUseDateFilter(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" /><Filter size={16} /> Filtro por Fechas</label>
                    <div className={`flex items-center gap-2 transition-all ${!useDateFilter ? 'opacity-40 pointer-events-none grayscale' : 'opacity-100'}`}>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm outline-none focus:border-blue-500 w-36 bg-white" /><span className="text-gray-400 font-bold">-</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm outline-none focus:border-blue-500 w-36 bg-white" />
                    </div>
                    {useDateFilter && <button onClick={clearDateFilter} className="ml-1 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors" title="Limpiar fechas"><X size={18} /></button>}
                </div>
            </div>

            {/* METRICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><BarChart3 size={20} /></div><MetricHeader label="Total" tooltip="Total de solicitudes visibles." /></div>
                    <h3 className="text-2xl font-bold text-gray-800">{stats.total}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><FileQuestion size={20} /></div><MetricHeader label="Solicitados" tooltip="Sin iniciar." /></div>
                    <h3 className="text-2xl font-bold text-gray-800">{stats.requested}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Clock size={20} /></div><MetricHeader label="En Proceso" tooltip="En desarrollo." /></div>
                    <h3 className="text-2xl font-bold text-gray-800">{stats.inProcess}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Eye size={20} /></div><MetricHeader label="En Revisión" tooltip="100% tareas + Link entregable." /></div>
                    <h3 className="text-2xl font-bold text-gray-800">{stats.revision}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={20} /></div><MetricHeader label="Completados" tooltip="Finalizados." /></div>
                    <h3 className="text-2xl font-bold text-gray-800">{stats.completed}</h3>
                </div>
                <div 
                    onClick={() => user?.role !== 'solicitante' && setIsTrendModalOpen(true)}
                    className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full transition-all ${user?.role !== 'solicitante' ? 'cursor-pointer hover:bg-slate-50 hover:border-purple-200' : ''}`}
                >
                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><TrendingUp size={20} /></div><MetricHeader label="Tasa Cierre" tooltip="% Completado / Total. Haz clic para ver tendencia." /></div>
                    <h3 className="text-2xl font-bold text-gray-800">{user?.role !== 'solicitante' ? `${stats.completionRate}%` : '***'}</h3>
                </div>
            </div>

            {/* GRÁFICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800">Volumen de Solicitudes</h3>
                        <select value={barGrouping} onChange={(e) => handleGroupingChange(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 font-medium focus:border-blue-500 outline-none cursor-pointer">
                            <option value="day">Por Día</option><option value="month">Por Mes</option><option value="year">Por Año</option>
                        </select>
                    </div>
                    <div className="h-64 w-full flex-1 min-h-[250px]">
                        {barChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} dy={10} interval={0} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                                    <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="solicitudes" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={30} onClick={handleBarClick} cursor="pointer">
                                        {barChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3B82F6' : '#60A5FA'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos para este periodo</div>}
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2 italic">Haz clic en una barra para ver detalles</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col relative" ref={areaMenuRef}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800">Distribución por Área</h3>
                        <div className="relative">
                            <button onClick={() => setIsAreaDropdownOpen(!isAreaDropdownOpen)} className={`flex items-center gap-2 text-xs border rounded-lg px-3 py-1.5 font-medium transition-colors ${selectedPieAreas.length > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                {selectedPieAreas.length === 0 ? "Top 5 (Default)" : `${selectedPieAreas.length} Área(s)`}<ChevronDown size={14} />
                            </button>
                            {isAreaDropdownOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95">
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {availableAreas.map(area => {
                                            const isSelected = selectedPieAreas.includes(area);
                                            return (
                                                <div key={area} onClick={() => { if (isSelected) setSelectedPieAreas(prev => prev.filter(a => a !== area)); else setSelectedPieAreas(prev => [...prev, area]); }} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs ${isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700'}`}>
                                                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{isSelected && <Check size={8} className="text-white" />}</div><span className="truncate">{area}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {selectedPieAreas.length > 0 && <div className="pt-2 mt-2 border-t border-gray-100"><button onClick={() => { setSelectedPieAreas([]); setIsAreaDropdownOpen(false); }} className="w-full text-center text-[10px] text-red-500 hover:text-red-700 font-bold">Restablecer a Top 5</button></div>}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="w-full flex-1 min-h-[250px] h-[300px] md:h-64">
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        activeIndex={pieChartData.findIndex(item => item.name === activeAreaName)}
                                        activeShape={renderActiveShape}
                                        data={pieChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="45%"
                                        outerRadius="65%"
                                        fill="#8884d8"
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                        onMouseLeave={onPieLeave}
                                        onClick={handlePieClick}
                                        paddingAngle={2}
                                        label={renderCustomLabels}
                                        labelLine={false}
                                        isAnimationActive={animationActive}
                                        animationDuration={1500}
                                        animationEasing="ease-out"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                                fillOpacity={!activeAreaName || activeAreaName === entry.name ? 1 : 0.3}
                                                stroke={activeAreaName === entry.name ? "#fff" : "none"}
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                    <Legend
                                        verticalAlign={isMobile ? "bottom" : "middle"}
                                        align={isMobile ? "center" : "right"}
                                        layout={isMobile ? "horizontal" : "vertical"}
                                        content={renderLegend}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos para este periodo</div>}
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2 italic">Haz clic en una sección para ver detalles</p>
                </div>
            </div>

            {/* DRILLDOWN MODAL */}
            {drilldown.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Filter size={18} className="text-blue-600" /> {drilldown.title}</h3>
                            <button onClick={() => setDrilldown({ ...drilldown, open: false })} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-3 flex-1">
                            {drilldown.items.length > 0 ? drilldown.items.map(req => (
                                <div key={req.id} onClick={() => navigate(`/solicitudes/${req.id}`)} className="bg-white border border-gray-100 rounded-lg p-3 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${req.type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{req.type === 'video' ? <PlayCircle size={16} /> : <FileVideo size={16} />}</div>
                                        <div><h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">{req.title}</h4><p className="text-xs text-gray-500">{normalizeDate(req.requestDate || req.createdAt)?.toLocaleDateString()} • {req.area}</p></div>
                                    </div>
                                    <ExternalLink size={16} className="text-gray-300 group-hover:text-blue-500" />
                                </div>
                            )) : <p className="text-center text-gray-400 py-4">No se encontraron detalles.</p>}
                        </div>
                        <div className="p-3 bg-gray-50 text-right border-t"><span className="text-xs font-bold text-gray-500">Total: {drilldown.items.length} registros</span></div>
                    </div>
                </div>
            )}

            {/* TREND MODAL (TASA CIERRE) */}
            {isTrendModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col h-[80vh]">
                        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><TrendingUp size={18} className="text-purple-600" /> Tendencia Mensual: Tasa de Cierre</h3>
                                <p className="text-xs text-gray-500 mt-1">Porcentaje de solicitudes completadas vs total solicitado.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                    <CalendarIcon size={14} className="text-gray-400" />
                                    <select 
                                        value={trendYear} 
                                        onChange={(e) => setTrendYear(parseInt(e.target.value))}
                                        className="text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                                    >
                                        {availableYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <button onClick={() => setIsTrendModalOpen(false)} className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 flex flex-col">
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendChartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} unit="%" domain={[0, 100]} />
                                        <RechartsTooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [`${value}%`, 'Tasa de Cierre']}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="rate" 
                                            stroke="#8B5CF6" 
                                            strokeWidth={4} 
                                            dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 8, strokeWidth: 0 }}
                                            animationDuration={1500}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mt-6">
                                {trendChartData.map((d, i) => (
                                    <div key={i} className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{d.name}</p>
                                        <p className="text-sm font-black text-purple-600">{d.rate}%</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">{d.completed}/{d.total}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* LISTA RECIENTE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileVideo size={18} className="text-gray-400" /> Solicitudes Recientes (Filtradas)</h3>
                    <button onClick={() => navigate('/solicitudes')} className="text-sm text-blue-600 hover:underline font-medium">Ver todas</button>
                </div>
                <div className="divide-y divide-gray-50">
                    {filteredRequests.length > 0 ? [...filteredRequests].sort((a, b) => new Date(b.requestDate || b.createdAt) - new Date(a.requestDate || a.createdAt)).slice(0, 5).map(req => (
                        <div key={req.id} onClick={() => navigate(`/solicitudes/${req.id}`)} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${req.type === 'video' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>{req.type === 'video' ? <PlayCircle size={16} /> : <FileVideo size={16} />}</div>
                                <div><h4 className="font-bold text-gray-800 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">{req.title}</h4><p className="text-xs text-gray-500 flex gap-2"><span className="uppercase">{req.area}</span> • <span>{normalizeDate(req.requestDate || req.createdAt)?.toLocaleDateString()}</span></p></div>
                            </div>
                            <div className="text-right"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${req.status && req.status.startsWith('Completado') ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{req.status || 'Solicitado'}</span></div>
                        </div>
                    )) : <div className="p-8 text-center text-gray-400 flex flex-col items-center"><AlertCircle size={32} className="mb-2 opacity-20" /><p className="text-sm">No hay actividad en este periodo.</p></div>}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
