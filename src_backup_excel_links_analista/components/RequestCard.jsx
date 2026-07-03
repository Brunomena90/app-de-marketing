import React from 'react';
import { FileText, Video, Trash2, FileDown, Calendar, User, List, Megaphone } from 'lucide-react';
// import { format } from 'date-fns'; // Removed to avoid dependency issues if not installed
import { toast } from 'sonner';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase'; // Ajusta la ruta si es necesario
import jsPDF from 'jspdf'; // Si usas exportación individual

import { useAuth } from '../context/AuthContext';

// IMPORTANTE: Recibir 'onClick' en las props
const RequestCard = ({ request, onClick }) => {
    const { user, isAdmin } = useAuth();
    const isPostProd = request?.inPostProduction;

    // Helper para truncar texto cuidando que sea legible
    const truncateText = (text, maxLength = 25) => {
        if (!text) return "";
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + "...";
    };

    // Valores por defecto para evitar crash
    const {
        id,
        title = "Sin Título",
        type = "video",
        status = "solicitado",
        area = "General",
        progress = 0,
        deliveryDate
    } = request || {};

    const handleDelete = async (e) => {
        e.stopPropagation(); // <--- VITAL: Evita que al borrar se abra el detalle

        try {
            await deleteDoc(doc(db, "solicitudes_contenido", id));
            toast.success("Solicitud eliminada");
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar");
        }
    };

    const handleExport = (e) => {
        e.stopPropagation();
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Ficha de Solicitud', 14, 20);

        doc.setFontSize(12);
        doc.text(`Título: ${title}`, 14, 30);
        doc.text(`Área: ${area}`, 14, 40);
        doc.text(`Tipo: ${type}`, 14, 50);
        doc.text(`Estado: ${status}`, 14, 60);
        doc.text(`Fecha Entrega: ${deliveryDate || 'Pendiente'}`, 14, 70);

        doc.save(`Solicitud_${id}.pdf`);
    };

    // Configuración de colores según estado
    const statusColors = {
        solicitado: "bg-gray-100 text-gray-600",
        "en proceso": "bg-blue-100 text-blue-600",
        revision: "bg-orange-100 text-orange-600",
        completado: "bg-green-100 text-green-600"
    };

    return (
        <div
            onClick={onClick}
            className={`border rounded-[24px] p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative group ${isPostProd ? 'bg-indigo-600 border-indigo-500 shadow-indigo-200' : 'bg-white border-slate-200'}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <span className={`p-2.5 rounded-xl shadow-inner ${isPostProd ? 'bg-indigo-500/50 text-white border border-indigo-400' : (type === 'video' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100')}`}>
                        {type === 'video' ? <Video size={18} /> : <FileText size={18} />}
                    </span>
                    <div>
                        <h3 className={`font-bold text-base leading-tight line-clamp-2 ${isPostProd ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
                        <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${isPostProd ? 'text-indigo-200' : 'text-slate-400'}`}>{type === 'video' ? 'Producción Audiovisual' : 'Diseño Gráfico'}</p>
                    </div>
                </div>

                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {(isAdmin || user?.role === 'editor') && (
                        <button onClick={handleDelete} className={`p-2 rounded-lg transition-colors shadow-sm ${isPostProd ? 'bg-indigo-500 text-indigo-100 hover:bg-red-500 hover:text-white border border-indigo-400' : 'bg-white border border-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100'}`} title="Eliminar">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className={`space-y-3 text-sm font-medium mb-5 ${isPostProd ? 'text-indigo-100' : 'text-slate-600'}`}>
                <div className="flex items-center gap-2">
                    <User size={14} className={isPostProd ? 'text-indigo-300' : 'text-slate-400'} /> <span className="truncate">{area}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar size={14} className={isPostProd ? 'text-indigo-300' : 'text-slate-400'} /> <span>Entrega: {deliveryDate || 'Pendiente'}</span>
                </div>
                {request.checklist && request.checklist.length > 0 && (
                    <div className={`flex items-center gap-2 font-bold ${isPostProd ? 'text-white' : 'text-blue-600'}`}>
                        <List size={14} /> <span>{request.checklist.filter(c => c.completed).length}/{request.checklist.length} Tareas</span>
                    </div>
                )}
                { (request.campaign || request.subGroup) && (
                    <div className={`flex items-center gap-2 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border uppercase tracking-tighter truncate max-w-full ${isPostProd ? 'bg-indigo-500 text-white border-indigo-400' : 'text-purple-700 bg-purple-50 border-purple-200'}`} title={request.campaign + (request.subGroup ? ` > ${request.subGroup}` : '')}>
                        <Megaphone size={12} className="shrink-0" />
                        <span className="truncate">
                            {request.subGroup ? truncateText(request.subGroup, 25) : request.campaign}
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100/20">
                <div className="flex justify-between items-center text-xs">
                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] shadow-sm ${isPostProd ? 'bg-indigo-500/50 text-white border border-indigo-400' : (statusColors[status.toLowerCase()] || statusColors.solicitado)}`}>
                        {isPostProd ? (request.postProductionFinished ? 'Post Producción (FIN)' : 'En Post Producción') : status}
                    </span>
                    <span className={`font-bold ${isPostProd ? 'text-white' : 'text-slate-400'}`}>{progress}%</span>
                </div>
                {/* Barra de progreso */}
                <div className={`w-full rounded-full h-2 shadow-inner ${isPostProd ? 'bg-indigo-800/50' : 'bg-slate-100'}`}>
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${isPostProd ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default RequestCard;
