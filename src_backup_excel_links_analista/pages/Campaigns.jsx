import React, { useState, useEffect, useRef } from 'react';
import { Plus, Megaphone, Calendar, Trash2, Search, Activity, PlayCircle, PauseCircle, Edit2, ChevronDown, Check, Filter, Layers } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewCampaignModal from '../components/NewCampaignModal';
import ConfirmModal from '../components/ConfirmModal';

const Campaigns = () => {
    const navigate = useNavigate();
    const { user, activeEmpresa, isAdmin } = useAuth();
    const canManageCampaigns = isAdmin || user?.role === 'editor';

    // --- ESTADOS NORMALES ---
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- SCROLL PERSISTENCE ---
    const [hasRestored, setHasRestored] = useState(false);

    useEffect(() => {
        const container = document.getElementById('main-scroll-container');
        if (!container) return;
        const handleScroll = () => {
            sessionStorage.setItem('campScrollY', container.scrollTop.toString());
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!hasRestored && !loading && campaigns.length >= 0) {
            const savedScroll = sessionStorage.getItem('campScrollY');
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
    }, [campaigns, loading, hasRestored]);

    // --- ESTADOS CON PERSISTENCIA (SESSION STORAGE) ---

    // 1. Estado de Búsqueda
    const [search, setSearch] = useState(() => {
        try {
            return sessionStorage.getItem('campaignSearch') || "";
        } catch { return ""; }
    });

    // 2. Estado de Filtro Multi-Select
    const [selectedStatuses, setSelectedStatuses] = useState(() => {
        try {
            const saved = sessionStorage.getItem('campaignStatusFilter');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // --- EFECTOS DE PERSISTENCIA ---
    useEffect(() => {
        sessionStorage.setItem('campaignSearch', search);
    }, [search]);

    useEffect(() => {
        sessionStorage.setItem('campaignStatusFilter', JSON.stringify(selectedStatuses));
    }, [selectedStatuses]);


    // --- ESTADOS NORMALES ---

    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const statusMenuRef = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [campaignToEdit, setCampaignToEdit] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

    // Cargar campañas
    useEffect(() => {
        // Consultamos todos con orden, y filtramos en memoria para evitar errores de índice compuesto de Firestore
        const q = query(collection(db, "campanas"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allCampaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtrado Multi-tenant en cliente
            if (activeEmpresa === 'Todas') {
                setCampaigns(allCampaigns);
            } else {
                setCampaigns(allCampaigns.filter(c => (c.empresa || 'GRUCOIN') === activeEmpresa));
            }
            setLoading(false);
        }, (error) => {
            console.error("Error loading campaigns:", error);
            setLoading(false);
            toast.error("Error al cargar campañas");
        });
        return () => unsubscribe();
    }, [activeEmpresa]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
                setIsStatusDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Opciones de Estado
    const statusOptions = [
        { value: 'activa', label: 'Activa' },
        { value: 'inactiva', label: 'Inactiva / Pausada' }
    ];

    const toggleStatusFilter = (val) => {
        if (selectedStatuses.includes(val)) {
            setSelectedStatuses(selectedStatuses.filter(s => s !== val));
        } else {
            setSelectedStatuses([...selectedStatuses, val]);
        }
    };

    const handleToggleStatus = async (e, id, currentStatus) => {
        e.stopPropagation();
        const newStatus = currentStatus === 'activa' ? 'inactiva' : 'activa';
        try {
            await updateDoc(doc(db, "campanas", id), { status: newStatus });
            toast.success(`Campaña ${newStatus}`);
        } catch (error) {
            toast.error("Error al actualizar estado");
        }
    };

    const handleEdit = (e, campaign) => {
        e.stopPropagation();
        setCampaignToEdit(campaign);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setCampaignToEdit(null);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;
        try {
            await deleteDoc(doc(db, "campanas", deleteModal.id));
            toast.success("Campaña eliminada");
            setDeleteModal({ open: false, id: null });
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    // --- LÓGICA DE FILTRADO ---
    // El filtrado por empresa ya se hace en la consulta (useEffect superior)
    const filteredCampaigns = campaigns.filter(c => {
        // Validación Multi-Tenant
        const reqEmpresa = c.empresa || 'GRUCOIN';
        const matchesEmpresa = activeEmpresa === 'Todas' || reqEmpresa === activeEmpresa;

        // Búsqueda y Estados
        const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(c.status);
        
        return matchesEmpresa && matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">Campañas</h1>
                    <p className="text-sm text-gray-500">Gestiona las campañas para agrupar solicitudes.</p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 w-full lg:w-auto items-center">

                    {/* BARRA DE BÚSQUEDA */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar campaña..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    {/* FILTRO MULTI-SELECT DE ESTADOS */}
                    <div className="relative w-full md:w-auto" ref={statusMenuRef}>
                        <button
                            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                            className={`w-full md:w-48 flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-all ${selectedStatuses.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Filter size={16} />
                                <span>{selectedStatuses.length === 0 ? "Todos los Estados" : `${selectedStatuses.length} Seleccionado(s)`}</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isStatusDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-full md:w-56 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in zoom-in-95">
                                <div className="space-y-1">
                                    {statusOptions.map(opt => {
                                        const isSelected = selectedStatuses.includes(opt.value);
                                        return (
                                            <button
                                                key={opt.value}
                                                onClick={() => toggleStatusFilter(opt.value)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedStatuses.length > 0 && (
                                    <div className="pt-2 mt-2 border-t border-gray-100">
                                        <button onClick={() => { setSelectedStatuses([]); setIsStatusDropdownOpen(false); }} className="w-full text-center text-xs text-red-500 hover:text-red-700 font-medium py-1">
                                            Limpiar Filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {canManageCampaigns && (
                        <button
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md flex items-center justify-center gap-2 text-sm transition-transform active:scale-95 whitespace-nowrap w-full md:w-auto"
                        >
                            <Plus size={18} /> Crear Campaña
                        </button>
                    )}
                </div>
            </div>

            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="text-gray-500 col-span-full text-center py-10">Cargando campañas...</p>
                ) : filteredCampaigns.length > 0 ? (
                    filteredCampaigns.map((camp) => {
                        const isActive = camp.status === 'activa';

                        return (
                            <div
                                key={camp.id}
                                onClick={() => navigate(`/campanas/${camp.id}`)}
                                className={`bg-white p-6 rounded-xl shadow-sm border transition-all relative group cursor-pointer ${isActive ? 'border-gray-100 hover:shadow-md' : 'border-gray-200 bg-gray-50 opacity-80'}`}
                            >
                                {/* STATUS BADGE */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                        <Megaphone size={24} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wide ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {camp.status || 'Inactiva'}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-800 mb-2 truncate" title={camp.name}>{camp.name}</h3>

                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span>Desde: {camp.startDate || 'N/A'}</span>
                                    </div>
                                    {camp.endDate && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Activity size={14} className="text-gray-400" />
                                            <span>Hasta: {camp.endDate}</span>
                                        </div>
                                    )}
                                </div>

                                {/* SUB-GRUPOS PREVIEW */}
                                {camp.subGroups && camp.subGroups.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Layers size={10} /> {camp.subGroups.length} Sub-grupos</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {camp.subGroups.slice(0, 3).map((sg, i) => (
                                                <span key={i} className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-100 truncate max-w-[120px]" title={sg}>{sg}</span>
                                            ))}
                                            {camp.subGroups.length > 3 && <span className="text-[10px] text-gray-400 font-bold self-center">+{camp.subGroups.length - 3}</span>}
                                        </div>
                                    </div>
                                )}

                                {/* ACCIONES */}
                                {canManageCampaigns && (
                                    <div className="flex items-center justify-between border-t pt-4 mt-auto">
                                        <button
                                            onClick={(e) => handleToggleStatus(e, camp.id, camp.status)}
                                            className={`flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-lg transition-colors ${isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
                                        >
                                            {isActive ? <><PauseCircle size={16} /> Pausar</> : <><PlayCircle size={16} /> Activar</>}
                                        </button>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => handleEdit(e, camp)}
                                                className="text-gray-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-full transition-colors"
                                                title="Editar nombre"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteModal({ open: true, id: camp.id }); }}
                                                className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                title="Eliminar campaña"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                ) : (
                    <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <Megaphone size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500 font-medium">No se encontraron campañas con los filtros actuales.</p>
                        {canManageCampaigns && (
                            <button onClick={handleCreate} className="mt-4 text-blue-600 hover:underline text-sm font-bold">Crear campaña</button>
                        )}
                    </div>
                )}
            </div>

            {/* MODALES */}
            <NewCampaignModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} campaignToEdit={campaignToEdit} />
            <ConfirmModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} onConfirm={handleDelete} title="¿Eliminar Campaña?" message="Las solicitudes vinculadas perderán la referencia a esta campaña." />
        </div>
    );
};

export default Campaigns;
