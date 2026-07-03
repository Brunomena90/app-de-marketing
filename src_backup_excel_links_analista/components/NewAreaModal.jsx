import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Layers, Save, Edit2, Building2 } from 'lucide-react';
import { addDoc, updateDoc, doc, collection, query, where, getDocs, writeBatch, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

// Si se pasan defaultEmpresaId y defaultEmpresaName, no se muestra el selector de empresa
const NewAreaModal = ({ isOpen, onClose, areaToEdit = null, defaultEmpresaId = null, defaultEmpresaName = null }) => {
    const { register, handleSubmit, reset, formState: { errors } } = useForm();
    const [loading, setLoading] = useState(false);
    const [empresas, setEmpresas] = useState([]);

    const hasDefaultEmpresa = !!defaultEmpresaId;

    // Cargar empresas solo si NO hay empresa pre-seleccionada
    useEffect(() => {
        if (isOpen && !hasDefaultEmpresa) {
            const q = query(collection(db, 'empresas'), orderBy('name'));
            const unsub = onSnapshot(q, snap =>
                setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            );
            return () => unsub();
        }
    }, [isOpen, hasDefaultEmpresa]);

    // Rellenar formulario al abrir
    useEffect(() => {
        if (isOpen) {
            if (areaToEdit) {
                reset({
                    name: areaToEdit.name,
                    empresaId: areaToEdit.empresaId || defaultEmpresaId || '',
                });
            } else {
                reset({ name: '', empresaId: defaultEmpresaId || '' });
            }
        }
    }, [isOpen, areaToEdit, defaultEmpresaId, reset]);

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const newName = data.name.trim();

            // Resolver empresa: prioridad → default prop → selector del form
            let empresaId = defaultEmpresaId || data.empresaId;
            let empresaName = defaultEmpresaName;

            if (!empresaName && empresaId) {
                const found = empresas.find(e => e.id === empresaId);
                empresaName = found ? found.name : '';
            }

            if (!empresaId) {
                toast.error('Debes seleccionar una empresa');
                setLoading(false);
                return;
            }

            if (areaToEdit) {
                const oldName = areaToEdit.name;
                const batch = writeBatch(db);

                const areaRef = doc(db, 'areas', areaToEdit.id);
                batch.update(areaRef, { name: newName, empresaId, empresaName });

                if (oldName !== newName) {
                    const reqSnap = await getDocs(query(collection(db, 'solicitudes_contenido'), where('area', '==', oldName)));
                    reqSnap.forEach(d => batch.update(d.ref, { area: newName }));

                    const userSnap = await getDocs(query(collection(db, 'users'), where('areas', 'array-contains', oldName)));
                    userSnap.forEach(docSnap => {
                        const ud = docSnap.data();
                        const updates = {};
                        if (Array.isArray(ud.areas)) updates.areas = ud.areas.map(a => a === oldName ? newName : a);
                        if (ud.area === oldName) updates.area = newName;
                        if (Object.keys(updates).length) batch.update(docSnap.ref, updates);
                    });
                }

                await batch.commit();
                toast.success('Área actualizada');
            } else {
                await addDoc(collection(db, 'areas'), {
                    name: newName,
                    empresaId,
                    empresaName,
                    createdAt: new Date().toISOString(),
                });
                toast.success('Área creada exitosamente');
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el área');
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
                        {areaToEdit
                            ? <><Edit2 size={20} className="text-blue-600" /> Editar Área</>
                            : <><Layers size={20} className="text-blue-600" /> Nueva Área</>}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                    {/* Empresa: mostrar como texto si viene pre-seleccionada, como select si no */}
                    {hasDefaultEmpresa ? (
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5">
                            <Building2 size={15} className="text-indigo-400 shrink-0" />
                            <span className="text-sm font-semibold text-indigo-700">{defaultEmpresaName}</span>
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                                <Building2 size={12} /> Empresa
                            </label>
                            {empresas.length === 0 ? (
                                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    No hay empresas creadas aún.
                                </div>
                            ) : (
                                <select
                                    {...register('empresaId', { required: 'Debes seleccionar una empresa' })}
                                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                >
                                    <option value="">Seleccionar empresa...</option>
                                    {empresas.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            )}
                            {errors.empresaId && <p className="text-red-500 text-xs mt-1">{errors.empresaId.message}</p>}
                        </div>
                    )}

                    {/* Nombre */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                            <Layers size={12} /> Nombre del Área
                        </label>
                        <input
                            {...register('name', { required: 'El nombre es requerido' })}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                            placeholder="Ej: MARKETING"
                            autoFocus
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t mt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (!hasDefaultEmpresa && empresas.length === 0)}
                            className="px-6 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                            {loading ? 'Guardando...' : <><Save size={16} /> {areaToEdit ? 'Actualizar' : 'Guardar'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewAreaModal;
