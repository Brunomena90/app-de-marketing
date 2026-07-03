import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ArrowLeft, ExternalLink, Calendar, Video, Image, AlertCircle, Plus, X, Layers, Save, ChevronRight, ChevronDown, Search, Edit2 } from 'lucide-react';
import { updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const CampaignDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [campaign, setCampaign] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- SCROLL PERSISTENCE ---
    const [hasRestored, setHasRestored] = useState(false);
    const scrollKey = `campDetailScrollY_${id}`;

    useEffect(() => {
        const container = document.getElementById('main-scroll-container');
        if (!container) return;
        const handleScroll = () => {
            sessionStorage.setItem(scrollKey, container.scrollTop.toString());
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [scrollKey]);

    useEffect(() => {
        if (!hasRestored && !loading && campaign) {
            const savedScroll = sessionStorage.getItem(scrollKey);
            if (savedScroll) {
                const scrollPos = parseInt(savedScroll, 10);
                const container = document.getElementById('main-scroll-container');
                if (container) {
                    container.scrollTop = scrollPos;
                    const timer1 = setTimeout(() => { container.scrollTop = scrollPos; }, 50);
                    const timer2 = setTimeout(() => { container.scrollTop = scrollPos; }, 200);
                    const timer3 = setTimeout(() => { container.scrollTop = scrollPos; }, 500);
                    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
                }
            }
            setHasRestored(true);
        }
    }, [campaign, loading, hasRestored, scrollKey]);


    const [isAddingSubGroup, setIsAddingSubGroup] = useState(false);
    const [newSubGroupName, setNewSubGroupName] = useState("");
    const [subgroupSearch, setSubgroupSearch] = useState("");
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [editingSubGroup, setEditingSubGroup] = useState(null);
    const [editSubGroupName, setEditSubGroupName] = useState("");

    const toggleGroup = (name) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    useEffect(() => {
        const campRef = doc(db, "campanas", id);
        const unsubCamp = onSnapshot(campRef, (docSnap) => {
            if (docSnap.exists()) {
                const campData = { id: docSnap.id, ...docSnap.data() };
                setCampaign(campData);

                const q = query(collection(db, "solicitudes_contenido"), where("campaign", "==", campData.name));
                const unsubReqs = onSnapshot(q, (snapshot) => {
                    let reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    // --- FILTRADO POR ROL Y ÁREA ---
                    const userRole = user?.role?.toLowerCase();
                    const isRestrictedRole = userRole === 'jefe';
                    if (isRestrictedRole) {
                        const accessibleAreas = [
                            ...(user?.area ? [user.area.toLowerCase()] : []),
                            ...(Array.isArray(user?.areas) ? user.areas.map(a => a.toLowerCase()) : [])
                        ];
                        reqs = reqs.filter(r => accessibleAreas.includes((r.area || "").toLowerCase()));
                    }

                    setRequests(reqs);
                    setLoading(false);
                });
                return () => unsubReqs();
            } else {
                setLoading(false);
                toast.error("Campaña no encontrada");
                navigate('/campanas');
            }
        });
        return () => unsubCamp();
    }, [id, navigate]);

    const addSubGroup = async () => {
        if (!newSubGroupName.trim()) return;
        if (campaign.subGroups?.includes(newSubGroupName.trim())) {
            return toast.error("Este sub-grupo ya existe");
        }
        try {
            await updateDoc(doc(db, "campanas", id), {
                subGroups: arrayUnion(newSubGroupName.trim())
            });
            toast.success("Sub-grupo añadido");
            setNewSubGroupName("");
            setIsAddingSubGroup(false);
        } catch (e) {
            toast.error("Error al añadir sub-grupo");
        }
    };

    const removeSubGroup = async (name) => {
        try {
            await updateDoc(doc(db, "campanas", id), {
                subGroups: arrayRemove(name)
            });
            toast.success("Sub-grupo eliminado");
        } catch (e) {
            toast.error("Error al eliminar");
        }
    };

    const renameSubGroup = async (oldName) => {
        if (!editSubGroupName.trim() || editSubGroupName.trim() === oldName) {
            setEditingSubGroup(null);
            return;
        }
        try {
            const updatedGroups = campaign.subGroups.map(sg => sg === oldName ? editSubGroupName.trim() : sg);
            await updateDoc(doc(db, "campanas", id), { subGroups: updatedGroups });

            const toUpdate = requests.filter(r => r.subGroup === oldName);
            for (const r of toUpdate) {
                await updateDoc(doc(db, "solicitudes_contenido", r.id), { subGroup: editSubGroupName.trim() });
            }

            toast.success("Sub-grupo renombrado");
            setEditingSubGroup(null);
            setEditSubGroupName("");
        } catch (e) {
            toast.error("Error al renombrar");
        }
    };

    // --- LÓGICA DE ESTADO UNIFICADA Y ESTRICTA ---
    const getCardStatus = (req) => {
        const total = req.checklist?.length || 0;
        const completed = req.checklist?.filter(t => t.completed).length || 0;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        const hasLink = !!(req.finalLink || req.link);

        // --- LOGICA DE GRABACION EN VIVO ---
        const now = new Date();
        const nowTime = now.getTime();
        let isRecordingNow = false;
        let hasFinishedRecordingToday = false;

        const recordings = req.recordings;
        if (recordings && Array.isArray(recordings) && recordings.length > 0) {
            isRecordingNow = recordings.some(rec => {
                if (!rec.date || !rec.startTime) return false;
                const startStr = `${rec.date}T${rec.startTime}:00`;
                const start = new Date(startStr);
                if (isNaN(start.getTime())) return false;

                if (rec.endTime) {
                    const endStr = `${rec.date}T${rec.endTime}:00`;
                    const end = new Date(endStr);
                    if (isNaN(end.getTime())) return false;
                    if (end.getTime() < start.getTime()) end.setDate(end.getDate() + 1);
                    return nowTime >= start.getTime() && nowTime <= end.getTime();
                } else {
                    const isSameDay = now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth() && now.getDate() === start.getDate();
                    return isSameDay && nowTime >= start.getTime();
                }
            });

            hasFinishedRecordingToday = recordings.some(rec => {
                if (!rec.date || !rec.endTime) return false;
                const endStr = `${rec.date}T${rec.endTime}:00`;
                const end = new Date(endStr);
                if (isNaN(end.getTime())) return false;
                if (rec.startTime) {
                    const startStr = `${rec.date}T${rec.startTime}:00`;
                    const start = new Date(startStr);
                    if (!isNaN(start.getTime()) && end.getTime() < start.getTime()) {
                        end.setDate(end.getDate() + 1);
                    }
                }
                return nowTime > end.getTime();
            });
        }

        let statusLabel = 'Solicitado';
        let statusColor = 'bg-gray-100 text-gray-500 border-gray-200';
        let barColor = 'bg-gray-200';

        if (req.status === 'Completado') {
            statusLabel = 'Completado';
            statusColor = 'bg-green-100 text-green-700 border-green-200';
            barColor = 'bg-green-500';
        } else if (hasLink && percent === 100) {
            // REGLA ESTRICTA: Link + 100% Checklist
            statusLabel = 'En Revisión';
            statusColor = 'bg-orange-100 text-orange-700 border-orange-200';
            barColor = 'bg-orange-500';
        } else if (isRecordingNow) {
            statusLabel = 'En Grabación';
            statusColor = 'bg-red-100 text-red-600 border border-red-200 animate-pulse';
            barColor = 'bg-red-500';
        } else if (req.status === 'En Proceso' || percent > 0 || hasFinishedRecordingToday) {
            statusLabel = 'En Proceso';
            statusColor = 'bg-blue-100 text-blue-700 border-blue-200';
            barColor = 'bg-blue-500';
        }

        return { statusLabel, statusColor, barColor, percent };
    };

    const renderRequestCard = (req) => {
        const { statusLabel, statusColor, barColor, percent } = getCardStatus(req);
        const finalLink = req.finalLink || req.link;

        return (
            <div key={req.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group animate-in fade-in zoom-in-95">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`p-1.5 rounded-lg ${req.type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                {req.type === 'video' ? <Video size={16} /> : <Image size={16} />}
                            </span>
                            <h3 onClick={() => navigate(`/solicitudes/${req.id}`)} className="font-bold text-gray-800 text-lg cursor-pointer hover:text-blue-600 transition-colors">
                                {req.title}
                            </h3>
                        </div>
                        <div className="ml-11 mb-3">
                            {finalLink ? (
                                <a href={finalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors">
                                    <ExternalLink size={14} /> Ver Entregable
                                </a>
                            ) : (
                                <span className="inline-flex items-center gap-2 text-sm text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                    <AlertCircle size={14} /> Sin entregable aún
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="md:w-1/3 flex flex-col justify-center border-l pl-0 md:pl-6 border-gray-100">
                            {user?.role !== 'solicitante' && (
                                <>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>
                                            {statusLabel}
                                        </span>
                                        <span className="text-xs font-bold text-gray-500">{percent}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percent}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 text-right">Progreso de Tareas</p>
                                </>
                            )}
                            {user?.role === 'solicitante' && (
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>
                                        {statusLabel}
                                    </span>
                                </div>
                            )}
                        </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando detalles de la campaña...</div>;
    if (!campaign) return <div className="p-10 text-center text-red-500">No se encontró la campaña.</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">

            {/* HEADER */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 mb-4 transition-colors font-medium">
                    <ArrowLeft size={18} /> Volver a Campañas
                </button>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{campaign.name}</h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Calendar size={14} /> Inicio: {campaign.startDate}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${campaign.status === 'activa' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {campaign.status}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{requests.length}</p>
                        <p className="text-xs text-gray-400 uppercase font-bold">Solicitudes</p>
                    </div>
                </div>
            </div>

            {/* SUB-GRUPOS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4 gap-4">
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"><Layers size={16} className="text-blue-600" /> Sub-grupos / Sub-campañas</h2>
                    
                    <div className="flex-1 max-w-xs relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                            type="text" 
                            value={subgroupSearch}
                            onChange={(e) => setSubgroupSearch(e.target.value)}
                            placeholder="Buscar sub-grupo..."
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                        />
                    </div>

                    {!isAddingSubGroup ? (
                        <button onClick={() => setIsAddingSubGroup(true)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1.5 whitespace-nowrap">
                            <Plus size={14} /> Añadir Sub-grupo
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                             <input 
                                type="text" 
                                value={newSubGroupName}
                                onChange={(e) => setNewSubGroupName(e.target.value)}
                                placeholder="Nombre del sub-grupo..."
                                className="text-xs border border-blue-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-100 w-48 font-medium"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && addSubGroup()}
                             />
                             <button onClick={addSubGroup} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"><Save size={14} /></button>
                             <button onClick={() => { setIsAddingSubGroup(false); setNewSubGroupName(""); }} className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"><X size={14} /></button>
                        </div>
                    )}
                </div>
                
                {campaign.subGroups && campaign.subGroups.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {campaign.subGroups
                            .filter(sg => sg.toLowerCase().includes(subgroupSearch.toLowerCase()))
                            .map((sg, i) => (
                            <div key={i} className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 group hover:border-blue-200 transition-colors">
                                <span className="opacity-50"><Layers size={10} /></span>
                                {editingSubGroup === sg ? (
                                    <div className="flex items-center gap-1 animate-in zoom-in-95">
                                        <input 
                                            type="text" 
                                            value={editSubGroupName}
                                            onChange={(e) => setEditSubGroupName(e.target.value)}
                                            className="bg-white border border-blue-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 w-32"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') renameSubGroup(sg);
                                                if (e.key === 'Escape') setEditingSubGroup(null);
                                            }}
                                        />
                                        <button onClick={() => renameSubGroup(sg)} className="text-blue-600 hover:text-blue-700"><Save size={14} /></button>
                                        <button onClick={() => setEditingSubGroup(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                    </div>
                                ) : (
                                    <>
                                        {sg}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                            <button 
                                                onClick={() => { setEditingSubGroup(sg); setEditSubGroupName(sg); }}
                                                className="text-slate-300 hover:text-blue-500 transition-colors"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => removeSubGroup(sg)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                         <p className="text-xs text-slate-400 font-medium italic">No hay sub-grupos definidos para esta campaña.</p>
                    </div>
                )}
            </div>

            {/* LISTA DE SOLICITUDES AGRUPADAS */}
            <div className="space-y-10">
                {campaign.subGroups && campaign.subGroups.length > 0 && campaign.subGroups
                    .filter(sg => sg.toLowerCase().includes(subgroupSearch.toLowerCase()))
                    .map((sgName, idx) => {
                    const sgRequests = requests.filter(r => r.subGroup === sgName);
                    if (sgRequests.length === 0) return null;
                    const isExpanded = expandedGroups.has(sgName);

                    return (
                        <div key={idx} className="space-y-4">
                            <div 
                                onClick={() => toggleGroup(sgName)}
                                className="flex items-center gap-3 px-2 cursor-pointer group"
                            >
                                <div className="h-px bg-slate-200 flex-1"></div>
                                <h2 className="text-sm font-bold text-slate-400 group-hover:text-blue-500 transition-colors uppercase tracking-[0.2em] flex items-center gap-2 whitespace-nowrap">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <Layers size={14} className="text-blue-500" /> {sgName}
                                </h2>
                                <div className="h-px bg-slate-200 flex-1"></div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{sgRequests.length}</span>
                            </div>
                            {isExpanded && (
                                <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 duration-300">
                                    {sgRequests.map(req => renderRequestCard(req))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* SOLICITUDES SIN SUB-GRUPO */}
                {(() => {
                    const generalReqs = requests.filter(r => !r.subGroup);
                    if (generalReqs.length === 0) return null;

                    return (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 px-2">
                                <div className="h-px bg-slate-200 flex-1"></div>
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 whitespace-nowrap">
                                    General / Principal
                                </h2>
                                <div className="h-px bg-slate-200 flex-1"></div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">{generalReqs.length}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {generalReqs.map(req => renderRequestCard(req))}
                            </div>
                        </div>
                    );
                })()}

                {requests.length === 0 && (
                    <div className="bg-white p-16 rounded-3xl text-center border border-dashed border-slate-200 shadow-inner">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 text-slate-300">
                             <AlertCircle size={32} />
                        </div>
                        <p className="text-slate-400 font-medium">No hay solicitudes vinculadas a esta campaña.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampaignDetail;
