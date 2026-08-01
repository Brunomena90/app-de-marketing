import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp, collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
    ArrowLeft, GitMerge, Save, Trash2, 
    AlignLeft, Clock, CheckCircle2, ChevronRight,
    TableProperties, Activity, Target, ShieldAlert,
    Plus, X, BarChart2, Info, Download, Timer
} from 'lucide-react';
import { generateProcessPDF } from '../../services/processPdfService';
import InfoTooltip from '../../components/InfoTooltip';

const emptyProceso = {
    name: '', description: '',
    supplier: '', input: '', trigger: '', output: '', customer: '',
    processOwner: '', scope: '', status: 'Diseñado', version: '1.0',
    asIsFlow: '', asIsCycleTime: '', asIsLeadTime: '', asIsFrequencyPeriod: 'Mensual', asIsFrequencyVolume: '',
    asIsPains: [], asIsTools: '', asIsCost: '', asIsTasks: [],
    asIsStepsCount: '', asIsManualIntervention: '', asIsSla: '',
    toBeFlow: '', toBeGapMatrix: '', toBeKpis: [], toBeEnablers: '', toBeTasks: [],
    toBeCycleTime: '', toBeLeadTime: '', toBeTools: '', toBeFrequencyPeriod: 'Mensual', toBeFrequencyVolume: '',
    toBeStepsCount: '', toBeManualIntervention: '', toBeSla: '',
    roadmap: [], riskManagement: ''
};

const ProcesoDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isSuperUser } = useAuth();
    
    const [proceso, setProceso] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('sipoc');
    const [showGlossary, setShowGlossary] = useState(false);
    
    const [editData, setEditData] = useState(emptyProceso);
    const [versions, setVersions] = useState([]);
    const [selectedVersionId, setSelectedVersionId] = useState('current');
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [showVersionMenu, setShowVersionMenu] = useState(false);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [estudiosTiempos, setEstudiosTiempos] = useState([]);
    const [showEstudiosModal, setShowEstudiosModal] = useState(false);

    useEffect(() => {
        const fetchVersionsAndEstudios = async () => {
            try {
                const snap = await getDocs(collection(db, 'procesos', id, 'versiones'));
                const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
                data.sort((a, b) => parseFloat(b.version) - parseFloat(a.version));
                setVersions(data);
                
                // Fetch estudios de tiempos
                const estudiosSnap = await getDocs(collection(db, 'procesos', id, 'estudiosTiempos'));
                const estudiosData = estudiosSnap.docs.map(d => ({id: d.id, ...d.data()}));
                estudiosData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                setEstudiosTiempos(estudiosData);
            } catch(e) {
                console.error(e);
            }
        };
        fetchVersionsAndEstudios();
    }, [id, fetchTrigger]);

    useEffect(() => {
        const docRef = doc(db, 'procesos', id);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProceso({ id: docSnap.id, ...data });
                setEditData(prev => {
                    // Only populate if name is empty (first load)
                    if (prev.name === '') {
                        return { ...emptyProceso, ...data };
                    }
                    return prev;
                });
            } else {
                toast.error("Proceso no encontrado");
                navigate('/procesos');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [id, navigate]);

    useEffect(() => {
        if (proceso && editData.name === '') {
            setEditData({ ...emptyProceso, ...proceso });
        }
    }, [proceso, editData.name]);

    const isFirstRender = useRef(true);

    // Auto-save effect
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (editData.name === '' || isReadOnly) return; // Still loading or in read-only mode

        const saveTimer = setTimeout(async () => {
            try {
                await updateDoc(doc(db, 'procesos', id), {
                    ...editData,
                    updatedAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error auto-saving:", error);
            }
        }, 1500);

        return () => clearTimeout(saveTimer);
    }, [editData, id, isReadOnly]);

    const handleCreateVersion = async () => {
        try {
            // Guardar versión actual en historial
            await addDoc(collection(db, 'procesos', id, 'versiones'), {
                ...editData,
                savedAt: serverTimestamp()
            });

            const currentVersion = parseFloat(editData.version || '1.0');
            const nextVersion = (currentVersion + 1.0).toFixed(1);

            const clearedData = {
                ...emptyProceso,
                name: editData.name,
                processOwner: editData.processOwner,
                scope: editData.scope,
                empresa: editData.empresa,
                version: nextVersion,
                status: 'Diseñado'
            };

            setEditData(clearedData);
            setFetchTrigger(prev => prev + 1);
            setSelectedVersionId('current');
            setIsReadOnly(false);
            
            toast.success(`Versión ${nextVersion} creada. Los campos se han reiniciado.`);
        } catch (error) {
            console.error("Error creating version:", error);
            toast.error("Error al crear la versión");
        }
    };

    const updateField = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    // Helpers para listas dinámicas
    const addListItem = (field, defaultItem) => {
        const newList = [...(editData[field] || []), { id: Date.now().toString(), ...defaultItem }];
        updateField(field, newList);
    };
    
    const updateListItem = (field, id, key, value) => {
        const newList = (editData[field] || []).map(item => item.id === id ? { ...item, [key]: value } : item);
        updateField(field, newList);
    };

    const removeListItem = (field, id) => {
        const newList = (editData[field] || []).filter(item => item.id !== id);
        updateField(field, newList);
    };

    const handleTimeChange = (listName, id, currentTotalSeconds, timeField, unit, value) => {
        const val = parseInt(value) || 0;
        const currentHr = Math.floor((currentTotalSeconds || 0) / 3600);
        const currentMin = Math.floor(((currentTotalSeconds || 0) % 3600) / 60);
        const currentSec = (currentTotalSeconds || 0) % 60;
        
        let newTotal = 0;
        if (unit === 'hr') newTotal = (val * 3600) + (currentMin * 60) + currentSec;
        else if (unit === 'min') newTotal = (currentHr * 3600) + (val * 60) + currentSec;
        else if (unit === 'sec') newTotal = (currentHr * 3600) + (currentMin * 60) + val;
        
        updateListItem(listName, id, timeField, newTotal === 0 ? '' : newTotal);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-600"></div>
            </div>
        );
    }

    if (!proceso) return null;

    const TabButton = ({ id, label, icon: Icon, colorClass }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                activeTab === id 
                    ? `border-${colorClass}-600 text-${colorClass}-600` 
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
            <div className="flex items-center gap-2"><Icon size={16}/> {label}</div>
        </button>
    );

    const inputClass = "w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all";
    const labelClass = "flex items-center text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5";



    const totalAsIsTime = (editData.asIsTasks || []).reduce((acc, curr) => acc + (Number(curr.time) || 0), 0);
    const totalAsIsWaitTime = (editData.asIsTasks || []).reduce((acc, curr) => acc + (Number(curr.waitTime) || 0), 0);
    const totalToBeTime = (editData.toBeTasks || []).reduce((acc, curr) => acc + (Number(curr.time) || 0), 0);
    const totalToBeWaitTime = (editData.toBeTasks || []).reduce((acc, curr) => acc + (Number(curr.waitTime) || 0), 0);

    const formatTime = (seconds) => {
        if (!seconds) return '0 s';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        let res = [];
        if (h > 0) res.push(`${h}h`);
        if (m > 0) res.push(`${m}m`);
        if (s > 0 || (h === 0 && m === 0)) res.push(`${s}s`);
        return res.join(' ');
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#050505] relative overflow-hidden transition-colors">
            {/* Header */}
            <header className="relative z-50 shrink-0 border-b border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md">
                <div className="px-8 py-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-3">
                    <button onClick={() => navigate('/procesos')} className="p-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-600 dark:text-gray-400 transition-colors">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-widest gap-2">
                        <span>Procesos</span> <ChevronRight size={14} />
                        <span className="text-cyan-600 truncate max-w-[200px]">{proceso.name}</span>
                    </div>
                </div>

                <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                            <GitMerge size={28} className="text-white" />
                        </div>
                        <div className="flex-1">
                            <input
                                type="text" value={editData.name} onChange={(e) => updateField('name', e.target.value)}
                                className="text-3xl font-black text-gray-900 dark:text-white tracking-tight bg-transparent border-none outline-none w-full focus:ring-0 p-0 mb-1"
                                placeholder="Nombre del proceso"
                            />
                            <div className="flex items-center gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {proceso.empresa && <span className="bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md">{proceso.empresa}</span>}
                                <span className="flex items-center gap-1.5">
                                    <Clock size={14} />
                                    Actualizado: {proceso.updatedAt?.toDate ? new Date(proceso.updatedAt.toDate()).toLocaleDateString() : 'Reciente'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => setShowEstudiosModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-xl border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 font-bold transition-colors text-sm shadow-sm"
                            title="Ver historial de estudios de tiempos"
                        >
                            <Timer size={16} />
                            Historial Tiempos
                        </button>
                        <div className="relative">
                            <button 
                                onClick={() => setShowVersionMenu(!showVersionMenu)}
                                className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm transition-all"
                            >
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Versión</span>
                                <span className="text-sm font-black text-gray-900 dark:text-white">
                                    {selectedVersionId === 'current' ? (proceso?.version || '1.0') : (versions.find(v => v.id === selectedVersionId)?.version)}
                                </span>
                            </button>
                            
                            {showVersionMenu && (
                                <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                    <div className="p-3 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                                        <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Historial de Versiones</h4>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto p-2">
                                        <button
                                            onClick={() => {
                                                setSelectedVersionId('current');
                                                setIsReadOnly(false);
                                                setEditData({ ...emptyProceso, ...proceso });
                                                setShowVersionMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors flex items-center justify-between ${selectedVersionId === 'current' ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                        >
                                            <span>Versión {proceso?.version || '1.0'}</span>
                                            <span className="text-[10px] uppercase opacity-70">Actual</span>
                                        </button>
                                        
                                        {versions.map(v => (
                                            <button
                                                key={v.id}
                                                onClick={() => {
                                                    setSelectedVersionId(v.id);
                                                    setIsReadOnly(true);
                                                    setEditData({ ...emptyProceso, ...v });
                                                    setShowVersionMenu(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 mt-1 rounded-xl text-sm transition-colors flex items-center justify-between ${selectedVersionId === v.id ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                            >
                                                <span>Versión {v.version}</span>
                                                <span className="text-[10px] uppercase opacity-70">Histórico</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={() => {
                                toast.promise(
                                    new Promise((resolve, reject) => {
                                        setTimeout(() => {
                                            try {
                                                generateProcessPDF(editData);
                                                resolve();
                                            } catch (error) {
                                                console.error("PDF generation failed:", error);
                                                reject(error);
                                            }
                                        }, 500);
                                    }),
                                    {
                                        loading: 'Generando documento PDF...',
                                        success: '¡PDF generado con éxito!',
                                        error: 'Error al generar PDF'
                                    }
                                );
                            }}
                            title="Exportar a PDF" 
                            className="p-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl text-gray-600 dark:text-gray-400 transition-colors border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-center"
                        >
                            <Download size={18} />
                        </button>
                        <button onClick={handleCreateVersion} className="flex items-center gap-1.5 px-4 py-2 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 rounded-xl font-bold transition-all text-xs border border-cyan-200 dark:border-cyan-500/20 shadow-sm">
                            <Plus size={14} /> Crear Versión
                        </button>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="px-8 flex gap-6 border-b border-gray-200 dark:border-white/10 overflow-x-auto scrollbar-hide">
                    <TabButton id="sipoc" label="Ficha SIPOC" icon={TableProperties} colorClass="cyan" />
                    <TabButton id="asIs" label="AS-IS (Actual)" icon={Activity} colorClass="orange" />
                    <TabButton id="toBe" label="TO-BE (Futuro)" icon={Target} colorClass="emerald" />
                    <TabButton id="roadmap" label="Transición" icon={ShieldAlert} colorClass="purple" />
                    <TabButton id="comparison" label="Comparación" icon={BarChart2} colorClass="blue" />
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 relative z-10 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
                {isReadOnly && (
                    <div className="flex justify-center mb-4 pointer-events-none">
                        <span className="text-xs font-bold text-orange-500 dark:text-orange-400 flex items-center gap-1.5 opacity-80">
                            <ShieldAlert size={14} /> Estás viendo una versión histórica (Solo Lectura)
                        </span>
                    </div>
                )}
                <div className={`max-w-6xl mx-auto space-y-6 relative transition-all duration-300 ${isReadOnly ? 'pointer-events-none opacity-60 grayscale-[15%]' : ''}`}>
                    
                    {/* SIPOC TAB */}
                    {activeTab === 'sipoc' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">1. Datos Generales</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelClass}>Descripción / Propósito <InfoTooltip text="Describe brevemente de qué trata este proceso y su objetivo principal."/></label>
                                        <textarea value={editData.description} onChange={e => updateField('description', e.target.value)} className={`${inputClass} min-h-[80px]`} placeholder="Propósito del proceso..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Dueño del Proceso (Process Owner) <InfoTooltip text="Persona o rol responsable del rendimiento y mejora continua de este proceso."/></label>
                                        <input type="text" value={editData.processOwner} onChange={e => updateField('processOwner', e.target.value)} className={inputClass} placeholder="Ej: Gerente de Finanzas" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Alcance (Scope) <InfoTooltip text="Indica dónde inicia (primer evento) y dónde termina (último evento) el proceso."/></label>
                                        <input type="text" value={editData.scope} onChange={e => updateField('scope', e.target.value)} className={inputClass} placeholder="Inicia en X y termina en Y" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Estado del Proceso <InfoTooltip text="El estado actual de diseño, revisión o implementación."/></label>
                                        <select value={editData.status} onChange={e => updateField('status', e.target.value)} className={inputClass}>
                                            <option value="Diseñado">Diseñado</option>
                                            <option value="En Revisión">En Revisión</option>
                                            <option value="Aprobado">Aprobado</option>
                                            <option value="En Implementación">En Implementación</option>
                                            <option value="Deprecado">Deprecado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Versión <InfoTooltip text="Número de versión para llevar un control de los cambios a lo largo del tiempo."/></label>
                                        <input type="text" value={editData.version} onChange={e => updateField('version', e.target.value)} className={inputClass} placeholder="Ej: v1.0 As-Is" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">2. Ficha SIPOC</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Supplier (Proveedor) <InfoTooltip text="Persona, departamento o sistema externo que provee los insumos para el proceso."/></label>
                                        <textarea value={editData.supplier} onChange={e => updateField('supplier', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Quién entrega insumos..." />
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Input (Entrada) <InfoTooltip text="Materiales, documentos o información necesarios para que el proceso inicie."/></label>
                                        <textarea value={editData.input} onChange={e => updateField('input', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Datos, documentos..." />
                                    </div>
                                    <div className="bg-cyan-50 dark:bg-cyan-500/10 p-4 rounded-xl border border-cyan-100 dark:border-cyan-500/20 shadow-inner">
                                        <label className="flex items-center text-xs font-bold text-cyan-700 dark:text-cyan-400 mb-2">Trigger (Disparador) <InfoTooltip text="El evento específico o condición que detona o da inicio al proceso."/></label>
                                        <textarea value={editData.trigger} onChange={e => updateField('trigger', e.target.value)} className={`${inputClass} text-xs min-h-[100px] bg-white dark:bg-black/40`} placeholder="Evento que inicia el flujo..." />
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Output (Salida) <InfoTooltip text="El resultado, producto, documento o servicio generado por el proceso."/></label>
                                        <textarea value={editData.output} onChange={e => updateField('output', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Entregables tangibles..." />
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="flex items-center text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Customer (Cliente) <InfoTooltip text="El destinatario interno o externo que recibe y utiliza el Output del proceso."/></label>
                                        <textarea value={editData.customer} onChange={e => updateField('customer', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Quién recibe el resultado..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AS-IS TAB */}
                    {activeTab === 'asIs' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <div className="bg-orange-50/50 dark:bg-[#15100a] border border-orange-200 dark:border-orange-500/20 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-4 border-b border-orange-200/50 dark:border-orange-500/20 pb-2">1. Diagnóstico Actual (Flujo y Herramientas)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelClass}>Flujograma / Pasos del Estado Actual <InfoTooltip text="Describe paso a paso cómo se ejecuta el proceso hoy en día, sin mejoras."/></label>
                                        <textarea value={editData.asIsFlow} onChange={e => updateField('asIsFlow', e.target.value)} className={`${inputClass} min-h-[150px]`} placeholder="Lista estructurada de pasos con roles asignados..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Sistemas y Herramientas Utilizadas <InfoTooltip text="Lista los sistemas (Ej: Excel, SAP, CRM, Correo) usados actualmente."/></label>
                                        <input type="text" value={editData.asIsTools} onChange={e => updateField('asIsTools', e.target.value)} className={inputClass} placeholder="Excel, ERP, correo..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Costo Directo Aproximado <InfoTooltip text="Estima el costo en horas/hombre, licencias o recursos físicos involucrados."/></label>
                                        <input type="text" value={editData.asIsCost} onChange={e => updateField('asIsCost', e.target.value)} className={inputClass} placeholder="Horas hombre o costo operativo..." />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-orange-50/50 dark:bg-[#15100a] border border-orange-200 dark:border-orange-500/20 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-4 border-b border-orange-200/50 dark:border-orange-500/20 pb-2">2. Tiempos y Frecuencia</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>Tiempo de Ejecución (Cycle Time) <InfoTooltip text="El tiempo real de trabajo activo para completar el proceso (sin contar esperas)."/></label>
                                        <input type="text" value={formatTime(totalAsIsTime)} readOnly className={`${inputClass} bg-gray-100 dark:bg-white/5 font-bold cursor-not-allowed`} title="Calculado automáticamente desde las tareas" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tiempo de Espera Total (Lead Time) <InfoTooltip text="El tiempo total desde que se solicita hasta que se entrega (incluyendo cuellos de botella)."/></label>
                                        <input type="text" value={formatTime(totalAsIsTime + totalAsIsWaitTime)} readOnly className={`${inputClass} bg-gray-100 dark:bg-white/5 font-bold cursor-not-allowed`} title="Calculado automáticamente (Cycle Time + Tiempos de Espera)" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Frecuencia / Volumen <InfoTooltip text="Cuántas veces se ejecuta el proceso en un periodo determinado (ej: 50/mes)."/></label>
                                        <div className="flex gap-2">
                                            <select value={editData.asIsFrequencyPeriod || 'Mensual'} onChange={e => updateField('asIsFrequencyPeriod', e.target.value)} className={`${inputClass} w-1/2 px-2`}>
                                                <option value="Por hora">Por hora</option>
                                                <option value="Diario">Diario</option>
                                                <option value="Semanal">Semanal</option>
                                                <option value="Mensual">Mensual</option>
                                                <option value="Anual">Anual</option>
                                            </select>
                                            <input type="number" value={editData.asIsFrequencyVolume || ''} onChange={e => updateField('asIsFrequencyVolume', e.target.value)} className={`${inputClass} w-1/2`} placeholder="Volumen (Ej: 50)" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                {/* Pains */}
                                <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">3. Puntos de Dolor (Pains)</h3>
                                        <button onClick={() => addListItem('asIsPains', { desc: '', severity: 'Medio' })} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
                                            <Plus size={14}/> Añadir
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {editData.asIsPains?.map(pain => (
                                            <div key={pain.id} className="flex flex-col sm:flex-row gap-2 items-center">
                                                <div className="flex-1 min-w-0">
                                                    <input type="text" value={pain.desc} onChange={e => updateListItem('asIsPains', pain.id, 'desc', e.target.value)} className={`${inputClass}`} placeholder="Descripción del problema..." />
                                                </div>
                                                <div className="flex-shrink-0 w-full sm:w-auto flex gap-2 items-center">
                                                    <select value={pain.severity} onChange={e => updateListItem('asIsPains', pain.id, 'severity', e.target.value)} className={`${inputClass.replace('w-full', '')} w-28 text-xs p-0 px-2`}>
                                                        <option value="Alto">Alto</option>
                                                        <option value="Medio">Medio</option>
                                                        <option value="Bajo">Bajo</option>
                                                    </select>
                                                    <button onClick={() => removeListItem('asIsPains', pain.id)} className="w-[42px] h-[42px] flex items-center justify-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
                                                        <X size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {(!editData.asIsPains || editData.asIsPains.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">No hay dolores registrados.</p>}
                                    </div>
                                </div>

                                {/* VA / NVA */}
                                <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">4. Tareas y Tiempos</h3>
                                            <button onClick={() => setShowGlossary(true)} className="text-[10px] bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded border border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors flex items-center gap-1 font-bold uppercase tracking-widest">
                                                <Info size={12}/> Glosario Lean
                                            </button>
                                        </div>
                                        <button onClick={() => addListItem('asIsTasks', { task: '', type: 'VA', time: '', waitTime: '' })} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
                                            <Plus size={14}/> Añadir
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {editData.asIsTasks?.map(t => (
                                            <div key={t.id} className="flex flex-col gap-3 p-4 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl relative group transition-all">
                                                <div className="flex flex-col xl:flex-row gap-2 items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <input 
                                                            type="text" 
                                                            value={t.task} 
                                                            onChange={e => updateListItem('asIsTasks', t.id, 'task', e.target.value)} 
                                                            className={`${inputClass} font-bold text-base`} 
                                                            placeholder="Título de la tarea..." 
                                                        />
                                                    </div>
                                                    <div className="flex-shrink-0 w-full xl:w-auto flex gap-2 items-center">
                                                        <div className="flex flex-col gap-1 items-end">
                                                            <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase mr-1">Activo</span>
                                                                <input type="number" value={Math.floor((t.time || 0) / 3600) || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.time, 'time', 'hr', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Horas" />
                                                                <span className="text-[10px] text-gray-500 font-bold">h</span>
                                                                <input type="number" value={Math.floor(((t.time || 0) % 3600) / 60) || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.time, 'time', 'min', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Minutos" />
                                                                <span className="text-[10px] text-gray-500 font-bold">m</span>
                                                                <input type="number" value={(t.time || 0) % 60 || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.time, 'time', 'sec', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Segundos" />
                                                                <span className="text-[10px] text-gray-500 font-bold">s</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-orange-500 transition-all">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase mr-1">Espera</span>
                                                                <input type="number" value={Math.floor((t.waitTime || 0) / 3600) || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.waitTime, 'waitTime', 'hr', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Horas" />
                                                                <span className="text-[10px] text-gray-500 font-bold">h</span>
                                                                <input type="number" value={Math.floor(((t.waitTime || 0) % 3600) / 60) || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.waitTime, 'waitTime', 'min', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Minutos" />
                                                                <span className="text-[10px] text-gray-500 font-bold">m</span>
                                                                <input type="number" value={(t.waitTime || 0) % 60 || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.waitTime, 'waitTime', 'sec', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Segundos" />
                                                                <span className="text-[10px] text-gray-500 font-bold">s</span>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => navigate(`/procesos/${id}/estudio-tiempos/asIsTasks/${t.id}`)} className="w-[42px] h-[42px] flex items-center justify-center bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-xl text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/30 transition-all" title="Cronometrar Tarea">
                                                            <Timer size={16}/>
                                                        </button>
                                                        <select value={t.type} onChange={e => updateListItem('asIsTasks', t.id, 'type', e.target.value)} className={`${inputClass.replace('w-full', '')} w-20 sm:w-24 text-xs font-bold p-0 px-2`}>
                                                            <option value="VA">VA</option>
                                                            <option value="NVAN">NVAN</option>
                                                            <option value="NVA">NVA</option>
                                                        </select>
                                                        <button onClick={() => removeListItem('asIsTasks', t.id)} className="w-[42px] h-[42px] flex items-center justify-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
                                                            <X size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={t.description || ''}
                                                    onChange={e => updateListItem('asIsTasks', t.id, 'description', e.target.value)}
                                                    onInput={e => { e.target.style.height = '0px'; e.target.style.height = (e.target.scrollHeight + 2) + 'px'; }}
                                                    className={`${inputClass} w-full resize-y min-h-[44px] text-sm text-gray-600 dark:text-gray-400`}
                                                    rows="2"
                                                    placeholder="Descripción detallada de la tarea..."
                                                />
                                            </div>
                                        ))}
                                        {(!editData.asIsTasks || editData.asIsTasks.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">No hay tareas analizadas.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TO-BE TAB */}
                    {activeTab === 'toBe' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <div className="bg-emerald-50/50 dark:bg-[#0a1510] border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-4 border-b border-emerald-200/50 dark:border-emerald-500/20 pb-2">1. Propuesta de Valor (Flujo y Matriz)</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className={labelClass}>Flujograma Propuesto <InfoTooltip text="Describe el nuevo flujo propuesto, detallando las eficiencias, pasos eliminados o automatizados."/></label>
                                        <textarea value={editData.toBeFlow} onChange={e => updateField('toBeFlow', e.target.value)} className={`${inputClass} min-h-[150px]`} placeholder="Proceso rediseñado (eliminando, automatizando)..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Matriz de Cambios (Gap Analysis) <InfoTooltip text="Define claramente qué actividades se eliminan, se automatizan, se mantienen o se crean desde cero."/></label>
                                        <textarea value={editData.toBeGapMatrix} onChange={e => updateField('toBeGapMatrix', e.target.value)} className={`${inputClass} min-h-[100px]`} placeholder="Qué se elimina, automatiza, mantiene o crea..." />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50/50 dark:bg-[#0a1510] border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-4 border-b border-emerald-200/50 dark:border-emerald-500/20 pb-2">2. Requerimientos y Habilitadores (Enablers)</h3>
                                <label className={labelClass}>Habilitadores <InfoTooltip text="Tecnología, software, capacitación o presupuesto necesario para que este nuevo flujo funcione."/></label>
                                <textarea value={editData.toBeEnablers} onChange={e => updateField('toBeEnablers', e.target.value)} className={`${inputClass} min-h-[100px]`} placeholder="Software necesario, automatizaciones, capacitaciones..." />
                            </div>

                            <div className="bg-emerald-50/50 dark:bg-[#0a1510] border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 shadow-sm mb-6">
                                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-4 border-b border-emerald-200/50 dark:border-emerald-500/20 pb-2">3. Tiempos y Frecuencia (Esperado)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>Tiempo de Ejecución (Cycle Time) <InfoTooltip text="El tiempo real de trabajo activo para completar el proceso (sin contar esperas)."/></label>
                                        <input type="text" value={formatTime(totalToBeTime)} readOnly className={`${inputClass} bg-gray-100 dark:bg-white/5 font-bold cursor-not-allowed`} title="Calculado automáticamente desde las tareas" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tiempo de Espera Total (Lead Time) <InfoTooltip text="El tiempo total desde que se solicita hasta que se entrega (incluyendo cuellos de botella)."/></label>
                                        <input type="text" value={formatTime(totalToBeTime + totalToBeWaitTime)} readOnly className={`${inputClass} bg-gray-100 dark:bg-white/5 font-bold cursor-not-allowed`} title="Calculado automáticamente (Cycle Time + Tiempos de Espera)" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Frecuencia / Volumen <InfoTooltip text="Cuántas veces se ejecuta el proceso en un periodo determinado (ej: 50/mes)."/></label>
                                        <div className="flex gap-2">
                                            <select value={editData.toBeFrequencyPeriod || 'Mensual'} onChange={e => updateField('toBeFrequencyPeriod', e.target.value)} className={`${inputClass} w-1/2 px-2`}>
                                                <option value="Por hora">Por hora</option>
                                                <option value="Diario">Diario</option>
                                                <option value="Semanal">Semanal</option>
                                                <option value="Mensual">Mensual</option>
                                                <option value="Anual">Anual</option>
                                            </select>
                                            <input type="number" value={editData.toBeFrequencyVolume || ''} onChange={e => updateField('toBeFrequencyVolume', e.target.value)} className={`${inputClass} w-1/2`} placeholder="Volumen (Ej: 50)" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm mb-6">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">4. Tareas y Tiempos Propuestos</h3>
                                    <button onClick={() => addListItem('toBeTasks', { task: '', time: '', waitTime: '' })} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
                                        <Plus size={14}/> Añadir Tarea
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {editData.toBeTasks?.map(t => (
                                        <div key={t.id} className="flex flex-col gap-3 p-4 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 rounded-2xl relative group transition-all">
                                            <div className="flex flex-col sm:flex-row gap-2 items-start">
                                                <div className="flex-1 min-w-0">
                                                    <input 
                                                        type="text" 
                                                        value={t.task} 
                                                        onChange={e => updateListItem('toBeTasks', t.id, 'task', e.target.value)} 
                                                        className={`${inputClass} font-bold text-base`} 
                                                        placeholder="Título de la tarea propuesta..." 
                                                    />
                                                </div>
                                                <div className="flex-shrink-0 w-full sm:w-auto flex gap-2 items-center">
                                                    <div className="flex flex-col gap-1 items-end">
                                                        <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase mr-1">Activo</span>
                                                            <input type="number" value={Math.floor((t.time || 0) / 3600) || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.time, 'time', 'hr', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Horas" />
                                                            <span className="text-[10px] text-gray-500 font-bold">h</span>
                                                            <input type="number" value={Math.floor(((t.time || 0) % 3600) / 60) || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.time, 'time', 'min', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Minutos" />
                                                            <span className="text-[10px] text-gray-500 font-bold">m</span>
                                                            <input type="number" value={(t.time || 0) % 60 || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.time, 'time', 'sec', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Segundos" />
                                                            <span className="text-[10px] text-gray-500 font-bold">s</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase mr-1">Espera</span>
                                                            <input type="number" value={Math.floor((t.waitTime || 0) / 3600) || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.waitTime, 'waitTime', 'hr', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Horas" />
                                                            <span className="text-[10px] text-gray-500 font-bold">h</span>
                                                            <input type="number" value={Math.floor(((t.waitTime || 0) % 3600) / 60) || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.waitTime, 'waitTime', 'min', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Minutos" />
                                                            <span className="text-[10px] text-gray-500 font-bold">m</span>
                                                            <input type="number" value={(t.waitTime || 0) % 60 || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.waitTime, 'waitTime', 'sec', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" title="Segundos" />
                                                            <span className="text-[10px] text-gray-500 font-bold">s</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => navigate(`/procesos/${id}/estudio-tiempos/toBeTasks/${t.id}`)} className="w-[42px] h-[42px] flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-all" title="Cronometrar Tarea">
                                                        <Timer size={16}/>
                                                    </button>
                                                    <button onClick={() => removeListItem('toBeTasks', t.id)} className="w-[42px] h-[42px] flex items-center justify-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
                                                        <X size={16}/>
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                value={t.description || ''}
                                                onChange={e => updateListItem('toBeTasks', t.id, 'description', e.target.value)}
                                                onInput={e => { e.target.style.height = '0px'; e.target.style.height = (e.target.scrollHeight + 2) + 'px'; }}
                                                className={`${inputClass} w-full resize-y min-h-[44px] text-sm text-gray-600 dark:text-gray-400`}
                                                rows="2"
                                                placeholder="Descripción detallada de la tarea..."
                                            />
                                        </div>
                                    ))}
                                    {(!editData.toBeTasks || editData.toBeTasks.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">No hay tareas propuestas.</p>}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">5. KPIs Objetivo (Métricas de Éxito)</h3>
                                    <button onClick={() => addListItem('toBeKpis', { metric: '', target: '' })} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
                                        <Plus size={14}/> Añadir KPI
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {editData.toBeKpis?.map(kpi => (
                                        <div key={kpi.id} className="flex flex-col sm:flex-row gap-2 items-center">
                                            <div className="flex-[2] min-w-0">
                                                <input type="text" value={kpi.metric} onChange={e => updateListItem('toBeKpis', kpi.id, 'metric', e.target.value)} className={`${inputClass}`} placeholder="Métrica (ej: Lead Time)" />
                                            </div>
                                            <div className="flex-shrink-0 w-full sm:w-auto flex-1 flex gap-2 items-center">
                                                <div className="flex-1 min-w-0">
                                                    <input type="text" value={kpi.target} onChange={e => updateListItem('toBeKpis', kpi.id, 'target', e.target.value)} className={`${inputClass}`} placeholder="Meta (ej: -40%)" />
                                                </div>
                                                <button onClick={() => removeListItem('toBeKpis', kpi.id)} className="flex-shrink-0 w-[42px] h-[42px] flex items-center justify-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
                                                    <X size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!editData.toBeKpis || editData.toBeKpis.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">No hay KPIs definidos.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ROADMAP TAB */}
                    {activeTab === 'roadmap' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <div className="bg-purple-50/50 dark:bg-[#150a15] border border-purple-200 dark:border-purple-500/20 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-center mb-4 border-b border-purple-200/50 dark:border-purple-500/20 pb-2">
                                    <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">1. Plan de Acción (Roadmap)</h3>
                                    <button onClick={() => addListItem('roadmap', { action: '', owner: '', deadline: '' })} className="text-xs bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
                                        <Plus size={14}/> Añadir Tarea
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {editData.roadmap?.map(task => (
                                        <div key={task.id} className="flex flex-col sm:flex-row gap-2 items-center">
                                            <div className="flex-[2] min-w-0">
                                                <input type="text" value={task.action} onChange={e => updateListItem('roadmap', task.id, 'action', e.target.value)} className={`${inputClass}`} placeholder="Acción a realizar..." />
                                            </div>
                                            <div className="flex-shrink-0 w-full sm:w-auto flex-1 flex gap-2 items-center">
                                                <div className="flex-1 min-w-0">
                                                    <input type="text" value={task.owner} onChange={e => updateListItem('roadmap', task.id, 'owner', e.target.value)} className={`${inputClass}`} placeholder="Responsable" />
                                                </div>
                                                <div className="flex-1 min-w-[100px]">
                                                    <input type="date" value={task.deadline} onChange={e => updateListItem('roadmap', task.id, 'deadline', e.target.value)} className={`${inputClass.replace('w-full', '')} w-full`} />
                                                </div>
                                                <button onClick={() => removeListItem('roadmap', task.id)} className="flex-shrink-0 w-[42px] h-[42px] flex items-center justify-center bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30 transition-all">
                                                    <X size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {(!editData.roadmap || editData.roadmap.length === 0) && <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">No hay tareas en el roadmap.</p>}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">2. Gestión del Riesgo</h3>
                                <textarea value={editData.riskManagement} onChange={e => updateField('riskManagement', e.target.value)} className={`${inputClass} min-h-[150px]`} placeholder="Impacto del cambio, resistencia, contingencias..." />
                            </div>
                        </div>
                    )}

                    {/* COMPARISON TAB */}
                    {activeTab === 'comparison' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-white dark:bg-black">
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Resumen Analítico (Side-by-Side)</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Comparativa directa para justificar el rediseño.</p>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white dark:bg-black text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">
                                                <th className="p-4 pl-6">Atributo / Variable</th>
                                                <th className="p-4 text-orange-600 dark:text-orange-400 border-l border-gray-200 dark:border-white/10">Estado As-Is (Actual)</th>
                                                <th className="p-4 text-emerald-600 dark:text-emerald-400 border-l border-gray-200 dark:border-white/10">Estado To-Be (Futuro)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-gray-900 dark:text-white divide-y divide-gray-200 dark:divide-white/10">
                                            <tr className="transition-colors">
                                                <td className="p-4 pl-6 font-bold">
                                                    Nº de Pasos / Tareas (Auto)
                                                    <span className="block text-xs font-normal opacity-70 mt-1 text-gray-500">Basado en las tareas agregadas</span>
                                                </td>
                                                <td className="p-4 border-l border-gray-200 dark:border-white/10 font-bold text-gray-900 dark:text-white">
                                                    {editData.asIsTasks?.length || 0} pasos
                                                </td>
                                                <td className="p-4 border-l border-gray-200 dark:border-white/10 font-bold text-emerald-600 dark:text-emerald-400 flex flex-wrap items-center gap-2">
                                                    {editData.toBeTasks?.length || 0} pasos
                                                    {(editData.asIsTasks?.length || 0) > (editData.toBeTasks?.length || 0) && (
                                                        <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                                            -{(editData.asIsTasks?.length || 0) - (editData.toBeTasks?.length || 0)} pasos
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            <tr className="transition-colors">
                                                <td className="p-4 pl-6 font-bold text-blue-800 dark:text-blue-300">
                                                    Suma de Tiempos (Auto)
                                                    <span className="block text-xs font-normal opacity-70 mt-1 text-blue-600/70 dark:text-blue-400/70">Basado en tiempos por tarea</span>
                                                </td>
                                                <td className="p-4 border-l border-blue-200/50 dark:border-blue-900/30 font-bold text-orange-600 dark:text-orange-400">
                                                    {formatTime(totalAsIsTime)}
                                                </td>
                                                <td className="p-4 border-l border-blue-200/50 dark:border-blue-900/30 font-bold text-emerald-600 dark:text-emerald-400 flex flex-wrap items-center gap-2">
                                                    {formatTime(totalToBeTime)}
                                                    {totalAsIsTime > 0 && totalToBeTime < totalAsIsTime && (
                                                        <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                                            -{formatTime(totalAsIsTime - totalToBeTime)} de ahorro
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                            <tr className="transition-colors">
                                                <td className="p-4 pl-6 font-bold">
                                                    Puntos de Dolor (Auto)
                                                    <span className="block text-xs font-normal opacity-70 mt-1 text-gray-500">Dolores identificados en AS-IS</span>
                                                </td>
                                                <td className="p-4 border-l border-gray-200 dark:border-white/10 font-bold text-red-600 dark:text-red-400">
                                                    {editData.asIsPains?.length || 0} dolores
                                                </td>
                                                <td className="p-4 border-l border-gray-200 dark:border-white/10 font-bold text-emerald-600 dark:text-emerald-400">
                                                    Resueltos / Mitigados
                                                </td>
                                            </tr>
                                            <tr className="transition-colors">
                                                <td className="p-4 pl-6 font-bold">
                                                    Métricas de Éxito / KPIs (Auto)
                                                    <span className="block text-xs font-normal opacity-70 mt-1 text-gray-500">KPIs definidos en TO-BE</span>
                                                </td>
                                                <td className="p-4 border-l border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400">
                                                    No medido
                                                </td>
                                                <td className="p-4 border-l border-gray-200 dark:border-white/10 font-bold text-emerald-600 dark:text-emerald-400">
                                                    {editData.toBeKpis?.length || 0} KPIs definidos
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Glossary Modal */}
            {showGlossary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl max-w-lg w-full">
                        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-3">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Info className="text-cyan-600"/> Glosario Lean (Valor)
                            </h3>
                            <button onClick={() => setShowGlossary(false)} className="text-gray-500 hover:text-red-500 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl">
                                <strong className="text-emerald-700 dark:text-emerald-400 block mb-1">VA (Valor Añadido / Value Added)</strong>
                                Actividades que transforman el producto o servicio directamente y por las cuales el cliente final está dispuesto a pagar.
                                <br/><em className="text-xs opacity-75 mt-1 block">Ejemplo: Diseñar una pieza, ensamblar el producto, redactar el informe final.</em>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 p-4 rounded-xl">
                                <strong className="text-blue-700 dark:text-blue-400 block mb-1">NVAN (No Valor Añadido Necesario / Business Value Added)</strong>
                                Tareas que no generan valor directo al cliente, pero son obligatorias por temas legales, normativos o para que la empresa funcione.
                                <br/><em className="text-xs opacity-75 mt-1 block">Ejemplo: Auditorías, contabilidad, firma de contratos, control de calidad regulatorio.</em>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 p-4 rounded-xl">
                                <strong className="text-red-700 dark:text-red-400 block mb-1">NVA (No Valor Añadido / Desperdicio / Waste)</strong>
                                Actividades que consumen tiempo y recursos pero no aportan absolutamente ningún valor. ¡Estas deben ser eliminadas o automatizadas!
                                <br/><em className="text-xs opacity-75 mt-1 block">Ejemplo: Tiempos de espera, re-trabajos, firmas o aprobaciones innecesarias, buscar información perdida.</em>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowGlossary(false)} className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold px-6 py-2 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Historial de Tiempos */}
            {showEstudiosModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 dark:text-white text-lg tracking-tight">Historial de Estudios de Tiempos</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Registro cronométrico de tareas de este proceso</p>
                                </div>
                            </div>
                            <button onClick={() => setShowEstudiosModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {estudiosTiempos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Timer size={48} className="text-gray-300 dark:text-white/10 mb-4" />
                                    <h4 className="text-gray-900 dark:text-white font-bold mb-1">Sin estudios registrados</h4>
                                    <p className="text-sm text-gray-500">Abre el cronómetro desde una tarea para registrar tiempos.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {estudiosTiempos.map(estudio => (
                                        <div key={estudio.id} className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${estudio.fase === 'asIsTasks' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                                                        {estudio.fase === 'asIsTasks' ? 'AS-IS' : 'TO-BE'}
                                                    </span>
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{estudio.tareaName}</h4>
                                                </div>
                                                <p className="text-xs text-gray-500">Realizado: {estudio.createdAt?.toDate ? new Date(estudio.createdAt.toDate()).toLocaleString() : 'Reciente'}</p>
                                                <div className="flex gap-4 mt-2 text-xs">
                                                    <span className="text-gray-600 dark:text-gray-400">Valoración: <strong className="text-gray-900 dark:text-white">{estudio.valoracion}%</strong></span>
                                                    <span className="text-gray-600 dark:text-gray-400">Fatiga: <strong className="text-gray-900 dark:text-white">{estudio.suplementos?.fatiga}%</strong></span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 p-3 rounded-lg text-right min-w-[140px]">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tiempo Estándar</span>
                                                <span className="text-lg font-black text-amber-600 dark:text-amber-500">{formatTime(estudio.metricasTotal?.te)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcesoDetail;
