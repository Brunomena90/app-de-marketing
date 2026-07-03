import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Megaphone, Save } from 'lucide-react';
import { useCampaigns } from '../context/CampaignContext';

const campaignSchema = z.object({
    name: z.string().min(1, "El nombre de la campaña es requerido"),
    client: z.string().min(1, "El cliente/área es requerido"),
    deadline: z.string().min(1, "La fecha límite es requerida"),
});

const CampaignForm = ({ onSuccess }) => {
    const { addCampaign } = useCampaigns();

    const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
        resolver: zodResolver(campaignSchema)
    });

    const onSubmit = async (data) => {
        try {
            await addCampaign({
                name: data.name,
                client: data.client,
                deadline: data.deadline,
                status: 'Activa',
                progress: 0
            });
            reset();
            onSuccess?.();
        } catch (error) {
            console.error("Error creating campaign:", error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                    <Megaphone size={24} />
                </div>
                <div>
                    <h3 className="font-semibold text-purple-900">Nueva Campaña</h3>
                    <p className="text-sm text-purple-600">Define los detalles de la campaña</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Campaña</label>
                    <input
                        {...register('name')}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        placeholder="Ej: Black Friday 2024"
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente / Área</label>
                    <input
                        {...register('client')}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                        placeholder="Ej: Marketing Digital"
                    />
                    {errors.client && <p className="text-red-500 text-xs mt-1">{errors.client.message}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
                    <input
                        type="date"
                        {...register('deadline')}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    />
                    {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline.message}</p>}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save size={20} />
                        {isSubmitting ? 'Guardando...' : 'Crear Campaña'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CampaignForm;
