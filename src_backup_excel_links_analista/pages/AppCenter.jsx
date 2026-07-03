import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth, isSuperUser, SUPER_ROLE_LABELS } from '../context/AuthContext';
import {
    LayoutDashboard, FileText, Megaphone, Book,
    ExternalLink, Users, Building2, LogOut,
    ChevronRight, Sparkles, ArrowRight, Star,
    ChevronDown, Search, Lock, Check, PowerOff,
    TrendingUp, BadgeDollarSign, ShoppingCart, UserCheck,
    Palette, Type, Image, Layers, User, Wallet, TrendingDown
} from 'lucide-react';

import AppIcon from '../components/AppIcon';

/* ─── Datos de los módulos ─────────────────────────────────── */
const MODULES = [
    {
        id: 'marketing',
        name: 'Marketing',
        label: 'Módulo de Marketing',
        description: 'Gestión completa de solicitudes, campañas, contenido digital y comunicación creativa.',
        route: '/dashboard',
        color: 'from-blue-600 to-indigo-700',
        shadowColor: 'shadow-blue-500/30',
        ringColor: 'ring-blue-400/30',
        bgGlow: 'bg-blue-500',
        icon: <Megaphone size={36} className="text-white" />,
        features: [
            { icon: <LayoutDashboard size={14} />, label: 'Dashboard' },
            { icon: <FileText size={14} />, label: 'Solicitudes' },
            { icon: <Megaphone size={14} />, label: 'Campañas' },
            { icon: <Book size={14} />, label: 'Cuadernos' },
            { icon: <ExternalLink size={14} />, label: 'Links' },
        ],
        badge: 'Contenido & Creatividad',
        badgeColor: 'bg-blue-500/20 text-blue-200',
    },
    {
        id: 'empresas',
        name: 'Empresas',
        label: 'Gestión Empresarial',
        description: 'Administra las empresas, sus áreas operativas y los usuarios con acceso al sistema.',
        route: '/empresas',
        color: 'from-violet-600 to-purple-800',
        shadowColor: 'shadow-violet-500/30',
        ringColor: 'ring-violet-400/30',
        bgGlow: 'bg-violet-500',
        icon: <Building2 size={36} className="text-white" />,
        features: [
            { icon: <Building2 size={14} />, label: 'Empresas & Áreas' },
            { icon: <Users size={14} />, label: 'Usuarios' },
        ],
        badge: 'Administración',
        badgeColor: 'bg-violet-500/20 text-violet-200',
    },
    {
        id: 'ventas',
        name: 'Ventas',
        label: 'Módulo de Ventas',
        description: 'Control de cotizaciones, órdenes de compra y CRM integrado para gestión comercial.',
        route: '/ventas',
        color: 'from-emerald-600 to-teal-800',
        shadowColor: 'shadow-emerald-500/30',
        ringColor: 'ring-emerald-400/30',
        bgGlow: 'bg-emerald-500',
        icon: <TrendingUp size={36} className="text-white" />,
        features: [
            { icon: <BadgeDollarSign size={14} />, label: 'Cotizaciones' },
            { icon: <ShoppingCart size={14} />, label: 'Órdenes' },
            { icon: <UserCheck size={14} />, label: 'CRM' },
        ],
        badge: 'Comercial & Negocios',
        badgeColor: 'bg-emerald-500/20 text-emerald-200',
    },
    {
        id: 'workflow-ai',
        name: 'Artories IA',
        label: 'Artories IA',
        description: 'Asistente de inteligencia artificial impulsado por Gemini. Análisis experto, Six Sigma, insights estratégicos y mucho más — todo con datos internos.',
        route: '/workflow-ai',
        color: 'from-zinc-900 to-black',
        shadowColor: 'shadow-violet-500/30',
        ringColor: 'ring-violet-400/30',
        bgGlow: 'bg-violet-500',
        icon: <Sparkles size={36} className="text-violet-400" />,
        features: [
            { icon: <Sparkles size={14} />, label: 'Chat IA' },
            { icon: <TrendingUp size={14} />, label: 'Six Sigma' },
            { icon: <UserCheck size={14} />, label: 'Análisis Datos' },
        ],
        badge: 'Inteligencia & Análisis',
        badgeColor: 'bg-violet-500/20 text-violet-200',
    },
    {
        id: 'branding',
        name: 'Marca',
        label: 'Gestión Estratégica de Marca',
        description: 'Decisiones de marca, estrategias de posicionamiento, identidad visual y buyer personas para construir marcas sólidas.',
        route: '/branding',
        color: 'from-violet-600 to-pink-700',
        shadowColor: 'shadow-violet-500/30',
        ringColor: 'ring-violet-400/30',
        bgGlow: 'bg-violet-500',
        icon: <Palette size={36} className="text-white" />,
        features: [
            { icon: <Sparkles size={14} />, label: 'Identidad Visual' },
            { icon: <User size={14} />, label: 'Buyer Persona' },
            { icon: <TrendingUp size={14} />, label: 'Estrategias' },
        ],
        badge: 'Estrategia & Marca',
        badgeColor: 'bg-violet-500/20 text-violet-200',
    },
    {
        id: 'finanzas',
        name: 'Finanzas',
        label: 'Gestión Financiera',
        description: 'Gestión de ingresos, egresos, flujo de caja y cuentas por cobrar/pagar.',
        route: '/finanzas',
        color: 'from-indigo-600 to-blue-800',
        shadowColor: 'shadow-indigo-500/30',
        ringColor: 'ring-indigo-400/30',
        bgGlow: 'bg-indigo-500',
        icon: <Wallet size={36} className="text-white" />,
        features: [
            { icon: <Wallet size={14} />, label: 'Dashboard' },
            { icon: <TrendingUp size={14} />, label: 'Ingresos' },
            { icon: <TrendingDown size={14} />, label: 'Egresos' },
        ],
        badge: 'Gestión Financiera',
        badgeColor: 'bg-indigo-500/20 text-indigo-200',
    },
];

/* ─── Componente ───────────────────────────────────────────── */
const AppCenter = () => {
    const { user, logout, activeEmpresa, changeActiveEmpresa, hasGlobalAccess, isEmpresaDisabled } = useAuth();
    const navigate = useNavigate();
    const [empresas, setEmpresas] = useState([]);
    const [loadingEmpresas, setLoadingEmpresas] = useState(true);
    
    // --- ESTADOS DROPDOWN PERSONALIZADO ---
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // Get active empresa data for status display
    const activeEmpresaData = empresas.find(emp => emp.name === activeEmpresa);

    useEffect(() => {
        const fetchEmpresas = async () => {
            try {
                const q = query(collection(db, 'empresas'), orderBy('name'));
                const snapshot = await getDocs(q);
                const allEmpresas = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    status: doc.data().status || 'on',
                    accessibleModules: doc.data().accessibleModules || []
                }));

                if (hasGlobalAccess) {
                    setEmpresas([{ name: 'Todas', status: 'on', accessibleModules: [] }, ...allEmpresas]);
                } else {
                    setEmpresas(allEmpresas);
                }
            } catch (error) {
                console.error("Error cargando empresas:", error);
            } finally {
                setLoadingEmpresas(false);
            }
        };

        if (user) {
            fetchEmpresas();
        }
    }, [user, hasGlobalAccess]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleEnterModule = (route) => {
        if (!activeEmpresa) {
            toast.error('Selecciona una empresa', {
                description: 'Por favor, elige un entorno de trabajo en el desplegable para continuar.',
            });
            return;
        }
        if (isEmpresaDisabled) {
            toast.error('Empresa Desactivada', {
                description: 'La empresa seleccionada está actualmente desactivada. Por favor, elige otra.',
            });
            return;
        }
        navigate(route);
    };

    const initials = user?.name
        ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        : 'U';

    return (
        <div className="min-h-screen bg-[#0a0f1e] flex flex-col relative overflow-hidden">

            {/* ── Glow de fondo ── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-900/10 blur-[150px]" />
                {/* Grid de puntos */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }}
                />
            </div>

            {/* ── HEADER ── */}
            <header className="relative z-10 flex items-center justify-between px-8 py-5">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20 backdrop-blur-sm">
                        <AppIcon className="w-6 h-6" variant="white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm leading-tight tracking-wide">ARTORIES</p>
                        <p className="text-white/40 text-[10px] uppercase tracking-widest">Management Suite</p>
                    </div>
                </div>

                {/* Usuario */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                            {initials}
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-white text-sm font-semibold leading-tight">{user?.name}</p>
                            <p className="text-white/40 text-[10px] capitalize flex items-center gap-1 justify-end">
                                {isSuperUser(user?.role) && <Star size={10} className="text-amber-400" fill="currentColor" />}
                                {SUPER_ROLE_LABELS[user?.role] || user?.role}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
                        title="Cerrar sesión"
                    >
                        <LogOut size={15} />
                        <span className="hidden sm:inline">Salir</span>
                    </button>
                </div>
            </header>

            {/* ── HERO ── */}
            <div className="relative z-30 flex flex-col items-center justify-center text-center px-6 pt-10 pb-12">
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
                    <Sparkles size={13} className="text-yellow-400" />
                    <span className="text-white/60 text-xs font-medium">Centro de Aplicaciones</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
                    Bienvenido, <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0]}</span>
                </h1>
                <p className="text-white/40 text-base max-w-md mb-8">
                    Selecciona un módulo para comenzar a trabajar.
                </p>

                {/* SELECTOR DE EMPRESA PERSONALIZADO */}
                <div className="w-full max-w-sm relative z-20">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                        <label className="block text-xs font-semibold text-white/50 text-left mb-2 px-1 uppercase tracking-wider">
                            Entorno de Trabajo
                        </label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                disabled={loadingEmpresas}
                                className="w-full text-left bg-black/20 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all hover:bg-black/30 flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Building2 size={16} className="text-white/50 shrink-0" />
                                    <span className="truncate font-medium">
                                        {loadingEmpresas ? 'Cargando empresas...' : 
                                            (!activeEmpresa ? 'Seleccione una empresa...' : (activeEmpresa === 'Todas' ? '🌟 Vista Global (Todas)' : activeEmpresa))
                                        }
                                    </span>
                                    {activeEmpresaData?.status === 'off' && <PowerOff size={12} className="text-red-500 ml-2" />}
                                </div>
                                <ChevronDown size={16} className={`text-white/50 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'group-hover:text-white'}`} />
                            </button>

                            {isOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-[#0d1326] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 transform origin-top animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                    {/* Buscador */}
                                    <div className="p-2 border-b border-white/10 relative shrink-0">
                                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Buscar empresa..."
                                            className="w-full bg-black/30 text-white text-sm rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-white/30"
                                            autoFocus
                                        />
                                    </div>
                                    
                                    {/* Lista de opciones recomendadas */}
                                    <div className="max-h-56 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                        {(() => {
                                            const filtered = empresas
                                                .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .sort((a, b) => {
                                                    const isGlobalA = a.name === 'Todas';
                                                    const isGlobalB = b.name === 'Todas';
                                                    if (isGlobalA) return -1;
                                                    if (isGlobalB) return 1;

                                                    const userEmpresas = user?.empresas || [];
                                                    const hasA = userEmpresas.includes(a.name);
                                                    const hasB = userEmpresas.includes(b.name);

                                                    if (hasA && !hasB) return -1;
                                                    if (!hasA && hasB) return 1;

                                                    return a.name.localeCompare(b.name);
                                                });

                                            if (filtered.length === 0) {
                                                return <div className="px-3 py-6 text-center text-xs text-white/40">No se encontraron coincidencias</div>;
                                            }

                                            return (
                                                <>
                                                    {filtered.map(emp => {
                                                        const isGlobalItem = emp.name === 'Todas';
                                                        const hasAccessToItem = (user?.empresas || []).includes(emp.name);
                                                        const canSelect = hasGlobalAccess || isGlobalItem ? true : hasAccessToItem;
                                                        const isSelected = activeEmpresa === emp.name;
                                                        const isOff = emp.status === 'off';
                                                        const isBlocked = isOff && !isSuperUser(user?.role);

                                                        return (
                                                            <button
                                                                key={emp.name}
                                                                disabled={!canSelect || isBlocked}
                                                                onClick={() => {
                                                                    if(canSelect && !isBlocked) {
                                                                        changeActiveEmpresa(emp.name);
                                                                        setIsOpen(false);
                                                                        setSearchQuery('');
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors mb-0.5 last:mb-0
                                                                    ${(!canSelect || isBlocked) ? 'opacity-60 text-gray-400 cursor-not-allowed bg-transparent' : 
                                                                      isSelected ? 'bg-indigo-600/20 text-indigo-300 font-medium' : 'text-gray-300 hover:bg-white/5 hover:text-white'}
                                                                `}
                                                            >
                                                                <div className="flex items-center gap-2 truncate pr-2">
                                                                    <span className="truncate">{isGlobalItem ? '🌟 Vista Global (Todas)' : emp.name}</span>
                                                                    {isOff && !isGlobalItem && <PowerOff size={10} className="text-red-500 shrink-0" />}
                                                                </div>
                                                                {!canSelect && <Lock size={12} className="shrink-0 text-white/50" />}
                                                                {isBlocked && !isGlobalItem && <Lock size={12} className="shrink-0 text-red-400" />}
                                                                {isSelected && <Check size={14} className="shrink-0 text-indigo-400" />}
                                                            </button>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── TARJETAS DE MÓDULOS ── */}
            <main className="relative z-10 flex-1 flex items-start justify-center px-6 pb-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
                    {(() => {
                        const isSU = isSuperUser(user?.role);
                        const isGlobal = activeEmpresa === 'Todas';

                        // Módulos habilitados en la empresa activa
                        const empresaData = empresas.find(e => e.name === activeEmpresa);
                        const empresaMods = empresaData?.accessibleModules || [];

                        // Módulos del usuario (accessibleApps en su perfil)
                        const userApps = Array.isArray(user?.accessibleApps) ? user.accessibleApps : [];

                        return MODULES
                            .filter(mod => {
                                // Ocultar módulo de branding en Vista Global
                                if (isGlobal && mod.id === 'branding') return false;

                                // 1. Restricción principal de la empresa (aplica a todos, incluso Super Usuarios)
                                // Si NO es vista global, y la empresa actual NO tiene el módulo habilitado, lo ocultamos.
                                if (!isGlobal && !empresaMods.includes(mod.id)) {
                                    return false; 
                                }

                                // 2. Restricción de permisos individuales del usuario
                                // El Superusuario se salta sus propias restricciones, pudiendo entrar a lo que la empresa permita.
                                if (isSU) return true;
                                
                                // Para usuarios normales, se exige que tengan el permiso asignado en su cuenta.
                                return userApps.includes(mod.id);
                            })

                            .map(mod => (
                                <ModuleCard key={mod.id} mod={mod} onEnter={() => handleEnterModule(mod.route)} />
                            ));
                    })()}
                </div>
            </main>

            {/* ── FOOTER ── */}
            <footer className="relative z-10 text-center pb-6">
                <p className="text-white/20 text-xs">
                    Artories Management Suite &copy; {new Date().getFullYear()}
                </p>
            </footer>
        </div>
    );
};

/* ─── Tarjeta de módulo ────────────────────────────────────── */
const ModuleCard = ({ mod, onEnter }) => (
    <button
        onClick={onEnter}
        className={`group relative text-left w-full rounded-2xl overflow-hidden border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${mod.shadowColor} focus:outline-none focus:ring-2 ${mod.ringColor}`}
    >
        {/* Glow interior */}
        <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${mod.bgGlow} opacity-20 blur-3xl group-hover:opacity-30 transition-opacity`} />

        {/* Gradiente de fondo */}
        <div className={`absolute inset-0 bg-gradient-to-br ${mod.color} opacity-90`} />

        {/* Patrón sutil */}
        <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
                backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                backgroundSize: '20px 20px',
            }}
        />

        {/* Contenido */}
        <div className="relative p-7">
            {/* Badge + icono */}
            <div className="flex items-start justify-between mb-5">
                <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 group-hover:scale-110 transition-transform duration-300">
                    {mod.icon}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${mod.badgeColor}`}>
                    {mod.badge}
                </span>
            </div>

            {/* Nombre y descripción */}
            <h2 className="text-white font-extrabold text-xl mb-1 leading-tight">{mod.label}</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-5">{mod.description}</p>

            {/* Features */}
            <div className="flex flex-wrap gap-2 mb-6">
                {mod.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-white/70 text-xs font-medium">
                        {f.icon}
                        {f.label}
                    </div>
                ))}
            </div>

            {/* CTA */}
            <div className="flex items-center justify-between">
                <span className="text-white font-bold text-sm group-hover:underline underline-offset-2">
                    Ingresar al módulo
                </span>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 group-hover:translate-x-1 transition-all duration-200">
                    <ArrowRight size={16} className="text-white" />
                </div>
            </div>
        </div>
    </button>
);

export default AppCenter;
