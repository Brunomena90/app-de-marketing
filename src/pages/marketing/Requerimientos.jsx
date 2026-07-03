import React, { useState } from 'react';
import { useRequests } from '../../context/RequestContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Search, ListTodo, FileText, ChevronRight, Download, X, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Requerimientos = () => {
    const { requests, loading } = useRequests();
    const { activeEmpresa } = useAuth();
    const [search, setSearch] = useState('');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [selectedForExport, setSelectedForExport] = useState([]);
    const [modalSearch, setModalSearch] = useState('');

    const filtered = requests.filter(s => {
        if (s.archived) return false;
        if (!search) return true;
        const sTerm = search.toLowerCase();
        return s.title?.toLowerCase().includes(sTerm);
    });

    const requestsWithItems = requests.filter(r => !r.archived && r.requerimientosItems && r.requerimientosItems.length > 0);

    const filteredModalRequests = requestsWithItems.filter(r => {
        if (!modalSearch) return true;
        return r.title?.toLowerCase().includes(modalSearch.toLowerCase());
    });

    const toggleSelection = (id) => {
        setSelectedForExport(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        // Obtenemos los IDs visibles actualmente en el filtro del modal
        const visibleIds = filteredModalRequests.map(f => f.id);
        
        // Verificamos si TODOS los visibles están seleccionados
        const allVisibleSelected = visibleIds.every(id => selectedForExport.includes(id));
        
        if (allVisibleSelected) {
            // Si todos los visibles están seleccionados, los desmarcamos
            setSelectedForExport(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            // Si falta alguno, los agregamos a los seleccionados manteniendo los que ya estaban
            const newSelection = new Set([...selectedForExport, ...visibleIds]);
            setSelectedForExport(Array.from(newSelection));
        }
    };

    const handleExportMultiPDF = () => {
        if (selectedForExport.length === 0) {
            return toast.error("Selecciona al menos una solicitud");
        }

        const doc = new jsPDF();
        
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        const companyName = activeEmpresa && activeEmpresa !== 'Todas' ? activeEmpresa.toUpperCase() : 'GENERAL';
        doc.text(`REQUERIMIENTOS (${companyName})`, 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });

        let currentY = 40;

        const selectedDocs = requestsWithItems.filter(r => selectedForExport.includes(r.id));

        selectedDocs.forEach((req, index) => {
            const items = req.requerimientosItems || [];
            
            if (currentY > 250) {
                doc.addPage();
                currentY = 20;
            }

            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(79, 70, 229);
            doc.text(`${index + 1}. ${req.title}`, 14, currentY);
            
            currentY += 8;

            const rows = items.map((item, i) => [
                i + 1,
                item.text
            ]);

            autoTable(doc, {
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                head: [['N°', 'REQUERIMIENTO']],
                body: rows.length ? rows : [['-', 'Sin requerimientos']],
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' }
                },
                styles: { fontSize: 9 },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 15;
        });

        // Add Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.text("Generado con: Artories Suit", 105, pageHeight - 10, { align: 'center' });
        }

        doc.save(`Requerimientos_Multiples.pdf`);
        setIsExportModalOpen(false);
        setSelectedForExport([]);
        toast.success("PDF generado exitosamente");
    };    return (
        <div className="p-4 md:p-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <ListTodo className="text-indigo-600" /> Requerimientos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Selecciona una solicitud para gestionar sus requerimientos técnicos y materiales.</p>
                </div>
                <button 
                    onClick={() => setIsExportModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl transition-colors shrink-0 text-sm"
                >
                    <Download size={16} /> Exportar Múltiples PDF
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar solicitud por nombre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-10 text-center text-slate-500">Cargando solicitudes...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 flex flex-col items-center">
                            <FileText size={32} className="text-slate-300 mb-3" />
                            <p>No se encontraron solicitudes.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {filtered.map(sol => (
                                <Link 
                                    key={sol.id} 
                                    to={`/requerimientos/${sol.id}`}
                                    className="flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{sol.title}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">Área: {sol.area || 'N/A'} • Creado: {sol.requestDate || new Date(sol.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors group-hover:translate-x-1" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Exportación Múltiple */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Exportar PDF</h2>
                                <p className="text-xs text-slate-500">Selecciona las solicitudes a incluir en el reporte.</p>
                            </div>
                            <button onClick={() => { setIsExportModalOpen(false); setModalSearch(''); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Buscador dentro del modal */}
                        <div className="p-3 border-b border-slate-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre..."
                                    value={modalSearch}
                                    onChange={(e) => setModalSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="p-2 overflow-y-auto flex-1 bg-white">
                            {filteredModalRequests.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 m-4 rounded-xl">
                                    {requestsWithItems.length === 0 ? "No tienes solicitudes con requerimientos." : "No se encontraron solicitudes con esa búsqueda."}
                                </div>
                            ) : (
                                <div className="space-y-1 p-2">
                                    {filteredModalRequests.map(req => {
                                        const isSelected = selectedForExport.includes(req.id);
                                        return (
                                            <div 
                                                key={req.id} 
                                                onClick={() => toggleSelection(req.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                                            >
                                                {isSelected ? <CheckSquare className="text-indigo-600 shrink-0" size={20} /> : <Square className="text-slate-300 shrink-0" size={20} />}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{req.title}</p>
                                                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{req.requerimientosItems.length} requerimientos agregados</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                            <button 
                                onClick={toggleAll}
                                className="text-sm text-indigo-600 font-bold hover:underline px-2 py-1"
                            >
                                {filteredModalRequests.length > 0 && filteredModalRequests.every(f => selectedForExport.includes(f.id)) ? 'Desmarcar todo' : 'Seleccionar todo'}
                            </button>
                            <button 
                                onClick={handleExportMultiPDF}
                                disabled={selectedForExport.length === 0}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
                            >
                                Generar PDF ({selectedForExport.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Requerimientos;
