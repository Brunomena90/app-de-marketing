import React, { useState, useEffect } from 'react';
import {
    Plus, Building2, Search, Trash2, Edit2, Layers,
    ChevronDown, ChevronUp, Check, Power, PowerOff,
    LayoutGrid, Megaphone, TrendingUp, Sparkles, Lock, Unlock, Palette, Wallet,
    Package, Image, GitMerge
} from 'lucide-react';

/* ─── Catálogo de módulos disponibles ─────────────────────── */
const ALL_MODULES = [
    { id: 'marketing',   label: 'Marketing',        icon: <Megaphone size={15} />,   color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'ventas',      label: 'Ventas',            icon: <TrendingUp size={15} />,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'workflow-ai', label: 'WorkFlow AI',       icon: <Sparkles size={15} />,   color: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200' },
    { id: 'branding',    label: 'Marca & Estrategia',icon: <Palette size={15} />,    color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { id: 'finanzas',    label: 'Gestión Financiera',icon: <Wallet size={15} />,     color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    { id: 'empresas',    label: 'Gestión Empresas',  icon: <Building2 size={15} />,  color: 'text-violet-600 bg-violet-50 border-violet-200' },
    { id: 'almacenes',   label: 'Módulo de Almacenes',icon: <Package size={15} />,   color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'media-suite', label: 'Media Suite',       icon: <Image size={15} />,      color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { id: 'procesos',    label: 'Gestión de Procesos',icon: <GitMerge size={15} />,  color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
];
import {
    deleteDoc, doc, where, updateDoc,
    collection, query, orderBy, onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth, isSuperUser5 } from '../context/AuthContext';
import NewEmpresaModal from '../components/NewEmpresaModal';
import NewAreaModal from '../components/NewAreaModal';
import ConfirmModal from '../components/ConfirmModal';

/* ─────────────────────────────────────────────────────────── */
/*  Helpers                                                    */
/* ─────────────────────────────────────────────────────────── */
const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
};

const getBgColor = (name) => {
    if (!name) return 'bg-gray-500';
    const colors = [
        'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500',
        'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-teal-500',
        'bg-cyan-500', 'bg-emerald-500',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
};

/* ─────────────────────────────────────────────────────────── */
/*  Componente principal                                       */
/* ─────────────────────────────────────────────────────────── */
const Empresas = () => {
    const { activeEmpresa, isSuper1, isSuper2, isAdmin, user } = useAuth();
    // Módulos permitidos para el usuario actual (Super Nv.5 tiene lista restringida, resto tiene todos)
    const iAmSuper5 = isSuperUser5(user?.role);
    const myAllowedModules = iAmSuper5
        ? (Array.isArray(user?.accessibleApps) ? user.accessibleApps : [])
        : ALL_MODULES.map(m => m.id); // Super Nv.1-4 y admins pueden todos
    const [empresas, setEmpresas] = useState([]);
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    /* Paneles expandibles — 'areas' | 'modulos' | null por empresa */
    const [expandedPanel, setExpandedPanel] = useState({ id: null, panel: null });

    /* Modal empresa */
    const [empresaModal, setEmpresaModal] = useState({ open: false, item: null });

    /* Modal área */
    const [areaModal, setAreaModal] = useState({ open: false, item: null, empresaId: null, empresaName: null });

    /* Modal confirmación */
    const [confirmModal, setConfirmModal] = useState({
        open: false, type: '', id: null, name: '', loading: false
    });

    /* Actualizar módulos de una empresa */
    const handleToggleModule = async (empresa, moduleId) => {
        // GUARD: Super Nv.5 no puede habilitar módulos fuera de su lista asignada
        if (iAmSuper5 && !myAllowedModules.includes(moduleId)) {
            toast.error('No tienes permiso para habilitar este módulo.');
            return;
        }
        const current = Array.isArray(empresa.accessibleModules) ? empresa.accessibleModules : [];
        const updated = current.includes(moduleId)
            ? current.filter(m => m !== moduleId)
            : [...current, moduleId];
        try {
            await updateDoc(doc(db, 'empresas', empresa.id), { accessibleModules: updated });
            toast.success(`Módulo ${updated.includes(moduleId) ? 'habilitado' : 'deshabilitado'}`);
        } catch {
            toast.error('Error al actualizar módulos');
        }
    };

    const togglePanel = (empresaId, panel) => {
        setExpandedPanel(prev =>
            prev.id === empresaId && prev.panel === panel
                ? { id: null, panel: null }
                : { id: empresaId, panel }
        );
    };

    /* ── Cargar datos ── */
    useEffect(() => {
        const unsubE = onSnapshot(
            query(collection(db, 'empresas'), orderBy('name')),
            snap => {
                setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            }
        );
        const unsubA = onSnapshot(
            query(collection(db, 'areas'), orderBy('name')),
            snap => setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        return () => { unsubE(); unsubA(); };
    }, []);

    const getAreasDeEmpresa = (empresaId) =>
        areas.filter(a => a.empresaId === empresaId);

    /* ── Eliminar ── */
    const handleConfirmDelete = async () => {
        setConfirmModal(p => ({ ...p, loading: true }));
        try {
            const col = confirmModal.type === 'empresa' ? 'empresas' : 'areas';
            await deleteDoc(doc(db, col, confirmModal.id));
            toast.success(`${confirmModal.type === 'empresa' ? 'Empresa' : 'Área'} eliminada`);
            setConfirmModal({ open: false, type: '', id: null, name: '', loading: false });
        } catch {
            toast.error('Error al eliminar');
            setConfirmModal(p => ({ ...p, loading: false }));
        }
    };

    const handleToggleStatus = async (e, empresa) => {
        e.stopPropagation();
        if (!isSuper1 && !isSuper2) {
            toast.error('Privilegios insuficientes para cambiar el estado de la empresa');
            return;
        }
        try {
            const newStatus = empresa.status === 'off' ? 'on' : 'off';
            await updateDoc(doc(db, 'empresas', empresa.id), {
                status: newStatus
            });
            toast.success(`Empresa ${newStatus === 'on' ? 'activada' : 'desactivada'}`);
        } catch {
            toast.error('Error al cambiar estado');
        }
    };

    const filteredEmpresas = empresas.filter(e => {
        const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
        const matchesActive = activeEmpresa === 'Todas' ? !(e.createdBySuperUser5 || e.isSuperUser5Company) : e.name === activeEmpresa;
        return matchesSearch && matchesActive;
    });

    const isCanManage = isAdmin || isSuper1 || isSuper2;

    return (
        <div className="space-y-6">

            {/* ── HEADER ── */}
            <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Gestión de Empresas</h1>
                        <p className="text-sm text-gray-500">Administra empresas y sus áreas operativas.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar empresa..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setEmpresaModal({ open: true, item: null })}
                            className="bg-gray-900 hover:bg-black text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center justify-center gap-1.5 text-sm transition-transform active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={16} /> <span className="hidden sm:inline">Nueva Empresa</span><span className="sm:hidden">Nueva</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── LISTA DE EMPRESAS ── */}
            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse h-20" />
                    ))}
                </div>
            ) : filteredEmpresas.length === 0 ? (
                <div className="py-24 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
                        <Building2 size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium text-lg">No se encontraron empresas</p>
                    <p className="text-gray-400 text-sm mt-1">
                        {search ? `Sin resultados para "${search}"` : 'Crea la primera empresa con el botón de arriba.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredEmpresas.map(empresa => {
                        const areasEmpresa = getAreasDeEmpresa(empresa.id);
                        const isAreasOpen   = expandedPanel.id === empresa.id && expandedPanel.panel === 'areas';
                        const isModulosOpen = expandedPanel.id === empresa.id && expandedPanel.panel === 'modulos';
                        const enabledMods   = Array.isArray(empresa.accessibleModules) ? empresa.accessibleModules : [];

                        return (
                            <div key={empresa.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all">

                                {/* ── Cabecera de empresa ── */}
                                <div className="p-4 md:p-5">
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white font-bold text-base md:text-lg shrink-0 ${getBgColor(empresa.name)}`}>
                                            {getInitials(empresa.name)}
                                        </div>

                                        {/* Info + Acciones */}
                                        <div className="flex-1 min-w-0">
                                            {/* Name row */}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {isCanManage && (
                                                    <button
                                                        onClick={(e) => handleToggleStatus(e, empresa)}
                                                        className={`p-1 rounded-lg transition-all active:scale-90 shrink-0 ${empresa.status === 'off' ? 'text-red-500 bg-red-50' : 'text-emerald-500 bg-emerald-50'}`}
                                                        title={empresa.status === 'off' ? 'Encender empresa' : 'Apagar empresa'}
                                                    >
                                                        {empresa.status === 'off' ? <PowerOff size={15} /> : <Power size={15} />}
                                                    </button>
                                                )}
                                                <h2 className="font-bold text-gray-800 text-base md:text-lg truncate">{empresa.name}</h2>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${empresa.status === 'off' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                    {empresa.status === 'off' ? 'Apagado' : 'Encendido'}
                                                </span>
                                                {empresa.isSuperUser5Company && (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center gap-1">
                                                        <Sparkles size={10} /> Super Usuario 5
                                                    </span>
                                                )}
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[11px] text-gray-400 hidden sm:block">
                                                    {empresa.createdAt ? `Creada el ${new Date(empresa.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Empresa registrada'}
                                                </span>
                                                <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                    <Layers size={10} />
                                                    {areasEmpresa.length} área{areasEmpresa.length !== 1 ? 's' : ''}
                                                </span>
                                                <span className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                                                    <LayoutGrid size={10} />
                                                    {enabledMods.length} módulo{enabledMods.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Action buttons — wrap naturally on mobile */}
                                            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                                <button onClick={() => setEmpresaModal({ open: true, item: empresa })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Editar empresa">
                                                    <Edit2 size={15} />
                                                </button>
                                                <button onClick={() => setConfirmModal({ open: true, type: 'empresa', id: empresa.id, name: empresa.name, loading: false })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Eliminar empresa">
                                                    <Trash2 size={15} />
                                                </button>

                                                {isCanManage && (
                                                    <button
                                                        onClick={() => togglePanel(empresa.id, 'modulos')}
                                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                            isModulosOpen ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100'
                                                        }`}
                                                    >
                                                        <LayoutGrid size={12} /> Módulos
                                                        {isModulosOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => togglePanel(empresa.id, 'areas')}
                                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                                        isAreasOpen ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    <Layers size={12} /> Áreas
                                                    {isAreasOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Panel de MÓDULOS ── */}
                                {isModulosOpen && (
                                    <div className="border-t border-zinc-800/50 bg-zinc-950/50 px-4 py-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <LayoutGrid size={12} /> Módulos — <span className="truncate max-w-[120px] sm:max-w-none text-zinc-300">{empresa.name}</span>
                                            </h3>
                                            <span className="text-[10px] text-violet-400 font-medium">
                                                {enabledMods.length}/{iAmSuper5 ? myAllowedModules.length : ALL_MODULES.length} habilitados
                                            </span>
                                        </div>

                                        {/* Aviso para Super Nv.5 */}
                                        {iAmSuper5 && (
                                            <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                                                <Lock size={12} className="text-amber-400 shrink-0" />
                                                <p className="text-[10px] text-amber-300 font-medium">
                                                    Solo puedes asignar los módulos que el Super Nv.1 te ha concedido ({myAllowedModules.length} disponibles).
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {ALL_MODULES.map(mod => {
                                                const isEnabled = enabledMods.includes(mod.id);
                                                // Si soy Super5, los módulos fuera de mi lista quedan bloqueados
                                                const isRestricted = iAmSuper5 && !myAllowedModules.includes(mod.id);
                                                return (
                                                    <button
                                                        key={mod.id}
                                                        onClick={() => !isRestricted && handleToggleModule(empresa, mod.id)}
                                                        disabled={isRestricted}
                                                        title={isRestricted ? 'Módulo no disponible en tu plan' : ''}
                                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left group ${
                                                            isRestricted
                                                                ? 'bg-zinc-900/40 border-dashed border-zinc-800 opacity-40 cursor-not-allowed'
                                                                : isEnabled
                                                                    ? 'bg-zinc-900 border-violet-500/50 shadow-sm cursor-pointer'
                                                                    : 'bg-zinc-900/60 border-dashed border-zinc-800 hover:border-violet-500/30 cursor-pointer'
                                                        }`}
                                                    >
                                                        {/* Icono del módulo */}
                                                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                                            isRestricted ? 'bg-zinc-900 border-zinc-800 text-zinc-600'
                                                            : isEnabled ? mod.color : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                                                        }`}>
                                                            {isRestricted ? <Lock size={15} /> : mod.icon}
                                                        </div>

                                                        {/* Label */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-bold truncate ${
                                                                isRestricted ? 'text-zinc-600' : isEnabled ? 'text-white' : 'text-zinc-400'
                                                            }`}>{mod.label}</p>
                                                            <p className="text-[10px] font-medium mt-0.5">
                                                                {isRestricted
                                                                    ? <span className="text-zinc-600 flex items-center gap-1"><Lock size={9} /> No disponible</span>
                                                                    : isEnabled
                                                                        ? <span className="text-violet-400 flex items-center gap-1"><Unlock size={9} /> Acceso habilitado</span>
                                                                        : <span className="text-zinc-500 flex items-center gap-1"><Lock size={9} /> Sin acceso</span>
                                                                }
                                                            </p>
                                                        </div>

                                                        {/* Toggle visual */}
                                                        {!isRestricted && (
                                                            <div className={`w-10 h-6 rounded-full flex items-center transition-all shrink-0 px-0.5 ${
                                                                isEnabled ? 'bg-violet-500 justify-end' : 'bg-zinc-800 justify-start'
                                                            }`}>
                                                                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[10px] text-violet-400 mt-3 text-center">
                                            Los cambios se aplican en tiempo real. Los usuarios de esta empresa solo verán los módulos habilitados.
                                        </p>
                                    </div>
                                )}

                                {/* ── Panel de ÁREAS ── */}
                                {isAreasOpen && (
                                    <div className="border-t border-zinc-800/50 bg-zinc-950/50 px-5 py-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                                <Layers size={12} /> Áreas de {empresa.name}
                                            </h3>
                                            <button
                                                onClick={() => setAreaModal({ open: true, item: null, empresaId: empresa.id, empresaName: empresa.name })}
                                                className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-violet-500 hover:text-violet-400 text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                            >
                                                <Plus size={13} /> Nueva Área
                                            </button>
                                        </div>
                                        {areasEmpresa.length === 0 ? (
                                            <div className="py-8 text-center">
                                                <Layers size={24} className="text-gray-300 mx-auto mb-2" />
                                                <p className="text-xs text-gray-400">Esta empresa no tiene áreas aún.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {areasEmpresa.map(area => (
                                                    <div key={area.id} className="bg-zinc-900/80 rounded-lg border border-zinc-800/80 hover:border-violet-500/50 px-4 py-3 flex items-center gap-3 group hover:shadow-sm transition-all">
                                                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                                                            <Layers size={14} className="text-violet-400" />
                                                        </div>
                                                        <span className="flex-1 text-sm font-semibold text-zinc-100 uppercase truncate">{area.name}</span>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => setAreaModal({ open: true, item: area, empresaId: empresa.id, empresaName: empresa.name })} className="p-1.5 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-full transition-colors"><Edit2 size={13} /></button>
                                                            <button onClick={() => setConfirmModal({ open: true, type: 'area', id: area.id, name: area.name, loading: false })} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 size={13} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MODALES ── */}
            <NewEmpresaModal
                isOpen={empresaModal.open}
                onClose={() => setEmpresaModal({ open: false, item: null })}
                empresaToEdit={empresaModal.item}
            />

            <NewAreaModal
                isOpen={areaModal.open}
                onClose={() => setAreaModal({ open: false, item: null, empresaId: null, empresaName: null })}
                areaToEdit={areaModal.item}
                defaultEmpresaId={areaModal.empresaId}
                defaultEmpresaName={areaModal.empresaName}
            />

            <ConfirmModal
                isOpen={confirmModal.open}
                onClose={() => setConfirmModal({ open: false, type: '', id: null, name: '', loading: false })}
                onConfirm={handleConfirmDelete}
                title={`¿Eliminar ${confirmModal.type === 'empresa' ? 'Empresa' : 'Área'}?`}
                message={
                    confirmModal.type === 'empresa'
                        ? `¿Seguro que deseas eliminar "${confirmModal.name}"? Sus áreas asociadas no se eliminarán automáticamente.`
                        : `¿Seguro que deseas eliminar el área "${confirmModal.name}"?`
                }
                confirmText="Eliminar"
                loading={confirmModal.loading}
            />
        </div>
    );
};

export default Empresas;
