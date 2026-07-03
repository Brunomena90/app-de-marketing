import React, { useState, useEffect } from 'react';

const STATUSES = ['Pendiente', 'Enviada', 'En revisión', 'Aprobada', 'Rechazada'];
const STATUS_COLORS = {
    'Pendiente':   'bg-amber-50 text-amber-700 border-amber-200',
    'Enviada':     'bg-blue-50 text-blue-700 border-blue-200',
    'En revisión': 'bg-purple-50 text-purple-700 border-purple-200',
    'Aprobada':    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rechazada':   'bg-red-50 text-red-700 border-red-200',
};
import { X, Plus, Trash2, Save, FileText, Calendar, User, Building, Mail, Phone, Hash, ShieldCheck, CheckSquare, Square, MessageSquare } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const QuotationModal = ({ isOpen, onClose, quotation = null, onSave }) => {
    const { user, activeEmpresa } = useAuth();
    const [formData, setFormData] = useState({
        clientName: '',
        clientRUC: '',
        showRUC: false,
        issuerName: user?.name || '',
        issuerCompany: activeEmpresa || '',
        issuerRUC: '',
        showIssuerRUC: false,
        issuerEmail: user?.email || '',
        issuerPhone: '',
        quotationNumber: '',
        date: new Date().toISOString().split('T')[0],
        items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
        notes: [''],
        currency: 'S/.',
        subtotal: 0,
        igv: 0,
        total: 0,
        includeIGV: true,
        status: 'Pendiente'
    });

    const getNextQuotationNumber = async (empresa) => {
        try {
            const year = new Date().getFullYear();
            let q;
            
            // Si estamos en modo "Todas", buscamos la última a nivel global
            // Si estamos en una empresa específica, buscamos la última de esa empresa
            if (!empresa || empresa === 'Todas') {
                q = query(
                    collection(db, "cotizaciones"),
                    orderBy("createdAt", "desc"),
                    limit(20) // Traemos las últimas 20 para filtrar por año en JS si es necesario
                );
            } else {
                q = query(
                    collection(db, "cotizaciones"),
                    where("empresa", "==", empresa),
                    orderBy("createdAt", "desc"),
                    limit(20)
                );
            }

            const snap = await getDocs(q);
            let lastNo = 0;
            
            if (!snap.empty) {
                // Buscamos la última del año actual entre los resultados recientes
                const sameYearDoc = snap.docs.find(d => {
                    const data = d.data();
                    return data.quotationNumber && data.quotationNumber.endsWith(` - ${year}`);
                });

                if (sameYearDoc) {
                    const data = sameYearDoc.data();
                    const numPart = data.quotationNumber.split(' - ')[0];
                    lastNo = parseInt(numPart) || 0;
                }
            }
            
            return `${(lastNo + 1).toString().padStart(3, '0')} - ${year}`;
        } catch (e) {
            console.error("Error generating number:", e);
            // Si falla por falta de índice compuesto (empresa + createdAt), 
            // intentamos una búsqueda global como fallback final
            try {
                const fallbackSnap = await getDocs(query(collection(db, "cotizaciones"), orderBy("createdAt", "desc"), limit(1)));
                if (!fallbackSnap.empty) {
                    const data = fallbackSnap.docs[0].data();
                    const year = new Date().getFullYear();
                    if (data.quotationNumber && data.quotationNumber.endsWith(` - ${year}`)) {
                        const numPart = data.quotationNumber.split(' - ')[0];
                        return `${(parseInt(numPart) + 1).toString().padStart(3, '0')} - ${year}`;
                    }
                }
            } catch (err) {}
            return `001 - ${new Date().getFullYear()}`;
        }
    };

    useEffect(() => {
        const initForm = async () => {
            if (quotation) {
                const formattedNotes = Array.isArray(quotation.notes) 
                    ? quotation.notes 
                    : (quotation.notes ? quotation.notes.split('\n').filter(n => n.trim() !== '') : ['']);
                
                // Si la cotización es antigua y no tiene número, generamos uno
                let nextNo = quotation.quotationNumber;
                if (!nextNo) {
                    nextNo = await getNextQuotationNumber(quotation.empresa || activeEmpresa);
                }
                
                const migratedItems = quotation.items.map(item => ({
                    ...item,
                    comments: Array.isArray(item.comments) ? item.comments : (item.comments ? [item.comments] : [])
                }));

                setFormData({
                    ...quotation,
                    items: migratedItems,
                    notes: formattedNotes.length > 0 ? formattedNotes : [''],
                    quotationNumber: nextNo,
                    issuerCompany: quotation.issuerCompany || (quotation.empresa !== 'Todas' ? quotation.empresa : (activeEmpresa !== 'Todas' ? activeEmpresa : '')),
                    issuerRUC: quotation.issuerRUC || '',
                    showIssuerRUC: quotation.showIssuerRUC || false,
                    issuerEmail: quotation.issuerEmail || user?.email || '',
                    issuerPhone: quotation.issuerPhone || ''
                });
            } else {
                const nextNumber = await getNextQuotationNumber(activeEmpresa);
                setFormData({
                    clientName: '',
                    clientRUC: '',
                    showRUC: false,
                    issuerName: user?.name || '',
                    issuerCompany: activeEmpresa === 'Todas' ? '' : activeEmpresa,
                    issuerRUC: '',
                    showIssuerRUC: false,
                    issuerEmail: user?.email || '',
                    issuerPhone: '',
                    quotationNumber: nextNumber,
                    date: new Date().toISOString().split('T')[0],
                    items: [{ description: '', comments: [], quantity: 1, unitPrice: 0, total: 0 }],
                    notes: [''],
                    currency: 'S/.',
                    subtotal: 0,
                    igv: 0,
                    total: 0,
                    includeIGV: true,
                    status: 'Pendiente'
                });
            }
        };

        if (isOpen) initForm();
    }, [quotation, user, isOpen, activeEmpresa]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                const textareas = document.querySelectorAll('.notes-textarea');
                textareas.forEach(ta => {
                    ta.style.height = 'auto';
                    ta.style.height = ta.scrollHeight + 'px';
                });
            }, 100);
        }
    }, [isOpen, formData.notes.length]);

    const calculateTotals = (items, includeIGV) => {
        const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        const igv = includeIGV ? subtotal * 0.18 : 0;
        const total = subtotal + igv;
        return { subtotal, igv, total };
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        const stringFields = ['description', 'comments'];
        newItems[index][field] = stringFields.includes(field) ? value : parseFloat(value) || 0;
        newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
        
        const { subtotal, igv, total } = calculateTotals(newItems, formData.includeIGV);
        setFormData({ ...formData, items: newItems, subtotal, igv, total });
    };

    const toggleIGV = () => {
        const newIncludeIGV = !formData.includeIGV;
        const { subtotal, igv, total } = calculateTotals(formData.items, newIncludeIGV);
        setFormData({ ...formData, includeIGV: newIncludeIGV, subtotal, igv, total });
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', comments: [], quantity: 1, unitPrice: 0, total: 0 }]
        });
    };

    const addCommentToItem = (itemIdx) => {
        const newItems = [...formData.items];
        if (!Array.isArray(newItems[itemIdx].comments)) {
            newItems[itemIdx].comments = [];
        }
        newItems[itemIdx].comments.push('');
        newItems[itemIdx].showComment = true;
        setFormData({ ...formData, items: newItems });
    };

    const removeCommentFromItem = (itemIdx, commentIdx) => {
        const newItems = [...formData.items];
        newItems[itemIdx].comments = newItems[itemIdx].comments.filter((_, i) => i !== commentIdx);
        setFormData({ ...formData, items: newItems });
    };

    const handleCommentChange = (itemIdx, commentIdx, value) => {
        const newItems = [...formData.items];
        newItems[itemIdx].comments[commentIdx] = value;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index) => {
        if (formData.items.length === 1) return;
        const newItems = formData.items.filter((_, i) => i !== index);
        const { subtotal, igv, total } = calculateTotals(newItems, formData.includeIGV);
        setFormData({ ...formData, items: newItems, subtotal, igv, total });
    };

    const addNote = () => {
        setFormData({
            ...formData,
            notes: [...formData.notes, '']
        });
    };

    const removeNote = (index) => {
        if (formData.notes.length === 1) {
            setFormData({ ...formData, notes: [''] });
            return;
        }
        const newNotes = formData.notes.filter((_, i) => i !== index);
        setFormData({ ...formData, notes: newNotes });
    };

    const handleNoteChange = (index, value) => {
        const newNotes = [...formData.notes];
        newNotes[index] = value;
        setFormData({ ...formData, notes: newNotes });
    };

    const autoResize = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    };

    const handleSave = async () => {
        if (!formData.clientName.trim()) return toast.error("El nombre de la empresa es obligatorio");
        
        try {
            // Validar duplicados si es nueva o si cambió el número
            if (!quotation?.id || formData.quotationNumber !== quotation.quotationNumber) {
                const checkQ = query(
                    collection(db, "cotizaciones"),
                    where("empresa", "==", activeEmpresa),
                    where("quotationNumber", "==", formData.quotationNumber)
                );
                const checkSnap = await getDocs(checkQ);
                if (!checkSnap.empty) {
                    return toast.error(`Error: El número ${formData.quotationNumber} ya está registrado para esta empresa.`);
                }
            }
            if (quotation?.id) {
                await updateDoc(doc(db, "cotizaciones", quotation.id), {
                    ...formData,
                    updatedAt: new Date().toISOString()
                });
                toast.success("Cotización actualizada");
            } else {
                await addDoc(collection(db, "cotizaciones"), {
                    ...formData,
                    empresa: activeEmpresa,
                    createdAt: new Date().toISOString(),
                    status: 'Pendiente'
                });
                toast.success("Cotización creada con éxito");
            }
            onSave?.();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        const { quotationNumber, date, clientName, clientRUC, showRUC, issuerName, issuerCompany, issuerRUC, showIssuerRUC, issuerEmail, issuerPhone, currency, subtotal, igv, total, includeIGV, items, notes } = formData;
        
        // Header con Número de Cotización
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("COTIZACIÓN", 20, 30);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`No. ${quotationNumber || '-'}`, 190, 30, { align: 'right' });
        
        // Línea divisoria
        doc.setDrawColor(226, 232, 240);
        doc.line(20, 35, 190, 35);

        // Bloque de Información (Dos columnas)
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("DESTINATARIO (CLIENTE)", 20, 45);
        doc.text("EMISOR", 110, 45);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        
        // Info Cliente
        let clientY = 52;
        const clientLines = doc.splitTextToSize(`Empresa: ${clientName}`, 80);
        doc.text(clientLines, 20, clientY);
        clientY += (clientLines.length * 4.5);

        if (showRUC && clientRUC) {
            doc.text(`RUC: ${clientRUC}`, 20, clientY);
            clientY += 5;
        }
        doc.text(`Fecha: ${date}`, 20, clientY);

        // Info Emisor
        let issuerY = 52;
        const issuerLines = doc.splitTextToSize(`Empresa: ${issuerCompany}`, 80);
        doc.text(issuerLines, 110, issuerY);
        issuerY += (issuerLines.length * 4.5);

        if (showIssuerRUC && issuerRUC) {
            doc.text(`RUC: ${issuerRUC}`, 110, issuerY);
            issuerY += 5;
            doc.text(`Atención: ${issuerName}`, 110, issuerY);
            issuerY += 5;
            if (issuerEmail) {
                doc.text(`Correo: ${issuerEmail}`, 110, issuerY);
                issuerY += 5;
            }
            if (issuerPhone) doc.text(`Tel: ${issuerPhone}`, 110, issuerY);
        } else {
            doc.text(`Atención: ${issuerName}`, 110, issuerY);
            issuerY += 5;
            if (issuerEmail) {
                doc.text(`Correo: ${issuerEmail}`, 110, issuerY);
                issuerY += 5;
            }
            if (issuerPhone) doc.text(`Tel: ${issuerPhone}`, 110, issuerY);
        }

        // Determinar el inicio de la tabla basado en el bloque más largo
        const startTableY = Math.max(clientY, issuerY) + 10;

        // Tabla de Items
        const tableBody = items.map(item => {
            const descriptionLines = [item.description];
            if (Array.isArray(item.comments)) {
                item.comments.forEach(comment => {
                    if (comment.trim()) {
                        // Dividimos el comentario manualmente para aplicar sangría a las líneas seguidas
                        const bullet = "  • ";
                        const padding = "     ";
                        // Estimamos el ancho de la columna de descripción (aprox 100 unidades)
                        const wrappedComment = doc.splitTextToSize(comment, 85);
                        wrappedComment.forEach((line, i) => {
                            descriptionLines.push(i === 0 ? bullet + line : padding + line);
                        });
                    }
                });
            }

            return [
                {
                    content: descriptionLines.join('\n'),
                    styles: { fontStyle: 'normal' }
                },
                item.quantity,
                `${currency} ${item.unitPrice.toFixed(2)}`,
                `${currency} ${item.total.toFixed(2)}`
            ];
        });

        autoTable(doc, {
            startY: startTableY,
            head: [['DESCRIPCIÓN', 'CANT.', 'P. UNITARIO', 'TOTAL']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' }
            }
        });

        let currentY = doc.lastAutoTable.finalY + 10;
        
        // Totales bloque a la derecha
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Subtotal:`, 140, currentY);
        doc.text(`${currency} ${subtotal.toFixed(2)}`, 190, currentY, { align: 'right' });
        
        if (includeIGV) {
            currentY += 7;
            doc.text(`IGV (18%):`, 140, currentY);
            doc.text(`${currency} ${igv.toFixed(2)}`, 190, currentY, { align: 'right' });
        }
        
        currentY += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(`TOTAL:`, 140, currentY);
        doc.text(`${currency} ${total.toFixed(2)}`, 190, currentY, { align: 'right' });

        // Notas Adicionales
        if (notes && notes.length > 0 && notes.some(n => n.trim())) {
            currentY += 15;
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("NOTAS Y TÉRMINOS:", 20, currentY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            
            let noteY = currentY + 7;
            const bullet = "  • ";
            const padding = "     ";
            
            notes.forEach(note => {
                if (note.trim()) {
                    const wrappedNote = doc.splitTextToSize(note, 165);
                    wrappedNote.forEach((line, i) => {
                        // Si nos acercamos al final de la página, podríamos necesitar un salto, 
                        // pero por ahora mantenemos la lógica de flujo simple
                        doc.text(i === 0 ? bullet + line : padding + line, 20, noteY);
                        noteY += 5;
                    });
                    noteY += 2; // Espacio extra entre diferentes notas
                }
            });
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        const footerText = `${activeEmpresa} utilizando la app de ARTORIES MANAGEMENT SUITE`;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(footerText, 105, 285, { align: 'center' });
        }

        doc.save(`Cotizacion_${clientName.replace(/\s+/g, '_')}_${quotationNumber}.pdf`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
                {/* Header */}
                <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <FileText className="text-emerald-500" size={28} />
                            {quotation ? 'Editar Cotización' : 'Nueva Cotización'}
                        </h2>
                        <p className="text-slate-500 text-xs mt-1 font-medium">Completa los campos para generar el documento corporativo.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all text-slate-400 hover:text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-10">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Info Cliente */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <User size={14} className="text-emerald-500" /> Datos del Cliente
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Incluir RUC</span>
                                    <button 
                                        onClick={() => setFormData({...formData, showRUC: !formData.showRUC})}
                                        className={`transition-colors ${formData.showRUC ? 'text-emerald-500' : 'text-slate-300'}`}
                                    >
                                        {formData.showRUC ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre / Empresa</label>
                                    <input 
                                        type="text"
                                        value={formData.clientName}
                                        onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                                        placeholder="Nombre del cliente"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                                    />
                                </div>
                                {formData.showRUC && (
                                    <div className="space-y-1.5 animate-in slide-in-from-right-2 duration-300">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">RUC / Identificación</label>
                                        <div className="relative">
                                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input 
                                                type="text"
                                                value={formData.clientRUC}
                                                onChange={(e) => setFormData({...formData, clientRUC: e.target.value})}
                                                placeholder="20XXXXXXXXX"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Info Emisor */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Building size={14} className="text-emerald-500" /> Información del Emisor
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Incluir RUC</span>
                                    <button 
                                        onClick={() => setFormData({...formData, showIssuerRUC: !formData.showIssuerRUC})}
                                        className={`transition-colors ${formData.showIssuerRUC ? 'text-emerald-500' : 'text-slate-300'}`}
                                    >
                                        {formData.showIssuerRUC ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Empresa</label>
                                    <input 
                                        type="text"
                                        value={formData.issuerCompany}
                                        onChange={(e) => setFormData({...formData, issuerCompany: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-emerald-700"
                                    />
                                </div>
                                {formData.showIssuerRUC && (
                                    <div className="space-y-1.5 animate-in slide-in-from-right-2 duration-300">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">RUC Emisor</label>
                                        <div className="relative">
                                            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input 
                                                type="text"
                                                value={formData.issuerRUC}
                                                onChange={(e) => setFormData({...formData, issuerRUC: e.target.value})}
                                                placeholder="20XXXXXXXXX"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Atención por</label>
                                    <input 
                                        type="text"
                                        value={formData.issuerName}
                                        onChange={(e) => setFormData({...formData, issuerName: e.target.value})}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Correo Electrónico</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input 
                                            type="email"
                                            value={formData.issuerEmail}
                                            onChange={(e) => setFormData({...formData, issuerEmail: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Teléfono / WhatsApp</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input 
                                            type="text"
                                            value={formData.issuerPhone}
                                            onChange={(e) => setFormData({...formData, issuerPhone: e.target.value})}
                                            placeholder="+51 900 000 000"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ficha y Estado */}
                    <div className="flex flex-wrap items-end gap-6 p-6 bg-slate-50 rounded-[28px] border border-slate-200/50">
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Hash size={12}/> No. Cotización</label>
                            <input 
                                type="text"
                                value={formData.quotationNumber}
                                readOnly
                                className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-sm font-black text-emerald-600 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar size={12}/> Fecha de Emisión</label>
                            <input 
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-bold text-slate-700"
                            />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado Actual</label>
                            <select
                                value={formData.status || 'Pendiente'}
                                onChange={(e) => setFormData({...formData, status: e.target.value})}
                                className={`w-full border rounded-xl px-4 py-2.5 text-sm font-black outline-none transition-all cursor-pointer shadow-sm ${STATUS_COLORS[formData.status] || 'bg-white border-slate-200 text-slate-700'}`}
                            >
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Conceptos y Costos</h3>
                            <button 
                                onClick={addItem}
                                className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1"
                            >
                                <Plus size={14} /> Añadir Item
                            </button>
                        </div>
                        
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-slate-200">Descripción</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-24">Cant.</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-40">Precio Unit.</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-32 text-right">Total</th>
                                        <th className="px-4 py-3 border-b border-slate-200 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {formData.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={item.description}
                                                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                            placeholder="Ej: Producción de Video V3"
                                                            className="flex-1 bg-transparent outline-none text-sm text-slate-700 font-bold"
                                                        />
                                                        <button 
                                                            onClick={() => addCommentToItem(idx)}
                                                            className={`p-1 rounded hover:bg-slate-200 transition-colors ${(item.comments?.length > 0) ? 'text-emerald-500' : 'text-slate-300'}`}
                                                            title="Añadir comentario/detalle"
                                                        >
                                                            <MessageSquare size={14} />
                                                        </button>
                                                    </div>
                                                    {Array.isArray(item.comments) && item.comments.length > 0 && (
                                                        <div className="space-y-2 pt-1">
                                                            {item.comments.map((comment, cNo) => (
                                                                <div key={cNo} className="flex items-center gap-2 animate-in slide-in-from-left-1 group/comment">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-200 mt-1 shrink-0" />
                                                                    <textarea 
                                                                        rows="1"
                                                                        value={comment}
                                                                        onChange={(e) => {
                                                                            handleCommentChange(idx, cNo, e.target.value);
                                                                            autoResize(e);
                                                                        }}
                                                                        onFocus={autoResize}
                                                                        placeholder="Añadir detalle..."
                                                                        className="flex-1 bg-transparent text-[11px] text-slate-500 outline-none hover:text-slate-700 focus:text-slate-700 italic border-b border-transparent focus:border-emerald-100 resize-none overflow-hidden"
                                                                    />
                                                                    <button 
                                                                        onClick={() => removeCommentFromItem(idx, cNo)}
                                                                        className="p-1 text-slate-300 hover:text-red-400 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                                                    >
                                                                        <Trash2 size={10} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <input 
                                                    type="number" 
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                    className="w-full bg-transparent outline-none text-sm text-slate-700 font-bold"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-slate-400 font-bold">{formData.currency}</span>
                                                    <input 
                                                        type="number" 
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                                        className="w-full bg-transparent outline-none text-sm text-slate-700 font-bold"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-black text-slate-800">{formData.currency} {item.total?.toFixed(2)}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas Adicionales</label>
                                <button 
                                    onClick={addNote}
                                    className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-all flex items-center gap-1"
                                >
                                    <Plus size={12} /> Añadir Nota
                                </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {formData.notes.map((note, idx) => (
                                    <div key={idx} className="flex gap-2 group">
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-3.5 text-slate-300 font-bold text-xs">•</span>
                                            <textarea 
                                                value={note}
                                                onChange={(e) => handleNoteChange(idx, e.target.value)}
                                                onInput={autoResize}
                                                placeholder="Ej: Entrega en 5 días hábiles..."
                                                rows={1}
                                                className="notes-textarea w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-medium text-slate-700 resize-none overflow-hidden min-h-[42px]"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => removeNote(idx)}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-[24px] p-6 border border-slate-200 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-500">Subtotal</span>
                                <span className="font-black text-slate-800">{formData.currency} {formData.subtotal.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center py-2 border-y border-slate-200/50">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-600">Incluir IGV (18%)</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Activa para calcular el impuesto</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.includeIGV} 
                                        onChange={toggleIGV}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            {formData.includeIGV && (
                                <div className="flex justify-between items-center text-sm animate-in slide-in-from-top-1 duration-200">
                                    <span className="font-bold text-slate-500">IGV (18%)</span>
                                    <span className="font-black text-slate-800">{formData.currency} {formData.igv.toFixed(2)}</span>
                                </div>
                            )}
                            
                            <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-lg font-black text-slate-800">TOTAL</span>
                                <span className="text-2xl font-black text-emerald-600">{formData.currency} {formData.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between gap-4">
                    <button 
                        onClick={exportPDF}
                        disabled={!formData.clientName}
                        className="flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-slate-200"
                    >
                        <FileText size={20} /> Previsualizar PDF
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-2xl transition-all">Cancelar</button>
                        <button 
                            onClick={handleSave}
                            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                            <Save size={20} /> Guardar Cotización
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuotationModal;
