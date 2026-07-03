import React, { useState } from 'react';
import { Plus, Instagram, Linkedin, Facebook, Twitter, FileText, Image, Layers } from 'lucide-react';
import { useRequests } from '../context/RequestContext';
import Modal from '../components/Modal';
import SlideOver from '../components/SlideOver';
import RequestForm from '../components/RequestForm';
import RequestDetail from '../components/RequestDetail';

const Posts = () => {
    const { requests, loading } = useRequests();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);

    // Filter only 'post' type requests
    const posts = requests.filter(req => req.type === 'post');

    const getPlatformIcon = (platform) => {
        switch (platform?.toLowerCase()) {
            case 'instagram': return <Instagram size={20} />;
            case 'linkedin': return <Linkedin size={20} />;
            case 'facebook': return <Facebook size={20} />;
            case 'twitter': return <Twitter size={20} />;
            default: return <FileText size={20} />;
        }
    };

    const getFormatIcon = (format) => {
        switch (format?.toLowerCase()) {
            case 'reel': return <FileText size={16} />;
            case 'carrusel': return <Layers size={16} />;
            case 'imagen': return <Image size={16} />;
            default: return <FileText size={16} />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Publicaciones</h2>
                    <p className="text-gray-500">Gestiona el contenido para redes sociales</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors shadow-sm hover:shadow-md"
                >
                    <Plus size={20} />
                    <span className="font-medium">Nueva Publicación</span>
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <p className="text-gray-500">Cargando publicaciones...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                    <div className="inline-flex p-4 bg-purple-50 rounded-full text-purple-600 mb-4">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No hay publicaciones</h3>
                    <p className="text-gray-500 mt-1">Crea tu primera publicación para comenzar</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.map((post) => (
                        <div
                            key={post.id}
                            onClick={() => setSelectedRequest(post)}
                            className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer p-6 group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
                                    {getPlatformIcon(post.details?.platform)}
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${post.status === 'Completado' ? 'bg-green-100 text-green-700' :
                                        post.status === 'En Proceso' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {post.status}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1">{post.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">{post.area}</p>

                            <div className="flex items-center gap-4 text-sm text-gray-600 pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-1.5">
                                    {getFormatIcon(post.details?.format)}
                                    <span>{post.details?.format || 'General'}</span>
                                </div>
                                {post.details?.platform && (
                                    <span className="text-gray-300">|</span>
                                )}
                                {post.details?.platform && (
                                    <span>{post.details.platform}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Nueva Solicitud"
            >
                <RequestForm onSuccess={() => setIsModalOpen(false)} />
            </Modal>

            <SlideOver
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title="Detalles de la Publicación"
            >
                <RequestDetail request={selectedRequest} />
            </SlideOver>
        </div>
    );
};

export default Posts;
