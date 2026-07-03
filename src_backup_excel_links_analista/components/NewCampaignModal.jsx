import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Megaphone, Calendar, Save, Edit2, Plus, Trash2, Layers } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const NewCampaignModal = ({ isOpen, onClose, campaignToEdit = null }) => {
    const { register, handleSubmit, reset, formState: { errors } } = useForm();
    const [loading, setLoading] = useState(false);
    const { activeEmpresa, hasGlobalAccess, user } = useAuth();
    const [subGroups, setSubGroups] = useState([]);
    const [newSubGroup, setNewSubGroup] = useState("");

    useEffect(() => {
        if (isOpen && activeEmpresa === 'Todas') {
            if (hasGlobalAccess) {
                getDocs(query(collection(db, 'empresas'), orderBy('name'))).then(snap => {
                    setAvailableEmpresas(snap.docs.map(d => d.data().name));
                });
            } else {
                setAvailableEmpresas(user?.empresas || []);
            }
        }
    }, [isOpen, activeEmpresa, hasGlobalAccess, user]);

    useEffect(() => {
        if (isOpen) {
            if (campaignToEdit) {
                reset({
                    name: campaignToEdit.name,
                    startDate: campaignToEdit.startDate,
                    endDate: campaignToEdit.endDate || ''
                });
                setSubGroups(campaignToEdit.subGroups || []);
            } else {
                reset({ name: '', startDate: '', endDate: '' });
                setSubGroups([]);
            }
        }
    }, [isOpen, campaignToEdit, reset]);

    const addSubGroup = (e) => {
        e.preventDefault();
        if (newSubGroup.trim()) {
            setSubGroups([...subGroups, newSubGroup.trim()]);
            setNewSubGroup("");
        }
    };

    const removeSubGroup = (index) => {
        setSubGroups(subGroups.filter((_, i) => i !== index));
    };

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            if (campaignToEdit) {
                // --- MODO EDICIÓN ---
                const oldName = campaignToEdit.name;
                const newName = data.name;
                const campaignRef = doc(db, "campanas", campaignToEdit.id);

                // 1. Actualizar la campaña misma
                await updateDoc(campaignRef, {
                    name: newName,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    subGroups: subGroups
                });

                // 2. ACTUALIZACIÓN EN CASCADA (Si cambió el nombre)
                if (oldName !== newName) {
                    // Buscar todas las solicitudes con el nombre antiguo
                    const q = query(collection(db, "solicitudes_contenido"), where("campaign", "==", oldName));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const batch = writeBatch(db);
                        querySnapshot.forEach((docSnap) => {
                            batch.update(docSnap.ref, { campaign: newName });
                        });
                        await batch.commit();
                        toast.success(`Se actualizaron ${querySnapshot.size} solicitudes vinculadas.`);
                    }
                }
                toast.success("Campaña actualizada correctamente");

            } else {
                // --- MODO CREACIÓN ---
                await addDoc(collection(db, "campanas"), {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    status: 'activa',
                    createdAt: new Date().toISOString(),
                    empresa: activeEmpresa === 'Todas' ? data.empresaDestino : activeEmpresa,
                    subGroups: subGroups
                });
                toast.success("Campaña creada exitosamente");
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar campaña");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">

                <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        {campaignToEdit ? <><Edit2 size={20} className="text-blue-600" /> Editar Campaña</> : <><Megaphone size={20} className="text-blue-600" /> Nueva Campaña</>}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nombre de la Campaña</label>
                        <input
                            {...register('name', { required: "El nombre es requerido" })}
                            spellCheck={true}
                            lang="es-PE"
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: Verano 2025..."
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                    </div>

                    {!campaignToEdit && activeEmpresa === 'Todas' && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Empresa Destino</label>
                            <select
                                {...register('empresaDestino', { required: "Debes seleccionar una empresa para esta campaña." })}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                            >
                                <option value="">-- Seleccionar Empresa --</option>
                                {availableEmpresas.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                            {errors.empresaDestino && <p className="text-red-500 text-xs mt-1">{errors.empresaDestino.message}</p>}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Fecha Inicio</label>
                            <input
                                type="date"
                                {...register('startDate', { required: "Requerido" })}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Fecha Fin (Opcional)</label>
                            <input
                                type="date"
                                {...register('endDate')}
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* SUB-GRUPOS */}
                    <div className="pt-2">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Sub-Grupos / Sub-Campañas (Opcional)</label>
                        <div className="flex gap-2 mb-3">
                            <input
                                value={newSubGroup}
                                onChange={(e) => setNewSubGroup(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Nombre del sub-grupo..."
                                onKeyDown={(e) => e.key === 'Enter' && addSubGroup(e)}
                            />
                            <button
                                type="button"
                                onClick={addSubGroup}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 rounded-lg border border-gray-200 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {subGroups.map((sg, index) => (
                                <span key={index} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 border border-blue-100">
                                    {sg}
                                    <button type="button" onClick={() => removeSubGroup(index)} className="hover:text-red-500"><X size={14} /></button>
                                </span>
                            ))}
                            {subGroups.length === 0 && <p className="text-[10px] text-gray-400 italic">No hay sub-grupos definidos.</p>}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t mt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors flex items-center gap-2">
                            {loading ? 'Guardando...' : <><Save size={16} /> {campaignToEdit ? 'Actualizar' : 'Guardar'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewCampaignModal;
