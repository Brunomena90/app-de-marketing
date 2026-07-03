import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Trash2, Plus, Link as LinkIcon, ExternalLink, FileDown, Edit2, Save, User, Calendar, Clock, PlayCircle, Layers, GripVertical, Megaphone, X, History, PanelLeftClose, PanelLeftOpen, Archive, RefreshCcw, RotateCcw, FileText, Lock, MessageSquare, ChevronRight, Search, ChevronDown } from 'lucide-react';
import Accordion from '../components/Accordion';
import { doc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, where } from 'firebase/firestore';

import { db } from '../firebase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import CampaignSelectorModal from '../components/CampaignSelectorModal';

// --- SUB-COMPONENTE: TEXTAREA AUTO-AJUSTABLE ---
const AutoResizeTextarea = ({ value, onChange, onBlur, disabled, isCompleted }) => {
    const textareaRef = useRef(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            const el = textareaRef.current;
            const container = el.closest('.overflow-y-auto') || el.closest('.overflow-auto');
            const containerScrollTop = container ? container.scrollTop : 0;
            const windowScrollY = window.scrollY;

            el.style.height = 'auto';
            el.style.height = `${Math.max(el.scrollHeight, 24)}px`;

            // Restore scroll positions to prevent jumping on mobile
            if (container && container.scrollTop !== containerScrollTop) {
                container.scrollTop = containerScrollTop;
            }
            if (window.scrollY !== windowScrollY) {
                window.scrollTo(window.scrollX, windowScrollY);
            }
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            rows={1}
            spellCheck={true}
            lang="es-PE"
            className={`text-sm w-full bg-transparent outline-none border-b border-transparent focus:border-blue-300 resize-none overflow-hidden block transition-all ${isCompleted ? 'line-through text-gray-400' : 'text-gray-700'
                }`}
            style={{ minHeight: '24px', lineHeight: '1.5' }}
        />
    );
};

const RequestDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, hasGlobalAccess, isAdmin } = useAuth();

    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);

    const [checklist, setChecklist] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [linkInput, setLinkInput] = useState("");
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    const [editDeliveryDate, setEditDeliveryDate] = useState("");
    const [recordings, setRecordings] = useState([]);
    const [postRecordings, setPostRecordings] = useState([]);
    const [activeCampaigns, setActiveCampaigns] = useState([]);
    const [areas, setAreas] = useState([]);

    // Estado para el Drag and Drop
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    // Estado para Menú de Exportación
    const [showExportMenu, setShowExportMenu] = useState(false);
    // Estado para Modo Compacto (Ocultar info general)
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [editRequestDate, setEditRequestDate] = useState(""); // Nuevo estado para fecha de solicitud
    const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
    const [reopenReason, setReopenReason] = useState("");
    const [isReopening, setIsReopening] = useState(false);
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
    
    // Novedades: Modo producción
    const [isProductionMode, setIsProductionMode] = useState(false);

    const normalize = (str) => str ? str.trim().toLowerCase() : '';
    const userRole = normalize(user?.role);
    const isEditor = userRole === 'editor';
    const isJefe = userRole === 'jefe';
    const canEdit = isAdmin || isEditor;

    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, "solicitudes_contenido", id), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                
                // --- VERIFICACIÓN DE SEGURIDAD (ROLES) ---
                const userRole = user?.role?.toLowerCase();
                const isRestrictedRole = userRole === 'jefe';
                if (isRestrictedRole) {
                    const reqArea = (data.area || "").toLowerCase();
                    const accessibleAreas = [
                        ...(user?.area ? [user.area.toLowerCase()] : []),
                        ...(Array.isArray(user?.areas) ? user.areas.map(a => a.toLowerCase()) : [])
                    ];

                    if (!accessibleAreas.includes(reqArea)) {
                        toast.error("No tienes permiso para ver esta solicitud");
                        navigate('/solicitudes');
                        return;
                    }
                }

                setRequest(data);
                // Solo actualizamos checklist si NO estamos arrastrando para evitar conflictos visuales
                if (draggedItemIndex === null) {
                    setChecklist(data.checklist || []);
                }
                // Solo actualizamos el título si NO estamos editándolo para que no salte el cursor
                if (!isEditingTitle) {
                    setEditedTitle(data.title || "");
                }

                if (!linkInput) {
                    const url = data.finalLink || data.link || "";
                    setLinkInput(url);
                    setIsEditingLink(!url);
                }
                if (!editDeliveryDate) setEditDeliveryDate(data.deliveryDate || "");
                setRecordings(data.recordings || []);
                setPostRecordings(data.postRecordings || []);
                if (!editRequestDate || editRequestDate === "") setEditRequestDate(data.requestDate || "");
                
                // Sincronizar Modo Producción persistente
                setIsProductionMode(!!data.isProductionMode);
            } else {
                toast.error("Solicitud no encontrada");
                navigate('/solicitudes');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, navigate, draggedItemIndex, isEditingTitle, user]); 

    useEffect(() => {
        if (canEdit && request) {
            // Usamos la empresa específica de la solicitud, o GRUCOIN por defecto
            const reqEmpresa = request.empresa || 'GRUCOIN';

            // Consulta de Campañas filtrada por la empresa DE LA SOLICITUD
            const qCamp = query(
                collection(db, "campanas"), 
                where("empresa", "==", reqEmpresa), 
                orderBy("createdAt", "desc")
            );

            const unsubCamp = onSnapshot(qCamp, (snap) => {
                const activeOnly = snap.docs.map(d => d.data()).filter(c => c.status === 'activa').map(c => c.name);
                setActiveCampaigns(activeOnly);
            });

            // Consulta de Áreas filtrada por la empresa DE LA SOLICITUD
            const qAreas = query(
                collection(db, "areas"), 
                where("empresaName", "==", reqEmpresa), 
                orderBy("name")
            );

            const unsubAreas = onSnapshot(qAreas, (snap) => {
                setAreas(snap.docs.map(d => d.data()));
            });
            return () => { unsubCamp(); unsubAreas(); };
        }
    }, [canEdit, request?.empresa]); // Cambiado activeEmpresa por request.empresa

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando información...</div>;
    if (!request) return null;

    const reqArea = normalize(request.area);
    const userArea = normalize(user?.area);
    const canApprove = isAdmin || isEditor || (isJefe && reqArea === userArea);
    const isPlanApproved = request.status && (request.status === 'En Proceso' || request.status.startsWith('Completado'));
    const canModifyPlan = !isPlanApproved; // CUALQUIER USUARIO puede modificar si no está bloqueado
    const canLockPlan = isAdmin || isEditor; // SOLO Admin/Editor pueden bloquear

    // Logic for Deliverable Approval
    const canApproveDeliverable = isAdmin || isEditor || isJefe; // Admin, Editor, or ANY Jefe can approve deliverable
    const canCloseRequest = isAdmin || isEditor; // Only Admin/Editor can close
    const hasUserApprovedDeliverable = request.deliverableApprovals?.some(ap => ap.uid === user?.uid);

    const isFinalApproved = request.status && request.status.startsWith('Completado');
    const currentCampaign = request.campaign || request.campana || "";

    let isPostProductionNow = false;
    const postRecs = request.postRecordings || [];
    if (postRecs.length > 0) {
        isPostProductionNow = postRecs.some(rec => {
            if (!rec.date || !rec.startTime || !rec.endTime) return false;
            const now = new Date();
            const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            if (rec.date !== dateStr) return false;
            
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const [startH, startM] = rec.startTime.split(':').map(Number);
            const [endH, endM] = rec.endTime.split(':').map(Number);
            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            
            return currentTime >= startMins && currentTime <= endMins;
        });
    }

    const isPostProdActive = !!request.inPostProduction || isPostProductionNow;

    const ensureUrl = (url) => { if (!url) return ''; return url.startsWith('http') ? url : `https://${url}`; };
    const isValidUrl = (string) => { try { return Boolean(new URL(string)); } catch (e) { return false; } };

    const updateField = async (field, value) => {
        try { 
            const updateData = { [field]: value };
            // Si actualizamos campaña y no viene subGrupo, reseteamos el subGrupo
            if (field === 'campaign' && !('subGroup' in updateData)) {
                updateData.subGroup = null;
            }
            await updateDoc(doc(db, "solicitudes_contenido", request.id), updateData); 
            toast.success("Actualizado"); 
        } catch (e) { toast.error("Error"); }
    };

    const handleSelectCampaign = async (campName, subName) => {
        try {
            await updateDoc(doc(db, "solicitudes_contenido", request.id), { 
                campaign: campName || null,
                subGroup: subName || null
            });
            toast.success("Campaña actualizada");
            setIsCampaignModalOpen(false);
        } catch (e) {
            toast.error("Error al actualizar");
        }
    };

    const handlePostProductionToggle = async (checked) => {
        try {
            const dataToUpdate = { inPostProduction: checked };
            await updateDoc(doc(db, "solicitudes_contenido", request.id), dataToUpdate);
            toast.success(checked ? "Post producción iniciada" : "Post producción desmarcada");
        } catch (e) { toast.error("Error"); }
    };

    const handlePostProductionFinish = async (checked) => {
        try {
            const dataToUpdate = { postProductionFinished: checked };
            await updateDoc(doc(db, "solicitudes_contenido", request.id), dataToUpdate);
            toast.success(checked ? "Post producción finalizada" : "Fin de post producción desmarcado");
        } catch (e) { toast.error("Error"); }
    };

    const toggleProductionMode = async () => {
        if (!canEdit) {
            toast.error("No tienes permisos para cambiar el modo producción");
            return;
        }
        try {
            const newMode = !isProductionMode;
            await updateDoc(doc(db, "solicitudes_contenido", id), {
                isProductionMode: newMode
            });
            toast.success(newMode ? "Modo producción activado" : "Modo producción desactivado");
        } catch (e) {
            toast.error("Error al actualizar");
        }
    };

    const updateRecordingsDB = async (currentRecs) => {
        const filtered = currentRecs.filter(r => r.date || r.startTime || r.endTime);
        try {
            await updateDoc(doc(db, "solicitudes_contenido", request.id), { recordings: filtered });
            setRequest(prev => ({ ...prev, recordings: filtered }));
        } catch (e) { toast.error("Error al guardar fechas de grabación"); }
    };

    const updatePostRecordingsDB = async (currentRecs) => {
        const filtered = currentRecs.filter(r => r.date || r.startTime || r.endTime);
        try {
            await updateDoc(doc(db, "solicitudes_contenido", request.id), { postRecordings: filtered });
            setRequest(prev => ({ ...prev, postRecordings: filtered }));
        } catch (e) { toast.error("Error al guardar fechas de post-producción"); }
    };

    // --- LÓGICA DE DRAG AND DROP ---
    const handleDragStart = (e, index) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnter = (e, index) => {
        if (draggedItemIndex === null || draggedItemIndex === index) return;
        const newList = [...checklist];
        const itemToMove = newList[draggedItemIndex];
        newList.splice(draggedItemIndex, 1);
        newList.splice(index, 0, itemToMove);
        setDraggedItemIndex(index);
        setChecklist(newList);
    };

    const handleDragEnd = async () => {
        setDraggedItemIndex(null);
        try { await updateDoc(doc(db, "solicitudes_contenido", request.id), { checklist: checklist }); }
        catch (error) { toast.error("Error al guardar el orden"); }
    };

    const saveChecklist = async (l) => { setChecklist(l); await updateDoc(doc(db, "solicitudes_contenido", request.id), { checklist: l }); };
    const addTask = async () => { if (newTask.trim()) { const l = [...checklist, { text: newTask, completed: false, type: 'Solo Video' }]; await saveChecklist(l); setNewTask(""); } };
    const toggleTask = async (i) => { const l = [...checklist]; l[i].completed = !l[i].completed; await saveChecklist(l); };
    const deleteTask = async (i) => { const l = [...checklist]; l.splice(i, 1); await saveChecklist(l); };
    const changeTaskType = async (i, v) => { const l = [...checklist]; l[i].type = v; await saveChecklist(l); };

    const updateTaskText = (i, text) => { const l = [...checklist]; l[i].text = text; setChecklist(l); };
    const saveTaskText = async () => { await updateDoc(doc(db, "solicitudes_contenido", request.id), { checklist: checklist }); };

    const updateTitle = async () => { await updateDoc(doc(db, "solicitudes_contenido", request.id), { title: editedTitle }); setIsEditingTitle(false); toast.success("Título actualizado"); };
    const togglePlanLock = () => {
        if (isPlanApproved) {
            toast("¿Desbloquear Plan de Producción?", {
                description: "El plan volverá a ser editable para todos los usuarios.",
                action: {
                    label: "Desbloquear",
                    onClick: async () => {
                        await updateDoc(doc(db, "solicitudes_contenido", request.id), { status: 'Solicitado', planApprovedBy: null });
                        toast.success("Plan Desbloqueado");
                    }
                },
                cancel: { label: "Cancelar" }
            });
        } else {
            toast("¿Bloquear Plan de Producción?", {
                description: "El plan pasará a estado 'En Proceso' y ya no será editable.",
                action: {
                    label: "Bloquear",
                    onClick: async () => {
                        await updateDoc(doc(db, "solicitudes_contenido", request.id), { status: 'En Proceso', planApprovedBy: user.name });
                        toast.success("Plan Bloqueado");
                    }
                },
                cancel: { label: "Cancelar" }
            });
        }
    };

    const saveLink = async () => { if (!isValidUrl(linkInput)) return toast.error("Link inválido"); await updateDoc(doc(db, "solicitudes_contenido", request.id), { finalLink: linkInput }); setIsEditingLink(false); toast.success("Guardado"); };

    const handleApproveDeliverable = async () => {
        try {
            const approvalData = {
                name: user.name || "Usuario",
                role: user.role || "unknown",
                uid: user.uid || "unknown",
                date: new Date().toISOString()
            };
            const currentApprovals = request.deliverableApprovals || [];
            // Optimistic update prevention handled by UI, but double check
            if (currentApprovals.some(ap => ap.uid === user.uid)) return;

            await updateDoc(doc(db, "solicitudes_contenido", request.id), {
                deliverableApprovals: [...currentApprovals, approvalData]
            });
            toast.success("Has aprobado el entregable");
        } catch (error) {
            console.error(error);
            toast.error("Error al aprobar");
        }
    };

    const handleCloseRequest = () => {
        if (!request.finalLink && !linkInput) return toast.error("Falta link");
        toast("¿Cerrar Solicitud?", {
            description: "La solicitud pasará a estado Completado.",
            action: {
                label: "Cerrar",
                onClick: async () => {
                    await updateDoc(doc(db, "solicitudes_contenido", request.id), {
                        status: 'Completado',
                        finalApprovedBy: user.name,
                        completedAt: new Date().toISOString()
                    });
                    toast.success("Solicitud Cerrada");
                    navigate('/solicitudes');
                }
            },
            cancel: { label: "Cancelar" }
        });
    };

    const handleReopenRequest = async () => {
        if (!reopenReason.trim()) return toast.error("El motivo es obligatorio");

        setIsReopening(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            // 1. Crear el Clon con el motivo en el briefing
            const newBriefing = (request.briefing || "") +
                "\n\n--- MOTIVO DE REAPERTURA ---\n" +
                reopenReason;

            const cloneData = {
                ...request,
                title: request.title,
                requestDate: todayStr,
                createdAt: new Date().toISOString(),
                status: 'Solicitado',
                applicantName: user.name,
                applicantId: user.uid,
                planApprovedBy: null,
                finalApprovedBy: null,
                completedAt: null,
                finalLink: null,
                deliverableApprovals: [],
                planVersions: [],
                reopenedFrom: request.id,
                briefing: newBriefing
            };
            delete cloneData.id;

            const docRef = await addDoc(collection(db, "solicitudes_contenido"), cloneData);

            // 2. Marcar la Original como Re-editada
            await updateDoc(doc(db, "solicitudes_contenido", request.id), {
                status: 'Completado (Re-editada)',
                reopenedAs: docRef.id,
                reopenReason: reopenReason
            });

            toast.success("Solicitud reabierta con éxito");
            setIsReopenModalOpen(false);
            setReopenReason("");
            navigate(`/solicitudes/${docRef.id}`);
        } catch (error) {
            console.error(error);
            toast.error("Error al reabrir la solicitud");
        } finally {
            setIsReopening(false);
        }
    };

    const handleArchive = async () => {
        try {
            await updateDoc(doc(db, "solicitudes_contenido", request.id), { archived: true });
            toast.success("Solicitud archivada");
            navigate('/solicitudes');
        } catch (e) { toast.error("Error al archivar"); }
    };

    const handleUnarchive = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            await updateDoc(doc(db, "solicitudes_contenido", request.id), {
                archived: false,
                requestDate: today
            });
            toast.success("Solicitud desarchivada con fecha de hoy");
            navigate('/solicitudes');
        } catch (e) { toast.error("Error al desarchivar"); }
    };

    const handleSaveVersion = async () => {
        try {
            const currentVersions = request.planVersions || [];
            const nextVersion = currentVersions.length + 1;
            const newVersion = {
                version: nextVersion,
                label: `V${nextVersion}`,
                checklist: checklist, // Snapshot current state
                savedBy: user.name,
                date: new Date().toISOString()
            };
            await updateDoc(doc(db, "solicitudes_contenido", request.id), {
                planVersions: [newVersion, ...currentVersions]
            });
            toast.success(`Versión ${nextVersion} guardada`);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar versión");
        }
    };

    const handleDeleteVersion = async (e, index) => {
        e.stopPropagation(); // Avoid triggering the PDF generation
        try {
            const currentVersions = [...(request.planVersions || [])];
            const versionToDelete = currentVersions[index];

            toast(`¿Eliminar Versión ${versionToDelete.label}?`, {
                description: "Esta acción no se puede deshacer.",
                action: {
                    label: "Eliminar",
                    onClick: async () => {
                        currentVersions.splice(index, 1);
                        await updateDoc(doc(db, "solicitudes_contenido", request.id), {
                            planVersions: currentVersions
                        });
                        toast.success(`Versión ${versionToDelete.label} eliminada`);
                    }
                },
                cancel: { label: "Cancelar" }
            });
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar versión");
        }
    };

    const handlePDF = (targetChecklist = null, versionLabel = "") => {
        const finalChecklist = targetChecklist || checklist;
        const titleSuffix = versionLabel ? `_${versionLabel}` : "";

        const doc = new jsPDF();

        // Header Minimalista (Sin franjas de color)
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); // Texto Negro
        doc.text("FICHA DE PROYECTO", 105, 20, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        const versionText = versionLabel ? `Versión: ${versionLabel}` : "Versión: Actual";
        doc.text(`${versionText} | Generado el: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

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
        const rows = finalChecklist.map(t => [t.completed ? 'OK' : 'PEND', t.text, t.type]);
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
            doc.text(`GCI - Gestión de Solicitudes | Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
        }

        doc.save(`Ficha_${request.title}${titleSuffix}.pdf`);
        setShowExportMenu(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24 md:pb-12">
            {/* Top App Bar (Sticky) */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between px-4 py-3 md:px-8 gap-3">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={() => navigate('/solicitudes')} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 active:scale-95 transition-all outline-none">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Detalles de Solicitud</span>
                            {request.archived ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider bg-slate-600 text-white flex items-center gap-1 shadow-sm"><Archive size={10} /> ARCHIVADO</span>
                            ) : (() => {
                                const total = checklist?.length || 0;
                                const completed = checklist?.filter(t => t.completed).length || 0;
                                const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
                                const hasLink = !!(request.finalLink || request.link);
                                
                                const now = new Date();
                                const nowTime = now.getTime();
                                let isRecordingNow = false;
                                let hasFinishedRecordingToday = false;

                                const recs = request.recordings || [];
                                if (recs.length > 0) {
                                    isRecordingNow = recs.some(rec => {
                                        if (!rec.date || !rec.startTime) return false;
                                        const startStr = `${rec.date}T${rec.startTime}:00`;
                                        const start = new Date(startStr);
                                        if (isNaN(start.getTime())) return false;
                                        if (rec.endTime) {
                                            const endStr = `${rec.date}T${rec.endTime}:00`;
                                            const end = new Date(endStr);
                                            if (end.getTime() < start.getTime()) end.setDate(end.getDate() + 1);
                                            return !isNaN(end.getTime()) && nowTime >= start.getTime() && nowTime <= end.getTime();
                                        }
                                        const isSameDay = now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth() && now.getDate() === start.getDate();
                                        return isSameDay && nowTime >= start.getTime();
                                    });

                                    hasFinishedRecordingToday = recs.some(rec => {
                                        if (!rec.date || !rec.endTime) return false;
                                        const endStr = `${rec.date}T${rec.endTime}:00`;
                                        const end = new Date(endStr);
                                        if (rec.startTime) {
                                            const startStr = `${rec.date}T${rec.startTime}:00`;
                                            const start = new Date(startStr);
                                            if (!isNaN(start.getTime()) && end.getTime() < start.getTime()) {
                                                end.setDate(end.getDate() + 1);
                                            }
                                        }
                                        return !isNaN(end.getTime()) && nowTime > end.getTime();
                                    });
                                }

                                let statusLabel = request.status || 'SOLICITADO';
                                let statusColorClass = isFinalApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200';

                                if (isFinalApproved) {
                                    statusLabel = 'COMPLETADO';
                                } else if (hasLink && percent === 100) {
                                    statusLabel = 'REVISIÓN';
                                    statusColorClass = 'bg-orange-100 text-orange-700 border-orange-200';
                                } else if (request.postProductionFinished) {
                                    statusLabel = 'POST PRODUCCIÓN (FIN)';
                                    statusColorClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                                } else if (isPostProdActive) {
                                    statusLabel = 'EN POST PRODUCCIÓN';
                                    statusColorClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
                                } else if (isRecordingNow) {
                                    statusLabel = 'EN GRABACIÓN';
                                    statusColorClass = 'bg-red-500 text-white border-red-600 animate-pulse';
                                } else if (request.status === 'En Proceso' || percent > 0 || hasFinishedRecordingToday) {
                                    statusLabel = 'EN PROCESO';
                                }

                                return (
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold tracking-wider shadow-sm border transition-all ${statusLabel === 'EN GRABACIÓN' ? 'bg-red-500 text-white border-red-600 animate-pulse' : statusColorClass}`}>
                                            {isFinalApproved ? <CheckCircle size={10} /> : null}
                                            {statusLabel}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                        {isEditingTitle && canEdit ? (
                            <div className="flex gap-2 items-center">
                                <input
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    className="text-lg md:text-xl font-bold bg-transparent border-b-2 border-blue-500 w-full outline-none text-slate-800"
                                    autoFocus spellCheck={true} lang="es-PE"
                                />
                                <button onClick={updateTitle} className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors"><Save size={16} /></button>
                                <button onClick={() => setIsEditingTitle(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-1.5 rounded-lg transition-colors"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight truncate">{request.title}</h1>
                                {canEdit && <button onClick={() => setIsEditingTitle(true)} className="text-slate-300 hover:text-blue-600 md:opacity-0 group-hover:opacity-100 transition-opacity p-1"><Edit2 size={16} /></button>}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3">
                    {/* Botón de Modo Producción: Solo visible/interactivo para superusuario/admin/editor si se quiere toggle, pero visible para todos si ya está activo */}
                    {(canEdit || isProductionMode) && (
                        <button 
                            onClick={toggleProductionMode}
                            disabled={!canEdit}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${isProductionMode ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                        >
                            {isProductionMode ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                            {isProductionMode ? 'Salir de Producción' : 'Modo Producción'}
                        </button>
                    )}
                    <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <Calendar size={14} className="text-slate-500" />
                        {canEdit ? (
                            <input
                                type="date"
                                value={editRequestDate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEditRequestDate(val);
                                    updateField('requestDate', val);
                                }}
                                className="text-xs border-none bg-transparent outline-none text-slate-700 font-bold p-0 min-w-[100px]"
                            />
                        ) : (
                            <span className="text-xs text-slate-700 font-bold">{request.requestDate || "-"}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    {/* LEFT COLUMN: Data View (Hidden in Production Mode) */}
                    {!isProductionMode && (
                        <div className="lg:col-span-5 flex flex-col gap-6 animate-in slide-in-from-left-4 duration-300">
                        
                        {/* Solicitante y Organización */}
                        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={14} /> Solicitante</h2>
                            <div className="flex items-center gap-4 mb-5">
                                <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-inner">
                                    {request.applicantName ? request.applicantName.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-slate-800 line-clamp-1">{request.applicantName || "Usuario"}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Layers size={14} className="text-slate-400" />
                                        {canEdit ? (
                                            <select value={request.area || ""} onChange={(e) => updateField('area', e.target.value)} className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none focus:border-blue-400 w-full max-w-[180px]">
                                                <option value="">-- Seleccionar Área --</option>
                                                {areas.map((a, i) => (<option key={i} value={a.name}>{a.name}</option>))}
                                                {request.area && !areas.some(a => a.name === request.area) && <option value={request.area}>{request.area}</option>}
                                            </select>
                                        ) : (
                                            <p className="text-xs font-semibold text-slate-600">{request.area || "-"}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Megaphone size={12} /> Campaña Asignada</span>
                                {canEdit ? (
                                    <>
                                        <div 
                                            onClick={() => setIsCampaignModalOpen(true)}
                                            className="w-full border shadow-sm border-purple-200 rounded-xl px-3 py-2.5 text-sm bg-purple-50 text-purple-700 font-bold focus:ring-2 focus:ring-purple-200 outline-none transition-all cursor-pointer hover:bg-purple-100 flex items-center justify-between group"
                                        >
                                            <span className="truncate flex-1">
                                                {request.campaign || "Sin Campaña"}
                                                {request.subGroup && <span className="text-[10px] opacity-70 ml-2 border-l border-purple-300 pl-2">Grupo: {request.subGroup}</span>}
                                            </span>
                                            <ChevronRight size={16} className="text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                        <CampaignSelectorModal 
                                            isOpen={isCampaignModalOpen} 
                                            onClose={() => setIsCampaignModalOpen(false)} 
                                            onSelect={handleSelectCampaign}
                                            activeEmpresa={request.empresa || 'GRUCOIN'}
                                            selectedCampaign={request.campaign}
                                            selectedSubGroup={request.subGroup}
                                        />
                                    </>
                                ) : (
                                    <div className="p-3 bg-purple-50 text-purple-700 rounded-xl text-sm font-bold flex flex-col gap-0.5 border border-purple-100/50 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <PlayCircle size={16} /> <span className="truncate">{request.campaign || "Sin Campaña"}</span>
                                        </div>
                                        {request.subGroup && (
                                            <div className="text-[10px] text-purple-600 font-bold uppercase tracking-wider pl-6 mt-1 flex items-center gap-1">
                                                <Layers size={10} /> Grupo: {request.subGroup}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tiempos y Fechas */}
                        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Calendar size={14} /> Cronograma</h2>
                            <div className="space-y-5">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><FileDown size={12}/> Entrega Esperada</span>
                                    </div>
                                    {canEdit ? (
                                        <input type="date" value={editDeliveryDate} onChange={(e) => updateField('deliveryDate', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 w-full text-sm bg-white shadow-sm focus:ring-2 focus:ring-blue-100 outline-none font-bold text-slate-700" />
                                    ) : (
                                        <span className="text-sm font-bold text-slate-800 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm inline-block w-full">{request.deliveryDate || 'No definida'}</span>
                                    )}
                                </div>

                                <div className="pt-2">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Clock size={12} /> Fechas de Grabación</span>
                                        {canEdit && <button onClick={() => setRecordings([...recordings, { date: '', startTime: '', endTime: '' }])} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-100 active:scale-95 transition-all flex items-center gap-1"><Plus size={14} /> Añadir</button>}
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {recordings.length === 0 && !(request.recordingStartDate || request.recordingDate) && (
                                            <div className="text-center p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs font-medium text-slate-400">Sin grabaciones programadas</div>
                                        )}
                                        {recordings.length === 0 && (request.recordingStartDate || request.recordingDate) && (
                                            <div className="p-4 border rounded-xl border-dashed bg-orange-50/50 border-orange-200">
                                                <p className="text-[10px] font-bold text-orange-400 uppercase mb-2">Legacy (Rango)</p>
                                                <p className="text-sm font-bold text-slate-700">Inicio: <span className="font-medium text-slate-600">{request.recordingStartDate || request.recordingDate} {request.recordingStartTime || request.recordingTime || ''}</span></p>
                                                {request.recordingEndDate && <p className="text-sm font-bold text-slate-700 mt-1">Fin: <span className="font-medium text-slate-600">{request.recordingEndDate} {request.recordingEndTime || ''}</span></p>}
                                            </div>
                                        )}
                                        {recordings.map((rec, i) => (
                                            <div key={i} className={`p-4 border rounded-2xl relative transition-all ${canEdit ? 'bg-white border-blue-200 hover:border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                                                {canEdit && <button onClick={() => { const r = recordings.filter((_, idx) => idx !== i); setRecordings(r); updateRecordingsDB(r); }} className="absolute -top-2 -right-2 bg-white text-slate-300 hover:text-red-500 shadow-md border border-slate-100 rounded-full p-1.5 transition-colors"><X size={14} /></button>}
                                                {canEdit ? (
                                                    <div className="flex flex-col gap-3">
                                                        <div>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fecha</span>
                                                            <input type="date" value={rec.date} onChange={e => { const r = [...recordings]; r[i].date = e.target.value; setRecordings(r); }} onBlur={() => updateRecordingsDB(recordings)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-blue-300 outline-none font-bold text-slate-700" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Inicio</span>
                                                                <input type="time" value={rec.startTime} onChange={e => { const r = [...recordings]; r[i].startTime = e.target.value; setRecordings(r); }} onBlur={() => updateRecordingsDB(recordings)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-blue-300 outline-none font-bold text-slate-700" />
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fin</span>
                                                                <input type="time" value={rec.endTime} onChange={e => { const r = [...recordings]; r[i].endTime = e.target.value; setRecordings(r); }} onBlur={() => updateRecordingsDB(recordings)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-blue-300 outline-none font-bold text-slate-700" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-sm font-bold text-slate-800 flex items-center gap-2"><Calendar size={14} className="text-blue-500"/> {rec.date || 'Sin fecha'}</span>
                                                        {(rec.startTime || rec.endTime) && (
                                                            <span className="text-xs text-slate-500 font-medium flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 w-fit">
                                                                <Clock size={12} className="text-slate-400" /> {rec.startTime || '?'} {rec.endTime ? `- ${rec.endTime}` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detalles y Contexto */}
                        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200 mb-6 lg:mb-0">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14} /> Detalles Técnicos</h2>
                            <div className="space-y-4">
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Objetivo Principal</span>
                                    <p className="text-sm text-slate-800 font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">{request.objetivo || "No especificado"}</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Público</span>
                                        <p className="text-sm text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">{request.publico || "-"}</p>
                                    </div>
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Formato</span>
                                        {canEdit ? (
                                            <select value={request.format || ""} onChange={(e) => updateField('format', e.target.value)} className="text-sm font-medium border shadow-sm border-slate-200 rounded-xl px-3 py-3 bg-white outline-none focus:ring-2 focus:ring-blue-200 w-full hover:bg-slate-50 transition-colors">
                                                <option value="Horizontal (16:9)">Horizontal (16:9)</option>
                                                <option value="Vertical (9:16)">Vertical (9:16)</option>
                                                <option value="Cuadrado (1:1)">Cuadrado (1:1)</option>
                                            </select>
                                        ) : (
                                            <p className="text-sm text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">{request.format || "-"}</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Briefing (Requerimiento)</span>
                                    <div className="bg-blue-50/50 p-4 rounded-2xl text-sm text-blue-900 border border-blue-100 leading-relaxed font-medium whitespace-pre-wrap">{request.briefing || "Sin detalles"}</div>
                                </div>
                                {request.copy && (
                                    <div>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Copy Propuesto</span>
                                        <div className="bg-white p-4 rounded-2xl text-sm italic border border-slate-200 shadow-sm text-slate-600 font-medium">{request.copy}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* PANEL DE REFERENCIA ADJUNTA (SIEMPRE VISIBLE EN VISTA NORMAL) */}
                        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-200">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                <span className="flex items-center gap-2"><LinkIcon size={14} /> Material de Referencia</span>
                                {canEdit && (
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={!!request.hasReferenceLink} 
                                            onChange={(e) => updateField('hasReferenceLink', e.target.checked)}
                                            className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                                        />
                                        <span className="text-[10px] text-slate-500 normal-case">Habilitar Link</span>
                                    </label>
                                )}
                            </h2>
                            
                            {!request.hasReferenceLink ? (
                                <p className="text-sm text-slate-400 italic bg-slate-50 px-4 py-4 rounded-2xl border border-dashed border-slate-200 text-center">Sin material de referencia adjunto</p>
                            ) : (
                                <div className="space-y-3">
                                    {canEdit ? (
                                        <div className="flex flex-col gap-3">
                                            <input 
                                                type="text" 
                                                placeholder="Ej: https://youtube.com/... o Drive"
                                                value={request.referenceLink || ""}
                                                onChange={(e) => updateField('referenceLink', e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-200 outline-none font-medium text-slate-700 transition-all"
                                            />
                                            {request.referenceLink && (
                                                <a 
                                                    href={ensureUrl(request.referenceLink)} 
                                                    target="_blank" rel="noopener noreferrer"
                                                    className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 p-2.5 rounded-xl border border-emerald-200 font-bold shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
                                                >
                                                    <ExternalLink size={14} /> Abrir Referencia
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center w-full">
                                            {request.referenceLink ? (
                                                <a 
                                                    href={ensureUrl(request.referenceLink)} 
                                                    target="_blank" rel="noopener noreferrer"
                                                    className="w-full text-sm font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center justify-center gap-2 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 transition-colors shadow-sm"
                                                >
                                                    <ExternalLink size={16} /> Ver material adjunto
                                                </a>
                                            ) : (
                                                <p className="text-sm text-slate-400 italic bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 w-full text-center">Link pendiente</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                    )}

                        {/* RIGHT COLUMN */}
                        <div className={`${isProductionMode ? 'lg:col-span-12' : 'lg:col-span-7'} flex flex-col gap-6 transition-all duration-300`}>
                            
                            {/* Plan de Producción */}
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle size={14} /> Plan de Producción
                                    </h2>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        {canModifyPlan && (
                                            <button onClick={handleSaveVersion} className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg shadow-sm border border-blue-100 flex items-center gap-1.5 font-bold transition-all active:scale-95">
                                                <Save size={12} /> Guardar Versión
                                            </button>
                                        )}
                                        {user?.role !== 'solicitante' && (
                                            <span className="text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg shadow-inner font-bold text-slate-600 min-w-[50px] text-center shrink-0 border border-slate-200">
                                                {checklist.filter(t => t.completed).length} / {checklist.length}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="p-5 flex-1 flex flex-col justify-start">
                                    {canModifyPlan && !isFinalApproved && (
                                        <div className="flex gap-2 mb-5">
                                            <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} spellCheck={true} lang="es-PE" placeholder="Escribe una nueva tarea..." className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50 focus:bg-white transition-all font-medium text-slate-700 shadow-sm" />
                                            <button onClick={addTask} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 font-bold active:scale-95 transition-all shadow-md"><Plus size={18} /></button>
                                        </div>
                                    )}

                                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar flex-1 relative min-h-[150px]">
                                        {checklist.length === 0 && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                                                <CheckCircle size={32} className="opacity-20" />
                                                <p className="text-sm font-medium">Aún no hay tareas en el plan.</p>
                                            </div>
                                        )}
                                        {checklist.map((t, i) => (
                                            <div
                                                key={i}
                                                draggable={canModifyPlan}
                                                onDragStart={(e) => handleDragStart(e, i)}
                                                onDragEnter={(e) => handleDragEnter(e, i)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => e.preventDefault()}
                                                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 border rounded-2xl transition-all duration-300 group ${t.completed ? 'bg-slate-50 border-slate-100 opacity-80' : 'bg-white border-slate-200 shadow-sm'} ${draggedItemIndex === i ? 'opacity-40 border-dashed border-blue-400 bg-blue-50 scale-[0.98]' : 'hover:border-blue-300 hover:shadow-md'}`}
                                            >
                                                <div className="flex items-start gap-3 flex-1 w-full min-w-0">
                                                    {canModifyPlan && !isFinalApproved && (
                                                        <div className="mt-2 text-slate-300 hover:text-indigo-400 cursor-grab active:cursor-grabbing transition-colors"><GripVertical size={16} /></div>
                                                    )}
                                                    <button onClick={() => (canModifyPlan || canLockPlan || canApprove) && toggleTask(i)} className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 mt-1 transition-all ${t.completed ? 'bg-green-500 border-green-500 text-white shadow-inner' : 'border-slate-300 bg-slate-50 hover:bg-white hover:border-slate-400'} ${(canModifyPlan || canLockPlan || canApprove) ? 'cursor-pointer' : 'cursor-not-allowed'}`}>{t.completed && <CheckCircle size={14} />}</button>
                                                    <div className="flex-1 min-w-0">
                                                        {canModifyPlan ? (
                                                            <AutoResizeTextarea value={t.text} onChange={(e) => updateTaskText(i, e.target.value)} onBlur={saveTaskText} disabled={false} isCompleted={t.completed} />
                                                        ) : <span className={`text-sm break-words whitespace-normal block font-medium mt-1 ${t.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.text}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-2 w-full sm:w-auto pl-10 sm:pl-0 shrink-0">
                                                    <select disabled={!canModifyPlan} value={t.type} onChange={(e) => changeTaskType(i, e.target.value)} className="text-[11px] font-bold tracking-wide border rounded-lg px-2.5 py-1.5 bg-slate-50 outline-none w-full sm:w-[130px] disabled:opacity-50 h-[34px] shadow-sm uppercase"><option>Solo Video</option><option>Voz en Off</option><option>Escena Compuesta</option><option>Imagen</option><option>Diseño</option><option>Foto</option><option>Texto en Pantalla</option><option>Animación</option></select>
                                                    {canModifyPlan && !isFinalApproved && <button onClick={() => deleteTask(i)} className="text-slate-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {canLockPlan && (
                                        <div className="mt-5 pt-5 border-t border-slate-100">
                                            <button onClick={togglePlanLock} className={`w-full py-3.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all active:scale-[0.98] shadow-sm ${isPlanApproved ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200' : 'bg-red-500 text-white hover:bg-red-600 shadow-md border border-red-600'}`}>
                                                {isPlanApproved ? <><Edit2 size={18} /> Desbloquear Plan</> : <><Lock size={18} /> Bloquear Plan de Producción</>}
                                            </button>
                                            {isPlanApproved && request.planApprovedBy && <p className="text-[10px] text-center text-slate-400 mt-3 uppercase tracking-widest font-bold">Bloqueado por: <span className="text-slate-600">{request.planApprovedBy}</span></p>}
                                        </div>
                                    )}
                                    { /* NUEVOS APARTADOS DE PRODUCCION */}
                                    {isProductionMode && (
                                        <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-bottom-4 duration-500 space-y-6">
                                            
                                            {/* Fechas de Post Producción */}
                                            <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Clock size={14} className="text-indigo-500" /> Fechas de Post Producción</span>
                                                    {canEdit && <button onClick={() => setPostRecordings([...postRecordings, { date: '', startTime: '', endTime: '' }])} className="text-[10px] font-bold text-indigo-700 bg-indigo-100/50 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-100 active:scale-95 transition-all flex items-center gap-1"><Plus size={12} /> Añadir</button>}
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {postRecordings.length === 0 ? (
                                                        <div className="text-center p-6 rounded-xl border border-dashed border-slate-300 bg-white/50 text-xs font-medium text-slate-400">Sin fechas de post producción programadas</div>
                                                    ) : (
                                                        postRecordings.map((rec, i) => (
                                                            <div key={i} className={`p-4 rounded-2xl relative transition-all ${canEdit ? 'bg-white border border-indigo-100 hover:border-indigo-300 shadow-sm' : 'bg-transparent border border-slate-200'}`}>
                                                                {canEdit && <button onClick={() => { const r = postRecordings.filter((_, idx) => idx !== i); setPostRecordings(r); updatePostRecordingsDB(r); }} className="absolute -top-2 -right-2 bg-white text-slate-300 hover:text-red-500 shadow-sm border border-slate-100 rounded-full p-1.5 transition-colors"><X size={14} /></button>}
                                                                {canEdit ? (
                                                                    <div className="flex flex-col sm:flex-row gap-3">
                                                                        <div className="flex-1">
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fecha</span>
                                                                            <input type="date" value={rec.date} onChange={e => { const r = [...postRecordings]; r[i].date = e.target.value; setPostRecordings(r); }} onBlur={() => updatePostRecordingsDB(postRecordings)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-300 outline-none font-bold text-slate-700" />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Inicio</span>
                                                                            <input type="time" value={rec.startTime} onChange={e => { const r = [...postRecordings]; r[i].startTime = e.target.value; setPostRecordings(r); }} onBlur={() => updatePostRecordingsDB(postRecordings)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-300 outline-none font-bold text-slate-700" />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fin</span>
                                                                            <input type="time" value={rec.endTime} onChange={e => { const r = [...postRecordings]; r[i].endTime = e.target.value; setPostRecordings(r); }} onBlur={() => updatePostRecordingsDB(postRecordings)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white focus:border-indigo-300 outline-none font-bold text-slate-700" />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2"><Calendar size={14} className="text-indigo-500"/> {rec.date || 'Sin fecha'}</span>
                                                                        {(rec.startTime || rec.endTime) && (
                                                                            <span className="text-xs text-slate-600 font-bold flex items-center gap-2">
                                                                                <Clock size={12} className="text-slate-400" /> {rec.startTime || '?'} {rec.endTime ? `- ${rec.endTime}` : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Estados y Checkboxes */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${isPostProdActive ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isPostProdActive} 
                                                        disabled={!canEdit || isPostProductionNow}
                                                        onChange={(e) => handlePostProductionToggle(e.target.checked)}
                                                        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800 leading-tight">En Post Producción</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">Etapa iniciada</span>
                                                    </div>
                                                </label>

                                                <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${request.postProductionFinished ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!request.postProductionFinished} 
                                                        disabled={!canEdit}
                                                        onChange={(e) => handlePostProductionFinish(e.target.checked)}
                                                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-800 leading-tight">Fin Post Producción</span>
                                                        <span className="text-[10px] text-slate-400 font-medium">Etapa finalizada</span>
                                                    </div>
                                                </label>
                                                
                                                <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${request.hasChanges ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!request.hasChanges} 
                                                        disabled={!canEdit}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            const updates = { hasChanges: checked };
                                                            if (checked && !request.changesDate) {
                                                                updates.changesDate = new Date().toISOString().split('T')[0];
                                                            } else if (!checked) {
                                                                updates.changesDate = null;
                                                            }
                                                            updateDoc(doc(db, "solicitudes_contenido", request.id), updates);
                                                        }}
                                                        className="mt-0.5 w-4 h-4 text-amber-500 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer" 
                                                    />
                                                    <div className="flex flex-col w-full">
                                                        <span className="text-sm font-bold text-amber-900 leading-tight cursor-pointer" onClick={() => {
                                                            if (!canEdit) return;
                                                            const checked = !request.hasChanges;
                                                            const updates = { hasChanges: checked };
                                                            if (checked && !request.changesDate) updates.changesDate = new Date().toISOString().split('T')[0];
                                                            else if (!checked) updates.changesDate = null;
                                                            updateDoc(doc(db, "solicitudes_contenido", request.id), updates);
                                                        }}>Con Cambios</span>
                                                        <span className="text-[10px] text-amber-700/60 font-medium mb-2">Hubieron cambios en la solicitud</span>
                                                        
                                                        {request.hasChanges && (
                                                            <div className="mt-1">
                                                                <input 
                                                                    type="date"
                                                                    disabled={!canEdit}
                                                                    value={request.changesDate || ''}
                                                                    onChange={(e) => updateField('changesDate', e.target.value)}
                                                                    className="w-full text-xs font-bold text-amber-900 bg-amber-100/50 border border-amber-200 rounded-lg px-2 py-1 outline-none focus:bg-white focus:border-amber-400"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Entregable Final & Aprobaciones */}
                            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden shrink-0">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <LinkIcon size={14} /> Entregable Final
                                    </h2>
                                </div>
                                <div className="p-5">
                                    {!isEditingLink && (request.finalLink || request.link) ? (
                                        <div className="flex items-start sm:items-center flex-col sm:flex-row p-4 bg-emerald-50 border border-emerald-200 shadow-sm rounded-xl gap-3 overflow-hidden transition-all hover:shadow-md group">
                                            <div className="flex items-center gap-3 flex-1 w-full min-w-0">
                                                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform"><ExternalLink size={20} /></div>
                                                <a href={ensureUrl(request.finalLink || request.link)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-bold text-emerald-800 hover:underline truncate underline-offset-4">Ver Entregable Final</a>
                                            </div>
                                            {canEdit && <button onClick={() => setIsEditingLink(true)} className="text-xs font-bold text-emerald-700 bg-white shadow-sm border border-emerald-100 px-4 py-2 w-full sm:w-auto text-center rounded-lg hover:bg-emerald-100 active:scale-95 transition-all mt-2 sm:mt-0">Editar Link</button>}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            {canEdit ? (
                                                <>
                                                    <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="Ej: https://drive.google.com/..." className="flex-1 border shadow-inner border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 min-w-0 transition-all text-slate-700 font-medium" />
                                                    <button onClick={saveLink} className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-95 transition-all whitespace-nowrap"><Save size={16} className="inline mr-1" /> Guardar</button>
                                                </>
                                            ) : (
                                                <div className="p-5 bg-slate-50 flex items-center justify-center gap-2 rounded-xl text-sm font-medium text-slate-400 w-full text-center border-2 border-dashed border-slate-200">
                                                    <Clock size={16} /> Esperando carga de entregable...
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    { /* Multi-User Approvals Section */}
                                    {(request.finalLink || request.link) && (
                                        <div className="mt-5 space-y-4 pt-5 border-t border-slate-100">
                                            {request.deliverableApprovals && request.deliverableApprovals.length > 0 && (
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Aprobaciones Recibidas ({request.deliverableApprovals.length})</span>
                                                    <div className="flex flex-wrap gap-2">
                                                        {request.deliverableApprovals.map((ap, idx) => (
                                                            <span key={idx} className="bg-white text-emerald-700 text-xs px-3 py-2 rounded-xl shadow-sm border border-emerald-100 flex items-center gap-2 font-bold transform hover:-translate-y-0.5 transition-transform" title={ap.date}>
                                                                <div className="bg-emerald-100 rounded-full p-0.5"><CheckCircle size={12} /></div> {ap.name} <span className="text-[10px] font-medium opacity-60 px-1 border-l border-emerald-200">{ap.role}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {canApproveDeliverable && !hasUserApprovedDeliverable && !isFinalApproved && (
                                                <button
                                                    onClick={handleApproveDeliverable}
                                                    className="w-full py-4 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex justify-center items-center gap-2 active:scale-95 transition-all"
                                                >
                                                    <CheckCircle size={18} /> Aprobar este Entregable
                                                </button>
                                            )}
                                            {hasUserApprovedDeliverable && !isFinalApproved && (
                                                <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 font-bold p-3 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                                                    <CheckCircle size={14} className="text-emerald-500" /> ¡Has aprobado este entregable!
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            {/* Footer Sticky Bottom Actions */}
            <div className="fixed bottom-0 left-0 right-0 z-40 md:relative md:bottom-auto md:z-auto pointer-events-none">
                <div className="pointer-events-auto bg-white/90 backdrop-blur-md md:bg-white border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] md:shadow-none transition-all p-4 md:px-8 md:py-5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="w-full md:w-auto self-start md:self-auto flex items-center gap-3">
                        {canEdit && (
                            <button
                                onClick={request.archived ? handleUnarchive : handleArchive}
                                className={`flex items-center justify-center md:justify-start gap-2 w-full md:w-auto px-5 py-3 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${request.archived ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' : 'bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50'}`}
                            >
                                {request.archived ? <><RefreshCcw size={16} /> Desarchivar Orden</> : <><Archive size={16} /> Archivar Orden</>}
                            </button>
                        )}
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-auto">
                            <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-slate-700 hover:bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 shadow-sm transition-all text-sm font-bold active:scale-95">
                                <FileDown size={16} /> <span className="hidden sm:inline">Exportar Ficha</span> PDF
                            </button>
                            {showExportMenu && (
                                <div className="absolute bottom-full right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 mb-3 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 transform origin-bottom animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-slate-50/80 backdrop-blur-sm px-5 py-3 border-b border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descargar Versión PDF</p>
                                    </div>
                                    <div className="max-h-60 overflow-y-auto w-full">
                                        <button onClick={() => handlePDF(null, "Actual")} className="w-full text-left px-5 py-3.5 hover:bg-blue-50 flex items-center gap-3 transition-colors border-b border-slate-50 group">
                                            <div className="bg-blue-100 text-blue-600 p-2 rounded-xl group-hover:scale-110 transition-transform"><Edit2 size={14} /></div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">Versión Actual</p>
                                                <p className="text-xs text-slate-500 font-medium tracking-tight mt-0.5">Estado actual en pantalla</p>
                                            </div>
                                        </button>
                                        {request.planVersions && request.planVersions.map((v, idx) => (
                                            <div key={v.version} className="relative group/v border-b border-slate-50 last:border-none">
                                                <button
                                                    onClick={() => handlePDF(v.checklist, v.label)}
                                                    className="w-full text-left px-5 py-3.5 hover:bg-slate-50 flex items-center gap-3 transition-colors pr-12"
                                                >
                                                    <div className="bg-slate-100 text-slate-500 p-2 rounded-xl"><History size={14} /></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700">{v.label}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">Por: {v.savedBy} <span className="opacity-50 mx-1">|</span> {new Date(v.date).toLocaleDateString()}</p>
                                                    </div>
                                                </button>
                                                {canEdit && (
                                                    <button
                                                        onClick={(e) => handleDeleteVersion(e, idx)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white text-slate-400 hover:text-red-500 rounded-lg shadow-sm border border-slate-100 sm:opacity-0 group-hover/v:opacity-100 transition-all hover:bg-red-50"
                                                        title="Eliminar versión"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {(!request.planVersions || request.planVersions.length === 0) && (
                                            <div className="px-5 py-4 text-xs font-medium text-slate-400 text-center italic">No hay versiones guardadas</div>
                                        )}
                                    </div>
                                    <button onClick={() => setShowExportMenu(false)} className="w-full py-3 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors uppercase tracking-widest border-t border-slate-100">Cancelar</button>
                                </div>
                            )}
                        </div>

                        {isFinalApproved && (request.deliverableApprovals?.length > 0 || isFinalApproved) && (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => setIsReopenModalOpen(true)}
                                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all active:scale-95"
                                >
                                    <RotateCcw size={16} /> Reabrir Solicitud
                                </button>
                                <div className="flex flex-col items-center justify-center bg-green-50 px-4 py-2.5 rounded-xl border border-green-200 outline-none w-full md:w-auto cursor-default">
                                    <span className="flex items-center gap-1.5 text-sm font-bold text-green-700"><CheckCircle size={16} className="text-green-500" /> Solicitud Cerrada</span>
                                    {request.finalApprovedBy && <span className="text-[10px] text-green-600/70 uppercase font-bold tracking-widest mt-0.5">Por: {request.finalApprovedBy}</span>}
                                </div>
                            </div>
                        )}
                        {!isFinalApproved && canCloseRequest && (request.deliverableApprovals?.length > 0) && (
                            <button
                                onClick={handleCloseRequest}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <Lock size={16} /> Cerrar Solicitud
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={isReopenModalOpen}
                onClose={() => setIsReopenModalOpen(false)}
                title="Reabrir Solicitud"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 font-medium">
                        ¿Estás seguro que quieres reabrir la solicitud? Se creará una copia clonada con la fecha actual.
                    </p>
                    <div>
                        <label className="text-xs font-bold text-gray-700 block mb-1 uppercase tracking-wide">Motivo de Reapertura</label>
                        <textarea
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            placeholder="Ej. Se requiere una nueva versión para la campaña de verano..."
                            className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 text-gray-800 text-sm h-32 resize-none"
                            spellCheck={true}
                            lang="es-PE"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            onClick={() => setIsReopenModalOpen(false)}
                            className="px-6 py-2.5 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleReopenRequest}
                            disabled={!reopenReason.trim() || isReopening}
                            className={`px-8 py-2.5 rounded-lg text-sm font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 ${reopenReason.trim() ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                            {isReopening ? 'Guardando...' : 'Confirmar Reapertura'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
export default RequestDetailPage;
