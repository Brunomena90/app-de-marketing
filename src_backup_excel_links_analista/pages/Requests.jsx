import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRequests } from '../context/RequestContext';
import { Search, Plus, Video, ChevronDown, Calendar, User, List, Trash2, FileSpreadsheet, Filter, Image, Megaphone, Check, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NewRequestModal from '../components/NewRequestModal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const Requests = () => {
    const { requests } = useRequests();
    const { user, isAdmin, activeEmpresa } = useAuth();
    const navigate = useNavigate();

    // Helper para truncar texto cuidando que sea legible
    const truncateText = (text, maxLength = 25) => {
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    };

    // --- ESTADOS CON PERSISTENCIA (SESSION STORAGE) ---

    // 1. Búsqueda
    const [search, setSearch] = useState(() => {
        try { return sessionStorage.getItem('reqSearch') || ""; } catch { return ""; }
    });

    // 2. Filtro Estados
    const [selectedStatuses, setSelectedStatuses] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('reqStatuses')) || []; } catch { return []; }
    });

    // 3. Filtro Áreas (NUEVO)
    const [selectedAreas, setSelectedAreas] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('reqAreas')) || []; } catch { return []; }
    });

    // 4. Filtro Fechas
    const [useDateFilter, setUseDateFilter] = useState(() => sessionStorage.getItem('reqUseDate') === 'true');
    const [startDate, setStartDate] = useState(() => sessionStorage.getItem('reqStartDate') || "");
    const [endDate, setEndDate] = useState(() => sessionStorage.getItem('reqEndDate') || "");

    // 5. Estado para mostrar archivados (No persistente por defecto, o sí si se desea manter la vista)
    const [showArchived, setShowArchived] = useState(false);

    // --- EFECTOS DE PERSISTENCIA ---
    useEffect(() => sessionStorage.setItem('reqSearch', search), [search]);
    useEffect(() => sessionStorage.setItem('reqStatuses', JSON.stringify(selectedStatuses)), [selectedStatuses]);
    useEffect(() => sessionStorage.setItem('reqAreas', JSON.stringify(selectedAreas)), [selectedAreas]);
    useEffect(() => sessionStorage.setItem('reqUseDate', useDateFilter), [useDateFilter]);
    useEffect(() => sessionStorage.setItem('reqStartDate', startDate), [startDate]);
    useEffect(() => sessionStorage.setItem('reqEndDate', endDate), [endDate]);

    // --- LIMPIAR FILTROS AL CAMBIAR DE EMPRESA ---
    // Previene que filtros de la empresa anterior oculten solicitudes en la nueva
    const prevEmpresaRef = React.useRef(activeEmpresa);
    useEffect(() => {
        if (prevEmpresaRef.current !== activeEmpresa) {
            prevEmpresaRef.current = activeEmpresa;
            setSelectedStatuses([]);
            setSelectedAreas([]);
            setSearch('');
            setUseDateFilter(false);
            setStartDate('');
            setEndDate('');
        }
    }, [activeEmpresa]);


    // --- ESTADOS UI (No persistentes) ---
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false); // Dropdown Áreas
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [initialTab, setInitialTab] = useState('video');
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

    const canDelete = isAdmin || user?.role === 'editor';

    const statusMenuRef = useRef(null);
    const areaMenuRef = useRef(null); // Ref Áreas

    // Cerrar dropdowns al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) setIsStatusDropdownOpen(false);
            if (areaMenuRef.current && !areaMenuRef.current.contains(event.target)) setIsAreaDropdownOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const normalizeDate = (val) => {
        if (!val) return null;
        try {
            if (val.seconds !== undefined) return new Date(val.seconds * 1000).toISOString().split('T')[0];
            if (typeof val === 'string') return val.split('T')[0];
        } catch (e) { return null; }
        return null;
    };

    // --- OPCIONES DINÁMICAS DE ÁREA ---
    const uniqueAreas = useMemo(() => {
        const areas = new Set(requests.map(r => r.area).filter(Boolean)); // Solo áreas que existen
        return Array.from(areas).sort();
    }, [requests]);

    const statusOptions = [
        { value: 'solicitado', label: 'Solicitado' },
        { value: 'en grabación', label: 'En Grabación' },
        { value: 'en proceso', label: 'En Proceso' },
        { value: 'revision', label: 'En Revisión' },
        { value: 'completado', label: 'Completado' }
    ];

    const toggleStatusFilter = (val) => {
        if (selectedStatuses.includes(val)) setSelectedStatuses(prev => prev.filter(s => s !== val));
        else setSelectedStatuses(prev => [...prev, val]);
    };

    const toggleAreaFilter = (val) => {
        if (selectedAreas.includes(val)) setSelectedAreas(prev => prev.filter(a => a !== val));
        else setSelectedAreas(prev => [...prev, val]);
    };

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
        let statusColor = 'bg-gray-100 text-gray-500';
        let barColor = 'bg-gray-200';

        if (req.status && req.status.startsWith('Completado')) {
            statusLabel = req.status === 'Completado' ? 'Completado' : 'Re-editada';
            statusColor = 'bg-green-100 text-green-700';
            barColor = 'bg-green-500';
        } else if (hasLink && percent === 100) {
            statusLabel = 'Revisión';
            statusColor = 'bg-orange-100 text-orange-700';
            barColor = 'bg-orange-500';
        } else if (isRecordingNow) {
            statusLabel = 'En Grabación';
            statusColor = 'bg-red-100 text-red-600 border border-red-200 animate-pulse';
            barColor = 'bg-red-500';
        } else if (req.status === 'En Proceso' || percent > 0 || hasFinishedRecordingToday) {
            statusLabel = 'En Proceso';
            statusColor = 'bg-blue-100 text-blue-700';
            barColor = 'bg-blue-500';
        }

        return { statusLabel, statusColor, barColor, percent, hasScript: total > 0 };
    };

    // --- FILTRO INTELIGENTE ---
    const filtered = useMemo(() => {
        const list = requests.filter(req => {
            // 0. Archivo vs Activas
            const isArchived = !!req.archived;
            if (showArchived !== isArchived) return false;

            // 1. Texto (Título, Campaña o Sub-grupo)
            const searchTerm = search.toLowerCase();
            const matchesSearch =
                req.title?.toLowerCase().includes(searchTerm) ||
                req.campaign?.toLowerCase().includes(searchTerm) ||
                req.campana?.toLowerCase().includes(searchTerm) ||
                req.subGroup?.toLowerCase().includes(searchTerm);

            // 2. Fechas
            let matchesDate = true;
            if (useDateFilter && startDate && endDate) {
                const reqDateStr = normalizeDate(req.requestDate || req.createdAt);
                if (!reqDateStr) matchesDate = false;
                else matchesDate = reqDateStr >= startDate && reqDateStr <= endDate;
            }

            // 3. Estados (Lógica Automatizada)
            const { statusLabel } = getCardStatus(req);
            const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.some(s => s.toLowerCase() === statusLabel.toLowerCase());

            // 4. Áreas
            const matchesArea = selectedAreas.length === 0 || selectedAreas.includes(req.area);

            return matchesSearch && matchesDate && matchesStatus && matchesArea;
        });

        return list.sort((a, b) => {
            const dateA = new Date(a.requestDate || a.createdAt || 0);
            const dateB = new Date(b.requestDate || b.createdAt || 0);
            return dateB - dateA;
        });

    }, [requests, search, useDateFilter, startDate, endDate, selectedStatuses, selectedAreas, showArchived]);

    // --- SCROLL PERSISTENCE ---
    const [hasRestored, setHasRestored] = useState(false);

    // Save scroll position on every scroll to handle case of back button or other navigation
    useEffect(() => {
        const container = document.getElementById('main-scroll-container');
        if (!container) return;

        const handleScroll = () => {
            sessionStorage.setItem('reqScrollY', container.scrollTop.toString());
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        // Attempt restore only once when data is available
        if (!hasRestored && requests.length > 0) {
            const savedScroll = sessionStorage.getItem('reqScrollY');
            if (savedScroll) {
                const scrollPos = parseInt(savedScroll, 10);
                const container = document.getElementById('main-scroll-container');
                
                if (container) {
                    // Try immediate scroll
                    container.scrollTop = scrollPos;
                    
                    // Retries are necessary for complex layouts and async rendering
                    const timer1 = setTimeout(() => { container.scrollTop = scrollPos; }, 50);
                    const timer2 = setTimeout(() => { container.scrollTop = scrollPos; }, 200);
                    const timer3 = setTimeout(() => { container.scrollTop = scrollPos; }, 500);

                    return () => {
                        clearTimeout(timer1);
                        clearTimeout(timer2);
                        clearTimeout(timer3);
                    };
                }
            }
            setHasRestored(true);
        }
    }, [requests, hasRestored]);

    const handleCardClick = (id) => {
        // Position is already being saved by the scroll listener, but we ensure it's up to date
        const container = document.getElementById('main-scroll-container');
        if (container) {
            sessionStorage.setItem('reqScrollY', container.scrollTop.toString());
        }
        navigate(`/solicitudes/${id}`);
    };

    // --- EXCEL ---
    const handleExportExcel = () => {
        if (filtered.length === 0) return toast.error("No hay datos para exportar");

        const formatDateForExcel = (dateVal) => {
            const isoDate = normalizeDate(dateVal);
            if (!isoDate) return 'Pendiente';
            const [year, month, day] = isoDate.split('-');
            return `${day}/${month}/${year}`;
        };

        // Buscar el máximo número de grabaciones y post-producciones para crear las columnas necesarias
        const maxRecs = Math.max(...filtered.map(r => (r.recordings || []).length), 0);
        const maxPosts = Math.max(...filtered.map(r => (r.postRecordings || []).length), 0);

        const data = filtered.map(req => {
            const { statusLabel, percent } = getCardStatus(req);

            // Datos básicos
            const row = {
                "Fecha Solicitud": formatDateForExcel(req.requestDate || req.createdAt),
                "Fecha Entrega": formatDateForExcel(req.deliveryDate),
                "Título": req.title,
                "Tipo": req.type,
                "Campaña": req.campaign || req.campana || 'Sin Campaña',
                "Sub Campaña": req.subGroup || '-',
                "Estado": statusLabel,
                "Avance": `${percent || 0}%`,
                "Área Solicitante": req.area || 'Sin Área',
                "Link de Solicitud": req.finalLink || req.link || 'Sin Link'
            };

            if (user?.analystFunction || isAdmin || user?.role === 'admin') {
                row["En Post-Producción"] = req.inPostProduction ? "SÍ" : "NO";
                row["Con Cambios"] = req.hasChanges ? "SÍ" : "NO";

                // Columnas dinámicas de Grabación (Producción)
                for (let i = 0; i < maxRecs; i++) {
                    const rec = (req.recordings || [])[i];
                    const prefix = `Grabación ${i + 1}`;
                    row[`${prefix} - Fecha`] = rec?.date ? formatDateForExcel(rec.date) : "0";
                    row[`${prefix} - Inicio`] = rec?.startTime || "0";
                    row[`${prefix} - Fin`] = rec?.endTime || "0";
                }

                // Columnas dinámicas de Post-Producción
                for (let i = 0; i < maxPosts; i++) {
                    const rec = (req.postRecordings || [])[i];
                    const prefix = `Post-Prod ${i + 1}`;
                    row[`${prefix} - Fecha`] = rec?.date ? formatDateForExcel(rec.date) : "0";
                    row[`${prefix} - Inicio`] = rec?.startTime || "0";
                    row[`${prefix} - Fin`] = rec?.endTime || "0";
                }
            }

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);

        // Convertir la columna "Link de Solicitud" (columna J, índice 9) a enlaces clickeables
        for (let i = 0; i < data.length; i++) {
            const cellRef = XLSX.utils.encode_cell({ c: 9, r: i + 1 });
            const cell = ws[cellRef];
            if (cell && cell.v && cell.v !== 'Sin Link') {
                let url = cell.v.toString();
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                cell.l = { Target: url };
            }
        }

        // Ajustar anchos de columna
        const colWidths = [
            { wch: 15 }, // Fecha Solicitud
            { wch: 15 }, // Fecha Entrega
            { wch: 40 }, // Título
            { wch: 10 }, // Tipo
            { wch: 25 }, // Campaña
            { wch: 20 }, // Sub Campaña
            { wch: 15 }, // Estado
            { wch: 10 }, // Avance
            { wch: 20 }, // Área Solicitante
            { wch: 40 }  // Link de Solicitud
        ];
        
        if (user?.analystFunction || isAdmin || user?.role === 'admin') {
            colWidths.push({ wch: 15 }); // En Post-Producción
            colWidths.push({ wch: 15 }); // Con Cambios
            // Añadir anchos para grabaciones (3 por cada una)
            for (let i = 0; i < (maxRecs + maxPosts); i++) {
                colWidths.push({ wch: 15 }); // Fecha
                colWidths.push({ wch: 10 }); // Inicio
                colWidths.push({ wch: 10 }); // Fin
            }
        }
        
        ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte GCI");
        XLSX.writeFile(wb, `Reporte_GCI_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;
        try { await deleteDoc(doc(db, "solicitudes_contenido", deleteModal.id)); toast.success("Eliminado"); setDeleteModal({ open: false, id: null }); }
        catch (e) { toast.error("Error"); }
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">{showArchived ? 'Solicitudes Archivadas' : 'Solicitudes'} <span className="bg-gray-100 text-gray-500 text-sm py-1 px-3 rounded-full">{filtered.length}</span></h1>
                    <div className="flex gap-3">
                        <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors text-sm ${showArchived ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                            {showArchived ? 'Ver Activas' : 'Solicitudes Archivadas'}
                        </button>
                        <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2.5 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg font-medium transition-colors text-sm"><FileSpreadsheet size={18} /> Excel</button>
                        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-md flex items-center gap-2 text-sm transition-transform active:scale-95"><Plus size={18} /> Nueva Solicitud</button>
                    </div>
                </div>
                <hr className="border-gray-100" />

                {/* BARRA DE HERRAMIENTAS */}
                <div className="flex flex-col xl:flex-row gap-4 items-center z-20 relative">

                    {/* BUSCADOR */}
                    <div className="relative flex-1 w-full"><Search className="absolute left-3 top-2.5 text-gray-400" size={18} /><input type="text" placeholder="Buscar por título, campaña o sub-campaña..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>

                    {/* FILTRO ÁREAS (NUEVO) */}
                    <div className="relative w-full xl:w-auto" ref={areaMenuRef}>
                        <button onClick={() => setIsAreaDropdownOpen(!isAreaDropdownOpen)} className={`w-full xl:w-56 flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${selectedAreas.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700'}`}>
                            <div className="flex items-center gap-2 truncate">
                                <Layers size={16} />
                                <span>{selectedAreas.length === 0 ? "Todas las Áreas" : `${selectedAreas.length} Área(s)`}</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${isAreaDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isAreaDropdownOpen && (
                            <div className="absolute top-full mt-2 w-full xl:w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95">
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                    {uniqueAreas.map(area => {
                                        const isSelected = selectedAreas.includes(area);
                                        return (
                                            <button key={area} onClick={() => toggleAreaFilter(area)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{isSelected && <Check size={12} className="text-white" />}</div>
                                                <span className="truncate text-left">{area}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedAreas.length > 0 && (<div className="pt-2 mt-2 border-t border-gray-100"><button onClick={() => { setSelectedAreas([]); setIsAreaDropdownOpen(false); }} className="w-full text-center text-xs text-red-500 hover:text-red-700 font-medium py-1">Limpiar Filtros</button></div>)}
                            </div>
                        )}
                    </div>

                    {/* FILTRO ESTADOS */}
                    <div className="relative w-full xl:w-auto" ref={statusMenuRef}>
                        <button onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)} className={`w-full xl:w-56 flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${selectedStatuses.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700'}`}>
                            <span className="truncate">{selectedStatuses.length === 0 ? "Todos los Estados" : `${selectedStatuses.length} Estado(s)`}</span>
                            <ChevronDown size={16} className={`transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isStatusDropdownOpen && (
                            <div className="absolute top-full mt-2 w-full xl:w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95">
                                <div className="space-y-1">{statusOptions.map(opt => { const isSelected = selectedStatuses.includes(opt.value); return (<button key={opt.value} onClick={() => toggleStatusFilter(opt.value)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}><div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{isSelected && <Check size={12} className="text-white" />}</div>{opt.label}</button>); })}</div>
                                {selectedStatuses.length > 0 && (<div className="pt-2 mt-2 border-t border-gray-100"><button onClick={() => { setSelectedStatuses([]); setIsStatusDropdownOpen(false); }} className="w-full text-center text-xs text-red-500 hover:text-red-700 font-medium py-1">Limpiar Filtros</button></div>)}
                            </div>
                        )}
                    </div>

                    {/* FILTRO FECHAS */}
                    <div className={`flex items-center gap-3 bg-gray-50 p-2 rounded-lg border w-full xl:w-auto transition-colors ${useDateFilter ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none whitespace-nowrap"><input type="checkbox" checked={useDateFilter} onChange={(e) => setUseDateFilter(e.target.checked)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" /><Filter size={16} /> Filtrar Fechas</label>
                        <div className={`flex items-center gap-2 transition-opacity ${!useDateFilter ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1 text-sm outline-none focus:border-blue-500 text-gray-600 w-32" /><span className="text-gray-400">-</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1 text-sm outline-none focus:border-blue-500 text-gray-600 w-32" /></div>
                    </div>
                </div>
            </div>

            {/* GRID TARJETAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(req => {
                    const { statusLabel, statusColor, barColor, percent, hasScript } = getCardStatus(req);
                    const displayDate = normalizeDate(req.requestDate || req.createdAt) || 'Sin fecha';

                    return (
                        <div key={req.id} onClick={() => handleCardClick(req.id)} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group flex flex-col overflow-hidden relative">
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${req.type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{req.type || 'GENERAL'}</span>
                                    <div className="flex items-center gap-2"><span className="text-xs text-gray-400">{displayDate}</span>{canDelete && (<button onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, id: req.id }); }} className="text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>)}</div>
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg mb-4 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[3.5rem]">{req.title}</h3>
                                <div className="space-y-2 text-xs text-gray-500">
                                    <div className="flex items-center gap-2"><User size={14} className="text-gray-400" /> <span className="uppercase font-medium">{req.area || 'Sin Área'}</span></div>
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Megaphone size={14} className="text-gray-400" />
                                        <span className="truncate pr-4" title={req.campaign + (req.subGroup ? ` > ${req.subGroup}` : '')}>
                                            {req.subGroup ? truncateText(req.subGroup, 25) : (req.campaign || req.campana || 'Sin Campaña Asignada')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-400" /> <span>Entrega: {req.deliveryDate || <span className="text-orange-400">Pendiente</span>}</span></div>
                                    <div className={`flex items-center gap-2 font-medium transition-colors ${hasScript ? 'text-blue-600' : 'text-gray-300'}`}><List size={14} /><span>{hasScript ? 'Guion Cargado' : 'Sin Guion'}</span></div>
                                </div>
                            </div>
                            <div className="px-6 pb-4 pt-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>{statusLabel}</span>
                                    {user?.role !== 'solicitante' && <span className="text-xs font-bold text-gray-400">{percent}%</span>}
                                </div>
                            </div>
                            {user?.role !== 'solicitante' && <div className="h-1.5 w-full bg-gray-100"><div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${percent}%` }}></div></div>}
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center">
                        <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <Search size={32} className="opacity-20" />
                        </div>
                        <p className="font-medium text-gray-500">No se encontraron solicitudes.</p>
                        {(selectedStatuses.length > 0 || selectedAreas.length > 0 || search || useDateFilter) && (
                            <button
                                onClick={() => {
                                    setSelectedStatuses([]);
                                    setSelectedAreas([]);
                                    setSearch('');
                                    setUseDateFilter(false);
                                    setStartDate('');
                                    setEndDate('');
                                }}
                                className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                            >
                                Limpiar todos los filtros
                            </button>
                        )}
                        {(selectedStatuses.length > 0 || selectedAreas.length > 0 || search || useDateFilter) && (
                            <p className="mt-2 text-xs text-amber-500 font-medium">
                                ⚠ Tienes filtros activos que pueden estar ocultando solicitudes.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <NewRequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialTab={initialTab} />
            <ConfirmModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} onConfirm={confirmDelete} title="¿Eliminar Solicitud?" message="Esta acción no se puede deshacer." />
        </div>
    );
};
export default Requests;
