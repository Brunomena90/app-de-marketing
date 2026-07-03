import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X, User, Mail, Briefcase, Shield, Layers, Save, Edit2, Lock, Eye, EyeOff, Check, Search, Building2, ChevronDown, Sparkles, LineChart } from 'lucide-react';
import { addDoc, updateDoc, doc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { SUPER_ROLES, SUPER_ROLE_LABELS, useAuth, isSuperUser1, isSuperUser, isSuperUser5 } from '../context/AuthContext';
import { APP_MODULES } from '../lib/constants';

const NewUserModal = ({ isOpen, onClose, userToEdit = null, defaultEmpresa = null }) => {
    const { user: currentUser, activeEmpresa } = useAuth();
    const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
    const [loading, setLoading] = useState(false);
    const [areas, setAreas] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [showPassword, setShowPassword] = useState(false);

    // --- ESTADOS PARA EL BUSCADOR DE ÁREAS ---
    const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
    const [areaSearch, setAreaSearch] = useState('');
    const dropdownRef = useRef(null);

    // --- ESTADOS PARA EL BUSCADOR DE EMPRESAS ---
    const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
    const [empresaSearch, setEmpresaSearch] = useState('');
    const empresaDropdownRef = useRef(null);

    // Observamos las áreas y empresas seleccionadas en el formulario
    const selectedAreas = watch('areas') || [];
    const selectedEmpresas = watch('empresas') || [];
    const selectedApps = watch('accessibleApps') || [];
    const selectedRole = watch('role');

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsAreaDropdownOpen(false);
            }
            if (empresaDropdownRef.current && !empresaDropdownRef.current.contains(event.target)) {
                setIsEmpresaDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cargar lista de áreas disponibles
    useEffect(() => {
        if (isOpen) {
            const q = query(collection(db, 'areas'), orderBy('name'));
            const unsub = onSnapshot(q, (snap) => setAreas(snap.docs.map(d => d.data())));
            return () => unsub();
        }
    }, [isOpen]);

    // Cargar lista de empresas disponibles
    useEffect(() => {
        if (isOpen) {
            const q = query(collection(db, 'empresas'), orderBy('name'));
            const unsub = onSnapshot(q, (snap) => setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
            return () => unsub();
        }
    }, [isOpen]);

    // Rellenar formulario al Editar
    useEffect(() => {
        if (isOpen) {
            setShowPassword(false);
            setAreaSearch('');
            setEmpresaSearch('');
            if (userToEdit) {
                let areasArray = [];
                if (Array.isArray(userToEdit.areas)) {
                    areasArray = userToEdit.areas;
                } else if (userToEdit.area) {
                    areasArray = [userToEdit.area];
                }

                reset({
                    name: userToEdit.name || '',
                    email: userToEdit.email || '',
                    password: userToEdit.password || '',
                    cargo: userToEdit.cargo || '',
                    areas: areasArray,
                    empresas: Array.isArray(userToEdit.empresas) ? userToEdit.empresas : [],
                    accessibleApps: Array.isArray(userToEdit.accessibleApps) ? userToEdit.accessibleApps : [],
                    marketingAIAccess: userToEdit.marketingAIAccess || false,
                    analystFunction: userToEdit.analystFunction || false,
                    role: userToEdit.role || 'user'
                });
            } else {
                reset({ 
                    name: '', 
                    email: '', 
                    password: '', 
                    cargo: '', 
                    areas: [], 
                    empresas: (defaultEmpresa && defaultEmpresa !== 'Todas') ? [defaultEmpresa] : [], 
                    accessibleApps: [],
                    marketingAIAccess: false,
                    analystFunction: false,
                    role: 'user' 
                });
            }
        }
    }, [isOpen, userToEdit, reset, defaultEmpresa]);

    // --- LÓGICA DE ÁREAS ---
    const filteredAreas = areas.filter(a =>
        a.name.toLowerCase().includes(areaSearch.toLowerCase())
    );
    const displayedAreas = filteredAreas.slice(0, 5);

    const toggleArea = (areaName) => {
        const current = selectedAreas;
        if (current.includes(areaName)) {
            setValue('areas', current.filter(a => a !== areaName));
        } else {
            setValue('areas', [...current, areaName]);
        }
        setAreaSearch('');
    };

    const removeTag = (e, areaName) => {
        e.stopPropagation();
        setValue('areas', selectedAreas.filter(a => a !== areaName));
    };

    // --- LÓGICA DE EMPRESAS ---
    const filteredEmpresas = empresas.filter(e =>
        e.name.toLowerCase().includes(empresaSearch.toLowerCase())
    );
    const displayedEmpresas = filteredEmpresas.slice(0, 5);

    const toggleEmpresa = (empresaName) => {
        const current = selectedEmpresas;
        if (current.includes(empresaName)) {
            setValue('empresas', current.filter(e => e !== empresaName));
        } else {
            setValue('empresas', [...current, empresaName]);
        }
        setEmpresaSearch('');
    };

    const removeEmpresaTag = (e, empresaName) => {
        e.stopPropagation();
        setValue('empresas', selectedEmpresas.filter(em => em !== empresaName));
    };

    // --- LÓGICA DE APPS ---
    const toggleApp = (appId) => {
        const current = selectedApps;
        if (current.includes(appId)) {
            setValue('accessibleApps', current.filter(id => id !== appId));
        } else {
            setValue('accessibleApps', [...current, appId]);
        }
    };

    // --- SINCRONIZACIÓN ÁREAS-EMPRESAS ---
    // Si se quita una empresa, debemos quitar las áreas que pertenecen a esa empresa
    useEffect(() => {
        if (selectedAreas.length === 0) return;
        
        const validAreas = selectedAreas.filter(areaName => {
            const matchingAreas = areas.filter(a => a.name === areaName);
            // Si no encontramos el doc (cargando) lo mantenemos por seguridad
            if (matchingAreas.length === 0) return true;
            // Validamos si AL MENOS UNA de las áreas con ese nombre pertenece a las empresas seleccionadas
            return matchingAreas.some(a => selectedEmpresas.includes(a.empresaName));
        });

        if (validAreas.length !== selectedAreas.length) {
            setValue('areas', validAreas);
        }
    }, [selectedEmpresas, areas, selectedAreas, setValue]);

    // (currentUser y activeEmpresa vienen de useAuth en la línea 11)

    // Permitir asignar Super Roles si el que crea es Nivel 1 y está en la vista Global o Artories
    const isArtoriesView = activeEmpresa === 'Todas' || activeEmpresa === 'ARTORIES - TUS HISTORIAS';
    const canAssignSuperRole = isSuperUser1(currentUser?.role) && isArtoriesView;

    // Si el rol seleccionado es Nivel 5, el Nivel 1 puede elegir módulos libremente
    const isEditingSuper5 = isSuperUser5(selectedRole);
    const iAmSuper1 = isSuperUser1(currentUser?.role);
    // Super Usuarios Nivel 1-4 tienen acceso total bloqueado. Nivel 5 puede ser restringido por Nivel 1.
    const superHasFullAccess = isSuperUser(selectedRole) && !isEditingSuper5;
    const super5ModulesEditable = isEditingSuper5 && iAmSuper1;

    const onSubmit = async (data) => {
        // Áreas ya no son obligatorias según requerimiento
        setLoading(true);
        try {
            const userData = {
                name: data.name,
                email: data.email,
                password: data.password,
                cargo: data.cargo,
                areas: selectedAreas,
                area: selectedAreas.length > 0 ? selectedAreas[0] : null,
                empresas: selectedEmpresas,
                // Super Nv.1-4 → acceso total. Super Nv.5 → usa selección manual. Usuarios normales → selectedApps
                accessibleApps: superHasFullAccess
                    ? APP_MODULES.map(m => m.id)
                    : selectedApps,
                marketingAIAccess: data.marketingAIAccess || false,
                analystFunction: data.analystFunction || false,
                role: data.role
            };

            // Eliminar propiedades undefined que rompen Firestore
            Object.keys(userData).forEach(key => userData[key] === undefined && delete userData[key]);

            if (userToEdit) {
                await updateDoc(doc(db, 'users', userToEdit.id), userData);
                toast.success('Usuario actualizado correctamente');
            } else {
                await addDoc(collection(db, 'users'), {
                    ...userData,
                    createdAt: new Date().toISOString()
                });
                toast.success('Usuario creado exitosamente');
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-visible animate-in zoom-in-95 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl shrink-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        {userToEdit ? <><Edit2 size={20} className="text-blue-600" /> Editar Usuario</> : <><User size={20} className="text-blue-600" /> Nuevo Usuario</>}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Formulario Scrollable */}
                <div className="overflow-y-auto p-6">
                    <form id="userForm" onSubmit={handleSubmit(onSubmit)} className="space-y-4">

                        {/* Nombre */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><User size={12} /> Nombre Completo</label>
                            <input {...register('name', { required: 'Requerido' })} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Juan Pérez" />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                        </div>

                        {/* Email y Password */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Mail size={12} /> Correo</label>
                                <input type="email" {...register('email', { required: 'Requerido' })} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="correo@empresa.com" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Lock size={12} /> Contraseña</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        {...register('password', { required: 'Requerido' })}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="********"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Cargo y Áreas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Briefcase size={12} /> Cargo</label>
                                <input {...register('cargo', { required: 'Requerido' })} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Analista" />
                            </div>

                            {/* BUSCADOR DE ÁREAS */}
                            <div className="relative" ref={dropdownRef}>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Layers size={12} /> Áreas Asignadas</label>
                                <div
                                    className="w-full border border-gray-300 rounded-lg p-2 min-h-[42px] bg-white cursor-text flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                                    onClick={() => setIsAreaDropdownOpen(true)}
                                >
                                    {selectedAreas.map(area => (
                                        <span key={area} className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-full font-bold border border-blue-200 flex items-center gap-1 animate-in zoom-in-95">
                                            {area}
                                            <button type="button" onClick={(e) => removeTag(e, area)} className="hover:text-red-500 rounded-full"><X size={10} /></button>
                                        </span>
                                    ))}
                                    <div className="flex-1 min-w-[80px] flex items-center">
                                        {selectedAreas.length === 0 && !areaSearch && <Search size={14} className="text-gray-400 mr-1" />}
                                        <input
                                            type="text"
                                            className="w-full text-sm outline-none bg-transparent placeholder-gray-400"
                                            placeholder={
                                                selectedEmpresas.length === 0 
                                                    ? 'Selecciona una empresa primero...' 
                                                    : (selectedAreas.length === 0 ? 'Buscar área...' : '')
                                            }
                                            value={areaSearch}
                                            onChange={(e) => { setAreaSearch(e.target.value); setIsAreaDropdownOpen(true); }}
                                            onFocus={() => setIsAreaDropdownOpen(true)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (isAreaDropdownOpen && areaSearch) {
                                                        const filteredByCompany = areas.filter(a => selectedEmpresas.length === 0 || selectedEmpresas.includes(a.empresaName));
                                                        const finalFiltered = filteredByCompany.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase()));
                                                        if (finalFiltered.length > 0) {
                                                            toggleArea(finalFiltered[0].name);
                                                        }
                                                    }
                                                }
                                            }}
                                            disabled={selectedEmpresas.length === 0}
                                        />
                                    </div>
                                </div>
                                {isAreaDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95">
                                        {(() => {
                                            const filteredByCompany = areas.filter(a => 
                                                selectedEmpresas.length === 0 || selectedEmpresas.includes(a.empresaName)
                                            );
                                            const finalFiltered = filteredByCompany.filter(a =>
                                                a.name.toLowerCase().includes(areaSearch.toLowerCase())
                                            );
                                            const displayed = finalFiltered.slice(0, 5);

                                            if (selectedEmpresas.length === 0) {
                                                return <div className="px-3 py-4 text-[11px] text-amber-600 bg-amber-50 text-center font-medium italic">Asigna al menos una empresa para ver áreas disponibles.</div>;
                                            }

                                            if (finalFiltered.length === 0) {
                                                return <div className="px-3 py-3 text-xs text-gray-400 text-center">No se encontraron áreas para estas empresas.</div>;
                                            }

                                            return (
                                                <>
                                                    {displayed.map((area, i) => {
                                                        const isSelected = selectedAreas.includes(area.name);
                                                        return (
                                                            <div key={i} onClick={() => toggleArea(area.name)} className={`px-3 py-2 text-sm flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                                                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                                    {isSelected && <Check size={12} className="text-white" />}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span>{area.name}</span>
                                                                    <span className="text-[9px] text-gray-400 uppercase tracking-tighter">{area.empresaName}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {finalFiltered.length > 5 && (
                                                        <div className="px-3 py-1.5 text-[10px] text-center text-gray-400 bg-gray-50 border-t">
                                                            Mostrando 5 de {finalFiltered.length} coincidencias...
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ================================================= */}
                        {/* BUSCADOR DE EMPRESAS                              */}
                        {/* ================================================= */}
                        <div className="relative pt-2" ref={empresaDropdownRef}>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                <Building2 size={12} /> Acceso a Empresas
                                <span className="ml-auto text-[10px] font-normal normal-case text-gray-400">
                                    {selectedEmpresas.length === 0 ? 'Sin restricción' : `${selectedEmpresas.length} seleccionada${selectedEmpresas.length > 1 ? 's' : ''}`}
                                </span>
                            </label>
                            <div
                                className="w-full border border-gray-300 rounded-lg p-2 min-h-[42px] bg-white cursor-text flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                                onClick={() => setIsEmpresaDropdownOpen(true)}
                            >
                                {selectedEmpresas.map(emp => (
                                    <span key={emp} className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded-full font-bold border border-indigo-200 flex items-center gap-1 animate-in zoom-in-95">
                                        {emp}
                                        <button type="button" onClick={(e) => removeEmpresaTag(e, emp)} className="hover:text-red-500 rounded-full"><X size={10} /></button>
                                    </span>
                                ))}
                                <div className="flex-1 min-w-[80px] flex items-center">
                                    {selectedEmpresas.length === 0 && !empresaSearch && <Search size={14} className="text-gray-400 mr-1" />}
                                    <input
                                        type="text"
                                        className="w-full text-sm outline-none bg-transparent placeholder-gray-400"
                                        placeholder={selectedEmpresas.length === 0 ? 'Buscar empresa...' : ''}
                                        value={empresaSearch}
                                        onChange={(e) => { setEmpresaSearch(e.target.value); setIsEmpresaDropdownOpen(true); }}
                                        onFocus={() => setIsEmpresaDropdownOpen(true)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (isEmpresaDropdownOpen && empresaSearch) {
                                                    const filtered = empresas.filter(emp => emp.name.toLowerCase().includes(empresaSearch.toLowerCase()));
                                                    if (filtered.length > 0) {
                                                        toggleEmpresa(filtered[0].name);
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                            {isEmpresaDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95">
                                    {displayedEmpresas.length > 0 ? displayedEmpresas.map((emp, i) => {
                                        const isSelected = selectedEmpresas.includes(emp.name);
                                        return (
                                            <div key={i} onClick={() => toggleEmpresa(emp.name)} className={`px-3 py-2 text-sm flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>
                                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                {emp.name}
                                            </div>
                                        );
                                    }) : (
                                        <div className="px-3 py-3 text-xs text-gray-400 text-center">No se encontraron empresas.</div>
                                    )}
                                    {filteredEmpresas.length > 5 && (
                                        <div className="px-3 py-1.5 text-[10px] text-center text-gray-400 bg-gray-50 border-t">
                                            Mostrando 5 de {filteredEmpresas.length} coincidencias...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Acceso a Aplicaciones */}
                        <div className="pt-2 border-t border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                                <Sparkles size={12} className="text-blue-500" /> Acceso a Aplicaciones
                                {isEditingSuper5 && iAmSuper1 && (
                                    <span className="ml-auto text-[10px] font-normal normal-case text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        Configurando permisos de Super Nv.5
                                    </span>
                                )}
                            </label>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {APP_MODULES.map(app => {
                                    const isChecked = superHasFullAccess || selectedApps.includes(app.id);
                                    // Si es Super 5 y yo soy Super 1, los módulos son editables
                                    const isLocked = superHasFullAccess;
                                    
                                    return (
                                        <div 
                                            key={app.id} 
                                            onClick={() => !isLocked && toggleApp(app.id)}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-xl border transition-all
                                                ${isChecked 
                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                                                    : 'bg-gray-50 border-gray-100 text-gray-500 opacity-60 hover:opacity-100 hover:bg-white'}
                                                ${isLocked ? 'cursor-default ring-1 ring-blue-100' : 'cursor-pointer active:scale-95'}
                                            `}
                                        >
                                            <div className={`
                                                w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                                                ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}
                                            `}>
                                                {isChecked && <Check size={14} className="text-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold leading-tight">{app.name}</span>
                                                <span className="text-[10px] opacity-70 leading-tight">{app.badge}</span>
                                            </div>
                                            {isLocked && <Lock size={12} className="ml-auto text-blue-400 opacity-50" />}
                                        </div>
                                    );
                                })}
                            </div>
                            {superHasFullAccess && (
                                <p className="text-[10px] text-blue-500 mt-2 italic flex items-center gap-1">
                                    <Shield size={10} /> Los Super Usuarios Nv.1-4 tienen acceso total a todas las aplicaciones.
                                </p>
                            )}
                            {isEditingSuper5 && iAmSuper1 && (
                                <p className="text-[10px] text-amber-600 mt-2 italic flex items-center gap-1">
                                    <Shield size={10} /> Como Super Nv.1, puedes definir qué módulos puede ver este Super Nv.5.
                                </p>
                            )}
                            {isEditingSuper5 && !iAmSuper1 && (
                                <p className="text-[10px] text-gray-400 mt-2 italic flex items-center gap-1">
                                    <Lock size={10} /> Los módulos de un Super Nv.5 son definidos por un Super Nv.1.
                                </p>
                            )}
                        </div>

                        {/* Funciones Adicionales */}
                        <div className="pt-2 border-t border-gray-100">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                                <Sparkles size={12} className="text-purple-500" /> Funciones Especiales y Analítica
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-white transition-all">
                                    <input type="checkbox" {...register('marketingAIAccess')} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-700 leading-tight">Asistente IA de Marketing</span>
                                        <span className="text-[10px] text-gray-500 leading-tight mt-0.5">Permite a la IA generar solicitudes basadas en contexto.</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-white transition-all">
                                    <input type="checkbox" {...register('analystFunction')} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-700 leading-tight flex items-center gap-1">Función Analista <LineChart size={12} className="text-blue-500" /></span>
                                        <span className="text-[10px] text-gray-500 leading-tight mt-0.5">Habilita acceso a datos avanzados en reportes exportables.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Rol */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Shield size={12} /> Rol de Sistema</label>
                            <select {...register('role', { required: 'Requerido' })} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <optgroup label="Roles Estándar">
                                    <option value="user">Solicitante</option>
                                    <option value="jefe">Jefe de Área</option>
                                    <option value="editor">Editor</option>
                                    <option value="admin">Administrador</option>
                                </optgroup>
                                {canAssignSuperRole && (
                                    <optgroup label="★ Super Usuarios · Artories">
                                        {SUPER_ROLES.map((r, i) => (
                                            <option key={r} value={r}>
                                                {SUPER_ROLE_LABELS[r]}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                            {isArtoriesView && !isSuperUser1(currentUser?.role) && (
                                <p className="text-[10px] text-gray-400 mt-1 italic">
                                    Nota: Los roles Super Usuario solo pueden ser asignados por un Super Usuario Nivel 1.
                                </p>
                            )}
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="p-5 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2 shrink-0">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" form="userForm" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg shadow-md transition-colors flex items-center gap-2">
                        {loading ? 'Guardando...' : <><Save size={16} /> {userToEdit ? 'Actualizar Datos' : 'Guardar Usuario'}</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
export default NewUserModal;
