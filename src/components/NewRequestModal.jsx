import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, Plus, Video, Layout, List, Megaphone, Image, Layers, Calendar, Clock, ChevronDown, Check, Search } from 'lucide-react';
import { addDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { getDocs } from 'firebase/firestore';
import CampaignSelectorModal from './CampaignSelectorModal';

const NewRequestModal = ({ isOpen, onClose, initialTab = 'video', initialData = null }) => {
    const { user, activeEmpresa, hasGlobalAccess, isAdmin } = useAuth();
    const { register, getValues, reset, setValue, watch } = useForm();
    const [availableEmpresas, setAvailableEmpresas] = useState([]);

    const [activeTab, setActiveTab] = useState(initialTab);
    const [briefing, setBriefing] = useState([]);
    const [item, setItem] = useState("");
    const [loading, setLoading] = useState(false);
    const [recordings, setRecordings] = useState([]);

    // Datos
    const [campaigns, setCampaigns] = useState([]);
    const [allSystemAreas, setAllSystemAreas] = useState([]);

    // States for search and selection
    const [campaignSearch, setCampaignSearch] = useState("");
    const [isAreaOpen, setIsAreaOpen] = useState(false);
    const [areaSearch, setAreaSearch] = useState("");
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

    const selectedCampaign = watch('campaign');
    const selectedArea = watch('area');
    const subGroup = watch('subGroup');
    const empresaDestino = watch('empresaDestino');

    const areaRef = useRef(null);

    const actualEmpresa = activeEmpresa === 'Todas' ? (empresaDestino || 'Todas') : activeEmpresa;
    const today = new Date().toISOString().split('T')[0];
    const isAdminOrEditor = isAdmin || user?.role === 'editor';

    // User Areas Logic
    const userAssignedAreas = React.useMemo(() => {
        if (!user) return [];
        if (Array.isArray(user.areas) && user.areas.length > 0) return user.areas;
        if (user.area) return [user.area];
        return [];
    }, [user]);

    const shouldEnableSelect = isAdminOrEditor || userAssignedAreas.length > 1;

    const availableAreaOptions = React.useMemo(() => {
        if (isAdminOrEditor) {
            return allSystemAreas.filter(a => {
                const aEmpresa = a.empresaName || 'GRUCOIN';
                return actualEmpresa === 'Todas' || aEmpresa === actualEmpresa;
            });
        }
        return userAssignedAreas.map(a => ({ name: a }));
    }, [isAdminOrEditor, allSystemAreas, userAssignedAreas, actualEmpresa]);

    const filteredAreas = availableAreaOptions.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase()));
    const displayedAreas = filteredAreas.slice(0, 5);

    const handleSelectCampaign = (campName, subName) => {
        setValue('campaign', campName || "");
        setValue('subGroup', subName || "");
        setCampaignSearch(campName ? (subName ? `${campName} > ${subName}` : campName) : "");
        setIsCampaignModalOpen(false);
    };

    const handleClearCampaign = (e) => {
        e.stopPropagation();
        setValue('campaign', "");
        setValue('subGroup', "");
        setCampaignSearch("");
    };

    const handleSelectArea = (name) => {
        setValue('area', name);
        setAreaSearch(name);
        setIsAreaOpen(false);
    };

    const addBriefingItem = (e) => { e.preventDefault(); if (item.trim()) { setBriefing([...briefing, item]); setItem(""); } };
    const removeBriefingItem = (i) => setBriefing(briefing.filter((_, idx) => idx !== i));

    // --- EFECTOS ---

    // Cerrar dropdowns al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (areaRef.current && !areaRef.current.contains(event.target)) setIsAreaOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && activeEmpresa === 'Todas') {
            if (hasGlobalAccess) {
                getDocs(query(collection(db, 'empresas'), orderBy('name'))).then(snap => {
                    setAvailableEmpresas(snap.docs.map(d => d.data().name));
                });
            } else {
                setAvailableEmpresas(user?.empresas || []);
            }
        }
    }, [isOpen, activeEmpresa, hasGlobalAccess, user]);

    useEffect(() => {
        if (isOpen) {
            // Cargas de DB
            const qAreas = query(collection(db, "areas"), orderBy("name"));
            const unsubAreas = onSnapshot(qAreas, (snap) => setAllSystemAreas(snap.docs.map(d => d.data())));

            // Reset Form
            reset();
            setBriefing([]);
            setRecordings([]);
            setActiveTab(initialTab);
            setValue('requestDate', today);
            setCampaignSearch("");

            // Aplicar initialData si existe
            if (initialData) {
                if (initialData.title) setValue('title', initialData.title);
                if (initialData.briefing) {
                    const items = typeof initialData.briefing === 'string' ? initialData.briefing.split('\n').filter(Boolean) : initialData.briefing;
                    setBriefing(items);
                    setValue('copy', items.join('\n'));
                }
                if (initialData.date) setValue('deliveryDate', initialData.date);
            }

            // --- INICIALIZACIÓN DE ÁREA ---
            let initialAreaValue = "";
            if (isAdminOrEditor || userAssignedAreas.length > 1) {
                initialAreaValue = ""; // Admin/Multi: Empieza vacío para elegir
            } else if (userAssignedAreas.length === 1) {
                initialAreaValue = userAssignedAreas[0]; // Usuario Mono: Se fija su área
            }

            setValue('area', initialAreaValue);
            setAreaSearch(initialAreaValue); // Sincronizamos el buscador visual con el valor inicial

            return () => { unsubAreas(); };
        }
    }, [isOpen, user, isAdminOrEditor, userAssignedAreas, initialTab, initialData, reset, setValue, today]);

    const save = async () => {
        const d = getValues();
        if (!d.title) return toast.error("Falta el Título");
        if (!d.area) return toast.error("Selecciona un Área");

        if (activeEmpresa === 'Todas' && !d.empresaDestino) return toast.error("Selecciona la Empresa para esta solicitud");
        
        setLoading(true);
        try {
            const base = {
                title: d.title,
                area: d.area,
                type: activeTab,
                campaign: d.campaign || null,
                subGroup: d.subGroup || null,
                status: 'solicitado',
                applicantName: user.name,
                applicantId: user.uid,
                createdAt: new Date().toISOString(),
                requestDate: d.requestDate || today,
                deliveryDate: d.deliveryDate || null,
                empresa: actualEmpresa,
            };

            if (activeTab === 'video') {
                base.objetivo = d.objetivo;
                base.publico = d.publico;
                base.mensaje = d.mensaje;
                base.briefing = briefing.join('\n');
                base.recordings = recordings.filter(r => r.date); // Guardar solo los que tengan fecha
                base.format = d.format || "Horizontal (16:9)";
            } else {
                base.copy = d.copy;
            }

            await addDoc(collection(db, "solicitudes_contenido"), base);
            toast.success("Solicitud Creada");
            onClose();
        } catch (e) { toast.error("Error al guardar"); }
        finally { setLoading(false); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in">
            <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95">

                {/* HEADER */}
                <div className="flex border-b shrink-0 bg-white z-10">
                    <button onClick={() => setActiveTab('video')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${activeTab === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}><Video size={18} /> Video</button>
                    <button onClick={() => setActiveTab('post')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors ${activeTab === 'post' ? 'bg-green-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}><Image size={18} /> Post</button>
                    <button onClick={onClose} className="px-4 bg-gray-50 hover:bg-red-50 hover:text-red-500 border-l transition-colors"><X /></button>
                </div>

                {/* BODY */}
                <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-1 bg-white">

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1 uppercase tracking-wide">Título del Proyecto</label>
                            <input {...register('title')} spellCheck={true} lang="es-PE" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-medium" placeholder="Ej: Video Corporativo..." autoFocus />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* SELECTOR DE EMPRESA GLOBAL */}
                            {activeEmpresa === 'Todas' && (
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-gray-700 block mb-1 uppercase">Empresa Destino</label>
                                    <select
                                        {...register('empresaDestino')}
                                        className="w-full border p-2.5 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                                        onChange={(e) => {
                                            setValue('empresaDestino', e.target.value);
                                            setValue('area', '');
                                            setAreaSearch('');
                                            setValue('campaign', '');
                                            setValue('subGroup', '');
                                            setCampaignSearch('');
                                        }}
                                    >
                                        <option value="">-- Seleccionar Empresa --</option>
                                        {availableEmpresas.map(e => (
                                            <option key={e} value={e}>{e}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* SELECTOR DE ÁREA (TIPO COMBOBOX) */}
                            <div className="relative" ref={areaRef}>
                                <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1"><Layers size={12} /> Área Solicitante</label>

                                <div
                                    className={`w-full border p-2.5 rounded-lg flex items-center gap-2 transition-colors ${shouldEnableSelect
                                        ? 'bg-white cursor-text border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500'
                                        : 'bg-gray-100 cursor-not-allowed border-gray-200 text-gray-500'
                                        }`}
                                    onClick={() => { if (shouldEnableSelect) setIsAreaOpen(true); }}
                                >
                                    <Search size={14} className="text-gray-400 shrink-0" />
                                    <input
                                        type="text"
                                        className={`w-full text-sm outline-none bg-transparent placeholder-gray-400 ${!shouldEnableSelect && 'cursor-not-allowed'}`}
                                        placeholder={shouldEnableSelect ? "Buscar área..." : "Sin área asignada"}
                                        value={areaSearch}
                                        readOnly={!shouldEnableSelect} // Bloqueado si no tiene permisos
                                        onChange={(e) => {
                                            setAreaSearch(e.target.value);
                                            if (shouldEnableSelect) setIsAreaOpen(true);
                                        }}
                                        onFocus={() => { if (shouldEnableSelect) setIsAreaOpen(true); }}
                                    />
                                    {/* Icono de flecha solo si es seleccionable */}
                                    {shouldEnableSelect && (
                                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isAreaOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </div>

                                {/* DROPDOWN ÁREAS */}
                                {isAreaOpen && shouldEnableSelect && (
                                    <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
                                        {displayedAreas.length > 0 ? (
                                            displayedAreas.map((a, i) => (
                                                <li
                                                    key={i}
                                                    onClick={() => handleSelectArea(a.name)}
                                                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between group ${selectedArea === a.name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                >
                                                    <span className="truncate">{a.name}</span>
                                                    {selectedArea === a.name && <Check size={14} className="text-blue-600" />}
                                                </li>
                                            ))
                                        ) : (
                                            <li className="px-3 py-3 text-xs text-gray-400 text-center">No se encontraron áreas.</li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            {/* SELECTOR DE CAMPAÑA (BOTÓN QUE ABRE MODAL FLOTANTE) */}
                            <div className="relative">
                                <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1"><Megaphone size={12} /> Campaña {subGroup ? '(Con Sub-grupo)' : '(Opcional)'}</label>

                                <div
                                    className="w-full border p-2.5 rounded-lg bg-white flex items-center gap-2 cursor-pointer border-gray-300 hover:border-blue-500 transition-colors"
                                    onClick={() => setIsCampaignModalOpen(true)}
                                >
                                    <Megaphone size={14} className="text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        className="w-full text-sm outline-none bg-transparent placeholder-gray-400 cursor-pointer pointer-events-none"
                                        placeholder="Toca para elegir campaña..."
                                        value={campaignSearch}
                                        readOnly
                                    />
                                    {selectedCampaign && (
                                        <button onClick={handleClearCampaign} className="text-gray-400 hover:text-red-500 p-0.5"><X size={14} /></button>
                                    )}
                                    <ChevronDown size={14} className="text-gray-400" />
                                </div>

                                <CampaignSelectorModal 
                                    isOpen={isCampaignModalOpen} 
                                    onClose={() => setIsCampaignModalOpen(false)} 
                                    onSelect={handleSelectCampaign}
                                    activeEmpresa={actualEmpresa}
                                    selectedCampaign={selectedCampaign}
                                    selectedSubGroup={subGroup}
                                />
                            </div>
                        </div>
                    </div>

                    {/* VIDEO FIELDS */}
                    {activeTab === 'video' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-3">
                                <h4 className="text-xs font-black text-gray-400 uppercase flex items-center gap-2"><Layout size={14} /> Estrategia</h4>
                                <input {...register('objetivo')} spellCheck={true} lang="es-PE" className="w-full border p-2.5 rounded-lg text-sm" placeholder="Objetivo Principal" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input {...register('publico')} spellCheck={true} lang="es-PE" className="w-full border p-2.5 rounded-lg text-sm" placeholder="Público Objetivo" />
                                    <input {...register('mensaje')} spellCheck={true} lang="es-PE" className="w-full border p-2.5 rounded-lg text-sm" placeholder="Mensaje Clave" />
                                </div>
                            </div>

                            <div className="border rounded-lg p-4">
                                <h4 className="text-xs font-black text-gray-400 uppercase flex items-center gap-2 mb-2"><List size={14} /> Puntos del Briefing</h4>
                                <div className="flex gap-2 mb-2">
                                    <input value={item} onChange={e => setItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBriefingItem(e)} spellCheck={true} lang="es-PE" className="flex-1 border p-2 rounded text-sm" placeholder="Escribe y presiona Enter..." />
                                    <button onClick={addBriefingItem} className="bg-gray-800 text-white p-2 rounded hover:bg-black"><Plus size={16} /></button>
                                </div>
                                <ul className="space-y-1 pl-1">
                                    {briefing.map((t, i) => (
                                        <li key={i} className="text-sm flex justify-between items-center bg-gray-50 p-2 rounded group">
                                            <span className="text-gray-700">• {t}</span>
                                            <button onClick={() => removeBriefingItem(i)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xs font-black text-blue-700 uppercase flex items-center gap-2"><Calendar size={14} /> Grabación</h4>
                                    <button type="button" onClick={() => setRecordings([...recordings, { date: '', startTime: '', endTime: '' }])} className="text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"><Plus size={14} /> Añadir Día</button>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                                    {recordings.length === 0 ? (
                                        <div className="text-sm text-blue-800/60 p-4 bg-white/50 border border-blue-100 rounded-xl text-center border-dashed">No hay fechas asignadas. Da clic en "Añadir Día".</div>
                                    ) : (
                                        recordings.map((rec, i) => (
                                            <div key={i} className="flex flex-col gap-2 p-4 bg-white border border-blue-200 shadow-sm rounded-xl relative group">
                                                <button type="button" onClick={() => setRecordings(recordings.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity bg-white hover:bg-red-50 p-1 rounded-full"><X size={16} /></button>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-6">
                                                    <div><label className="text-[10px] font-bold text-blue-800 uppercase block mb-1">Fecha</label><input type="date" value={rec.date} onChange={e => { const newRecs = [...recordings]; newRecs[i].date = e.target.value; setRecordings(newRecs); }} className="w-full border border-blue-100 p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-blue-50/20" /></div>
                                                    <div><label className="text-[10px] font-bold text-blue-800 uppercase block mb-1">Hora Inicio</label><input type="time" value={rec.startTime} onChange={e => { const newRecs = [...recordings]; newRecs[i].startTime = e.target.value; setRecordings(newRecs); }} className="w-full border border-blue-100 p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-blue-50/20" /></div>
                                                    <div><label className="text-[10px] font-bold text-blue-800 uppercase block mb-1">Hora Fin</label><input type="time" value={rec.endTime} onChange={e => { const newRecs = [...recordings]; newRecs[i].endTime = e.target.value; setRecordings(newRecs); }} className="w-full border border-blue-100 p-2.5 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-blue-50/20" /></div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1">Formato de Video</label>
                                <select {...register('format')} className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none">
                                    <option>Horizontal (16:9)</option>
                                    <option>Vertical (9:16)</option>
                                    <option>Cuadrado (1:1)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* POST FIELDS */}
                    {activeTab === 'post' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-1 uppercase">Detalles / Copy</label>
                                <textarea {...register('copy')} rows={6} spellCheck={true} lang="es-PE" className="w-full border p-3 rounded-lg resize-none text-sm focus:ring-2 focus:ring-green-200 outline-none" placeholder="Describe el contenido..."></textarea>
                            </div>
                        </div>
                    )}

                    {/* FECHAS COMUNES */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Fecha Solicitud</label>
                            <input
                                type="date"
                                {...register('requestDate')}
                                readOnly={!isAdminOrEditor}
                                className={`w-full border p-2 rounded text-sm outline-none focus:ring-2 ${isAdminOrEditor ? 'bg-white focus:ring-blue-200' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-900 block mb-1">Fecha Entrega</label>
                            <input type="date" {...register('deliveryDate')} className="w-full border border-green-200 p-2 rounded text-sm bg-green-50 focus:ring-2 focus:ring-green-200 outline-none" />
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0 safe-area-pb">
                    <button onClick={save} disabled={loading} className={`w-full md:w-auto px-8 py-3 text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95 ${activeTab === 'video' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                        {loading ? 'Guardando...' : 'Crear Solicitud'}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default NewRequestModal;
