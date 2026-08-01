import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Clock, Calculator, Plus, Trash2, Save, Play, Pause, RotateCcw, Target, ShieldAlert, Timer, Activity, ArrowLeft, GitMerge, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import InfoTooltip from '../../components/InfoTooltip';
import RatingCalculatorModal from './components/RatingCalculatorModal';
import AllowanceCalculatorModal from './components/AllowanceCalculatorModal';

const EstudioTiempos = () => {
    const { id, fase, taskId } = useParams();
    const navigate = useNavigate();
    
    // Estados para Modo Selector (Standalone)
    const [allProcesos, setAllProcesos] = useState([]);
    const [selectedProceso, setSelectedProceso] = useState(null);
    const [allVersions, setAllVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);

    const [procesoSnapshot, setProcesoSnapshot] = useState(null);
    const [tareaName, setTareaName] = useState('');
    const emptyMuestra = { active: 0, wait: 0, total: 0 };
    const [muestras, setMuestras] = useState([emptyMuestra, emptyMuestra, emptyMuestra, emptyMuestra, emptyMuestra]);
    const [valoracion, setValoracion] = useState(100);
    
    // Suplementos
    const [supPersonales, setSupPersonales] = useState(5);
    const [supFatiga, setSupFatiga] = useState(4);
    const [supDemoras, setSupDemoras] = useState(2);

    // Modals
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [showAllowanceModal, setShowAllowanceModal] = useState(false);

    // Cronómetro
    const [timerState, setTimerState] = useState('stopped'); // 'stopped', 'active', 'waiting'
    const [activeTime, setActiveTime] = useState(0);
    const [waitTime, setWaitTime] = useState(0);
    const timerRef = useRef(null);

    // Cargar Lista de Procesos si NO hay ID en URL (Modo Standalone)
    useEffect(() => {
        if (!id) {
            const fetchAllProcesos = async () => {
                try {
                    const snap = await getDocs(collection(db, 'procesos'));
                    const pList = snap.docs.map(d => ({id: d.id, ...d.data()}));
                    setAllProcesos(pList);
                } catch(e) {
                    console.error("Error cargando procesos:", e);
                }
            };
            fetchAllProcesos();
        }
    }, [id]);

    // Cargar versiones si se selecciona un proceso en Standalone
    useEffect(() => {
        if (!id && selectedProceso) {
            const fetchVersiones = async () => {
                try {
                    const snap = await getDocs(collection(db, 'procesos', selectedProceso.id, 'versiones'));
                    const vList = snap.docs.map(d => ({id: d.id, ...d.data()}));
                    vList.sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
                    setAllVersions(vList);
                    // Por defecto pre-seleccionar la actual
                    setSelectedVersion(selectedProceso);
                } catch(e) {
                    console.error("Error cargando versiones:", e);
                }
            };
            fetchVersiones();
        }
    }, [selectedProceso, id]);

    // Cargar Proceso si viene de URL (Modo Integrado)
    useEffect(() => {
        if (id && fase && taskId) {
            const fetchProceso = async () => {
                try {
                    const docRef = doc(db, 'procesos', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setProcesoSnapshot(data);
                        const tasksArray = data[fase] || [];
                        const taskObj = tasksArray.find(t => t.id === taskId);
                        if (taskObj) {
                            setTareaName(taskObj.task);
                        } else {
                            toast.error("Tarea no encontrada en el proceso.");
                        }
                    } else {
                        toast.error("Proceso no encontrado.");
                    }
                } catch (error) {
                    console.error(error);
                    toast.error("Error al cargar el proceso.");
                }
            };
            fetchProceso();
        }
    }, [id, fase, taskId]);

    const handleStartActive = () => {
        if (timerState === 'active') return;
        clearInterval(timerRef.current);
        const startTime = Date.now() - activeTime;
        timerRef.current = setInterval(() => {
            setActiveTime(Date.now() - startTime);
        }, 10);
        setTimerState('active');
    };

    const handleStartWait = () => {
        if (timerState === 'waiting' || timerState === 'stopped') return;
        clearInterval(timerRef.current);
        const startTime = Date.now() - waitTime;
        timerRef.current = setInterval(() => {
            setWaitTime(Date.now() - startTime);
        }, 10);
        setTimerState('waiting');
    };

    const handleStop = () => {
        clearInterval(timerRef.current);
        setTimerState('stopped');
    };

    const handleReset = () => {
        clearInterval(timerRef.current);
        setTimerState('stopped');
        setActiveTime(0);
        setWaitTime(0);
    };

    const handleSaveSample = () => {
        const activeVal = parseFloat((activeTime / 1000).toFixed(4));
        const waitVal = parseFloat((waitTime / 1000).toFixed(4));
        const totalVal = activeVal + waitVal;
        
        const newMuestra = { active: activeVal, wait: waitVal, total: totalVal };

        const emptyIndex = muestras.findIndex(m => m.total === 0);
        if (emptyIndex !== -1) {
            const newMuestras = [...muestras];
            newMuestras[emptyIndex] = newMuestra;
            setMuestras(newMuestras);
        } else {
            setMuestras([...muestras, newMuestra]);
        }
        handleReset();
    };

    const formatStopwatch = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor((ms % 1000) / 10);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    };

    const formatReadableTime = (value) => {
        if (!value || isNaN(value) || value === 0) return `0 segundos`;
        let totalSeconds = value;

        if (totalSeconds < 60) {
            return `${totalSeconds.toFixed(2).replace(/\.00$/, '')} segundos`;
        }

        const d = Math.floor(totalSeconds / 86400);
        const h = Math.floor((totalSeconds % 86400) / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        const parts = [];
        if (d > 0) parts.push(`${d} ${d === 1 ? 'día' : 'días'}`);
        if (h > 0) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
        if (m > 0) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
        if (s > 0) {
            const sStr = s.toFixed(2).replace(/\.00$/, '');
            parts.push(`${sStr} ${sStr === '1' ? 'segundo' : 'segundos'}`);
        }

        return parts.join(' ');
    };

    useEffect(() => {
        return () => clearInterval(timerRef.current);
    }, []);

    const handleMuestraChange = (index, field, value) => {
        const newMuestras = [...muestras];
        const numValue = parseFloat(value) || 0;
        newMuestras[index] = { ...newMuestras[index], [field]: numValue };
        if (field === 'active' || field === 'wait') {
            newMuestras[index].total = (parseFloat(newMuestras[index].active) || 0) + (parseFloat(newMuestras[index].wait) || 0);
        }
        setMuestras(newMuestras);
    };

    const addMuestra = () => setMuestras([...muestras, emptyMuestra]);
    const removeMuestra = (index) => setMuestras(muestras.filter((_, i) => i !== index));

    // Cálculos
    const muestrasValidas = muestras.filter(m => m.total > 0);
    const totalSuplementos = supPersonales + supFatiga + supDemoras;

    const calcularMetricas = (campo) => {
        const suma = muestrasValidas.reduce((a, b) => a + (parseFloat(b[campo]) || 0), 0);
        const tom = muestrasValidas.length > 0 ? suma / muestrasValidas.length : 0;
        const tn = tom * (valoracion / 100);
        const te = tn * (1 + totalSuplementos / 100);
        return { tom, tn, te };
    };

    const metricasActivo = calcularMetricas('active');
    const metricasEspera = calcularMetricas('wait');
    const metricasTotal = calcularMetricas('total');

    const handleSaveToProcess = async () => {
        if (!id || !fase || !taskId || !procesoSnapshot) return;
        
        try {
            // 1. Update the task in the process
            const tasksArray = procesoSnapshot[fase] || [];
            const taskIndex = tasksArray.findIndex(t => t.id === taskId);
            
            if (taskIndex === -1) {
                toast.error("No se pudo encontrar la tarea en el proceso actual.");
                return;
            }
            
            // Set active and wait times to the calculated standard times
            tasksArray[taskIndex].time = metricasActivo.te;
            tasksArray[taskIndex].waitTime = metricasEspera.te;
            
            const docRef = doc(db, 'procesos', id);
            await updateDoc(docRef, {
                [fase]: tasksArray
            });
            
            // 2. Save a historical record in a subcollection
            const estudiosRef = collection(docRef, 'estudiosTiempos');
            await addDoc(estudiosRef, {
                taskId,
                fase,
                tareaName,
                muestras,
                valoracion,
                suplementos: {
                    personales: supPersonales,
                    fatiga: supFatiga,
                    demoras: supDemoras
                },
                metricasActivo,
                metricasEspera,
                metricasTotal,
                createdAt: serverTimestamp()
            });
            
            toast.success("Estudio de tiempos guardado y proceso actualizado.");
            navigate(`/procesos/${id}`);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar el análisis en el proceso.");
        }
    };

    if (!id) {
        return (
            <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#050505] relative overflow-hidden transition-colors">
                <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
                <header className="relative z-10 shrink-0 px-8 py-6 border-b border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Clock size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Estudio de Tiempos</h1>
                            <p className="text-xs text-amber-600 font-bold uppercase tracking-widest mt-1">
                                Seleccionar Proceso para Análisis
                            </p>
                        </div>
                    </div>
                </header>
                
                <div className="flex-1 overflow-y-auto p-8 relative z-10">
                    <div className="max-w-4xl mx-auto space-y-6">
                        
                        {/* 1. Seleccionar Proceso */}
                        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">1. Elige el Proceso</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {allProcesos.map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => setSelectedProceso(p)}
                                        className={`flex flex-col text-left p-4 rounded-xl border transition-all ${selectedProceso?.id === p.id ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-500/30'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <GitMerge size={16} className={selectedProceso?.id === p.id ? 'text-amber-500' : 'text-gray-400'} />
                                            <span className="font-bold text-gray-900 dark:text-white truncate">{p.name || 'Sin nombre'}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">Versión Actual: {p.version || '1.0'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 2. Seleccionar Versión (solo si hay proceso) */}
                        {selectedProceso && (
                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">2. Elige la Versión a analizar</h2>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setSelectedVersion(selectedProceso)}
                                        className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all ${selectedVersion?.id === selectedProceso.id ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                    >
                                        Versión Actual ({selectedProceso.version || '1.0'})
                                    </button>
                                    {allVersions.map(v => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVersion(v)}
                                            className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all ${selectedVersion?.id === v.id ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-700 dark:text-orange-400' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                        >
                                            Histórico ({v.version})
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. Seleccionar Tarea */}
                        {selectedVersion && (
                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">3. Elige la Tarea a Cronometrar</h2>
                                
                                <div className="space-y-6">
                                    {/* AS-IS */}
                                    <div>
                                        <h3 className="text-xs font-bold text-cyan-600 uppercase tracking-widest mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Fase AS-IS (Actual)</h3>
                                        {(!selectedVersion.asIsTasks || selectedVersion.asIsTasks.length === 0) ? (
                                            <p className="text-sm text-gray-500 italic">No hay tareas AS-IS definidas.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {selectedVersion.asIsTasks.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => navigate(`/procesos/${selectedProceso.id}/estudio-tiempos/asIsTasks/${t.id}`)}
                                                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-cyan-300 dark:hover:border-cyan-500/30 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 transition-all text-left group"
                                                    >
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate mr-2">{t.task}</span>
                                                        <Timer size={16} className="text-cyan-500 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* TO-BE */}
                                    <div className="pt-4 border-t border-gray-100 dark:border-white/10">
                                        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Fase TO-BE (Propuesto)</h3>
                                        {(!selectedVersion.toBeTasks || selectedVersion.toBeTasks.length === 0) ? (
                                            <p className="text-sm text-gray-500 italic">No hay tareas TO-BE definidas.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {selectedVersion.toBeTasks.map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => navigate(`/procesos/${selectedProceso.id}/estudio-tiempos/toBeTasks/${t.id}`)}
                                                        className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all text-left group"
                                                    >
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate mr-2">{t.task}</span>
                                                        <Timer size={16} className="text-emerald-500 opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#050505] relative overflow-hidden transition-colors">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

            <header className="relative z-10 shrink-0 px-8 py-6 border-b border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {id && (
                        <button onClick={() => navigate(`/procesos/${id}`)} className="p-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-gray-600 dark:text-gray-300 transition-colors mr-2">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Clock size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Estudio de Tiempos</h1>
                        <p className="text-xs text-amber-600 font-bold uppercase tracking-widest mt-1">
                            Análisis OIT (Cronometría Industrial)
                        </p>
                    </div>
                </div>
                {id && (
                    <button onClick={handleSaveToProcess} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 w-full sm:w-auto">
                        <Save size={18} />
                        Guardar en Proceso
                    </button>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-8 relative z-10">
                <div className="max-w-5xl mx-auto space-y-6">
                    
                    {/* Información General */}
                    <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-white/10 pb-2">
                            1. Información de la Tarea
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Nombre de la Tarea/Operación
                                </label>
                                <input
                                    type="text"
                                    value={tareaName}
                                    onChange={e => setTareaName(e.target.value)}
                                    placeholder="Ej. Ensamblaje de pieza A"
                                    disabled={!!id}
                                    className={`w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors ${id ? 'opacity-70 cursor-not-allowed' : ''}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Toma de Muestras */}
                    <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 mb-4 border-b border-gray-200 dark:border-white/10 pb-4 sm:pb-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center flex-wrap gap-2">
                                2. Captura de Tiempos (Muestras) 
                                <InfoTooltip text="Ingresa los tiempos tomados con cronómetro para cada ciclo de la tarea. (En segundos o minutos decimales, pero usa una misma unidad)." />
                            </h3>
                            <button onClick={addMuestra} className="text-xs w-full sm:w-auto justify-center bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold transition-colors">
                                <Plus size={14}/> Añadir Muestra
                            </button>
                        </div>

                        {/* Cronómetro UI */}
                        <div className="flex flex-col xl:flex-row items-center gap-6 mb-6 p-4 sm:p-5 bg-gray-50 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/5">
                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-center sm:text-left">
                                <div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 relative overflow-hidden shadow-sm flex flex-col justify-center">
                                    {timerState === 'active' && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse" />}
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-1">
                                        <Play size={12} className={timerState === 'active' ? "text-emerald-500" : ""} /> Proceso Activo
                                    </h4>
                                    <div className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${timerState === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
                                        {formatStopwatch(activeTime)}
                                    </div>
                                </div>
                                <div className="p-4 bg-white dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 relative overflow-hidden shadow-sm flex flex-col justify-center">
                                    {timerState === 'waiting' && <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse" />}
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-1">
                                        <Timer size={12} className={timerState === 'waiting' ? "text-amber-500" : ""} /> Tiempo de Espera
                                    </h4>
                                    <div className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${timerState === 'waiting' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                                        {formatStopwatch(waitTime)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 w-full xl:w-auto">
                                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={handleStartActive}
                                        className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-3.5 rounded-xl font-bold transition-all shadow-lg ${
                                            timerState === 'active' 
                                                ? 'bg-emerald-500/10 text-emerald-500 shadow-none border border-emerald-500/20' 
                                                : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20 hover:scale-105 border border-transparent'
                                        }`}
                                    >
                                        <Play size={18} fill="currentColor" /> Iniciar
                                    </button>
                                    <button
                                        onClick={handleStartWait}
                                        className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-3.5 rounded-xl font-bold transition-all shadow-lg ${
                                            timerState === 'waiting' 
                                                ? 'bg-amber-500/10 text-amber-500 shadow-none border border-amber-500/20' 
                                                : 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20 hover:scale-105 border border-transparent'
                                        }`}
                                    >
                                        <Pause size={18} fill="currentColor" /> Espera
                                    </button>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={handleStop}
                                        disabled={timerState === 'stopped'}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition-all disabled:opacity-30 border border-transparent"
                                    >
                                        Detener
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={activeTime === 0 && waitTime === 0}
                                        className="flex items-center justify-center px-4 sm:px-3.5 py-3.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors disabled:opacity-30"
                                        title="Reiniciar cronómetro"
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                    <button
                                        onClick={handleSaveSample}
                                        disabled={timerState !== 'stopped' || (activeTime === 0 && waitTime === 0)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-3.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-bold transition-all shadow-lg disabled:opacity-30 border border-transparent"
                                    >
                                        <Save size={18} /> Guardar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {muestras.map((m, idx) => (
                                <div key={idx} className="relative group bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                                            Muestra {idx + 1}
                                        </label>
                                        {muestras.length > 1 && (
                                            <button 
                                                onClick={() => removeMuestra(idx)} 
                                                className="bg-red-100 dark:bg-red-500/20 text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div>
                                            <span className="block text-[9px] text-gray-500 uppercase font-bold mb-1 truncate" title="Activo (segundos)">Activo (s)</span>
                                            <input
                                                type="number"
                                                value={m?.active || ''}
                                                onChange={e => handleMuestraChange(idx, 'active', e.target.value)}
                                                placeholder="0.0"
                                                className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <span className="block text-[9px] text-gray-500 uppercase font-bold mb-1 truncate" title="Espera (segundos)">Espera (s)</span>
                                            <input
                                                type="number"
                                                value={m?.wait || ''}
                                                onChange={e => handleMuestraChange(idx, 'wait', e.target.value)}
                                                placeholder="0.0"
                                                className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-gray-600 dark:text-gray-400 uppercase">Total:</span>
                                        <span className="text-sm font-bold text-amber-600 dark:text-amber-500">{(m?.total || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Valoración */}
                        <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-white/10 pb-2">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    3. Valoración del Ritmo
                                    <InfoTooltip text="Sistema Westinghouse o Escala 100. 100% es el ritmo normal (operador capacitado trabajando sin esfuerzo excesivo ni lentitud)." />
                                </h3>
                                <button onClick={() => setShowRatingModal(true)} className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors uppercase tracking-widest">
                                    <Target size={12}/> Asistente
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                                        Factor de Valoración (%)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="50"
                                            max="150"
                                            value={valoracion}
                                            onChange={e => setValoracion(Number(e.target.value))}
                                            className="flex-1 accent-amber-500"
                                        />
                                        <input
                                            type="number"
                                            value={valoracion}
                                            onChange={e => setValoracion(Number(e.target.value))}
                                            className="w-20 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-center text-gray-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                                        />
                                        <span className="text-sm text-gray-500 font-bold">%</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50/50 dark:bg-amber-500/10 rounded-xl border border-amber-200/50 dark:border-amber-500/20">
                                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium text-center">
                                        TN (Total) = {metricasTotal.tom.toFixed(2)} × ({valoracion}/100) = <strong className="text-sm">{metricasTotal.tn.toFixed(2)} u.t.</strong>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Suplementos */}
                        <div className="bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-white/10 pb-2">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    4. Suplementos (Tolerancias)
                                    <InfoTooltip text="Márgenes añadidos al tiempo normal para compensar la fatiga, necesidades personales y retrasos inevitables." />
                                </h3>
                                <button onClick={() => setShowAllowanceModal(true)} className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors uppercase tracking-widest">
                                    <ShieldAlert size={12}/> Asistente OIT
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Necesidades Personales (%)</label>
                                    <input type="number" value={supPersonales} onChange={e => setSupPersonales(Number(e.target.value))} className="w-16 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-sm" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Fatiga Básica (%)</label>
                                    <input type="number" value={supFatiga} onChange={e => setSupFatiga(Number(e.target.value))} className="w-16 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-sm" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Demoras Especiales (%)</label>
                                    <input type="number" value={supDemoras} onChange={e => setSupDemoras(Number(e.target.value))} className="w-16 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-sm" />
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase">Total Suplementos</span>
                                    <span className="text-sm font-black text-gray-900 dark:text-white">{totalSuplementos}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resultado Final (Desglose) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        {/* Sin Esperas */}
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                            <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                                <Activity size={100} />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-sm font-bold opacity-90 uppercase tracking-widest mb-1">Sin Esperas</h2>
                                <p className="text-[10px] opacity-80 mb-4 h-6">Solo tiempo de proceso activo</p>
                                
                                <div className="space-y-1 mb-4 font-mono">
                                    <div className="flex justify-between text-xs opacity-90"><span>TOM:</span> <span>{metricasActivo.tom.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-xs opacity-90"><span>TN:</span> <span>{metricasActivo.tn.toFixed(2)}</span></div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-center flex flex-col justify-center items-center">
                                    <span className="block text-[9px] font-bold uppercase tracking-widest opacity-80 mb-2">Tiempo Estándar</span>
                                    <span className="text-xl sm:text-2xl font-black leading-tight text-balance">{formatReadableTime(metricasActivo.te)}</span>
                                    <span className="text-[9px] font-mono opacity-70 mt-1">Decimal: {metricasActivo.te.toFixed(2)} segundos</span>
                                </div>
                            </div>
                        </div>

                        {/* Solo Esperas */}
                        <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
                            <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                                <Timer size={100} />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-sm font-bold opacity-90 uppercase tracking-widest mb-1">Solo Esperas</h2>
                                <p className="text-[10px] opacity-80 mb-4 h-6">Tiempos muertos o cuellos de botella</p>
                                
                                <div className="space-y-1 mb-4 font-mono">
                                    <div className="flex justify-between text-xs opacity-90"><span>TOM:</span> <span>{metricasEspera.tom.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-xs opacity-90"><span>TN:</span> <span>{metricasEspera.tn.toFixed(2)}</span></div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-center flex flex-col justify-center items-center">
                                    <span className="block text-[9px] font-bold uppercase tracking-widest opacity-80 mb-2">Tiempo Estándar</span>
                                    <span className="text-xl sm:text-2xl font-black leading-tight text-balance">{formatReadableTime(metricasEspera.te)}</span>
                                    <span className="text-[9px] font-mono opacity-70 mt-1">Decimal: {metricasEspera.te.toFixed(2)} segundos</span>
                                </div>
                            </div>
                        </div>

                        {/* Total */}
                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden ring-4 ring-amber-500/20">
                            <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                                <Calculator size={100} />
                            </div>
                            <div className="relative z-10">
                                <h2 className="text-sm font-bold opacity-90 uppercase tracking-widest mb-1">Tiempo Total</h2>
                                <p className="text-[10px] opacity-80 mb-4 h-6">Sumando Activo + Esperas</p>
                                
                                <div className="space-y-1 mb-4 font-mono">
                                    <div className="flex justify-between text-xs opacity-90"><span>TOM:</span> <span>{metricasTotal.tom.toFixed(2)}</span></div>
                                    <div className="flex justify-between text-xs opacity-90"><span>TN:</span> <span>{metricasTotal.tn.toFixed(2)}</span></div>
                                </div>
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 text-center flex flex-col justify-center items-center">
                                    <span className="block text-[9px] font-bold uppercase tracking-widest opacity-80 mb-2">Tiempo Estándar</span>
                                    <span className="text-xl sm:text-2xl font-black leading-tight text-balance">{formatReadableTime(metricasTotal.te)}</span>
                                    <span className="text-[9px] font-mono opacity-70 mt-1">Decimal: {metricasTotal.te.toFixed(2)} segundos</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <RatingCalculatorModal 
                isOpen={showRatingModal} 
                onClose={() => setShowRatingModal(false)}
                currentValoracion={valoracion}
                onSave={(newVal) => {
                    setValoracion(newVal);
                    setShowRatingModal(false);
                }}
            />

            <AllowanceCalculatorModal
                isOpen={showAllowanceModal}
                onClose={() => setShowAllowanceModal(false)}
                onSave={(personales, fatiga, especiales) => {
                    setSupPersonales(personales);
                    setSupFatiga(fatiga);
                    setSupDemoras(especiales);
                    setShowAllowanceModal(false);
                }}
            />
        </div>
    );
};

export default EstudioTiempos;
