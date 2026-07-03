import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Building2, Sparkles, AlertCircle } from 'lucide-react';
import AppIcon from './AppIcon';

const CompanySelector = () => {
    const { user, changeActiveEmpresa, hasGlobalAccess } = useAuth();
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmpresas = async () => {
            try {
                const q = query(collection(db, 'empresas'), orderBy('name'));
                const snapshot = await getDocs(q);
                const allEmpresas = snapshot.docs.map(doc => doc.data().name);

                // Si tiene acceso global (Artories o SuperUsuario), ve todas. Si no, ve solo las suyas.
                if (hasGlobalAccess) {
                    setEmpresas(allEmpresas);
                } else {
                    const userEmpresas = user?.empresas || [];
                    setEmpresas(allEmpresas.filter(e => userEmpresas.includes(e)));
                }
            } catch (error) {
                console.error("Error cargando empresas:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEmpresas();
    }, [user]);

    if (loading) {
        return (
            <div className="h-screen bg-[#0a0f1e] flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-white/60 text-sm">Cargando entorno de trabajo...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0f1e] flex flex-col relative overflow-hidden" data-ai="company-selector-view">
            {/* Glow de fondo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-violet-900/10 blur-[150px]" />
            </div>

            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center ring-1 ring-white/20 backdrop-blur-sm mb-8">
                    <AppIcon className="w-8 h-8" variant="white" />
                </div>

                <div className="text-center mb-10 max-w-md">
                    <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-4">
                        <Sparkles size={14} className="text-indigo-400" />
                        <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Contexto de Trabajo</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Selecciona una Empresa</h1>
                    <p className="text-white/50 text-sm">
                        Para continuar a este módulo, necesitas establecer con qué empresa vas a operar.
                    </p>
                </div>

                <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Botón Vista Global para usuarios autorizados */}
                    {hasGlobalAccess && (
                        <button
                            onClick={() => changeActiveEmpresa('Todas')}
                            className="group flex items-center gap-4 bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-2xl hover:bg-indigo-500/20 transition-all text-left focus:outline-none focus:ring-2 ring-indigo-500 sm:col-span-2 shadow-sm"
                            title="Operar en Modo Matriz"
                        >
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                <Sparkles size={18} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-white font-bold text-base truncate">Vista Global</h3>
                                <p className="text-white/50 text-xs mt-0.5">Accede a todas las empresas y módulos simultáneamente como administrador maestro.</p>
                            </div>
                        </button>
                    )}

                    {empresas.length > 0 ? (
                        empresas.map((emp) => (
                            <button
                                key={emp}
                                onClick={() => changeActiveEmpresa(emp)}
                                className="group flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 hover:border-indigo-500/50 transition-all text-left focus:outline-none focus:ring-2 ring-indigo-500"
                                data-ai-action="select-company"
                                data-ai-value={emp}
                            >
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Building2 size={18} />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h3 className="text-white font-semibold text-sm truncate">{emp}</h3>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="col-span-full bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center flex flex-col items-center">
                            <AlertCircle className="text-red-400 mb-3" size={24} />
                            <p className="text-white font-medium mb-1">Sin acceso comercial</p>
                            <p className="text-red-200/60 text-sm">No tienes empresas asignadas a tu cuenta. Contacta a un administrador.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CompanySelector;
