import React, { useState, useEffect } from 'react';
import { Plus, Layers, Search, Trash2, Edit2, Building2, ChevronDown } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NewAreaModal from '../components/NewAreaModal';
import ConfirmModal from '../components/ConfirmModal';
const Areas = () => {
    const [searchParams] = useSearchParams();
    const { activeEmpresa, hasGlobalAccess } = useAuth();
    const [areas, setAreas] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [empresaFiltro, setEmpresaFiltro] = useState(searchParams.get('empresa') || '');

    // Si no tiene acceso global, el filtro se fuerza a la empresa activa
    useEffect(() => {
        if (!hasGlobalAccess && activeEmpresa && activeEmpresa !== 'Todas') {
            setEmpresaFiltro(activeEmpresa);
        }
    }, [activeEmpresa, hasGlobalAccess]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [areaToEdit, setAreaToEdit] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [deleting, setDeleting] = useState(false);

    // Cargar Áreas (Filtradas si no es Todas)
    useEffect(() => {
        // Consultamos todos con orden, y filtramos en memoria para evitar errores de índice compuesto de Firestore
        const q = query(collection(db, 'areas'), orderBy('name'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allAreas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Filtrado Multi-tenant en cliente
            if (activeEmpresa === 'Todas') {
                setAreas(allAreas);
            } else {
                setAreas(allAreas.filter(a => (a.empresaName || 'GRUCOIN') === activeEmpresa));
            }
            setLoading(false);
        }, (error) => {
            console.error("Error loading areas:", error);
            setLoading(false);
            toast.error("Error al cargar áreas");
        });
        return () => unsubscribe();
    }, [activeEmpresa]);

    // Cargar Empresas para el filtro
    useEffect(() => {
        const q = query(collection(db, 'empresas'), orderBy('name'));
        const unsub = onSnapshot(q, (snap) => {
            setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleEdit = (area) => {
        setAreaToEdit(area);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setAreaToEdit(null);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'areas', deleteModal.id));
            toast.success('Área eliminada');
            setDeleteModal({ open: false, id: null });
        } catch (error) {
            toast.error('Error al eliminar');
        } finally {
            setDeleting(false);
        }
    };

    // Filtrado: por empresa seleccionada Y por búsqueda de texto
    const filteredAreas = areas.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
        const matchesEmpresa = empresaFiltro === '' || a.empresaId === empresaFiltro;
        return matchesSearch && matchesEmpresa;
    });

    // Agrupar por empresa para mostrar visualmente
    const empresaFiltroObj = empresas.find(e => e.id === empresaFiltro);

    return (
        <div className="space-y-6">

            {/* HEADER */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gestión de Áreas</h1>
                    <p className="text-sm text-gray-500">
                        {empresaFiltroObj
                            ? <>Mostrando áreas de <strong>{empresaFiltroObj.name}</strong></>
                            : 'Define las áreas operativas por empresa.'}
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">

                    {/* FILTRO DE EMPRESA */}
                    <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <select
                            value={empresaFiltro}
                            onChange={(e) => setEmpresaFiltro(e.target.value)}
                            className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-gray-700 appearance-none cursor-pointer"
                        >
                            <option value="">Todas las empresas</option>
                            {empresas.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" size={16} />
                    </div>

                    {/* BUSCADOR */}
                    <div className="relative flex-1 md:w-52">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar área..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>

                    <button
                        onClick={handleCreate}
                        className="bg-gray-900 hover:bg-black text-white font-bold py-2 px-6 rounded-lg shadow-md flex items-center justify-center gap-2 text-sm transition-transform active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={18} /> Nueva Área
                    </button>
                </div>
            </div>

            {/* CONTENIDO AGRUPADO O PLANO */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 animate-pulse h-24" />
                    ))}
                </div>
            ) : filteredAreas.length === 0 ? (
                <div className="py-20 text-center">
                    <div className="inline-block p-4 rounded-full bg-gray-50 mb-3">
                        <Layers size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium text-lg">No se encontraron áreas</p>
                    <p className="text-gray-400 text-sm mt-1">
                        {search || empresaFiltro
                            ? 'Prueba cambiando los filtros.'
                            : 'Crea la primera área con el botón de arriba.'}
                    </p>
                </div>
            ) : empresaFiltro ? (
                // Vista plana cuando hay filtro de empresa
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredAreas.map(area => (
                        <AreaCard key={area.id} area={area} onEdit={handleEdit} onDelete={() => setDeleteModal({ open: true, id: area.id })} showEmpresa={false} />
                    ))}
                </div>
            ) : (
                // Vista agrupada por empresa cuando no hay filtro
                empresas.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredAreas.map(area => (
                            <AreaCard key={area.id} area={area} onEdit={handleEdit} onDelete={() => setDeleteModal({ open: true, id: area.id })} showEmpresa={true} />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {empresas.map(empresa => {
                            const areasDeEmpresa = filteredAreas.filter(a => a.empresaId === empresa.id);
                            const sinEmpresa = filteredAreas.filter(a => !a.empresaId);
                            // Solo renderizar si hay áreas
                            if (areasDeEmpresa.length === 0) return null;
                            return (
                                <div key={empresa.id}>
                                    {/* Cabecera de grupo */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={16} className="text-gray-400" />
                                            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wider">{empresa.name}</h2>
                                        </div>
                                        <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {areasDeEmpresa.length} área{areasDeEmpresa.length !== 1 ? 's' : ''}
                                        </span>
                                        <div className="flex-1 h-px bg-gray-100" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {areasDeEmpresa.map(area => (
                                            <AreaCard key={area.id} area={area} onEdit={handleEdit} onDelete={() => setDeleteModal({ open: true, id: area.id })} showEmpresa={false} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Áreas sin empresa asignada (legado) */}
                        {filteredAreas.filter(a => !a.empresaId).length > 0 && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Layers size={16} className="text-gray-400" />
                                        <h2 className="font-bold text-gray-400 text-sm uppercase tracking-wider">Sin empresa asignada</h2>
                                    </div>
                                    <div className="flex-1 h-px bg-gray-100" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredAreas.filter(a => !a.empresaId).map(area => (
                                        <AreaCard key={area.id} area={area} onEdit={handleEdit} onDelete={() => setDeleteModal({ open: true, id: area.id })} showEmpresa={false} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            )}

            {/* MODALES */}
            <NewAreaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} areaToEdit={areaToEdit} />
            <ConfirmModal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, id: null })}
                onConfirm={handleDelete}
                title="¿Eliminar Área?"
                message="Asegúrate de que no haya usuarios asignados a esta área antes de eliminarla."
                loading={deleting}
            />
        </div>
    );
};

// ── Tarjeta de Área reutilizable ───────────────────────────
const AreaCard = ({ area, onEdit, onDelete, showEmpresa }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative group">
        <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Layers size={18} />
            </div>
            <h3 className="font-bold text-gray-800 text-base uppercase truncate">{area.name}</h3>
        </div>
        {showEmpresa && area.empresaName && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Building2 size={11} /> {area.empresaName}
            </p>
        )}

        {/* Botones de acción */}
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
                onClick={() => onEdit(area)}
                className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Editar"
            >
                <Edit2 size={14} />
            </button>
            <button
                onClick={onDelete}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Eliminar"
            >
                <Trash2 size={14} />
            </button>
        </div>
    </div>
);

export default Areas;
