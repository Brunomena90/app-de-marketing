import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, CheckCircle, Trash2, Plus, Link as LinkIcon, ExternalLink, FileDown, Edit2, Save, User, Calendar, Clock, PlayCircle, FileText, ChevronRight, Layers } from 'lucide-react';
import Accordion from '../components/Accordion';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';

const RequestDetail = ({ request: initialRequest, isOpen, onClose }) => {
    const { user, isSuperUser } = useAuth();

    const [request, setRequest] = useState(initialRequest);

    // Estados de datos
    const [checklist, setChecklist] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [linkInput, setLinkInput] = useState("");
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Estados para inputs editables
    const [editDeliveryDate, setEditDeliveryDate] = useState("");
    const [editRecordingStartDate, setEditRecordingStartDate] = useState("");
    const [editRecordingStartTime, setEditRecordingStartTime] = useState("");
    const [editRecordingEndDate, setEditRecordingEndDate] = useState("");
    const [editRecordingEndTime, setEditRecordingEndTime] = useState("");
    const [editRequestDate, setEditRequestDate] = useState("");
    const [activeCampaigns, setActiveCampaigns] = useState([]);
    const [recordings, setRecordings] = useState([]);

    // --- LÓGICA DE ROLES ---
    const normalize = (str) => str ? str.trim().toLowerCase() : '';

    const userRole = normalize(user?.role);
    const isAdmin = userRole === 'admin' || isSuperUser;
    const isEditor = userRole === 'editor';
    const isJefe = userRole === 'jefe';

    const canEdit = isAdmin || isEditor;
    const reqArea = normalize(request?.area);
    const userArea = normalize(user?.area);
    const canApprove = isAdmin || isEditor || (isJefe && reqArea === userArea);

    // --- SINCRONIZACIÓN ---
    useEffect(() => {
        setRequest(initialRequest);

        if (initialRequest) {
            setChecklist(initialRequest.checklist || []);

            const url = initialRequest.finalLink || initialRequest.link || "";
            setLinkInput(url);
            setIsEditingLink(!url);
            setEditedTitle(initialRequest.title || "");

            setEditDeliveryDate(initialRequest.deliveryDate || "");
            setEditRecordingStartDate(initialRequest.recordingStartDate || "");
            setEditRecordingStartTime(initialRequest.recordingStartTime || "");
            setEditRecordingEndDate(initialRequest.recordingEndDate || "");
            setEditRecordingEndTime(initialRequest.recordingEndTime || "");
            setEditRequestDate(initialRequest.requestDate || "");
            setRecordings(initialRequest.recordings || []);
        }
    }, [initialRequest]);

    useEffect(() => {
        if (isOpen && canEdit) {
            const q = query(collection(db, "campanas"), where("status", "==", "activa"));
            const unsub = onSnapshot(q, (snap) => {
                setActiveCampaigns(snap.docs.map(d => d.data().name));
            });
            return () => unsub();
        }
    }, [isOpen, canEdit]);

    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen || !request) return null;

    // --- FUNCIONES ---
    const ensureUrl = (url) => { if (!url) return ''; return url.startsWith('http') ? url : `https://${url}`; };
    const isValidUrl = (string) => { try { return Boolean(new URL(string)); } catch (e) { return false; } };

    const updateField = async (field, value) => {
        try {
            await updateDoc(doc(db, "solicitudes_contenido", request.id), { [field]: value });
            setRequest(prev => ({ ...prev, [field]: value }));

            if (field === 'deliveryDate') setEditDeliveryDate(value);
            if (field === 'recordingStartDate') setEditRecordingStartDate(value);
            if (field === 'recordingStartTime') setEditRecordingStartTime(value);
            if (field === 'recordingEndDate') setEditRecordingEndDate(value);
            if (field === 'recordingEndTime') setEditRecordingEndTime(value);
            if (field === 'requestDate') setEditRequestDate(value);

            toast.success("Campo actualizado");
        } catch (e) { toast.error("Error al actualizar"); }
    };

    const updateRecordingsDB = async (currentRecs) => {
        const filtered = currentRecs.filter(r => r.date || r.startTime || r.endTime);
        try {
            await updateDoc(doc(db, "solicitudes_contenido", request.id), { recordings: filtered });
            setRequest(prev => ({ ...prev, recordings: filtered }));
        } catch (e) { toast.error("Error al guardar fechas"); }
    };

    const saveChecklist = async (l) => { setChecklist(l); await updateDoc(doc(db, "solicitudes_contenido", request.id), { checklist: l }); setRequest(prev => ({ ...prev, checklist: l })); };

    const addTask = async () => { if (newTask.trim()) { const l = [...checklist, { text: newTask, completed: false, type: 'Solo Video' }]; await saveChecklist(l); setNewTask(""); } };
    const toggleTask = async (i) => { const l = [...checklist]; l[i].completed = !l[i].completed; await saveChecklist(l); };
    const deleteTask = async (i) => { const l = [...checklist]; l.splice(i, 1); await saveChecklist(l); };
    const changeTaskType = async (i, v) => { const l = [...checklist]; l[i].type = v; await saveChecklist(l); };

    const updateTaskText = (i, text) => {
        const l = [...checklist];
        l[i].text = text;
        setChecklist(l);
    };
    const saveTaskText = async () => {
        await updateDoc(doc(db, "solicitudes_contenido", request.id), { checklist: checklist });
    };

    // Función para auto-ajustar altura del textarea
    const autoResize = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const updateTitle = async () => { await updateDoc(doc(db, "solicitudes_contenido", request.id), { title: editedTitle }); setRequest(prev => ({ ...prev, title: editedTitle })); setIsEditingTitle(false); toast.success("Título actualizado"); };

    const approvePlan = () => {
        toast("¿Aprobar Plan?", {
            action: { label: "Aprobar", onClick: async () => { await updateDoc(doc(db, "solicitudes_contenido", request.id), { status: 'En Proceso', planApprovedBy: user.name }); setRequest(prev => ({ ...prev, status: 'En Proceso', planApprovedBy: user.name })); toast.success("Plan Aprobado"); } },
            cancel: { label: "Cancelar" }
        });
    };

    const saveLink = async () => {
        if (!isValidUrl(linkInput)) return toast.error("Link inválido (http/https)");
        await updateDoc(doc(db, "solicitudes_contenido", request.id), { finalLink: linkInput });
        setRequest(prev => ({ ...prev, finalLink: linkInput }));
        setIsEditingLink(false);
        toast.success("Guardado");
    };

    const approveFinal = () => {
        if (!request.finalLink && !linkInput) return toast.error("Falta link");
        toast("¿Finalizar Solicitud?", {
            action: { label: "Finalizar", onClick: async () => { await updateDoc(doc(db, "solicitudes_contenido", request.id), { status: 'Completado', finalApprovedBy: user.name }); setRequest(prev => ({ ...prev, status: 'Completado', finalApprovedBy: user.name })); toast.success("Finalizado"); setTimeout(onClose, 1000); } },
            cancel: { label: "Cancelar" }
        });
    };

    const handlePDF = () => {
        const doc = new jsPDF();

        // Header Minimalista (Sin franjas de color)
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); // Texto Negro
        doc.text("FICHA DE PROYECTO", 105, 20, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(`Versión: Actual | Generado el: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

        // Tabla de Datos Generales
        autoTable(doc, {
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
            head: [['DATOS GENERALES', '']],
            body: [
                ['Título', request.title],
                ['Solicitante', request.applicantName],
                ['Área', request.area],
                ['Estado', request.status],
                ['Fecha de Solicitud', request.requestDate || '-']
            ],
            styles: { fontSize: 10 }
        });

        // Aprobaciones
        const approvals = [];
        if (request.planApprovedBy) approvals.push(['Plan Aprobado por:', request.planApprovedBy]);
        if (request.finalApprovedBy) approvals.push(['Cierre Aprobado por:', request.finalApprovedBy]);
        if (approvals.length > 0) {
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                theme: 'plain',
                body: approvals,
                styles: { fontStyle: 'italic', textColor: [100, 100, 100], fontSize: 9 }
            });
        }

        // Briefing
        if (request.briefing) {
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                theme: 'plain',
                head: [['BRIEFING:']],
                body: [[request.briefing]],
                headStyles: { fontStyle: 'bold', textColor: [0, 0, 0] },
                styles: { cellPadding: 2, fontSize: 10 }
            });
        }

        // Checklist / Plan de Producción
        const rows = checklist.map(t => [t.completed ? 'OK' : 'PEND', t.text, t.type]);
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 10,
            theme: 'grid',
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            head: [['ESTADO', 'TAREA', 'TIPO']],
            body: rows.length ? rows : [['-', 'Sin tareas', '-']],
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35 }
            },
            styles: { fontSize: 9 }
        });

        // Pie de página
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Mod. MkT - Gestión de Solicitudes | Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        }

        doc.save(`Ficha_${request.title}.pdf`);
    };

    const isPlanApproved = request.status === 'En Proceso' || request.status === 'Completado';
    const isFinalApproved = request.status === 'Completado';
    const currentCampaign = request.campaign || request.campana || "";

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in" onClick={onClose}>

            <div className="bg-white w-full h-full md:h-[90vh] md:max-w-6xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative animate-in slide-in-from-bottom-10 md:zoom-in-95" onClick={(e) => e.stopPropagation()}>

                {/* HEADER */}
                {(() => {
                    const total = checklist?.length || 0;
                    const completed = checklist?.filter(t => t.completed).length || 0;
                    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
                    const hasLink = !!(request.finalLink || request.link);

                    const now = new Date();
                    const nowTime = now.getTime();
                    let isRecordingNow = false;
                    let hasFinishedRecordingToday = false;

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

                            const isSameDay = now.getFullYear() === end.getFullYear() && now.getMonth() === end.getMonth() && now.getDate() === end.getDate();
                            return isSameDay && nowTime > end.getTime();
                        });
                    }

                    let statusLabel = request.status || 'SOLICITADO';
                    let statusColor = 'bg-blue-100 text-blue-700';

                    if (isFinalApproved) {
                        statusLabel = 'COMPLETADO';
                        statusColor = 'bg-green-100 text-green-700';
                    } else if (hasLink && percent === 100) {
                        statusLabel = 'REVISIÓN';
                        statusColor = 'bg-orange-100 text-orange-700';
                    } else if (isRecordingNow) {
                        statusLabel = 'EN GRABACIÓN';
                        statusColor = 'bg-red-100 text-red-600 border border-red-200 animate-pulse';
                    } else if (request.status === 'En Proceso' || percent > 0 || hasFinishedRecordingToday) {
                        statusLabel = 'EN PROCESO';
                        statusColor = 'bg-blue-100 text-blue-700';
                    }

                    return (
                        <div className="px-4 md:px-8 py-4 md:py-5 border-b bg-white flex justify-between items-start shrink-0 z-50">
                            <div className="flex-1 pr-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider shadow-sm transition-all ${statusLabel === 'EN GRABACIÓN' ? 'bg-red-500 text-white animate-pulse' : statusColor}`}>
                                        {statusLabel}
                                    </span>
                                    {canEdit ? (
                                        <input
                                            type="date"
                                            value={editRequestDate}
                                            onChange={(e) => updateField('requestDate', e.target.value)}
                                            className="text-xs text-gray-500 border-b border-gray-300 focus:border-blue-400 outline-none bg-transparent px-1 py-0.5 rounded"
                                            title="Editar fecha de solicitud"
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={12} /> {request.requestDate || "-"}</span>
                                    )}
                                </div>
                                {isEditingTitle && canEdit ? (
                                    <div className="flex gap-2 items-center max-w-xl">
                                        <input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="text-lg md:text-xl font-bold border-b-2 border-blue-500 w-full outline-none" autoFocus />
                                        <button onClick={updateTitle} className="bg-blue-600 text-white p-1 rounded"><Save size={16} /></button>
                                        <button onClick={() => setIsEditingTitle(false)} className="text-gray-400"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 group">
                                        <h2 className="text-lg md:text-2xl font-bold text-gray-800 line-clamp-1">{request.title}</h2>
                                        {canEdit && <button onClick={() => setIsEditingTitle(true)} className="text-gray-300 hover:text-blue-600 md:opacity-0 group-hover:opacity-100"><Edit2 size={18} /></button>}
                                    </div>
                                )}
                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-red-100 hover:text-red-500 rounded-full cursor-pointer"><X size={24} /></button>
                        </div>
                    );
                })()}

                {/* BODY */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

                        {/* IZQUIERDA */}
                        <div className="lg:col-span-5 space-y-6">
                            <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 space-y-0">
                                <Accordion title="Información General" icon={User} defaultOpen={true}>
                                    <div className="flex items-start gap-3 mb-4">
                                        <div className="p-2 bg-gray-50 rounded-lg border border-gray-100"><User size={20} className="text-gray-400" /></div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{request.applicantName || "Usuario"}</p>
                                            <p className="text-xs text-gray-500">{request.area || "-"}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Campaña</span>
                                        {canEdit ? (
                                            <select value={currentCampaign} onChange={(e) => updateField('campaign', e.target.value)} className="w-full border border-purple-200 rounded px-2 py-1.5 text-sm bg-purple-50 text-purple-700 font-bold focus:ring-2 focus:ring-purple-200 outline-none">
                                                <option value="">-- Sin Campaña --</option>
                                                {activeCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
                                                {currentCampaign && !activeCampaigns.includes(currentCampaign) && <option value={currentCampaign}>{currentCampaign}</option>}
                                            </select>
                                        ) : (
                                            <div className="p-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold flex items-center gap-2 border border-purple-100 truncate">
                                                <PlayCircle size={14} />
                                                {request.subGroup ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="opacity-50 font-normal italic">{currentCampaign}</span>
                                                        <ChevronRight size={10} className="text-purple-300" />
                                                        {request.subGroup}
                                                    </span>
                                                ) : (currentCampaign || "Sin Campaña")}
                                            </div>
                                        )}
                                        {canEdit && request.subGroup && (
                                            <p className="text-[10px] text-purple-400 mt-1.5 pl-1 italic flex items-center gap-1">
                                                <Layers size={10} /> Sub-campaña: {request.subGroup}
                                            </p>
                                        )}
                                    </div>
                                </Accordion>

                                <Accordion title="Fechas" icon={Calendar} defaultOpen={true}>
                                    <div className="space-y-4">
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Entrega</span>
                                            {canEdit ? <input type="date" value={editDeliveryDate} onChange={(e) => updateField('deliveryDate', e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none" /> : <span className="font-medium text-sm">{request.deliveryDate || '-'}</span>}
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase">Grabación</span>
                                                {canEdit && <button onClick={() => setRecordings([...recordings, { date: '', startTime: '', endTime: '' }])} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md hover:bg-blue-100 flex items-center gap-1 transition-colors"><Plus size={12} /> Añadir</button>}
                                            </div>
                                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                                {recordings.length === 0 && !(request.recordingStartDate || request.recordingDate) && (
                                                    <span className="text-sm font-medium text-gray-500">-</span>
                                                )}
                                                {recordings.length === 0 && (request.recordingStartDate || request.recordingDate) && (
                                                    <div className="p-3 border rounded-lg border-dashed bg-gray-50 border-gray-200">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Legado (Rango)</p>
                                                        <p className="text-sm font-medium">Inicio: {request.recordingStartDate || request.recordingDate} {request.recordingStartTime || request.recordingTime || ''}</p>
                                                        {request.recordingEndDate && <p className="text-sm font-medium">Fin: {request.recordingEndDate} {request.recordingEndTime || ''}</p>}
                                                    </div>
                                                )}
                                                {recordings.map((rec, i) => (
                                                    <div key={i} className={`p-3 border rounded-lg relative group transition-colors ${canEdit ? 'bg-white border-blue-200 hover:border-blue-300 shadow-sm' : 'bg-gray-50 border-gray-100'}`}>
                                                        {canEdit && (
                                                            <button onClick={() => { const r = recordings.filter((_, idx) => idx !== i); setRecordings(r); updateRecordingsDB(r); }} className="absolute top-1 right-1 text-gray-300 hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100 bg-white hover:bg-red-50 rounded p-1"><X size={16} /></button>
                                                        )}
                                                        {canEdit ? (
                                                            <div className="flex flex-col gap-2 pr-5">
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Fecha</span>
                                                                    <input type="date" value={rec.date} onChange={e => { const r = [...recordings]; r[i].date = e.target.value; setRecordings(r); }} onBlur={() => updateRecordingsDB(recordings)} className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs sm:text-sm bg-gray-50 focus:bg-white focus:border-blue-300 outline-none" />
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Inicio</span>
                                                                        <input type="time" value={rec.startTime} onChange={e => { const r = [...recordings]; r[i].startTime = e.target.value; setRecordings(r); }} onBlur={() => updateRecordingsDB(recordings)} className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs sm:text-sm bg-gray-50 focus:bg-white focus:border-blue-300 outline-none" title="Hora Inicio" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Fin</span>
                                                                        <input type="time" value={rec.endTime} onChange={e => { const r = [...recordings]; r[i].endTime = e.target.value; setRecordings(r); }} onBlur={() => updateRecordingsDB(recordings)} className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-xs sm:text-sm bg-gray-50 focus:bg-white focus:border-blue-300 outline-none" title="Hora Fin" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-1"><Calendar size={14} className="text-blue-500" /> {rec.date || 'Sin fecha'}</span>
                                                                {(rec.startTime || rec.endTime) && (
                                                                    <span className="text-xs text-gray-600 font-medium flex items-center gap-1.5">
                                                                        <Clock size={12} className="text-gray-400" /> {rec.startTime || '?'} {rec.endTime ? `- ${rec.endTime}` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Accordion>

                                <Accordion title="Detalles" icon={FileText} defaultOpen={true}>
                                    <div className="space-y-4">
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Objetivo</span>
                                            {canEdit ? (
                                                <textarea value={request.objetivo || ""} onChange={e => setRequest(prev => ({ ...prev, objetivo: e.target.value }))} onBlur={e => updateField('objetivo', e.target.value)} onInput={autoResize} className="w-full text-sm bg-gray-50 focus:bg-white p-3 border border-gray-200 focus:border-blue-400 rounded-lg cursor-text outline-none resize-none overflow-hidden transition-colors" rows={1} placeholder="Añadir objetivo..." />
                                            ) : (
                                                <p className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">{request.objetivo || "No especificado"}</p>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Público</span>
                                                {canEdit ? (
                                                    <input value={request.publico || ""} onChange={e => setRequest(prev => ({ ...prev, publico: e.target.value }))} onBlur={e => updateField('publico', e.target.value)} className="w-full text-sm bg-gray-50 focus:bg-white p-2.5 border border-gray-200 focus:border-blue-400 rounded-lg outline-none transition-colors" placeholder="Añadir público..." />
                                                ) : (
                                                    <p className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">{request.publico || "-"}</p>
                                                )}
                                            </div>
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Formato</span>
                                                {canEdit ? (
                                                    <select value={request.format || "-"} onChange={e => updateField('format', e.target.value)} className="w-full text-sm bg-gray-50 focus:bg-white p-2.5 border border-gray-200 focus:border-blue-400 rounded-lg outline-none cursor-pointer transition-colors">
                                                        <option value="-">-</option>
                                                        <option value="Horizontal (16:9)">Horizontal (16:9)</option>
                                                        <option value="Vertical (9:16)">Vertical (9:16)</option>
                                                        <option value="Cuadrado (1:1)">Cuadrado (1:1)</option>
                                                    </select>
                                                ) : (
                                                    <p className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">{request.format || "-"}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1 flex justify-between">
                                                Briefing
                                                {canEdit && <span className="text-[9px] text-gray-400 lowercase font-normal italic">Editable</span>}
                                            </span>
                                            {canEdit ? (
                                                <textarea value={request.briefing || ""} onChange={e => setRequest(prev => ({ ...prev, briefing: e.target.value }))} onBlur={e => updateField('briefing', e.target.value)} onInput={autoResize} className="w-full text-sm bg-blue-50/50 text-blue-900 focus:bg-white p-3.5 border border-blue-200 focus:border-blue-400 rounded-lg outline-none resize-none transition-colors leading-relaxed" rows={4} placeholder="Escribe el briefing..." />
                                            ) : (
                                                <div className="bg-blue-50/50 p-3.5 rounded-lg text-sm text-blue-900 whitespace-pre-wrap border border-blue-100 leading-relaxed">{request.briefing || "Sin detalles"}</div>
                                            )}
                                        </div>
                                        {(request.copy || canEdit) && (
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Copy</span>
                                                {canEdit ? (
                                                    <textarea value={request.copy || ""} onChange={e => setRequest(prev => ({ ...prev, copy: e.target.value }))} onBlur={e => updateField('copy', e.target.value)} onInput={autoResize} className="w-full text-sm bg-gray-50 focus:bg-white p-3.5 border border-gray-200 focus:border-blue-400 rounded-lg outline-none italic resize-none transition-colors" rows={3} placeholder="Añadir copy..." />
                                                ) : (
                                                    <div className="bg-gray-50 p-3.5 rounded-lg text-sm italic border border-gray-200 text-gray-600">{request.copy}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Accordion>
                            </div>
                        </div>

                        {/* DERECHA */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="bg-white p-5 md:p-6 rounded-xl shadow-sm border border-gray-100 space-y-0">
                                <Accordion title="Plan de Producción" icon={CheckCircle} defaultOpen={true}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Progreso</span>
                                        <span className="text-xs bg-gray-100 px-2 py-1 rounded font-bold text-gray-600">{checklist.filter(t => t.completed).length}/{checklist.length}</span>
                                    </div>

                                    {canEdit && !isFinalApproved && (
                                        <div className="flex gap-2 mb-4">
                                            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Añadir tarea..." className="flex-1 border border-gray-200 bg-gray-50 hover:bg-white rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors" />
                                            <button onClick={addTask} className="bg-blue-600 shadow-sm text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"><Plus size={18} /></button>
                                        </div>
                                    )}

                                    <div className="space-y-3 md:space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                        {checklist.map((t, i) => (
                                            <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 border rounded-lg hover:border-blue-300 transition-colors group bg-white">
                                                {/* BLOQUE SUPERIOR (MÓVIL): CHECKBOX + TEXTO */}
                                                <div className="flex items-start gap-3 flex-1 w-full">
                                                    <button onClick={() => (canEdit || canApprove) && toggleTask(i)} className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-1.5 ${t.completed ? 'bg-green-500 border-green-500 text-white shadow-sm' : 'border-gray-300 bg-gray-50'} ${(canEdit || canApprove) ? 'cursor-pointer hover:border-green-400' : 'cursor-not-allowed'} transition-colors`}>
                                                        {t.completed && <CheckCircle size={12} />}
                                                    </button>

                                                    <div className="flex-1 min-w-0">
                                                        {canEdit ? (
                                                            <textarea
                                                                value={t.text}
                                                                onChange={(e) => {
                                                                    updateTaskText(i, e.target.value);
                                                                    autoResize(e);
                                                                }}
                                                                onBlur={saveTaskText}
                                                                rows={1}
                                                                spellCheck={true}
                                                                lang="es-PE"
                                                                className={`text-sm w-full bg-transparent outline-none border-b border-transparent focus:border-blue-300 break-words whitespace-normal resize-none overflow-hidden transition-colors ${t.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}
                                                                style={{ minHeight: '1.5rem' }}
                                                            />
                                                        ) : (
                                                            <span className={`text-sm break-words whitespace-normal block ${t.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                                                {t.text}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* BLOQUE INFERIOR (MÓVIL): CONTROLES */}
                                                <div className="flex items-center justify-end gap-2 w-full sm:w-auto pl-8 sm:pl-0">
                                                    <select disabled={!canEdit} value={t.type} onChange={(e) => changeTaskType(i, e.target.value)} className="text-xs border rounded-md px-2 py-1 bg-gray-50 focus:bg-white outline-none w-full sm:w-28 disabled:opacity-50 h-8 cursor-pointer hover:border-gray-300 transition-colors">
                                                        <option>Solo Video</option><option>Voz en Off</option><option>Escena Compuesta</option><option>Imagen</option><option>Diseño</option><option>Foto</option><option>Texto en Pantalla</option><option>Animación</option>
                                                    </select>

                                                    {canEdit && !isFinalApproved && (
                                                        <button onClick={() => deleteTask(i)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded p-1.5 h-8 w-8 flex items-center justify-center">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {canApprove && (
                                        <div className="mt-6">
                                            <button onClick={!isPlanApproved ? approvePlan : undefined} disabled={isPlanApproved} className={`w-full py-3 rounded-lg text-sm font-bold flex justify-center items-center gap-2 transition-all ${isPlanApproved ? 'bg-green-100 text-green-700 border border-green-200 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}>{isPlanApproved ? <><CheckCircle size={18} /> Plan Aprobado</> : "Aprobar Plan de Producción"}</button>
                                            {isPlanApproved && request.planApprovedBy && <p className="text-[10px] text-center text-gray-400 mt-2 uppercase tracking-wide">Aprobado por: <span className="font-bold text-gray-600">{request.planApprovedBy}</span></p>}
                                        </div>
                                    )}
                                </Accordion>

                                <Accordion title="Entregable Final" icon={LinkIcon} defaultOpen={true}>
                                    {!isEditingLink && (request.finalLink || request.link) ? (
                                        <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg gap-3 overflow-hidden transition-colors hover:bg-green-100/50">
                                            <ExternalLink size={18} className="text-green-600 flex-shrink-0" />
                                            <a href={ensureUrl(request.finalLink || request.link)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium text-green-800 hover:text-green-900 hover:underline truncate">Link del Entregable</a>
                                            {canEdit && <button onClick={() => setIsEditingLink(true)} className="text-xs font-bold text-green-600 bg-green-100 hover:bg-green-200 px-2 py-1 rounded transition-colors flex-shrink-0">Editar</button>}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            {canEdit ? (
                                                <>
                                                    <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="https://..." className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 min-w-0 bg-gray-50 focus:bg-white transition-colors" />
                                                    <button onClick={saveLink} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black shadow-sm transition-colors">Guardar</button>
                                                </>
                                            ) : (
                                                <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-400 w-full text-center italic border border-dashed border-gray-200">Esperando carga de entregable...</div>
                                            )}
                                        </div>
                                    )}
                                    {canApprove && (
                                        <div className="mt-6 pt-4 border-t border-gray-100">
                                            <button onClick={!isFinalApproved ? approveFinal : undefined} disabled={isFinalApproved} className={`w-full py-3.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-all ${isFinalApproved ? 'bg-green-600 text-white cursor-default shadow-lg ring-4 ring-green-100' : 'bg-gray-900 hover:bg-black text-white shadow-lg'}`}>{isFinalApproved ? <><CheckCircle size={20} /> Solicitud Finalizada</> : <><CheckCircle size={20} /> Aprobar y Cerrar Solicitud</>}</button>
                                            {isFinalApproved && request.finalApprovedBy && <p className="text-[10px] text-center text-gray-400 mt-2 uppercase tracking-wide">Cierre por: <span className="font-bold text-gray-600">{request.finalApprovedBy}</span></p>}
                                        </div>
                                    )}
                                </Accordion>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 md:px-8 py-4 border-t bg-gray-50 flex justify-end shrink-0"><button onClick={handlePDF} className="flex items-center gap-2 text-gray-600 hover:bg-white px-4 py-2 rounded-lg border border-transparent hover:border-gray-200 transition-all text-sm font-medium"><FileDown size={16} /> <span className="hidden sm:inline">Exportar Ficha</span> PDF</button></div>
            </div>
        </div>,
        document.body
    );
};

export default RequestDetail;
