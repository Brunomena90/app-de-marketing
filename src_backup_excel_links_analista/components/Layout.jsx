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

    // Determinar si debemos aplicar Dark Mode Global basado en la ruta actual
    const isDarkMode = location.pathname.startsWith('/ventas') || location.pathname.startsWith('/workflow-ai');
    const bgGlobalClass = isDarkMode ? 'bg-[#000000]' : 'bg-gray-100';

    return (
        <div className={`flex h-screen overflow-hidden ${bgGlobalClass}`}>

            {/* 1. SIDEBAR DESKTOP (Visible solo en md+) */}
            <div className="hidden md:flex md:w-64 md:flex-col fixed h-full z-30">
                <Sidebar />
            </div>

            {/* 2. SIDEBAR MOBILE (Overlay) */}
            {/* Fondo oscuro backdrop */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Menú deslizable */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="relative h-full flex flex-col">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white p-1"
                    >
                        <X size={24} />
                    </button>
                    <Sidebar onCloseMobile={() => setIsSidebarOpen(false)} />
                </div>
            </div>

            {/* 3. CONTENIDO PRINCIPAL */}
            <div className="flex-1 flex flex-col md:pl-64 h-full w-full relative transition-all duration-300">

                {/* Header Mobile (Solo visible en móviles) */}
                <div className={`md:hidden flex items-center justify-between p-4 border-b shadow-sm shrink-0 z-20 ${isDarkMode ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg active:scale-95 transition-transform ${isDarkMode ? 'text-white/70 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <Menu size={24} />
                        </button>
                        <div className="flex items-center gap-2">
                            <AppIcon className="w-8 h-8" variant={isDarkMode ? 'white' : 'dark'} />
                            <h1 className={`font-bold text-base tracking-wide uppercase ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Artories</h1>
                        </div>
                    </div>
                </div>

                {/* Área de Scroll */}
                <main id="main-scroll-container" className={`flex-1 w-full relative ${noPadding ? 'overflow-hidden flex flex-col' : `overflow-y-auto p-4 md:p-8 ${bgGlobalClass}`}`}>
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
        </div>
    );
};

export default Layout;
