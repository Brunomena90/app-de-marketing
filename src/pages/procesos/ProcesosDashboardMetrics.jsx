import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { BarChart as RechartsBarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart, Activity, TrendingUp, GitMerge, Clock, CheckCircle } from 'lucide-react';
import InfoTooltip from '../../components/InfoTooltip';

const ProcesosDashboardMetrics = () => {
    const { activeEmpresa } = useAuth();
    const [procesos, setProcesos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProcesoId, setSelectedProcesoId] = useState('all');

    useEffect(() => {
        if (!activeEmpresa) return;

        let q;
        if (activeEmpresa === 'Todas') {
            q = query(collection(db, 'procesos'), orderBy('updatedAt', 'desc'));
        } else {
            q = query(
                collection(db, 'procesos'),
                where('empresa', '==', activeEmpresa),
                orderBy('updatedAt', 'desc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const procesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProcesos(procesData);
            setLoading(false);
        }, (error) => {
            console.error("Error cargando procesos:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeEmpresa]);

    // Métricas Generales
    const totalProcesos = procesos.length;
    
    // Un proceso se considera "analizado" (TO-BE) si tiene al menos una tarea TO-BE
    const procesosAnalizados = procesos.filter(p => p.toBeTasks && p.toBeTasks.length > 0).length;
    const efectividadTasa = totalProcesos > 0 ? (procesosAnalizados / totalProcesos) * 100 : 0;

    // Calcular suma de tiempos AS-IS y TO-BE totales
    const totalTimeAsIs = procesos.reduce((acc, p) => {
        const t = (p.asIsTasks || []).reduce((sum, task) => sum + (Number(task.time) || 0) + (Number(task.waitTime) || 0), 0);
        return acc + t;
    }, 0);

    const totalTimeToBe = procesos.reduce((acc, p) => {
        const t = (p.toBeTasks || []).reduce((sum, task) => sum + (Number(task.time) || 0) + (Number(task.waitTime) || 0), 0);
        return acc + t;
    }, 0);

    const porcentajeMejoraGlobal = totalTimeAsIs > 0 ? ((totalTimeAsIs - totalTimeToBe) / totalTimeAsIs) * 100 : 0;

    // Datos para gráficos de Evolución (simulado por versiones si un proceso es seleccionado, o global si es "all")
    let evolutionData = [];
    if (selectedProcesoId === 'all') {
        // Agrupar los últimos procesos creados para ver el impacto
        evolutionData = procesos.slice(0, 5).reverse().map(p => {
            const asIs = (p.asIsTasks || []).reduce((sum, t) => sum + (Number(t.time) || 0), 0) / 60; // a minutos
            const toBe = (p.toBeTasks || []).reduce((sum, t) => sum + (Number(t.time) || 0), 0) / 60;
            return {
                name: p.name.length > 10 ? p.name.substring(0, 10) + '...' : p.name,
                AsIs: asIs.toFixed(2),
                ToBe: toBe.toFixed(2)
            };
        });
    } else {
        // Mostrar datos de un solo proceso seleccionado
        const p = procesos.find(p => p.id === selectedProcesoId);
        if (p) {
            const asIsTime = (p.asIsTasks || []).reduce((sum, t) => sum + (Number(t.time) || 0), 0) / 60;
            const toBeTime = (p.toBeTasks || []).reduce((sum, t) => sum + (Number(t.time) || 0), 0) / 60;
            evolutionData = [
                { name: `v1.0 (AS-IS)`, LeadTime: asIsTime.toFixed(2) },
                { name: `v2.0 (TO-BE)`, LeadTime: toBeTime.toFixed(2) }
            ];
        }
    }

    // Datos para gráfico de distribución
    const tipoData = [
        { name: 'Valor Añadido (VA)', value: 0 },
        { name: 'No VA - Necesario', value: 0 },
        { name: 'No VA (Desperdicio)', value: 0 }
    ];

    procesos.forEach(p => {
        const arr = (selectedProcesoId === 'all' || selectedProcesoId === p.id) ? (p.asIsTasks || []) : [];
        arr.forEach(t => {
            if (t.type === 'VA') tipoData[0].value++;
            else if (t.type === 'NVAN') tipoData[1].value++;
            else if (t.type === 'NVA') tipoData[2].value++;
        });
    });

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#050505] relative overflow-hidden transition-colors">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

            <header className="relative z-10 shrink-0 px-8 py-6 border-b border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <BarChart size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Dashboard Analítico</h1>
                        <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest mt-1">
                            Métricas de Eficiencia y Tiempos
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-500 uppercase">Analizar Proceso:</label>
                    <select 
                        value={selectedProcesoId}
                        onChange={e => setSelectedProcesoId(e.target.value)}
                        className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    >
                        <option value="all">Global (Todos)</option>
                        {procesos.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 relative z-10">
                {loading ? (
                    <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>
                ) : (
                    <div className="max-w-7xl mx-auto space-y-6">
                        
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500"><GitMerge size={20} /></div>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">Procesos Base</h3>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black text-gray-900 dark:text-white">{totalProcesos}</span>
                                </div>
                            </div>
                            
                            <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm relative group">
                                <div className="absolute top-4 right-4"><InfoTooltip text="Porcentaje de procesos que ya cuentan con un análisis TO-BE (mejora propuesta)." /></div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><CheckCircle size={20} /></div>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">Efectividad de Análisis</h3>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black text-emerald-600">{efectividadTasa.toFixed(1)}%</span>
                                    <span className="text-xs font-bold text-emerald-600 mb-1">({procesosAnalizados} Optimizados)</span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm relative group">
                                <div className="absolute top-4 right-4"><InfoTooltip text="Reducción porcentual de tiempos totales (AS-IS vs TO-BE) a nivel global o del proceso seleccionado." /></div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><TrendingUp size={20} /></div>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">Tasa de Mejora</h3>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black text-blue-600">{porcentajeMejoraGlobal.toFixed(1)}%</span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm relative group">
                                <div className="absolute top-4 right-4"><InfoTooltip text="Tiempo total invertido sumando todas las tareas del proceso (AS-IS) en horas." /></div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><Clock size={20} /></div>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400">Total AS-IS (Horas)</h3>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-black text-orange-600">{(totalTimeAsIs / 3600).toFixed(1)}h</span>
                                </div>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Evolución (Lead Time en Min)
                                        <InfoTooltip text={selectedProcesoId === 'all' ? "Comparativa de tiempo total (minutos) entre AS-IS y TO-BE de los últimos procesos." : "Evolución de tiempos al aplicar el TO-BE en el proceso seleccionado."} />
                                    </h3>
                                </div>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {selectedProcesoId === 'all' ? (
                                            <RechartsBarChart data={evolutionData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                                                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                                                <YAxis stroke="#6b7280" fontSize={10} />
                                                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px' }} />
                                                <Legend />
                                                <Bar dataKey="AsIs" fill="#f97316" radius={[4, 4, 0, 0]} name="AS-IS (Actual)" />
                                                <Bar dataKey="ToBe" fill="#10b981" radius={[4, 4, 0, 0]} name="TO-BE (Propuesto)" />
                                            </RechartsBarChart>
                                        ) : (
                                            <LineChart data={evolutionData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                                                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                                                <YAxis stroke="#6b7280" fontSize={10} />
                                                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px' }} />
                                                <Legend />
                                                <Line type="monotone" dataKey="LeadTime" stroke="#6366f1" strokeWidth={3} dot={{ r: 6 }} name="Tiempo Total" />
                                            </LineChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                        Distribución de Tareas AS-IS
                                        <InfoTooltip text="Muestra cuántas tareas aportan valor y cuántas son desperdicio (NVA). Ayuda a identificar cuellos de botella." />
                                    </h3>
                                </div>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsBarChart data={tipoData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                                            <XAxis type="number" stroke="#6b7280" fontSize={10} />
                                            <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} width={120} />
                                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '12px' }} />
                                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Cantidad de Tareas" />
                                        </RechartsBarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProcesosDashboardMetrics;
