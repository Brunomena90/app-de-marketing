import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
    LayoutDashboard, FileText, Users, Megaphone, Calendar,
    LogOut, Book, ExternalLink, Building2, Home, Star, Sparkles, TrendingUp, Handshake, ShoppingCart, UserCheck, Heart, Wallet, TrendingDown,
    Palette, Type, Image, Layers, ChevronDown, ChevronUp, User, PanelRight, ListTodo, Package,

    Moon, Sun, LayoutList, GitMerge
} from 'lucide-react';


import { useAuth } from '../context/AuthContext';
import { isSuperUser1, isSuperUser, SUPER_ROLE_LABELS } from '../context/AuthContext';
import UserAvatar from './UserAvatar';
import AppIcon from './AppIcon';

/* ── Rutas por Módulo ── */
const EMPRESAS_PATHS = ['/empresas', '/usuarios'];
const MARKETING_PATHS = ['/dashboard', '/solicitudes', '/requerimientos', '/campanas', '/cuadro-contenidos', '/calendario-contenidos', '/links', '/cuadernos', '/funcion-ia'];
const VENTAS_PATHS = ['/ventas'];
const FINANZAS_PATHS = ['/finanzas'];
const WORKFLOW_PATHS = ['/workflow-ai'];
const BRANDING_PATHS = ['/branding'];
const ALMACENES_PATHS = ['/almacenes'];
const PROCESOS_PATHS = ['/procesos'];

const Sidebar = ({ onCloseMobile }) => {
    const { user, logout, activeEmpresa } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();
    const [isIdentidadOpen, setIsIdentidadOpen] = useState(true);

    const [marketingDark, setMarketingDark] = useState(() => localStorage.getItem('marketingDark') === 'true');

    const toggleMarketingDark = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const newVal = !marketingDark;
        setMarketingDark(newVal);
        localStorage.setItem('marketingDark', String(newVal));
        window.dispatchEvent(new CustomEvent('toggle-marketing-dark', { detail: newVal }));
    };

    const renderSectionHeader = (title) => (
        <div className="mb-2 px-4 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest opacity-60">
            <span>{title}</span>
            <button 
                onClick={toggleMarketingDark} 
                className="hover:text-white transition-colors"
                title={marketingDark ? "Modo Claro" : "Modo Oscuro"}
            >
                {marketingDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
        </div>
    );
    const role = user?.role ? user.role.toLowerCase().trim() : '';
    const isAdmin = role === 'admin' || isSuperUser(role);
    const isEditor = role === 'editor';
    const isSuper1 = isSuperUser1(role);

    const isEmpresasModule = EMPRESAS_PATHS.some(p => location.pathname.startsWith(p));
    const isMarketingModule = MARKETING_PATHS.some(p => location.pathname.startsWith(p));
    const isVentasModule = VENTAS_PATHS.some(p => location.pathname.startsWith(p));
    const isFinanzasModule = FINANZAS_PATHS.some(p => location.pathname.startsWith(p));
    const isWorkFlowModule = WORKFLOW_PATHS.some(p => location.pathname.startsWith(p));
    const isBrandingModule = BRANDING_PATHS.some(p => location.pathname.startsWith(p));
    const isAlmacenesModule = ALMACENES_PATHS.some(p => location.pathname.startsWith(p));
    const isProcesosModule = PROCESOS_PATHS.some(p => location.pathname.startsWith(p));
    
    // Permisos
    const hasMarketingAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('marketing');
    const hasEmpresasAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('empresas');
    const hasVentasAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('ventas');
    const hasFinanzasAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('finanzas');
    const hasWorkFlowAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('workflow-ai');
    const hasBrandingAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('branding');
    const hasAlmacenesAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('almacenes');
    const hasProcesosAccess = isSuperUser(role) || (user?.accessibleApps || []).includes('procesos');

    const handleLogout = () => {
        logout();
        if (onCloseMobile) onCloseMobile();
    };

    const handleGoHome = () => {
        if (onCloseMobile) onCloseMobile();
        navigate('/');
    };

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm border border-transparent ${isActive
            ? 'bg-blue-600/10 text-blue-400 border-blue-500/30'
            : 'text-white hover:bg-gray-800'
        }`;

    const iconWrapperClass = (colorClass, isActive) => 
        `p-1.5 rounded-md transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg' : colorClass}`;

    return (
        <aside className="w-64 bg-gray-900 text-white flex flex-col h-full shadow-xl">

            {/* HEADER */}
            <div className="p-6 border-b border-gray-800 shrink-0 flex items-center gap-3">
                <AppIcon className="w-10 h-10 shrink-0" variant="white" />
                <div>
                    <h1 className="text-lg font-bold tracking-wider text-white leading-tight uppercase">
                        {isEmpresasModule ? 'Gestión' : isMarketingModule ? 'Marketing' : isVentasModule ? 'Ventas' : isFinanzasModule ? 'Finanzas' : isWorkFlowModule ? 'Artories IA' : isBrandingModule ? 'Marca' : isAlmacenesModule ? 'Almacenes' : isProcesosModule ? 'Procesos' : 'Artories'}
                    </h1>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">
                        {isEmpresasModule ? 'Empresas & Usuarios' : isMarketingModule ? 'Contenido & SEO' : isVentasModule ? 'Comercial & Negocios' : isFinanzasModule ? 'Gestión Financiera' : isWorkFlowModule ? 'Asistente de Inteligencia' : isBrandingModule ? 'Estrategia & Gestión de Marca' : isAlmacenesModule ? 'Inventario & Logística' : isProcesosModule ? 'Gestión Operativa' : 'Management Suite'}
                    </p>
                </div>
                {isSuper1 && (
                    <span className="ml-auto flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold px-2 py-1 rounded-full">
                        <Star size={9} fill="currentColor" /> NV.1
                    </span>
                )}
            </div>

            {/* BOTÓN VOLVER AL APP CENTER */}
            <div className="px-4 py-4 shrink-0">
                <button
                    onClick={handleGoHome}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 hover:text-white hover:bg-blue-600/20 hover:border-blue-500/30 transition-all duration-300 group shadow-lg"
                >
                    <Home size={18} className="text-blue-400 group-hover:scale-125 transition-transform" />
                    <span className="text-sm font-bold tracking-tight uppercase">← App Center</span>
                </button>
            </div>

            {/* MÓDULO MARKETING */}
            {hasMarketingAccess && isMarketingModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("MARKETING SUITE")}

                    <NavLink to="/dashboard" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-blue-500/10 text-blue-400', isActive)}>
                                    <LayoutDashboard size={18} />
                                </div>
                                <span>{"Dashboard"}</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/solicitudes" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-emerald-500/10 text-emerald-400', isActive)}>
                                    <FileText size={18} />
                                </div>
                                <span>{"Solicitudes"}</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/requerimientos" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-indigo-500/10 text-indigo-400', isActive)}>
                                    <ListTodo size={18} />
                                </div>
                                <span>{"Requerimientos"}</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/campanas" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-purple-500/10 text-purple-400', isActive)}>
                                    <Megaphone size={18} />
                                </div>
                                <span>{"Campañas"}</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/cuadro-contenidos" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-pink-500/10 text-pink-400', isActive)}>
                                    <LayoutList size={18} />
                                </div>
                                <span>{"Cuadro Contenidos"}</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/calendario-contenidos" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-orange-500/10 text-orange-400', isActive)}>
                                    <Calendar size={18} />
                                </div>
                                <span>{"Calendario"}</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/links" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-cyan-500/10 text-cyan-400', isActive)}>
                                    <ExternalLink size={18} />
                                </div>
                                <span>{"Links Importantes"}</span>
                            </>
                        )}
                    </NavLink>

                    {(isSuperUser(role) || user?.marketingAIAccess) && (
                        <NavLink to="/funcion-ia" className={linkClass} onClick={onCloseMobile}>
                            {({ isActive }) => (
                                <>
                                    <div className={iconWrapperClass('bg-purple-500/10 text-purple-400 border border-purple-500/30', isActive)}>
                                        <Sparkles size={18} className={isActive ? "animate-pulse" : ""} />
                                    </div>
                                    <span className="font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Función IA</span>
                                </>
                            )}
                        </NavLink>
                    )}

                    {(isAdmin || isEditor) && (
                        <NavLink to="/cuadernos" className={linkClass} onClick={onCloseMobile}>
                            {({ isActive }) => (
                                <>
                                    <div className={iconWrapperClass('bg-rose-500/10 text-rose-400', isActive)}>
                                        <Book size={18} />
                                    </div>
                                    <span>Cuadernos</span>
                                </>
                            )}
                        </NavLink>
                    )}
                </nav>
            )}

            {/* MÓDULO EMPRESAS */}
            {hasEmpresasAccess && isEmpresasModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("GESTIÓN EMPRESARIAL")}

                    <NavLink to="/empresas" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-indigo-500/10 text-indigo-400', isActive)}>
                                    <Building2 size={18} />
                                </div>
                                <span>Empresas &amp; Áreas</span>
                            </>
                        )}
                    </NavLink>

                    {isAdmin && (
                        <NavLink to="/usuarios" className={linkClass} onClick={onCloseMobile}>
                            {({ isActive }) => (
                                <>
                                    <div className={iconWrapperClass('bg-teal-500/10 text-teal-400', isActive)}>
                                        <Users size={18} />
                                    </div>
                                    <span>Usuarios</span>
                                </>
                            )}
                        </NavLink>
                    )}
                </nav>
            )}

            {/* MÓDULO VENTAS */}
            {hasVentasAccess && isVentasModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("GESTIÓN COMERCIAL")}

                    <NavLink to="/ventas" end className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-emerald-500/10 text-emerald-400', isActive)}>
                                    <LayoutDashboard size={18} />
                                </div>
                                <span>Panel de Control (Ventas)</span>
                            </>
                        )}
                    </NavLink>
                </nav>
            )}

            {/* MÓDULO FINANZAS */}
            {hasFinanzasAccess && isFinanzasModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("GESTIÓN FINANCIERA")}

                    <NavLink to="/finanzas" end className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-indigo-500/10 text-indigo-400', isActive)}>
                                    <Wallet size={18} />
                                </div>
                                <span>Dashboard Financiero</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/finanzas/cuentas-cobrar" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-emerald-500/10 text-emerald-400', isActive)}>
                                    <TrendingUp size={18} />
                                </div>
                                <span>Cuentas por Cobrar</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/finanzas/egresos" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-rose-500/10 text-rose-400', isActive)}>
                                    <TrendingDown size={18} />
                                </div>
                                <span>Egresos & Pagos</span>
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/finanzas/cotizaciones-recibidas" className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-teal-500/10 text-teal-400', isActive)}>
                                    <Handshake size={18} />
                                </div>
                                <span>Cotizaciones Proveedores</span>
                            </>
                        )}
                    </NavLink>
                </nav>
            )}

            {/* MÓDULO ARTORIES IA */}
            {hasWorkFlowAccess && isWorkFlowModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("ARTORIES IA")}

                    <NavLink to="/workflow-ai" end className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-violet-500/10 text-violet-400', isActive)}>
                                    <Sparkles size={18} />
                                </div>
                                <span>Chat IA</span>
                            </>
                        )}
                    </NavLink>
                </nav>
            )}

            {/* MÓDULO BRANDING - GESTIÓN ESTRATÉGICA DE MARCA */}
            {hasBrandingAccess && isBrandingModule && activeEmpresa !== 'Todas' && (

                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("GESTIÓN DE MARCA")}

                    <NavLink to="/branding" end className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-indigo-500/10 text-indigo-400', isActive)}>
                                    <LayoutDashboard size={18} />
                                </div>
                                <span className="font-semibold">Centro de Marca</span>
                            </>
                        )}
                    </NavLink>

                    {/* IDENTIDAD VISUAL - GRUPO COLAPSABLE */}
                    <div className="space-y-1">
                        <button
                            onClick={() => setIsIdentidadOpen(!isIdentidadOpen)}
                            className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-800 rounded-lg transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-md bg-violet-500/10 text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                    <Sparkles size={18} />
                                </div>
                                <span className="text-sm font-medium text-gray-400 group-hover:text-white">Identidad Visual</span>
                            </div>
                            {isIdentidadOpen ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                        </button>

                        {isIdentidadOpen && (
                            <div className="pl-9 space-y-1 mt-1 animate-in slide-in-from-top-1 duration-200">
                                <NavLink to="/branding/paletas" className={linkClass} onClick={onCloseMobile}>
                                    {({ isActive }) => (
                                        <>
                                            <div className={iconWrapperClass('bg-violet-500/5 text-violet-400/70', isActive)}>
                                                <Palette size={14} />
                                            </div>
                                            <span className="text-[13px]">Paletas de Color</span>
                                        </>
                                    )}
                                </NavLink>

                                <NavLink to="/branding/tipografias" className={linkClass} onClick={onCloseMobile}>
                                    {({ isActive }) => (
                                        <>
                                            <div className={iconWrapperClass('bg-pink-500/5 text-pink-400/70', isActive)}>
                                                <Type size={14} />
                                            </div>
                                            <span className="text-[13px]">Tipografías</span>
                                        </>
                                    )}
                                </NavLink>

                                <NavLink to="/branding/activos" className={linkClass} onClick={onCloseMobile}>
                                    {({ isActive }) => (
                                        <>
                                            <div className={iconWrapperClass('bg-fuchsia-500/5 text-fuchsia-400/70', isActive)}>
                                                <Image size={14} />
                                            </div>
                                            <span className="text-[13px]">Activos de Marca</span>
                                        </>
                                    )}
                                </NavLink>

                                <NavLink to="/branding/lineamientos" className={linkClass} onClick={onCloseMobile}>
                                    {({ isActive }) => (
                                        <>
                                            <div className={iconWrapperClass('bg-indigo-500/5 text-indigo-400/70', isActive)}>
                                                <Layers size={14} />
                                            </div>
                                            <span className="text-[13px]">Lineamientos</span>
                                        </>
                                    )}
                                </NavLink>
                            </div>
                        )}
                    </div>

                    <div className="pt-2 space-y-2">
                        <NavLink to="/branding/buyer-persona" className={linkClass} onClick={onCloseMobile}>
                            {({ isActive }) => (
                                <>
                                    <div className={iconWrapperClass('bg-blue-500/10 text-blue-400', isActive)}>
                                        <User size={18} />
                                    </div>
                                    <span className="font-semibold">Buyer Persona</span>
                                </>
                            )}
                        </NavLink>

                        <NavLink to="/branding/estrategias" className={linkClass} onClick={onCloseMobile}>
                            {({ isActive }) => (
                                <>
                                    <div className={iconWrapperClass('bg-purple-500/10 text-purple-400', isActive)}>
                                        <TrendingUp size={18} />
                                    </div>
                                    <span className="font-semibold">Estrategias</span>
                                </>
                            )}
                        </NavLink>
                    </div>

                </nav>
            )}

            {/* MÓDULO ALMACENES */}
            {hasAlmacenesAccess && isAlmacenesModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("GESTIÓN DE INVENTARIO")}

                    <NavLink to="/almacenes" end className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-amber-500/10 text-amber-400', isActive)}>
                                    <Package size={18} />
                                </div>
                                <span>Panel de Control</span>
                            </>
                        )}
                    </NavLink>
                </nav>
            )}

            {/* MÓDULO PROCESOS */}
            {hasProcesosAccess && isProcesosModule && (
                <nav className="p-4 space-y-2 overflow-y-auto flex-1">
                    {renderSectionHeader("GESTIÓN DE PROCESOS")}

                    <NavLink to="/procesos" end className={linkClass} onClick={onCloseMobile}>
                        {({ isActive }) => (
                            <>
                                <div className={iconWrapperClass('bg-cyan-500/10 text-cyan-400', isActive)}>
                                    <GitMerge size={18} />
                                </div>
                                <span>Panel de Control</span>
                            </>
                        )}
                    </NavLink>
                </nav>
            )}

            {/* FOOTER PERFIL */}
            <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                    <UserAvatar name={user?.name} size="sm" className="bg-gray-700 text-gray-300 border-gray-600 shrink-0" />
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-white">{user?.name}</p>
                        <p className="text-xs text-gray-500 capitalize truncate flex items-center gap-1">
                            {isSuperUser(role) && <Star size={10} className="text-amber-400" fill="currentColor" />}
                            {SUPER_ROLE_LABELS[role] || role}
                        </p>
                    </div>
                </div>

                {/* Botón Dividir Pantalla / Nueva Ventana */}
                <button
                    onClick={() => {
                        if (window.electronAPI?.isElectron) {
                            window.electronAPI.openFloatingWindow('/');
                        } else {
                            window.dispatchEvent(new CustomEvent('toggle-split-screen'));
                        }
                        if (onCloseMobile) onCloseMobile();
                    }}
                    className="hidden md:flex w-full items-center justify-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all text-sm font-bold mb-3"
                >
                    <PanelRight size={16} /> {window.electronAPI?.isElectron ? 'Nueva Ventana' : 'Pantalla Dividida'}
                </button>

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-all text-sm font-bold"
                >
                    <LogOut size={16} /> Cerrar Sesión
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
