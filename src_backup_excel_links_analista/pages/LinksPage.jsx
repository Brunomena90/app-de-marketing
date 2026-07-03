import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Plus, ExternalLink, Trash2, Edit2, Search, Link as LinkIcon, Globe, Tag, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const LinksPage = () => {
    const { activeEmpresa, hasGlobalAccess, user } = useAuth();
    const [availableEmpresas, setAvailableEmpresas] = useState([]);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });

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

    const [formData, setFormData] = useState({
        title: '',
        url: '',
        description: '',
        category: '',
        empresaDestino: ''
    });

    useEffect(() => {
        // Consultamos todos con orden, y filtramos en memoria para evitar errores de índice compuesto de Firestore
        const q = query(collection(db, "links"), orderBy("createdAt", "desc"));
            
        const unsub = onSnapshot(q, (snap) => {
            const allLinks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Filtrado Multi-tenant en cliente
            if (activeEmpresa === 'Todas') {
                setLinks(allLinks);
            } else {
                setLinks(allLinks.filter(link => link.empresa === activeEmpresa));
            }
            setLoading(false);
        }, (error) => {
            console.error("Error loading links:", error);
            setLoading(false);
            toast.error("Error al cargar enlaces");
        });
        return () => unsub();
    }, [activeEmpresa]);

    const handleOpenModal = (link = null) => {
        if (link) {
            setEditingLink(link);
            setFormData({
                title: link.title || '',
                url: link.url || '',
                description: link.description || '',
                category: link.category || '',
                empresaDestino: link.empresa || ''
            });
        } else {
            setEditingLink(null);
            setFormData({ title: '', url: '', description: '', category: '', empresaDestino: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.url.trim()) {
            return toast.error("Título y URL son obligatorios");
        }
        if (activeEmpresa === 'Todas' && !formData.empresaDestino && !editingLink) {
            return toast.error("Selecciona una empresa para este recurso.");
        }

        // Add https if missing
        let processedUrl = formData.url.trim();
        if (!/^https?:\/\//i.test(processedUrl)) {
            processedUrl = 'https://' + processedUrl;
        }

        try {
            if (editingLink) {
                await updateDoc(doc(db, "links", editingLink.id), {
                    title: formData.title,
                    url: processedUrl,
                    description: formData.description,
                    category: formData.category,
                    updatedAt: serverTimestamp()
                });
                toast.success("Link actualizado");
            } else {
                await addDoc(collection(db, "links"), {
                    title: formData.title,
                    url: processedUrl,
                    description: formData.description,
                    category: formData.category,
                    createdAt: serverTimestamp(),
                    empresa: activeEmpresa === 'Todas' ? formData.empresaDestino : activeEmpresa
                });
                toast.success("Link agregado");
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar el link");
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;
        try {
            await deleteDoc(doc(db, "links", deleteModal.id));
            toast.success("Link eliminado");
            setDeleteModal({ open: false, id: null });
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    const filteredLinks = links.filter(link => {
        const matchesSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.description.toLowerCase().includes(searchTerm.toLowerCase());
        
        const docEmpresa = link.empresa || 'GRUCOIN';
        const matchesEmpresa = activeEmpresa === 'Todas' || docEmpresa === activeEmpresa;
        return matchesSearch && matchesEmpresa;
    });

    return (
        <div className="space-y-6 pb-10">
            {/* HEADER SECTION */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <ExternalLink className="text-indigo-600" size={28} />
                        Libreta de Links
                        <span className="bg-indigo-50 text-indigo-600 text-xs py-1 px-3 rounded-full ml-2">
                            {links.length}
                        </span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Colección de recursos y links importantes para el equipo</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={20} />
                    Agregar Link
                </button>
            </div>

            {/* SEARCH BAR */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    placeholder="Buscar por título, categoría o descripción..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* GRID SECTION */}
            {loading ? (
                <div className="py-20 text-center text-gray-400 font-medium">Cargando enlaces importantes...</div>
            ) : filteredLinks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredLinks.map((link) => (
                        <div
                            key={link.id}
                            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group relative flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <LinkIcon size={20} />
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleOpenModal(link)}
                                        className="p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteModal({ open: true, id: link.id })}
                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 group-hover:text-indigo-600 transition-colors mb-2 line-clamp-1">
                                    {link.title}
                                </h3>

                                {link.category && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 mb-3 uppercase tracking-wider">
                                        {link.category}
                                    </span>
                                )}

                                <p className="text-gray-500 text-sm mb-6 line-clamp-3 leading-relaxed">
                                    {link.description || 'Sin descripción adicional.'}
                                </p>
                            </div>

                            <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-gray-50 group-hover:bg-indigo-600 text-gray-600 group-hover:text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all mt-auto border border-gray-100 group-hover:border-indigo-600"
                            >
                                <span>Abrir Link</span>
                                <ExternalLink size={16} />
                            </a>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-20 text-center text-gray-400 flex flex-col items-center">
                    <div className="p-6 bg-gray-50 rounded-full mb-4">
                        <LinkIcon size={48} className="opacity-10" />
                    </div>
                    <p className="text-lg font-medium">No se encontraron links</p>
                    <p className="text-sm">Agrega recursos importantes para que tu equipo pueda acceder a ellos rápidamente.</p>
                </div>
            )}

            {/* MODAL AGREGAR / EDITAR */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingLink ? "Editar Link" : "Agregar Nuevo Link"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-2">
                            <Info size={12} /> Título del Recurso
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. Guía de Marca 2024"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    {!editingLink && activeEmpresa === 'Todas' && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-2">
                                <Globe size={12} /> Empresa Destino
                            </label>
                            <select
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm text-gray-700"
                                value={formData.empresaDestino}
                                onChange={(e) => setFormData({ ...formData, empresaDestino: e.target.value })}
                            >
                                <option value="">-- Seleccionar Empresa --</option>
                                {availableEmpresas.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-2">
                            <Globe size={12} /> URL (Enlace)
                        </label>
                        <input
                            type="text"
                            placeholder="https://ejemplo.com/recurso"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm font-mono"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-2">
                            <Tag size={12} /> Categoría
                        </label>
                        <input
                            type="text"
                            placeholder="Ej. Diseño, Referencias, Administrativo"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 mb-1.5 uppercase tracking-widest flex items-center gap-2">
                            <Edit2 size={12} /> Descripción (Opcional)
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Breve descripción de este recurso..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all text-sm"
                        >
                            {editingLink ? "Guardar Cambios" : "Agregar Link"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* DELETE MODAL */}
            <ConfirmModal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, id: null })}
                onConfirm={confirmDelete}
                title="¿Eliminar Link?"
                message="Esta acción eliminará el enlace permanentemente de la colección del equipo."
            />
        </div>
    );
};

export default LinksPage;
