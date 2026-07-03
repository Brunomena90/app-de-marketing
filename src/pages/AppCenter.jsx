import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, addDoc, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth, isSuperUser, isSuperUser5, SUPER_ROLE_LABELS } from '../context/AuthContext';
import {
    LayoutDashboard, FileText, Megaphone, Book,
    ExternalLink, Users, Building2, LogOut,
    ChevronRight, Sparkles, ArrowRight, Star,
    ChevronDown, Search, Lock, Check, PowerOff,
    TrendingUp, BadgeDollarSign, ShoppingCart, UserCheck,
    Palette, Type, Image, Layers, User, Wallet, TrendingDown,
    Rocket, Package, ArrowRightLeft, BarChart3, DownloadCloud, PanelRight
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
    {
        id: 'almacenes',
        name: 'Almacenes',
        label: 'Módulo de Almacenes',
        description: 'Gestión de inventario, productos, ingresos y salidas, y balances en tiempo real.',
        route: '/almacenes',
        color: 'from-amber-600 to-orange-800',
        shadowColor: 'shadow-amber-500/30',
        ringColor: 'ring-amber-400/30',
        bgGlow: 'bg-amber-500',
        icon: <Package size={36} className="text-white" />,
        features: [
            { icon: <LayoutDashboard size={14} />, label: 'Dashboard' },
            { icon: <Package size={14} />, label: 'Productos' },
            { icon: <ArrowRightLeft size={14} />, label: 'Movimientos' },
            { icon: <BarChart3 size={14} />, label: 'Balances' },
        ],
        badge: 'Inventario & Logística',
        badgeColor: 'bg-amber-500/20 text-amber-200',
    },
];

/* ─── Componente Onboarding (Creación de Matriz) ───────────── */
const OnboardingFlow = ({ user, changeActiveEmpresa }) => {
    const [empresaName, setEmpresaName] = useState('');
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!empresaName.trim()) return toast.error('Ingresa un nombre para tu empresa matriz');
        setCreating(true);
        try {
            const name = empresaName.trim().toUpperCase();
            
            // 1. Crear empresa con todos los módulos activos
            const newCompanyData = {
                name: name,
                createdAt: new Date().toISOString(),
                accessibleModules: MODULES.map(m => m.id),
                status: 'on'
            };
            await addDoc(collection(db, 'empresas'), newCompanyData);

            // 2. Auto-asignar la empresa al usuario
            const userRef = doc(db, 'users', user.uid || user.id);
            await updateDoc(userRef, {
                empresas: [name]
            });
            
            // 3. Establecer como activa para que entre directo
            changeActiveEmpresa(name);

            toast.success('¡Ecosistema matriz creado con éxito!');
            // El onSnapshot de AuthContext detectará el cambio y actualizará la sesión recargando el AppCenter automáticamente.
        } catch(error) {
            console.error(error);
            toast.error('Error al crear tu ecosistema matriz');
            setCreating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 animate-in fade-in duration-1000">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-violet-600/10 blur-[120px]" />
                <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-blue-600/10 blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-lg bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12 backdrop-blur-md shadow-2xl text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Rocket size={40} className="text-white" />
                </div>
                
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">
                    ¡Bienvenido, {user?.name?.split(' ')[0] || 'Administrador'}!
                </h1>
                
                <p className="text-gray-400 mb-8 leading-relaxed">
                    Para comenzar a utilizar tu ecosistema y gestionar clientes, primero necesitas crear tu <strong className="text-white font-semibold">Empresa Matriz</strong> (tu agencia o negocio principal).
                </p>

                <form onSubmit={handleCreate} className="space-y-5">
                    <div className="text-left relative">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-2 block">Nombre de tu Empresa</label>
                        <Building2 size={20} className="absolute left-4 top-10 text-gray-500" />
                        <input 
                            type="text" 
                            value={empresaName}
                            onChange={(e) => setEmpresaName(e.target.value)}
                            placeholder="Ej. Mi Agencia Creativa"
                            autoFocus
                            className="w-full bg-black/40 border border-white/10 text-white rounded-xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all text-lg"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={creating}
                        className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-violet-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? 'Construyendo ecosistema...' : <><Sparkles size={20} /> Crear mi Empresa Matriz</>}
                    </button>
                </form>
            </div>
            
            <p className="text-white/20 text-xs mt-12 relative z-10">
                Artories Management Suite &copy; {new Date().getFullYear()}
            </p>
        </div>
    );
};

/* ─── Componente AppCenter ───────────────────────────────────────────── */
const AppCenter = () => {
    const { user, logout, activeEmpresa, changeActiveEmpresa, hasGlobalAccess, isEmpresaDisabled, isSuper1 } = useAuth();
    const navigate = useNavigate();
    const [loadingEmpresas, setLoadingEmpresas] = useState(true);
    const [superUsers5, setSuperUsers5] = useState([]);
    
    // --- ESTADOS DE ACTUALIZACIÓN ---
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, downloading, downloaded
    const [downloadProgress, setDownloadProgress] = useState(0);
    
    // --- ESTADOS DROPDOWN PERSONALIZADO ---
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSU5User, setSelectedSU5User] = useState(null);
    const dropdownRef = useRef(null);

    const isElectron = navigator.userAgent.toLowerCase().includes('electron');


    const [allEmpresas, setAllEmpresas] = useState([]);

    useEffect(() => {
        if (!user) return;

        const qEmpresas = query(collection(db, 'empresas'), orderBy('name'));
        const qUsers = query(collection(db, 'users'));

        const unsubEmpresas = onSnapshot(qEmpresas, (snap) => {
            const raw = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                accessibleModules: doc.data().accessibleModules || []
            }));
            setAllEmpresas(raw);
            setLoadingEmpresas(false);
        }, (error) => {
            console.error("Error loading companies:", error);
            setLoadingEmpresas(false);
        });

        const unsubUsers = onSnapshot(qUsers, (snap) => {
            const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const su5Users = users.filter(u => (u.role || '').toLowerCase() === 'superusuario_5');
            
            if (isSuper1) {
                setSuperUsers5(su5Users);
            }
        }, (error) => {
            console.error("Error loading users:", error);
            setLoadingEmpresas(false);
        });

        return () => {
            unsubEmpresas();
            unsubUsers();
        };
    }, [user?.id, isSuper1]);

    // Calcular las empresas visibles (sin modificar el estado empresas para no causar renders infinitos ni re-fetching)
    const empresas = React.useMemo(() => {
        if (!user || allEmpresas.length === 0) return [];
        
        let visibleEmpresas = [];
        const userEmpresasList = user?.empresas || [];

        if (hasGlobalAccess) {
            // Global users (SU1)
            if (selectedSU5User) {
                // Viewing a specific SU5 ecosystem
                visibleEmpresas = allEmpresas.filter(e => 
                    (selectedSU5User.empresas || []).includes(e.name)
                );
            } else {
                // 3. Compute which companies belong to SU5 ecosystems
                const su5CompanyNames = new Set();
                allEmpresas.forEach(emp => {
                    if (emp.createdBySuperUser5 || emp.isSuperUser5Company) {
                        su5CompanyNames.add(emp.name);
                    }
                });
                
                // Viewing their own global ecosystem (excluding SU5 companies)
                const globalEmps = allEmpresas.filter(e => !su5CompanyNames.has(e.name));
                visibleEmpresas = [{ name: 'Todas', status: 'on', accessibleModules: [] }, ...globalEmps];
            }
        } else {
            // Non-global users only see what they are explicitly assigned to
            visibleEmpresas = allEmpresas.filter(e => userEmpresasList.includes(e.name));
        }
        return visibleEmpresas;
    }, [allEmpresas, user, hasGlobalAccess, selectedSU5User]);

    // Get active empresa data for status display
    const activeEmpresaData = empresas.find(emp => emp.name === activeEmpresa);

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

    // --- AUTO UPDATER LISTENER ---
    useEffect(() => {
        if (!window.electronAPI?.isElectron || !window.electronAPI.onUpdaterEvent) return;

        const unsubscribe = window.electronAPI.onUpdaterEvent((eventName, data) => {
            switch(eventName) {
                case 'update-available':
                    setUpdateStatus('available');
                    toast.info('Actualización Disponible', { description: 'Hay una nueva versión de la app de escritorio lista para instalar.' });
                    break;
                case 'update-not-available':
                    setUpdateStatus('idle');
                    toast.success('Software Actualizado', { description: 'Tienes la última versión de la aplicación instalada.' });
                    break;
                case 'download-progress':
                    setUpdateStatus('downloading');
                    if (data?.percent) {
                        setDownloadProgress(Math.round(data.percent));
                    }
                    break;
                case 'update-downloaded':
                    setUpdateStatus('downloaded');
                    toast.success('Descarga Completa', { description: 'La actualización está lista para ser instalada.' });
                    break;
                case 'error':
                    console.error('Error de actualización:', data);
                    setUpdateStatus('idle');
                    toast.error('Error al actualizar', { description: 'Ocurrió un problema al descargar o buscar actualizaciones.' });
                    break;
                default:
                    break;
            }
        });
        return unsubscribe;
    }, []);

    const handleCheckUpdate = () => {
        if (!window.electronAPI?.isElectron) return;
        setUpdateStatus('checking');
        toast('Buscando actualizaciones...', { description: 'Comprobando si existe una nueva versión de la aplicación...' });
        window.electronAPI.checkForUpdates();
    };

    const handleDownloadUpdate = () => {
        if (!window.electronAPI?.isElectron) return;
        setUpdateStatus('downloading');
        setDownloadProgress(0);
        window.electronAPI.downloadUpdate();
    };

    const handleInstallUpdate = () => {
        if (!window.electronAPI?.isElectron) return;
        window.electronAPI.quitAndInstall();
    };

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

    const needsOnboarding = !loadingEmpresas && isSuperUser(user?.role) && !hasGlobalAccess && (!user?.empresas || user.empresas.length === 0);

    if (needsOnboarding) {
        return <OnboardingFlow user={user} changeActiveEmpresa={changeActiveEmpresa} />;
    }

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
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300 transform group-hover:scale-105">
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">ARTORIES</h1>
                        <p className="text-[10px] text-blue-400 font-bold tracking-[0.2em] uppercase">Operating System</p>
                    </div>
                </div>

                {/* Perfil & Logout */}
                <div className="flex items-center gap-4">
                    {isElectron && (
                        <button
                            onClick={() => window.electronAPI?.openFloatingWindow('/')}
                            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20 transition-all cursor-pointer shadow-lg shadow-blue-500/10"
                            title="Abrir Nueva Ventana Flotante"
                        >
                            <PanelRight size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Nueva Ventana</span>
                        </button>
                    )}
                    {isElectron && (
                        <button
                            onClick={handleCheckUpdate}
                            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                            className={`hidden sm:flex items-center gap-2 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/20 transition-all cursor-pointer shadow-lg shadow-indigo-500/10 ${(updateStatus === 'checking' || updateStatus === 'downloading') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Actualizaciones de la App de Escritorio"
                        >
                            <DownloadCloud size={18} className={updateStatus === 'checking' ? 'animate-pulse' : ''} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {updateStatus === 'checking' ? 'Buscando...' : updateStatus === 'downloading' ? 'Descargando' : 'Actualizar'}
                            </span>
                        </button>
                    )}
                    <div className="hidden sm:block text-right">
                        <p className="text-sm font-bold text-white">{user?.name}</p>
                        <p className="text-[11px] text-blue-400 font-medium uppercase tracking-wider">{SUPER_ROLE_LABELS[user?.role] || user?.role}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-white font-bold shadow-inner">
                        {initials}
                    </div>
                    <button
                        onClick={logout}
                        className="ml-2 w-10 h-10 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all duration-300"
                        title="Cerrar Sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* ── MAIN CONTENT ── */}
            <div className="relative z-30 flex flex-col items-center justify-center text-center px-6 pt-10 pb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8 backdrop-blur-sm">
                    <Sparkles size={14} />
                    <span className="text-white/60 text-xs font-medium">Centro de Aplicaciones</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white text-center tracking-tight mb-4 leading-tight">
                    Bienvenido, <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0]}</span>
                </h1>
                <p className="text-white/40 text-base max-w-md mb-8 text-center">
                    Selecciona un módulo para comenzar a trabajar. (Rol: {SUPER_ROLE_LABELS[user?.role] || user?.role})
                </p>

                {/* FILTRO SUPER USUARIO 5 (SOLO PARA NIVEL 1) */}
                {isSuper1 && (
                    <div className="w-full max-w-sm relative z-20 mb-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-600/10 border border-indigo-500/30 rounded-2xl p-4 backdrop-blur-sm shadow-xl">
                            <label className="block text-xs font-bold text-indigo-300 text-left mb-2 px-1 uppercase tracking-wider flex items-center gap-1.5">
                                <Users size={14} /> Filtro: Ecosistema Nivel 5
                            </label>
                            <select
                                className="w-full bg-black/40 border border-indigo-500/40 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer appearance-none"
                                value={selectedSU5User ? selectedSU5User.id : ''}
                                onChange={(e) => {
                                    const su5Id = e.target.value;
                                    if (su5Id) {
                                        const su5 = superUsers5.find(u => u.id === su5Id);
                                        setSelectedSU5User(su5);
                                        toast.success(`Mostrando ecosistema de ${su5.name}`);
                                        // Auto-select their first company if possible
                                        if (su5.empresas && su5.empresas.length > 0) {
                                            changeActiveEmpresa(su5.empresas[0]);
                                        } else {
                                            changeActiveEmpresa('');
                                        }
                                    } else {
                                        setSelectedSU5User(null);
                                        changeActiveEmpresa('Todas');
                                        toast.info(`Mostrando ecosistema global`);
                                    }
                                }}
                            >
                                <option value="">[ Mi Ecosistema Global ]</option>
                                {superUsers5.map(su => (
                                    <option key={su.id} value={su.id}>Ecosistema de: {su.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

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
                                // Si NO hay empresa activa (ej. usuario nuevo), SOLO permitimos ver 'empresas' para que cree la suya
                                if (!activeEmpresa) {
                                    if (mod.id !== 'empresas') return false;
                                } else if (!isGlobal && !empresaMods.includes(mod.id)) {
                                    // Si hay empresa pero NO tiene el módulo habilitado, se oculta
                                    return false; 
                                }

                                // 2. Restricción de permisos individuales del usuario
                                // Super Nv.1-4: acceso total a lo que la empresa permita (sin restricción de userApps)
                                // Super Nv.5: debe cumplir TAMBIÉN con su lista personal de módulos asignados por Nv.1
                                const isSuper5 = isSuperUser5(user?.role);
                                if (isSU && !isSuper5) return true; // Nv.1-4 pasan libremente
                                
                                // Para usuarios normales Y Super Nv.5, se verifica el permiso personal
                                return userApps.includes(mod.id);
                            })

                            .map(mod => (
                                <ModuleCard key={mod.id} mod={mod} onEnter={() => handleEnterModule(mod.route)} />
                            ));
                    })()}
                </div>
            </main>

            {/* ── MODAL DE ACTUALIZACIÓN ── */}
            {updateStatus !== 'idle' && updateStatus !== 'checking' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                            <DownloadCloud size={32} />
                        </div>
                        
                        {updateStatus === 'available' && (
                            <>
                                <h3 className="text-xl font-bold text-white mb-2">¡Nueva actualización disponible!</h3>
                                <p className="text-gray-400 text-sm mb-6">Hemos lanzado una nueva versión del software. ¿Deseas descargar e instalarla ahora?</p>
                                <div className="flex gap-3 w-full">
                                    <button onClick={() => setUpdateStatus('idle')} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors font-medium">Más tarde</button>
                                    <button onClick={handleDownloadUpdate} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-indigo-500/20">Descargar</button>
                                </div>
                            </>
                        )}
                        
                        {updateStatus === 'downloading' && (
                            <>
                                <h3 className="text-xl font-bold text-white mb-2">Descargando actualización...</h3>
                                <p className="text-gray-400 text-sm mb-6">Por favor, espera mientras preparamos la nueva versión.</p>
                                <div className="w-full bg-black/50 rounded-full h-3 mb-2 border border-white/5 overflow-hidden">
                                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
                                </div>
                                <span className="text-xs text-indigo-400 font-bold">{downloadProgress}%</span>
                            </>
                        )}

                        {updateStatus === 'downloaded' && (
                            <>
                                <h3 className="text-xl font-bold text-white mb-2">¡Descarga completada!</h3>
                                <p className="text-gray-400 text-sm mb-6">La nueva versión está lista para instalarse. La aplicación se reiniciará.</p>
                                <button onClick={handleInstallUpdate} className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-bold shadow-lg shadow-green-500/20 flex items-center justify-center gap-2">
                                    <Check size={18} /> Instalar y Reiniciar
                                </button>
                                <button onClick={() => setUpdateStatus('idle')} className="w-full mt-3 px-4 py-2 text-gray-500 hover:text-white transition-colors text-xs">Instalar la próxima vez que abra la app</button>
                            </>
                        )}
                    </div>
                </div>
            )}

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
