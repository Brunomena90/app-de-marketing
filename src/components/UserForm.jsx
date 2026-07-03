import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Save, Eye, EyeOff } from 'lucide-react';
import { useUsers } from '../context/UserContext';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const userSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    email: z.string().email("Email inválido"),
    role: z.string().min(1, "El rol es requerido"),
    area: z.string().min(1, "El área es requerida"),
    position: z.string().optional(),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional().or(z.literal('')),
});

const UserForm = ({ userToEdit, onSuccess }) => {
    const { addUser, updateUser } = useUsers();
    const [areasList, setAreasList] = useState([]);
    const [loadingAreas, setLoadingAreas] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm({
        resolver: zodResolver(userSchema),
        defaultValues: {
            role: 'Solicitante',
            area: '',
            position: '',
            password: ''
        }
    });

    const watchedName = watch('name');

    // Helper to get initials
    const getInitials = (name) => {
        if (!name) return '??';
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    // Fetch Areas from Firebase
    useEffect(() => {
        const q = query(collection(db, 'areas'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const areas = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAreasList(areas);
            setLoadingAreas(false);

            // Set default area if creating new user and areas exist
            if (!userToEdit && areas.length > 0) {
                setValue('area', areas[0].name);
            }
        }, (error) => {
            console.error("Error fetching areas:", error);
            setLoadingAreas(false);
        });

        return () => unsubscribe();
    }, [userToEdit, setValue]);

    useEffect(() => {
        if (userToEdit) {
            reset({
                name: userToEdit.name,
                email: userToEdit.email,
                role: userToEdit.role,
                area: userToEdit.area,
                position: userToEdit.position || '',
                password: userToEdit.password || ''
            });
        } else {
            reset({
                name: '',
                email: '',
                role: 'solicitante',
                area: areasList.length > 0 ? areasList[0].name : '',
                position: '',
                password: ''
            });
        }
    }, [userToEdit, reset, areasList]);

    const onSubmit = async (data) => {
        try {
            if (userToEdit) {
                await updateUser(userToEdit.id, data);
            } else {
                await addUser(data);
            }
            reset();
            onSuccess?.();
        } catch (error) {
            console.error("Error saving user:", error);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / Avatar */}
            <div className="flex flex-col items-center justify-center pb-6 border-b border-gray-100">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 text-2xl font-bold mb-3 ring-4 ring-white shadow-sm">
                    {getInitials(watchedName)}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                    {userToEdit ? 'Editar Perfil' : 'Nuevo Perfil'}
                </h3>
                <p className="text-sm text-gray-500">
                    {userToEdit ? 'Actualiza la información del colaborador' : 'Ingresa los datos del nuevo colaborador'}
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Datos Personales */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                        <input
                            {...register('name')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="Ej: Juan Pérez"
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            {...register('email')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="juan@empresa.com"
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                            <select
                                {...register('role')}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="jefe">Jefe</option>
                                <option value="solicitante">Solicitante</option>
                            </select>
                            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Área</label>
                            <select
                                {...register('area')}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                disabled={loadingAreas || areasList.length === 0}
                            >
                                {loadingAreas ? (
                                    <option>Cargando áreas...</option>
                                ) : areasList.length === 0 ? (
                                    <option value="">No hay áreas creadas</option>
                                ) : (
                                    areasList.map(area => (
                                        <option key={area.id} value={area.name}>
                                            {area.name}
                                        </option>
                                    ))
                                )}
                            </select>
                            {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Puesto / Cargo</label>
                        <input
                            {...register('position')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="Ej: Gerente de Marketing"
                        />
                    </div>
                </div>

                {/* Gestión de Contraseña */}
                <div className="pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Gestión de Contraseña</h4>
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            {...register('password')}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-10"
                            placeholder="Ingrese contraseña para actualizar"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                        <p className="text-xs text-gray-500 mt-1">Edite este campo solo si desea cambiar la contraseña.</p>
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={isSubmitting || (areasList.length === 0 && !loadingAreas)}
                        className="flex items-center gap-2 bg-gray-900 text-white px-8 py-2.5 rounded-xl hover:bg-gray-800 transition-colors font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={20} />
                        Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    );
};

export default UserForm;
