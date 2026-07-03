import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Plus, Trash2, Download, ListTodo, Save, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- SUB-COMPONENTE: TEXTAREA AUTO-AJUSTABLE ---
const AutoResizeTextarea = ({ value, onChange, onBlur, disabled }) => {
    const textareaRef = useRef(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 24)}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            rows={1}
            spellCheck={true}
            lang="es-PE"
            className="text-sm w-full bg-transparent outline-none border-b border-transparent focus:border-indigo-300 resize-none overflow-hidden block transition-all font-medium text-slate-700"
            style={{ minHeight: '24px', lineHeight: '1.5' }}
        />
    );
};

const RequerimientoDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, isAdmin, activeEmpresa } = useAuth();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [items, setItems] = useState([]);
    const [newItemText, setNewItemText] = useState('');

    useEffect(() => {
        if (!id) return;
        const unsub = onSnapshot(doc(db, "solicitudes_contenido", id), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                setRequest(data);
                setItems(data.requerimientosItems || []);
            } else {
                toast.error("Solicitud no encontrada");
                navigate('/requerimientos');
            }
            setLoading(false);
        });
        return () => unsub();
    }, [id, navigate]);

    const saveItems = async (newItems) => {
        setItems(newItems);
        try {
            await updateDoc(doc(db, "solicitudes_contenido", id), {
                requerimientosItems: newItems
            });
        } catch (error) {
            toast.error("Error al guardar los requerimientos");
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        if (!newItemText.trim()) return;
        
        const newItems = [...items, { 
            text: newItemText.trim(), 
            addedBy: user.name, 
            createdAt: new Date().toISOString() 
        }];
        await saveItems(newItems);
        setNewItemText('');
    };

    const handleDeleteItem = async (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        await saveItems(newItems);
    };

    const handleUpdateItem = async (index, newText) => {
        const newItems = [...items];
        newItems[index].text = newText;
        await saveItems(newItems);
    };

    const exportToPDF = () => {
        if (!request) return;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        const companyName = activeEmpresa && activeEmpresa !== 'Todas' ? activeEmpresa.toUpperCase() : 'GENERAL';
        doc.text(`REQUERIMIENTOS (${companyName})`, 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Solicitud: ${request.title}`, 105, 28, { align: 'center' });
        doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 105, 33, { align: 'center' });

        const rows = items.map((item, index) => [
            index + 1,
            item.text
        ]);

        autoTable(doc, {
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
            head: [['N°', 'REQUERIMIENTO / MATERIAL']],
            body: rows.length ? rows : [['-', 'Sin requerimientos']],
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' }
            },
            styles: { fontSize: 10 }
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
            doc.text("Generado con: Artories Suit", 105, pageHeight - 10, { align: 'center' });
        }

        doc.save(`Requerimientos_${request.title}.pdf`);
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Cargando detalles...</div>;
    if (!request) return null;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={() => navigate('/requerimientos')} className="p-2 -ml-2 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Requerimientos de Solicitud</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 leading-tight">{request.title}</h1>
                    </div>
                </div>

                <button 
                    onClick={exportToPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl transition-colors shrink-0 text-sm"
                >
                    <Download size={16} /> Exportar PDF
                </button>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <ListTodo size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Lista de Requerimientos</h2>
                        <p className="text-xs text-slate-500">Materiales, equipos o necesidades para esta solicitud.</p>
                    </div>
                </div>

                <div className="p-6">
                    {/* Input para agregar */}
                    <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            placeholder="Escribe un nuevo requerimiento..."
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                        <button 
                            type="submit"
                            disabled={!newItemText.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shrink-0 shadow-sm shadow-indigo-200"
                        >
                            <Plus size={18} /> <span className="hidden sm:inline">Agregar</span>
                        </button>
                    </form>

                    {/* Lista */}
                    <div className="space-y-2">
                        {items.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-sm">No hay requerimientos agregados todavía.</p>
                            </div>
                        ) : (
                            items.map((item, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-300 bg-white group transition-colors shadow-sm">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <AutoResizeTextarea 
                                            value={item.text} 
                                            onChange={(e) => {
                                                const newItems = [...items];
                                                newItems[index].text = e.target.value;
                                                setItems(newItems);
                                            }}
                                            onBlur={(e) => handleUpdateItem(index, e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteItem(index)}
                                        className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RequerimientoDetail;
