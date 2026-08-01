import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Building2, Save, Edit2, Image as ImageIcon } from 'lucide-react';
import { addDoc, updateDoc, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { useAuth, isSuperUser5 } from '../context/AuthContext';

const ALL_MODULE_IDS = ['marketing', 'ventas', 'workflow-ai', 'branding', 'finanzas', 'empresas'];

const NewEmpresaModal = ({ isOpen, onClose, empresaToEdit = null }) => {
    const { register, handleSubmit, reset, formState: { errors } } = useForm();
    const [loading, setLoading] = useState(false);
    const [logoBase64, setLogoBase64] = useState(null);
    const { user, hasGlobalAccess } = useAuth();

    useEffect(() => {
        if (isOpen) {
            if (empresaToEdit) {
                reset({ 
                    name: empresaToEdit.name,
                    ruc: empresaToEdit.ruc || ''
                });
                setLogoBase64(empresaToEdit.logoBase64 || null);
            } else {
                reset({ 
                    name: '',
                    ruc: ''
                });
                setLogoBase64(null);
            }
        }
    }, [isOpen, empresaToEdit, reset]);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width; let h = img.height;
                const max = 800;
                if (w > max || h > max) {
                    if (w > h) { h = h * (max / w); w = max; }
                    else { w = w * (max / h); h = max; }
                }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                setLogoBase64(canvas.toDataURL('image/png'));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const onSubmit = async (data) => {
        setLoading(true);
        try {
            const newName = data.name.trim();
            const rucValue = data.ruc ? data.ruc.trim() : '';
            const iAmSuper5 = isSuperUser5(user?.role);

            if (empresaToEdit) {
                // MODO EDICIÓN
                const empresaRef = doc(db, 'empresas', empresaToEdit.id);
                const updateData = { name: newName, ruc: rucValue };
                if (logoBase64) updateData.logoBase64 = logoBase64;
                await updateDoc(empresaRef, updateData);
                toast.success('Empresa actualizada correctamente');
            } else {
                // MODO CREACIÓN
                // Si es Super Nv.5, sus empresas solo pueden tener los módulos que el Nv.1 le asignó
                const allowedModules = iAmSuper5
                    ? (Array.isArray(user?.accessibleApps) ? user.accessibleApps : [])
                    : ALL_MODULE_IDS;

                const newCompanyData = {
                    name: newName,
                    ruc: rucValue,
                    createdAt: new Date().toISOString(),
                    accessibleModules: allowedModules,
                    status: 'on',
                    logoBase64: logoBase64 || null,
                    ...(iAmSuper5 && { createdBySuperUser5: user?.id || user?.uid })
                };
                await addDoc(collection(db, 'empresas'), newCompanyData);
                
                // Si el usuario no tiene acceso global (ej. Super Usuario Nivel 5), le auto-asignamos esta empresa a su perfil
                if (!hasGlobalAccess && user?.id) {
                    const userRef = doc(db, 'users', user.id);
                    const updatedEmpresas = [...(user.empresas || []), newName];
                    await updateDoc(userRef, { empresas: updatedEmpresas });
                }

                toast.success('Empresa creada exitosamente');
            }

            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la empresa');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">

                {/* HEADER */}
                <div className="flex justify-between items-center p-5 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        {empresaToEdit
                            ? <><Edit2 size={20} className="text-blue-600" /> Editar Empresa</>
                            : <><Building2 size={20} className="text-blue-600" /> Nueva Empresa</>
                        }
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* FORM */}
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                            Nombre de la Empresa
                        </label>
                        <input
                            {...register('name', {
                                required: 'El nombre es requerido',
                                minLength: { value: 2, message: 'El nombre debe tener al menos 2 caracteres' },
                            })}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: Artories Creative"
                            autoFocus
                        />
                        {errors.name && (
                            <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                        )}
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                            RUC (Opcional)
                        </label>
                        <input
                            {...register('ruc')}
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ej: 20123456789"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block flex justify-between">
                            <span>Logo de la Empresa (SVG, PNG, JPG)</span>
                            {logoBase64 && (
                                <button type="button" onClick={() => setLogoBase64(null)} className="text-red-500 hover:underline">
                                    Quitar
                                </button>
                            )}
                        </label>
                        {logoBase64 ? (
                            <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-center bg-gray-50">
                                <img src={logoBase64} alt="Logo preview" className="max-h-24 max-w-full object-contain" />
                            </div>
                        ) : (
                            <label className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                                <ImageIcon size={24} className="text-gray-400 mb-2" />
                                <span className="text-sm font-medium text-gray-600">Subir logo (SVG, PNG, JPG)</span>
                                <input type="file" accept="image/svg+xml,image/png,image/jpeg" className="hidden" onChange={handleLogoUpload} />
                            </label>
                        )}
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-60"
                        >
                            {loading ? 'Guardando...' : <><Save size={16} /> {empresaToEdit ? 'Actualizar' : 'Guardar'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewEmpresaModal;
