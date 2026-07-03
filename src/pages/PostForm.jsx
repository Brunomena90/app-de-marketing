import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { FileText, ArrowLeft, Save } from 'lucide-react';

const PostForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        area: 'Marketing',
        copy: '',
        platform: 'Instagram',
        format: 'Post'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, "solicitudes_contenido"), {
                type: 'post',
                title: formData.title,
                area: formData.area,
                status: 'Solicitado',
                progress: 0,
                createdAt: new Date().toISOString().split('T')[0],
                details: {
                    copy: formData.copy,
                    platform: formData.platform,
                    format: formData.format
                }
            });
            alert("Solicitud de Post Guardada con Éxito");
            navigate('/');
        } catch (error) {
            console.error("Error al guardar post:", error);
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
                <div className="p-6 border-b border-gray-100 bg-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Nueva Publicación</h2>
                            <p className="text-sm text-purple-600">Define el contenido para redes sociales</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título del Post</label>
                            <input
                                required
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="Ej: Anuncio de Vacante"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Área Solicitante</label>
                            <select
                                name="area"
                                value={formData.area}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="Marketing">Marketing</option>
                                <option value="RRHH">RRHH</option>
                                <option value="Ventas">Ventas</option>
                                <option value="Producto">Producto</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
                            <select
                                name="platform"
                                value={formData.platform}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="Instagram">Instagram</option>
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="TikTok">TikTok</option>
                                <option value="Twitter">Twitter</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
                            <select
                                name="format"
                                value={formData.format}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                            >
                                <option value="Post">Post Estático</option>
                                <option value="Carrusel">Carrusel</option>
                                <option value="Reel">Reel</option>
                                <option value="Story">Story</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Copy (Texto)</label>
                            <textarea
                                required
                                name="copy"
                                value={formData.copy}
                                onChange={handleChange}
                                rows={5}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="Escribe el texto de la publicación aquí..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-sm hover:shadow"
                        >
                            <Save size={20} />
                            Crear Publicación
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PostForm;
