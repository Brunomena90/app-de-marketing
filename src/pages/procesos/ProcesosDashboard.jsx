import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, GitMerge, Search, LayoutGrid, Clock, Settings2 } from 'lucide-react';

const ProcesosDashboard = () => {
    const { activeEmpresa, isSuper1 } = useAuth();
    const navigate = useNavigate();
    const [procesos, setProcesos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [newProcesoName, setNewProcesoName] = useState('');
    const [newProcesoDesc, setNewProcesoDesc] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!activeEmpresa) return;

        let q;
        if (activeEmpresa === 'Todas') {
            q = query(collection(db, 'procesos'), orderBy('updatedAt', 'desc'));
        } else {
            q = query(
                collection(db, 'procesos'),
                where('empresa', '==', activeEmpresa),
                orderBy('updatedAt', 'desc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const procesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProcesos(procesData);
            setLoading(false);
        }, (error) => {
            console.error("Error cargando procesos:", error);
            // Fallback sin index si falla
            if (error.code === 'failed-precondition') {
                const fallbackQ = activeEmpresa === 'Todas' 
                    ? query(collection(db, 'procesos'))
                    : query(collection(db, 'procesos'), where('empresa', '==', activeEmpresa));
                
                onSnapshot(fallbackQ, (snap) => {
                    setProcesos(snap.docs.map(d => ({id: d.id, ...d.data()})));
                    setLoading(false);
                });
            } else {
                toast.error("Error al cargar los procesos");
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [activeEmpresa]);

    const handleCreateProceso = async (e) => {
        e.preventDefault();
        if (!newProcesoName.trim()) {
            toast.error("El nombre del proceso es obligatorio");
            return;
        }
        
        const empresaTarget = activeEmpresa === 'Todas' ? 'Global' : activeEmpresa;

        setCreating(true);
        try {
            const docRef = await addDoc(collection(db, 'procesos'), {
                name: newProcesoName.trim(),
                description: newProcesoDesc.trim(),
                empresa: empresaTarget,
                asIs: '',
                toBe: '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            toast.success("Proceso creado exitosamente");
            setShowModal(false);
            setNewProcesoName('');
            setNewProcesoDesc('');
            navigate(`/procesos/${docRef.id}`);
        } catch (error) {
            console.error("Error creating process:", error);
            toast.error("Error al crear el proceso");
        } finally {
            setCreating(false);
        }
    };

    const filteredProcesos = procesos.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 relative overflow-hidden">
            {/* Decoración de fondo */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <header className="relative z-10 shrink-0 px-8 py-6 border-b border-gray-200 bg-white/90 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <GitMerge size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestión de Procesos</h1>
                        <p className="text-xs text-cyan-600 font-bold uppercase tracking-widest mt-1">
                            Análisis AS-IS / TO-BE
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar proceso..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full sm:w-64 bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Nuevo Proceso</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 relative z-10">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
                    </div>
                ) : filteredProcesos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Settings2 size={32} className="text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No hay procesos</h3>
                        <p className="text-gray-500 text-sm max-w-md">
                            No se encontraron procesos en la empresa activa. Crea uno nuevo para comenzar a documentar el AS-IS y TO-BE.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="mt-6 flex items-center gap-2 text-cyan-600 hover:text-cyan-700 font-bold transition-colors"
                        >
                            <Plus size={18} /> Crear mi primer proceso
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProcesos.map(proceso => (
                            <Link
                                key={proceso.id}
                                to={`/procesos/${proceso.id}`}
                                className="group bg-white border border-gray-200 rounded-2xl p-6 hover:bg-gray-50 hover:border-cyan-500/50 transition-all duration-300 relative overflow-hidden flex flex-col"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
                                        <LayoutGrid size={20} />
                                    </div>
                                    {activeEmpresa === 'Todas' && (
                                        <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-full text-gray-600 truncate max-w-[100px]">
                                            {proceso.empresa}
                                        </span>
                                    )}
                                </div>
                                
                                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-cyan-600 transition-colors">
                                    {proceso.name}
                                </h3>
                                <p className="text-sm text-gray-500 line-clamp-3 mb-6 flex-1">
                                    {proceso.description || "Sin descripción"}
                                </p>
                                
                                <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mt-auto border-t border-gray-200 pt-4">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} />
                                        <span>
                                            {proceso.updatedAt && proceso.updatedAt.toDate
                                                ? new Date(proceso.updatedAt.toDate()).toLocaleDateString()
                                                : 'Reciente'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 ml-auto">
                                        <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                            AS-IS
                                        </span>
                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
                                            TO-BE
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Creación */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Plus className="text-cyan-600" /> Nuevo Proceso
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Define la información básica del proceso para documentarlo.
                            </p>
                        </div>
                        
                        <form onSubmit={handleCreateProceso} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Nombre del Proceso <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newProcesoName}
                                    onChange={(e) => setNewProcesoName(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-cyan-500 transition-colors"
                                    placeholder="Ej. Onboarding de Clientes"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Descripción Corta</label>
                                <textarea
                                    rows="3"
                                    value={newProcesoDesc}
                                    onChange={(e) => setNewProcesoDesc(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                                    placeholder="¿De qué trata este proceso?"
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-4 border-t border-gray-200 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors disabled:opacity-50"
                                >
                                    {creating ? 'Creando...' : 'Crear Proceso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcesosDashboard;
