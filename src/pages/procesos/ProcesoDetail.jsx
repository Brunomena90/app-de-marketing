import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
    ArrowLeft, GitMerge, Save, Trash2, 
    AlignLeft, Clock, CheckCircle2, ChevronRight,
    TableProperties, Activity, Target, ShieldAlert,
    Plus, X, BarChart2, Info
} from 'lucide-react';

const emptyProceso = {
    name: '', description: '',
    supplier: '', input: '', trigger: '', output: '', customer: '',
    processOwner: '', scope: '', status: 'Diseñado', version: '1.0',
    asIsFlow: '', asIsCycleTime: '', asIsLeadTime: '', asIsFrequency: '',
    asIsPains: [], asIsTools: '', asIsCost: '', asIsTasks: [],
    asIsStepsCount: '', asIsManualIntervention: '', asIsSla: '',
    toBeFlow: '', toBeGapMatrix: '', toBeKpis: [], toBeEnablers: '', toBeTasks: [],
    toBeCycleTime: '', toBeLeadTime: '', toBeTools: '',
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

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'procesos', id), {
                ...editData,
                updatedAt: serverTimestamp()
            });
            toast.success("Proceso actualizado exitosamente");
        } catch (error) {
            console.error("Error updating process:", error);
            toast.error("Error al guardar los cambios");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("¿Eliminar este proceso definitivamente?")) return;
        try {
            await deleteDoc(doc(db, 'procesos', id));
            toast.success("Proceso eliminado");
            navigate('/procesos');
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar");
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

    const handleTimeChange = (listName, id, currentTotal, field, value) => {
        const val = parseInt(value) || 0;
        const currentHr = Math.floor((currentTotal || 0) / 60);
        const currentMin = (currentTotal || 0) % 60;
        const newTotal = field === 'hr' ? (val * 60) + currentMin : (currentHr * 60) + val;
        updateListItem(listName, id, 'time', newTotal === 0 ? '' : newTotal);
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
    const labelClass = "block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5";

    const totalAsIsTime = (editData.asIsTasks || []).reduce((acc, curr) => acc + (Number(curr.time) || 0), 0);
    const totalToBeTime = (editData.toBeTasks || []).reduce((acc, curr) => acc + (Number(curr.time) || 0), 0);

    const formatTime = (mins) => {
        if (!mins) return '0 min';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#050505] relative overflow-hidden transition-colors">
            {/* Header */}
            <header className="relative z-10 shrink-0 border-b border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md">
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
                        {isSuperUser && (
                            <button onClick={handleDelete} className="p-2.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-colors shadow-sm">
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg ${saving ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20'}`}>
                            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
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
                <div className="max-w-6xl mx-auto space-y-6">
                    
                    {/* SIPOC TAB */}
                    {activeTab === 'sipoc' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">1. Datos Generales</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-1 md:col-span-2">
                                        <label className={labelClass}>Descripción / Propósito</label>
                                        <textarea value={editData.description} onChange={e => updateField('description', e.target.value)} className={`${inputClass} min-h-[80px]`} placeholder="Propósito del proceso..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Dueño del Proceso (Process Owner)</label>
                                        <input type="text" value={editData.processOwner} onChange={e => updateField('processOwner', e.target.value)} className={inputClass} placeholder="Ej: Gerente de Finanzas" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Alcance (Scope)</label>
                                        <input type="text" value={editData.scope} onChange={e => updateField('scope', e.target.value)} className={inputClass} placeholder="Inicia en X y termina en Y" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Estado del Proceso</label>
                                        <select value={editData.status} onChange={e => updateField('status', e.target.value)} className={inputClass}>
                                            <option value="Diseñado">Diseñado</option>
                                            <option value="En Revisión">En Revisión</option>
                                            <option value="Aprobado">Aprobado</option>
                                            <option value="En Implementación">En Implementación</option>
                                            <option value="Deprecado">Deprecado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Versión</label>
                                        <input type="text" value={editData.version} onChange={e => updateField('version', e.target.value)} className={inputClass} placeholder="Ej: v1.0 As-Is" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-white/5 pb-2">2. Ficha SIPOC</h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Supplier (Proveedor)</label>
                                        <textarea value={editData.supplier} onChange={e => updateField('supplier', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Quién entrega insumos..." />
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Input (Entrada)</label>
                                        <textarea value={editData.input} onChange={e => updateField('input', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Datos, documentos..." />
                                    </div>
                                    <div className="bg-cyan-50 dark:bg-cyan-500/10 p-4 rounded-xl border border-cyan-100 dark:border-cyan-500/20 shadow-inner">
                                        <label className="block text-xs font-bold text-cyan-700 dark:text-cyan-400 mb-2">Trigger (Disparador)</label>
                                        <textarea value={editData.trigger} onChange={e => updateField('trigger', e.target.value)} className={`${inputClass} text-xs min-h-[100px] bg-white dark:bg-black/40`} placeholder="Evento que inicia el flujo..." />
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Output (Salida)</label>
                                        <textarea value={editData.output} onChange={e => updateField('output', e.target.value)} className={`${inputClass} text-xs min-h-[100px]`} placeholder="Entregables tangibles..." />
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Customer (Cliente)</label>
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
                                        <label className={labelClass}>Flujograma / Pasos del Estado Actual</label>
                                        <textarea value={editData.asIsFlow} onChange={e => updateField('asIsFlow', e.target.value)} className={`${inputClass} min-h-[150px]`} placeholder="Lista estructurada de pasos con roles asignados..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Sistemas y Herramientas Utilizadas</label>
                                        <input type="text" value={editData.asIsTools} onChange={e => updateField('asIsTools', e.target.value)} className={inputClass} placeholder="Excel, ERP, correo..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Costo Directo Aproximado</label>
                                        <input type="text" value={editData.asIsCost} onChange={e => updateField('asIsCost', e.target.value)} className={inputClass} placeholder="Horas hombre o costo operativo..." />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-orange-50/50 dark:bg-[#15100a] border border-orange-200 dark:border-orange-500/20 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-4 border-b border-orange-200/50 dark:border-orange-500/20 pb-2">2. Tiempos y Frecuencia</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>Tiempo de Ejecución (Cycle Time)</label>
                                        <input type="text" value={editData.asIsCycleTime} onChange={e => updateField('asIsCycleTime', e.target.value)} className={inputClass} placeholder="Tiempo de trabajo activo..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tiempo de Espera Total (Lead Time)</label>
                                        <input type="text" value={editData.asIsLeadTime} onChange={e => updateField('asIsLeadTime', e.target.value)} className={inputClass} placeholder="Desde inicio hasta fin..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Frecuencia / Volumen</label>
                                        <input type="text" value={editData.asIsFrequency} onChange={e => updateField('asIsFrequency', e.target.value)} className={inputClass} placeholder="Diario, semanal, mensual..." />
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
                                        <button onClick={() => addListItem('asIsTasks', { task: '', type: 'VA', time: '' })} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
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
                                                        <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
                                                            <input type="number" value={Math.floor((t.time || 0) / 60) || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.time, 'hr', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none" placeholder="0" title="Horas" />
                                                            <span className="text-xs text-gray-500 font-bold">h</span>
                                                            <input type="number" value={(t.time || 0) % 60 || ''} onChange={e => handleTimeChange('asIsTasks', t.id, t.time, 'min', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1" placeholder="0" title="Minutos" />
                                                            <span className="text-xs text-gray-500 font-bold">m</span>
                                                        </div>
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
                                        <label className={labelClass}>Flujograma Propuesto</label>
                                        <textarea value={editData.toBeFlow} onChange={e => updateField('toBeFlow', e.target.value)} className={`${inputClass} min-h-[150px]`} placeholder="Proceso rediseñado (eliminando, automatizando)..." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Matriz de Cambios (Gap Analysis)</label>
                                        <textarea value={editData.toBeGapMatrix} onChange={e => updateField('toBeGapMatrix', e.target.value)} className={`${inputClass} min-h-[100px]`} placeholder="Qué se elimina, automatiza, mantiene o crea..." />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-50/50 dark:bg-[#0a1510] border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-4 border-b border-emerald-200/50 dark:border-emerald-500/20 pb-2">2. Requerimientos y Habilitadores (Enablers)</h3>
                                <textarea value={editData.toBeEnablers} onChange={e => updateField('toBeEnablers', e.target.value)} className={`${inputClass} min-h-[100px]`} placeholder="Software necesario, automatizaciones, capacitaciones..." />
                            </div>

                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm mb-6">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">3. Tareas y Tiempos Propuestos</h3>
                                    <button onClick={() => addListItem('toBeTasks', { task: '', time: '' })} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-colors">
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
                                                    <div className="flex items-center gap-1 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
                                                        <input type="number" value={Math.floor((t.time || 0) / 60) || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.time, 'hr', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none" placeholder="0" title="Horas" />
                                                        <span className="text-xs text-gray-500 font-bold">h</span>
                                                        <input type="number" value={(t.time || 0) % 60 || ''} onChange={e => handleTimeChange('toBeTasks', t.id, t.time, 'min', e.target.value)} className="w-8 sm:w-10 bg-transparent text-center text-sm text-gray-900 dark:text-white outline-none border-l border-gray-200 dark:border-white/10 pl-1" placeholder="0" title="Minutos" />
                                                        <span className="text-xs text-gray-500 font-bold">m</span>
                                                    </div>
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
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">4. KPIs Objetivo (Métricas de Éxito)</h3>
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
                            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Resumen Analítico (Side-by-Side)</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Comparativa directa para justificar el rediseño.</p>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-black/40 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-white/10">
                                                <th className="p-4 pl-6">Atributo / Variable</th>
                                                <th className="p-4 text-orange-600 dark:text-orange-400 border-l border-gray-200 dark:border-white/10">Estado As-Is (Actual)</th>
                                                <th className="p-4 text-emerald-600 dark:text-emerald-400 border-l border-gray-200 dark:border-white/10">Estado To-Be (Futuro)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-gray-900 dark:text-white divide-y divide-gray-200 dark:divide-white/10">
                                            <tr className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
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
                                            <tr className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors bg-blue-50/30 dark:bg-blue-900/10">
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
                                            <tr className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
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
                                            <tr className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
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
        </div>
    );
};

export default ProcesoDetail;
