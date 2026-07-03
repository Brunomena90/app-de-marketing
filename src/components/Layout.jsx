import React, { useState } from 'react';
import Sidebar from './Sidebar';
import AppIcon from './AppIcon';
import { Menu, X, PowerOff, ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Layout = ({ children, noPadding = false }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { isEmpresaDisabled, activeEmpresa, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [marketingDark, setMarketingDark] = useState(() => localStorage.getItem('marketingDark') === 'true');

    React.useEffect(() => {
        const handler = (e) => setMarketingDark(e.detail);
        window.addEventListener('toggle-marketing-dark', handler);
        return () => window.removeEventListener('toggle-marketing-dark', handler);
    }, []);

    // Determinar si es módulo de marketing
    const isMarketingModule = ['/dashboard', '/solicitudes', '/requerimientos', '/campanas', '/cuadro-contenidos', '/calendario-contenidos', '/links', '/cuadernos', '/funcion-ia'].some(p => location.pathname.startsWith(p));

    // Determinar si debemos aplicar Dark Mode Global basado en la ruta actual
    const isDarkMode = location.pathname.startsWith('/ventas') || location.pathname.startsWith('/workflow-ai');
    
    // Si estamos en ventas/workflow es oscuro por defecto, o si estamos en marketing y tiene oscuro activado.
    const isDarkTheme = isDarkMode || (isMarketingModule && marketingDark);
    
    const bgGlobalClass = isDarkTheme ? 'bg-[#000000]' : 'bg-gray-100';

    // MULTI-PANE SPLIT SCREEN LOGIC
    // Si estamos dentro de un iframe, es el panel secundario
    const isIframePane = window !== window.top;
    const [isSplitScreen, setIsSplitScreen] = useState(false);

    React.useEffect(() => {
        const handleToggle = () => setIsSplitScreen(prev => !prev);
        window.addEventListener('toggle-split-screen', handleToggle);
        return () => window.removeEventListener('toggle-split-screen', handleToggle);
    }, []);

    // Forzar modo compacto (ocultar sidebar lateral, mostrar header top) si la pantalla está dividida
    const forceCompactMode = isIframePane || isSplitScreen;

    return (
        <div className={`flex h-screen overflow-hidden ${bgGlobalClass}`}>

            {/* 1. SIDEBAR DESKTOP (Visible solo si NO estamos en modo compacto y en pantallas md+) */}
            {!forceCompactMode && (
                <div className="hidden md:flex md:w-64 md:flex-col fixed h-full z-30">
                    <Sidebar />
                </div>
            )}

            {/* 2. SIDEBAR MOBILE / COMPACT (Overlay) */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
            )}
            
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${forceCompactMode ? '' : 'md:hidden'}`}>
                <div className="relative h-full flex flex-col">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 z-50"
                    >
                        <X size={24} />
                    </button>
                    <Sidebar onCloseMobile={() => setIsSidebarOpen(false)} />
                </div>
            </div>

            {/* 3. CONTENIDO PRINCIPAL Y SPLIT SCREEN */}
            <div className={`flex-1 flex w-full h-full relative transition-all duration-300 ${!forceCompactMode ? 'md:pl-64' : ''}`}>
                
                {/* LADO IZQUIERDO (O 100% si no hay split) */}
                <div className={`flex-1 flex flex-col h-full relative transition-all duration-300 ${isSplitScreen ? 'w-1/2 border-r border-gray-200 dark:border-gray-800' : 'w-full'}`}>
                    
                    {/* Header Top (Visible en móviles SIEMPRE, o en PC si forceCompactMode es true) */}
                    <div className={`flex items-center justify-between p-3 border-b shadow-sm shrink-0 z-20 ${isDarkTheme ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'} ${forceCompactMode ? '' : 'md:hidden'}`}>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsSidebarOpen(true)} className={`p-1.5 rounded-lg active:scale-95 transition-transform ${isDarkTheme ? 'text-white/70 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <Menu size={24} />
                            </button>
                            <div className="flex items-center gap-2">
                                <AppIcon className="w-6 h-6" variant={isDarkTheme ? 'white' : 'dark'} />
                                <h1 className={`font-bold text-sm tracking-wide uppercase ${isDarkTheme ? 'text-white' : 'text-gray-800'}`}>
                                    {isIframePane ? 'Panel Secundario' : 'Artories'}
                                </h1>
                            </div>
                        </div>
                    </div>

                    {/* Área de Scroll Principal */}
                    <main id={isIframePane ? "main-scroll-container-pane" : "main-scroll-container"} className={`flex-1 w-full relative ${(isMarketingModule && marketingDark) ? 'marketing-dark' : ''} ${noPadding ? 'overflow-hidden flex flex-col' : `overflow-y-auto p-4 md:p-8 ${bgGlobalClass}`}`}>
                        {noPadding ? (
                            isEmpresaDisabled ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                    <PowerOff size={48} className="text-red-500 mb-4" />
                                    <h2 className="text-2xl font-black text-white">Empresa Desactivada</h2>
                                </div>
                            ) : children
                        ) : (
                            <div className="max-w-7xl mx-auto pb-20 md:pb-0">
                            {isEmpresaDisabled ? (
                                <div className="h-[70vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-red-100 shadow-xl shadow-red-500/5 animate-in fade-in zoom-in duration-500">
                                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-red-50/50">
                                        <PowerOff size={48} className="text-red-500 animate-pulse" />
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Entorno en Mantenimiento</h2>
                                    <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium leading-relaxed">
                                        La empresa <span className="text-red-600 font-bold">"{activeEmpresa}"</span> ha sido desactivada temporalmente por la administración. Por favor, selecciona otra empresa o contacta a soporte.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2">
                                            Ir al App Center
                                        </button>
                                        <button onClick={logout} className="bg-white text-slate-600 border border-slate-200 px-8 py-3.5 rounded-2xl font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-2">
                                            <LogOut size={16} /> Cerrar Sesión
                                        </button>
                                    </div>
                                </div>
                            ) : children}
                        </div>
                    )}
                </main>
                </div>

                {/* LADO DERECHO (Iframe del Split Screen) */}
                {isSplitScreen && (
                    <div className="hidden md:flex flex-1 w-1/2 h-full flex-col bg-gray-50 dark:bg-black relative animate-in slide-in-from-right duration-300">
                        <div className="absolute top-2 right-4 z-10">
                            <button 
                                onClick={() => setIsSplitScreen(false)} 
                                className="bg-gray-900/80 hover:bg-red-600 text-white p-1.5 rounded-lg shadow-lg backdrop-blur-sm transition-all"
                                title="Cerrar Panel"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        {/* URL fija a / (App Center) para que elija a dónde ir. Nunca re-renderiza con location.pathname */}
                        <iframe 
                            src="/" 
                            className="w-full h-full border-none bg-transparent" 
                            title="Panel Secundario"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Layout;
