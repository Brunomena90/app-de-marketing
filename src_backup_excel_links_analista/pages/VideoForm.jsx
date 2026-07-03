import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Video, ArrowLeft, Save } from 'lucide-react';

const VideoForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        area: 'Marketing',
        objective: '',
        references: '',
        duration: '',
        deadline: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "solicitudes_contenido"), {
                type: 'video',
                title: formData.title,
                area: formData.area,
                status: 'Solicitado',
                progress: 0,
                createdAt: new Date().toISOString().split('T')[0],
                details: {
                    objective: formData.objective,
                    references: formData.references,
                    duration: formData.duration,
                    deadline: formData.deadline
                }
            });
            alert("Solicitud de Video Guardada con Éxito");
            navigate('/');
        } catch (error) {
            console.error("Error al guardar video:", error);
            alert("Error al guardar la solicitud");
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="max-w-2xl mx-auto">
            <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-500 hover:text-gray-900 mb-6 transition-colors"
            >
                <ArrowLeft size={20} className="mr-2" />
                Volver al Dashboard
            </button>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-blue-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Video size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Nueva Solicitud de Video</h2>
                            <p className="text-sm text-blue-600">Completa los detalles para iniciar la producción</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título del Video</label>
                            <input
                                required
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Ej: Lanzamiento de Producto X"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Área Solicitante</label>
                            <select
                                name="area"
                                value={formData.area}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="Marketing">Marketing</option>
                                <option value="RRHH">RRHH</option>
                                <option value="Ventas">Ventas</option>
                                <option value="Producto">Producto</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
                            <input
                                required
                                type="date"
                                name="deadline"
                                value={formData.deadline}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo del Video</label>
                            <textarea
                                required
                                name="objective"
                                value={formData.objective}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="¿Qué queremos lograr con este video?"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Referencias Visuales (Link)</label>
                            <input
                                type="url"
                                name="references"
                                value={formData.references}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="https://..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duración Estimada</label>
                            <input
                                name="duration"
                                value={formData.duration}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="Ej: 30 seg, 2 min"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow"
                        >
                            <Save size={20} />
                            Crear Solicitud
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VideoForm;
