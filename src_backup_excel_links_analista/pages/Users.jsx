import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Mail, Briefcase, Shield, Edit2, Layers, Building2, ChevronDown, Check, X } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth, isSuperUser, isSuperUser1, SUPER_ROLE_LABELS } from '../context/AuthContext';
import NewUserModal from '../components/NewUserModal';
import ConfirmModal from '../components/ConfirmModal';

const Users = () => {
    const { user: currentUser, activeEmpresa, hasGlobalAccess } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [empresaFilter, setEmpresaFilter] = useState("Todas");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [allEmpresas, setAllEmpresas] = useState([]);
    // --- ESTADOS DROPDOWN EMPRESA ---
    const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
    const [empresaSearch, setEmpresaSearch] = useState('');
    const empresaDropdownRef = React.useRef(null);

    // Sync empresaFilter with context for non-global users
    useEffect(() => {
        if (!hasGlobalAccess && activeEmpresa && activeEmpresa !== 'Todas') {
            setEmpresaFilter(activeEmpresa);
        }
    }, [activeEmpresa, hasGlobalAccess]);

    // Cargar Usuarios
    useEffect(() => {
        // Consultamos todos con orden, y filtramos en memoria para evitar errores de índice compuesto de Firestore
        const q = query(collection(db, "users"), orderBy("name"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtrado Multi-tenant en cliente
            let filtered;
            if (activeEmpresa === 'Todas') {
                filtered = allUsers;
            } else {
                filtered = allUsers.filter(u => 
                    Array.isArray(u.empresas) && u.empresas.includes(activeEmpresa)
                );
            }
            setUsers(filtered);
            setLoading(false);
        }, (error) => {
            console.error("Error loading users:", error);
            setLoading(false);
            toast.error("Error al cargar usuarios");
        });
        return () => unsubscribe();
    }, [activeEmpresa]);

    // Cargar Todas las Empresas (para el filtro)
    useEffect(() => {
        const q = query(collection(db, "empresas"), orderBy("name"));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => d.data().name);
            setAllEmpresas(list);
        });
        return unsub;
    }, []);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (empresaDropdownRef.current && !empresaDropdownRef.current.contains(event.target)) {
                setIsEmpresaDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Extraer empresas únicas para el filtro de Super Usuario
    const uniqueEmpresas = [...new Set(users.flatMap(u => u.empresas || []))].filter(Boolean).sort();

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || 
                              u.email?.toLowerCase().includes(search.toLowerCase());
        
        let matchesEmpresa = false;
        const targetEmpresas = Array.isArray(u.empresas) ? u.empresas : [];

        if (hasGlobalAccess) {
            // Usuarios con acceso global (Artories o SuperUsuarios) usan el filtro del select "empresaFilter"
            matchesEmpresa = (empresaFilter === "Todas") || targetEmpresas.includes(empresaFilter);
        } else {
            // El admin (y otros) solo ven los de su contexto (empresa activa) o de sus empresas asignadas
            if (activeEmpresa) {
                matchesEmpresa = targetEmpresas.includes(activeEmpresa);
            } else {
                const misEmpresas = currentUser?.empresas || [];
                matchesEmpresa = targetEmpresas.some(e => misEmpresas.includes(e));
            }
        }

        return matchesSearch && matchesEmpresa;
    });

    const handleEdit = (user) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setUserToEdit(null);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;
        try {
            await deleteDoc(doc(db, "users", deleteModal.id));
            toast.success("Usuario eliminado");
            setDeleteModal({ open: false, id: null });
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    const getRoleBadge = (role) => {
        const r = (role || 'user').toLowerCase();
        
        // Estilos para Super Usuarios (1-5)
        if (isSuperUser(r)) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm flex items-center gap-1 whitespace-nowrap">
                    <Shield size={10} fill="currentColor" />
                    {SUPER_ROLE_LABELS[r] || r}
                </span>
            );
        }

        const styles = {
            admin: "bg-purple-100 text-purple-700 border-purple-200",
            editor: "bg-blue-100 text-blue-700 border-blue-200",
            jefe: "bg-orange-100 text-orange-700 border-orange-200",
            user: "bg-gray-100 text-gray-600 border-gray-200"
        };
        return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${styles[r] || styles.user}`}>{r}</span>;
    };

    // Función auxiliar para mostrar áreas (soporta string antiguo y array nuevo)
    const getDisplayAreas = (user) => {
        if (Array.isArray(user.areas) && user.areas.length > 0) {
            return user.areas.join(', ');
        }
        return user.area || "Sin Área";
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4" data-ai="users-header">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios</h1>
                    <p className="text-sm text-gray-500">Administra el acceso y roles del personal.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
                    
                    {/* FILTRO GLOBAL (Super Usuarios o Miembros de Artories) */}
                    {hasGlobalAccess && (
                        <div className="relative w-full sm:w-64" ref={empresaDropdownRef}>
                            <div 
                                className="w-full h-[42px] px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors group"
                                onClick={() => setIsEmpresaDropdownOpen(!isEmpresaDropdownOpen)}
                                data-ai="company-filter"
                            >
                                <div className="flex items-center gap-2 truncate pr-2">
                                    <Building2 size={14} className="text-blue-400 shrink-0" />
                                    <span className="truncate font-semibold">
                                        {empresaFilter === 'Todas' ? 'Todas las Empresas' : empresaFilter}
                                    </span>
                                </div>
                                <ChevronDown size={14} className={`text-blue-400 transition-transform ${isEmpresaDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isEmpresaDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-blue-100 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                                    {/* Buscador interno */}
                                    <div className="p-2 border-b border-gray-50 flex items-center gap-2">
                                        <Search size={14} className="text-gray-400" />
                                        <input 
                                            type="text"
                                            value={empresaSearch}
                                            onChange={(e) => setEmpresaSearch(e.target.value)}
                                            placeholder="Buscar empresa..."
                                            className="w-full text-xs outline-none bg-transparent"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>

                                    <div className="max-h-60 overflow-y-auto">
                                        <div 
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between ${empresaFilter === 'Todas' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}`}
                                            onClick={() => { setEmpresaFilter('Todas'); setIsEmpresaDropdownOpen(false); setEmpresaSearch(''); }}
                                        >
                                            Todas las Empresas
                                            {empresaFilter === 'Todas' && <Check size={14} />}
                                        </div>
                                        {(() => {
                                            const filtered = allEmpresas.filter(e => e.toLowerCase().includes(empresaSearch.toLowerCase()));
                                            
                                            // Si no hay búsqueda, mostramos un número limitado (2) como pidió el usuario inicialmente
                                            const displayed = (empresaSearch === '' && filtered.length > 2) ? filtered.slice(0, 2) : filtered;

                                            if (displayed.length === 0 && empresaSearch !== '') {
                                                return <div className="px-3 py-4 text-center text-xs text-gray-400 italic">No se encontraron empresas</div>;
                                            }

                                            return (
                                                <>
                                                    {displayed.map(emp => (
                                                        <div 
                                                            key={emp}
                                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between ${empresaFilter === emp ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}`}
                                                            onClick={() => { setEmpresaFilter(emp); setIsEmpresaDropdownOpen(false); setEmpresaSearch(''); }}
                                                        >
                                                            <span className="truncate">{emp}</span>
                                                            {empresaFilter === emp && <Check size={14} />}
                                                        </div>
                                                    ))}
                                                    {empresaSearch === '' && filtered.length > 2 && (
                                                        <div className="px-3 py-1.5 text-[10px] text-center text-gray-400 bg-gray-50 border-t italic">
                                                            Escribe para ver más empresas...
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BUSCADOR */}
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar usuario..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 focus:bg-white transition-colors" 
                            data-ai="search-users"
                        />
                    </div>
                    
                    {/* BOTÓN CREAR */}
                    <button 
                        onClick={handleCreate} 
                        className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold py-2 px-6 rounded-lg shadow-md flex items-center justify-center gap-2 text-sm transition-transform active:scale-95 whitespace-nowrap"
                        data-ai-action="create-user"
                    >
                        <Plus size={18} /> Nuevo Usuario
                    </button>
                </div>
            </div>

            {/* GRID DE USUARIOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-10" data-ai="users-grid">
                {loading ? <p className="col-span-full text-center py-10 text-gray-500">Cargando...</p> : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                        const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'US';
                        return (
                            <div key={user.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative group flex flex-col h-full min-h-[200px]">

                                {/* Cabecera Tarjeta */}
                                <div className="flex justify-between items-start mb-4 gap-2">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-500 font-bold text-lg border border-gray-200">{initials}</div>
                                    {getRoleBadge(user.role)}
                                </div>

                                {/* Cuerpo Tarjeta */}
                                <div className="mb-4 flex-1">
                                    <h3 className="font-bold text-gray-800 text-lg leading-tight mb-1 break-words">{user.name}</h3>
                                    <div className="flex items-start gap-2 text-sm text-gray-500 mb-1">
                                        <Mail size={14} className="text-gray-400 mt-1 flex-shrink-0" />
                                        <span className="break-all leading-tight">{user.email}</span>
                                    </div>
                                </div>

                                {/* Pie Tarjeta */}
                                <div className="space-y-2 pt-3 border-t border-gray-50 pb-8">
                                    <div className="flex items-start gap-2 text-xs text-gray-500">
                                        <Briefcase size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                        <span className="font-medium text-gray-700 break-words leading-tight">{user.cargo || "Sin cargo"}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-xs text-gray-500">
                                        <Layers size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                        <span className="uppercase break-words leading-tight line-clamp-2" title={getDisplayAreas(user)}>
                                            {getDisplayAreas(user)}
                                        </span>
                                    </div>
                                    {/* Empresas asignadas */}
                                    <div className="flex items-start gap-2 text-xs text-gray-500">
                                        <Building2 size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                        {Array.isArray(user.empresas) && user.empresas.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {user.empresas.map(emp => (
                                                    <span key={emp} className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                        {emp}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">Todas las empresas</span>
                                        )}
                                    </div>
                                </div>

                                {/* Botones de Acción */}
                                <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                                    {/* 
                                        SEGURIDAD SUPER USUARIOS:
                                    */}
                                    {(() => {
                                        const targetIsSuper = isSuperUser(user.role);
                                        const iAmSuper1 = isSuperUser1(currentUser?.role);
                                        const isMySelf = currentUser?.uid === user.id;
                                        
                                        const showEdit = targetIsSuper 
                                            ? (iAmSuper1 || isMySelf)
                                            : (iAmSuper1 || currentUser?.role === 'admin');

                                        const showDelete = targetIsSuper
                                            ? iAmSuper1
                                            : (iAmSuper1 || currentUser?.role === 'admin');

                                        return (
                                            <>
                                                {showEdit && (
                                                    <button onClick={() => handleEdit(user)} className="p-2 bg-white text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-full shadow-sm transition-all" title="Editar" data-ai-action="edit-user">
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                                {showDelete && (
                                                    <button onClick={() => setDeleteModal({ open: true, id: user.id })} className="p-2 bg-white text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-full shadow-sm transition-all" title="Eliminar" data-ai-action="delete-user">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })
                ) : <div className="col-span-full py-16 text-center"><p className="text-gray-500 font-medium">No se encontraron usuarios</p></div>}
            </div>

            <NewUserModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                userToEdit={userToEdit} 
                defaultEmpresa={empresaFilter}
            />
            <ConfirmModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} onConfirm={handleDelete} title="¿Eliminar Usuario?" message="Se perderá el acceso de este personal a la plataforma." />
        </div>
    );
};
export default Users;
