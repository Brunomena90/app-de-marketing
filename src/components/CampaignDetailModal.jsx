import React from 'react';
import { X, Calendar, Download, Video, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useRequests } from '../context/RequestContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CampaignDetailModal = ({ isOpen, onClose, campaign }) => {
    const { requests } = useRequests();

    if (!isOpen || !campaign) return null;

    // Filter requests for this campaign
    const campaignRequests = requests.filter(r => r.campaignId === campaign.id);

    // Calculate stats
    const totalRequests = campaignRequests.length;
    const completedRequests = campaignRequests.filter(r => r.status === 'Completado').length;
    const overallProgress = totalRequests > 0
        ? Math.round(campaignRequests.reduce((acc, curr) => acc + (curr.progress || 0), 0) / totalRequests)
        : 0;

    const handleExportReport = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(142, 68, 173); // Purple
        doc.text(`Reporte de Campaña: ${campaign.name}`, 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Periodo: ${campaign.startDate} - ${campaign.endDate}`, 14, 28);
        doc.text(`Estado: ${campaign.status}`, 14, 33);
        doc.text(`Progreso General: ${overallProgress}%`, 14, 38);

        // Table
        const tableRows = campaignRequests.map(r => [
            r.title || 'Sin Título',
            r.type === 'video' ? 'Video' : 'Post',
            r.area || 'N/A',
            r.status || 'Solicitado',
            `${r.progress || 0}%`
        ]);

        autoTable(doc, {
            startY: 45,
            head: [['Título', 'Tipo', 'Área', 'Estado', 'Progreso']],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [142, 68, 173] },
        });

        doc.save(`Reporte_Campaña_${campaign.name.replace(/\s+/g, '_')}.pdf`);
    };

    const StatusBadge = ({ status }) => {
        const colors = {
            'Solicitado': 'bg-gray-100 text-gray-700',
            'En Proceso': 'bg-yellow-100 text-yellow-700',
            'Revisión': 'bg-blue-100 text-blue-700',
            'Completado': 'bg-green-100 text-green-700'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors['Solicitado']}`}>
                {status || 'Solicitado'}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${campaign.status === 'Activa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {campaign.status}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Calendar size={14} />
                                {campaign.startDate} - {campaign.endDate}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{campaign.name}</h2>
                        <p className="text-gray-600 mt-1">{campaign.description || 'Sin descripción'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-4 p-6 border-b border-gray-100 bg-white">
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Solicitudes</p>
                        <p className="text-2xl font-bold text-gray-900">{totalRequests}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Completadas</p>
                        <p className="text-2xl font-bold text-gray-900">{completedRequests}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Progreso General</p>
                        <div className="flex items-end gap-2">
                            <p className="text-2xl font-bold text-gray-900">{overallProgress}%</p>
                            <div className="flex-1 pb-1.5">
                                <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${overallProgress}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body - Request List */}
                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Solicitudes Vinculadas</h3>

                    {campaignRequests.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                            <FileText className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                            <p className="text-gray-500">No hay solicitudes vinculadas a esta campaña.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {campaignRequests.map(req => (
                                <div key={req.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${req.type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                            {req.type === 'video' ? <Video size={20} /> : <FileText size={20} />}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">{req.title}</h4>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <span>{req.area}</span>
                                                <span>•</span>
                                                <span>{req.createdAt}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <span className="text-xs font-medium text-gray-500">Progreso</span>
                                            <p className="text-sm font-bold text-gray-900">{req.progress || 0}%</p>
                                        </div>
                                        <StatusBadge status={req.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={handleExportReport}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium shadow-sm transition-colors"
                    >
                        <Download size={18} />
                        Exportar Informe
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CampaignDetailModal;
