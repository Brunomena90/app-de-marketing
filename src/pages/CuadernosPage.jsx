import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { Plus, Book, Calendar, User, Trash2, ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const CuadernosPage = () => {
    const [notebooks, setNotebooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [availableEmpresas, setAvailableEmpresas] = useState([]);
    const [empresaDestino, setEmpresaDestino] = useState('');

    const { user, activeEmpresa, hasGlobalAccess, isAdmin } = useAuth();
    const navigate = useNavigate();

    // Cargar empresas para el modal global
    useEffect(() => {
        if (isModalOpen && activeEmpresa === 'Todas') {
            if (hasGlobalAccess) {
                import('firebase/firestore').then(({ getDocs }) => {
                    getDocs(query(collection(db, 'empresas'), orderBy('name'))).then(snap => {
                        setAvailableEmpresas(snap.docs.map(d => d.data().name));
                    });
                });
            } else {
                setAvailableEmpresas(user?.empresas || []);
            }
        }
    }, [isModalOpen, activeEmpresa, hasGlobalAccess, user]);

    // Check permissions
    useEffect(() => {
        if (!isAdmin && user?.role?.toLowerCase().trim() !== 'editor') {
            toast.error("No tienes permisos para acceder a esta sección");
            navigate('/dashboard');
        }
    }, [user, navigate, isAdmin]);

    useEffect(() => {
        // Consultamos todos con orden, y filtramos en memoria para evitar errores de índice compuesto de Firestore
        const q = query(collection(db, "cuadernos"), orderBy("createdAt", "desc"));
            
        const unsub = onSnapshot(q, (snap) => {
            const allNotebooks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Filtrado Multi-tenant en cliente
            if (activeEmpresa === 'Todas') {
                setNotebooks(allNotebooks);
            } else {
                setNotebooks(allNotebooks.filter(nb => nb.empresa === activeEmpresa));
            }
            setLoading(false);
        }, (error) => {
            console.error("Error loading notebooks:", error);
            setLoading(false);
            toast.error("Error al cargar cuadernos");
        });
        return () => unsub();
    }, [activeEmpresa]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return toast.error("El título es obligatorio");
        if (activeEmpresa === 'Todas' && !empresaDestino) return toast.error("Selecciona una empresa para este cuaderno.");

        try {
            const docRef = await addDoc(collection(db, "cuadernos"), {
                title: newTitle,
                createdAt: serverTimestamp(),
                createdBy: user?.name || 'Sistema',
                createdByUid: user?.uid || '',
                sections: [],
                empresa: activeEmpresa === 'Todas' ? empresaDestino : activeEmpresa
            });
            toast.success("Cuaderno creado con éxito");
            setIsModalOpen(false);
            setNewTitle('');
            setEmpresaDestino('');
            navigate(`/cuadernos/${docRef.id}`);
        } catch (error) {
            console.error(error);
            toast.error("Error al crear el cuaderno");
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;
        try {
            await deleteDoc(doc(db, "cuadernos", deleteModal.id));
            toast.success("Cuaderno eliminado");
            setDeleteModal({ open: false, id: null });
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    const filteredNotebooks = notebooks.filter(nb => {
        const matchesSearch = nb.title.toLowerCase().includes(searchTerm.toLowerCase());
        const reqEmpresa = nb.empresa || 'GRUCOIN';
        const matchesEmpresa = activeEmpresa === 'Todas' || reqEmpresa === activeEmpresa;
        return matchesSearch && matchesEmpresa;
    });

    const formatDate = (date) => {
        if (!date) return '-';
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString();
    };

    return (
        <div className="space-y-6 pb-10">
            {/* HEADER SECTION */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <Book className="text-blue-600" size={28} />
                        Mis Cuadernos
                        <span className="bg-blue-50 text-blue-600 text-xs py-1 px-3 rounded-full ml-2">
                            {notebooks.length}
                        </span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Gestiona tus planes de producción consolidados</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Nuevo Cuaderno
                </button>
            </div>

            {/* SEARCH BAR */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar cuaderno..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* GRID SECTION */}
            {loading ? (
                <div className="py-20 text-center text-gray-400">Cargando cuadernos...</div>
            ) : filteredNotebooks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredNotebooks.map((nb) => (
                        <div
                            key={nb.id}
                            onClick={() => navigate(`/cuadernos/${nb.id}`)}
                            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group relative flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Book size={20} />
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteModal({ open: true, id: nb.id });
                                    }}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors mb-4 line-clamp-2 min-h-[3.5rem]">
                                {nb.title}
                            </h3>

                            <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Calendar size={14} />
                                    <span>{formatDate(nb.createdAt)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <User size={14} />
                                    <span className="truncate uppercase font-medium">{nb.createdBy}</span>
                                </div>
                            </div>

                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-blue-600">
                                <ArrowRight size={20} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center text-gray-400 flex flex-col items-center">
                    <div className="p-6 bg-gray-50 rounded-full mb-4">
                        <Book size={48} className="opacity-10" />
                    </div>
                    <p className="text-lg font-medium">No se encontraron cuadernos</p>
                    <p className="text-sm">Crea uno nuevo para empezar a organizar tus escenas.</p>
                </div>
            )}

            {/* CREATE MODAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Nuevo Cuaderno de Escenas"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                            Título del Cuaderno
                        </label>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Ej. Grabación Lunes 24 - Marketing"
                            spellCheck={true}
                            lang="es-PE"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                        />
                    </div>

                    {activeEmpresa === 'Todas' && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                                Empresa Destino
                            </label>
                            <select
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-700 bg-white"
                                value={empresaDestino}
                                onChange={(e) => setEmpresaDestino(e.target.value)}
                            >
                                <option value="">-- Seleccionar Empresa --</option>
                                {availableEmpresas.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                        >
                            Crear Cuaderno
                        </button>
                    </div>
                </form>
            </Modal>

            {/* DELETE MODAL */}
            <ConfirmModal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, id: null })}
                onConfirm={confirmDelete}
                title="¿Eliminar Cuaderno?"
                message="Esta acción eliminará el cuaderno y todas las escenas importadas en él. Esta acción no se puede deshacer."
            />
        </div>
    );
};

export default CuadernosPage;
