import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Plus, Download, Upload, Trash2, Check, ArrowRight, LayoutList, Edit2, X, BotMessageSquare, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import NewRequestModal from '../../components/NewRequestModal';
import RequestDetail from '../../components/RequestDetail';
import ConfirmModal from '../../components/ConfirmModal';
import { sendSmartMessage } from '../../services/geminiService';

const CuadroContenidos = () => {
    const { user, activeEmpresa, isAdmin } = useAuth();
    const [contenidos, setContenidos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [selectedContent, setSelectedContent] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const fileInputRef = useRef(null);

    const handleOpenRequest = async (id) => {
        try {
            const docSnap = await getDoc(doc(db, "solicitudes_contenido", id));
            if (docSnap.exists()) {
                setSelectedRequest({ id: docSnap.id, ...docSnap.data() });
            } else {
                toast.error("La solicitud ya no existe.");
            }
        } catch (error) {
            toast.error("Error al cargar la solicitud.");
        }
    };

    const handleMarkdownClick = (e) => {
        const btn = e.target.closest('.action-request-btn');
        if (btn) {
            handleOpenRequest(btn.dataset.id);
        }
    };

    // Nuevo contenido manual
    const [newTitle, setNewTitle] = useState("");
    const [newPoints, setNewPoints] = useState("");
    const [newDate, setNewDate] = useState("");

    // Bulk Selection
    const [selectedIds, setSelectedIds] = useState([]);

    // Inline Date Editing
    const [editingDateId, setEditingDateId] = useState(null);
    const [editingDateValue, setEditingDateValue] = useState("");

    // AI Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);

    const canDelete = isAdmin || user?.role === 'editor';

    useEffect(() => {
        if (!activeEmpresa) return;

        const q = query(
            collection(db, "cuadro_contenidos"),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Filtrar por empresa si no es 'Todas'
            const filtered = activeEmpresa === 'Todas' ? data : data.filter(d => d.empresa === activeEmpresa);
            setContenidos(filtered);
            setLoading(false);
        });

        return () => unsub();
    }, [activeEmpresa]);

    const handleAddManual = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) {
            return toast.error("El título es obligatorio");
        }

        const empresaDestino = activeEmpresa === 'Todas' ? 'GRUCOIN' : activeEmpresa;

        try {
            await addDoc(collection(db, "cuadro_contenidos"), {
                title: newTitle,
                keyPoints: newPoints,
                date: newDate,
                empresa: empresaDestino,
                status: 'pendiente',
                createdAt: new Date().toISOString(),
                createdBy: user.name,
                creatorId: user.uid
            });
            setNewTitle("");
            setNewPoints("");
            setNewDate("");
            toast.success("Contenido agregado");
        } catch (error) {
            toast.error("Error al guardar el contenido");
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.id) return;
        try {
            await deleteDoc(doc(db, "cuadro_contenidos", deleteModal.id));
            toast.success("Contenido eliminado");
            setSelectedIds(prev => prev.filter(id => id !== deleteModal.id));
        } catch (error) {
            toast.error("Error al eliminar");
        }
        setDeleteModal({ open: false, id: null });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(contenidos.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} elemento(s)?`)) return;

        try {
            for (const id of selectedIds) {
                await deleteDoc(doc(db, "cuadro_contenidos", id));
            }
            toast.success(`${selectedIds.length} contenidos eliminados`);
            setSelectedIds([]);
        } catch (error) {
            toast.error("Error al eliminar algunos contenidos");
        }
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            { Titulo: "Ejemplo de Video", PuntosImportantes: "Punto 1\nPunto 2\nPunto 3", FechaTentativa: "31-12-2024" }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "Plantilla_Cuadro_Contenidos.xlsx");
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) return toast.error("El Excel está vacío");

                let successCount = 0;
                const empresaDestino = activeEmpresa === 'Todas' ? 'GRUCOIN' : activeEmpresa;

                for (let row of data) {
                    const title = row['Titulo'] || row['Título'] || row['TITULO'];
                    const points = row['PuntosImportantes'] || row['Puntos Importantes'] || row['PUNTOS IMPORTANTES'];
                    const tentativeDate = row['FechaTentativa'] || row['Fecha Tentativa'] || row['FECHA TENTATIVA'];
                    
                    if (title) {
                        // Tratar la fecha de excel (puede venir como serial number o string)
                        let parsedDate = "";
                        if (tentativeDate) {
                            if (typeof tentativeDate === 'number') {
                                // Convertir numero de serie excel a string ISO
                                const date = new Date(Math.round((tentativeDate - 25569) * 86400 * 1000));
                                parsedDate = date.toISOString().split('T')[0];
                            } else {
                                let strDate = String(tentativeDate).trim();
                                // Support DD-MM-YYYY or DD/MM/YYYY
                                const parts = strDate.split(/[-/]/);
                                if (parts.length === 3) {
                                    if (parts[0].length <= 2 && parts[2].length === 4) {
                                        // DD-MM-YYYY
                                        const day = parts[0].padStart(2, '0');
                                        const month = parts[1].padStart(2, '0');
                                        parsedDate = `${parts[2]}-${month}-${day}`;
                                    } else if (parts[0].length === 4 && parts[2].length <= 2) {
                                        // YYYY-MM-DD
                                        const month = parts[1].padStart(2, '0');
                                        const day = parts[2].padStart(2, '0');
                                        parsedDate = `${parts[0]}-${month}-${day}`;
                                    } else {
                                        parsedDate = strDate;
                                    }
                                } else {
                                    parsedDate = strDate;
                                }
                            }
                        }

                        await addDoc(collection(db, "cuadro_contenidos"), {
                            title: String(title),
                            keyPoints: points ? String(points) : "",
                            date: parsedDate,
                            empresa: empresaDestino,
                            status: 'pendiente',
                            createdAt: new Date().toISOString(),
                            createdBy: user.name,
                            creatorId: user.uid
                        });
                        successCount++;
                    }
                }
                
                toast.success(`${successCount} contenidos importados exitosamente`);
            } catch (error) {
                toast.error("Error al procesar el Excel");
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportExcel = () => {
        if (contenidos.length === 0) return toast.info("No hay datos para exportar");

        const exportData = contenidos.map(c => ({
            "Título": c.title,
            "Puntos Importantes": c.keyPoints,
            "Fecha Tentativa": c.date || "",
            "Estado": c.status === 'convertido' ? 'Convertido' : 'Pendiente',
            "Fecha Creación": new Date(c.createdAt).toLocaleDateString()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Contenidos");
        XLSX.writeFile(wb, "Cuadro_Contenidos.xlsx");
    };

    const handleConvert = (item) => {
        setSelectedContent(item);
        setIsRequestModalOpen(true);
    };

    // Callback llamado cuando se cierra el modal. 
    // Si queremos marcarlo como convertido idealmente deberíamos saber si se guardó la solicitud.
    // Una forma simple es asumir que si se abre el modal y luego comprobamos que se creó, pero no tenemos un callback de "onSaveSuccess" en NewRequestModal.
    // Como simplificación (y porque la conversión es manual), permitiremos que el usuario le de check manual o lo marque como convertido.
    // Añadiremos una función manual de marcar como convertido por si el usuario lo hace.
    const markAsConverted = async (id, currentStatus) => {
        try {
            await updateDoc(doc(db, "cuadro_contenidos", id), {
                status: currentStatus === 'convertido' ? 'pendiente' : 'convertido'
            });
            toast.success("Estado actualizado");
        } catch (error) {
            toast.error("Error al actualizar");
        }
    };

    const handleEditDate = (item) => {
        setEditingDateId(item.id);
        setEditingDateValue(item.date || "");
    };

    const handleSaveDate = async (id) => {
        try {
            await updateDoc(doc(db, "cuadro_contenidos", id), {
                date: editingDateValue
            });
            toast.success("Fecha actualizada");
        } catch (error) {
            toast.error("Error al guardar la fecha");
        }
        setEditingDateId(null);
    };

    const CHAT_SYSTEM_PROMPT = `Eres el asistente integrado del Cuadro de Contenidos. 
    Tu objetivo es ayudar al usuario a convertir sus ideas (del cuadro de contenidos actual) en solicitudes estructuradas.
    Conoces los ítems actuales del Cuadro de Contenidos (los recibes en el contexto).
    
    Si el usuario te pide crear una solicitud basada en un ítem, genera el JSON de create_request.
    
    Para CREAR UNA SOLICITUD responde SIEMPRE con este bloque de código JSON EXACTO (NO incluyas fechas de grabación):
    \`\`\`json
    {
      "action": "create_request",
      "data": {
        "title": "Título llamativo para la solicitud",
        "type": "video", 
        "area": "Marketing",
        "objetivo": "Objetivo",
        "publico": "Público objetivo",
        "mensaje": "Mensaje principal",
        "briefing": "Ideas generales",
        "format": "Vertical (9:16)",
        "campaign": null,
        "checklist": [
          { "text": "Escena 1...", "completed": false, "type": "Solo Video" }
        ]
      }
    }
    \`\`\`
    
    Responde siempre de forma muy breve y amistosa.`;

    const handleSendChat = async () => {
        if (!chatInput.trim() || isChatLoading) return;
        
        const userMsg = { role: 'user', content: chatInput };
        const newMessages = [...chatMessages, userMsg];
        setChatMessages(newMessages);
        setChatInput("");
        setIsChatLoading(true);

        try {
            const aiResponse = await sendSmartMessage({
                message: chatInput,
                history: chatMessages,
                empresa: activeEmpresa,
                appData: { cuadro_contenidos_actuales: contenidos },
                appContext: CHAT_SYSTEM_PROMPT
            });

            let aiText = aiResponse.text;
            const jsonMatches = [...aiText.matchAll(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/g)];
            
            for (const match of jsonMatches) {
                try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.action === 'create_request' && parsed.data) {
                        const data = parsed.data;
                        const base = {
                            title: data.title || 'Solicitud generada por IA',
                            area: data.area || 'Marketing',
                            type: data.type || 'video',
                            campaign: data.campaign || null,
                            status: 'solicitado',
                            applicantName: user.name,
                            applicantId: user.uid,
                            createdAt: new Date().toISOString(),
                            requestDate: new Date().toISOString().split('T')[0],
                            empresa: activeEmpresa,
                            objetivo: data.objetivo || '',
                            publico: data.publico || '',
                            mensaje: data.mensaje || '',
                            briefing: data.briefing || '',
                            format: data.format || 'Horizontal (16:9)',
                            checklist: Array.isArray(data.checklist) ? data.checklist : [],
                        };
                        await addDoc(collection(db, "solicitudes_contenido"), base);
                        toast.success("¡Solicitud creada exitosamente!");
                        
                        // Opcionalmente: marcar el ítem del cuadro como convertido si la IA incluyó su ID,
                        // pero como simplificación solo avisaremos.
                        aiText = aiText.replace(match[0], `\n\n> ✅ **He creado la solicitud exitosamente.** <button class="action-request-btn text-blue-600 font-bold hover:text-blue-800 transition-colors" data-id="${docRef.id}">Haz clic aquí para revisarla y editar su plan de producción</button>. ¡Recuerda marcar el ítem del cuadro como 'Convertido'!`);
                    }
                } catch(e) { console.error("JSON parse error in floating chat", e); }
            }

            setChatMessages([...newMessages, { role: 'model', content: aiText }]);
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión con la IA");
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in">
            {/* ENCABEZADO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <LayoutList className="text-blue-600" size={28} />
                        Cuadro de Contenidos
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Planifica títulos e ideas, y conviértelos en solicitudes cuando estén listos.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={handleDownloadTemplate} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm">
                        <Download size={16} /> Plantilla
                    </button>
                    
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm">
                        <Upload size={16} /> Cargar Excel
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                    />

                    <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm">
                        <Download size={16} /> Exportar
                    </button>
                    {selectedIds.length > 0 && canDelete && (
                        <button 
                            onClick={handleBulkDelete} 
                            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-2 shadow-sm ml-2"
                        >
                            <Trash2 size={16} /> Eliminar Seleccionados ({selectedIds.length})
                        </button>
                    )}
                </div>
            </div>

            {/* FORMULARIO AGREGAR MANUAL */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <form onSubmit={handleAddManual} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Título / Tema Principal</label>
                        <input 
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Ej: 5 Razones para invertir..."
                            className="w-full border p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                        />
                    </div>
                    <div className="flex-[2] w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">De qué va a tratar (Opcional)</label>
                        <input 
                            type="text"
                            value={newPoints}
                            onChange={(e) => setNewPoints(e.target.value)}
                            placeholder="Escribe de qué tratará..."
                            className="w-full border p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Fecha Tentativa</label>
                        <input 
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="w-full border p-2.5 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50"
                        />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap w-full md:w-auto justify-center">
                        <Plus size={16} /> Agregar
                    </button>
                </form>
            </div>

            {/* TABLA */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 border-b w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={contenidos.length > 0 && selectedIds.length === contenidos.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-4 font-bold border-b w-[30%]">Título</th>
                                <th className="p-4 font-bold border-b w-[35%]">De qué va a tratar</th>
                                <th className="p-4 font-bold border-b w-[15%] text-center">Fecha Tentativa</th>
                                <th className="p-4 font-bold border-b">Estado</th>
                                <th className="p-4 font-bold border-b text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-400">Cargando contenidos...</td>
                                </tr>
                            ) : contenidos.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-400">
                                        No hay contenidos en el cuadro. Agrega uno o carga un Excel.
                                    </td>
                                </tr>
                            ) : (
                                contenidos.map((item) => (
                                    <tr key={item.id} className={`hover:bg-blue-50/30 transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="p-4">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => handleSelectOne(item.id)}
                                            />
                                        </td>
                                        <td className="p-4 text-sm font-semibold text-gray-800">
                                            {item.title}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 whitespace-pre-line">
                                            {item.keyPoints || <span className="text-gray-300 italic">Sin detalles</span>}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 text-center">
                                            {editingDateId === item.id ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <input 
                                                        type="date"
                                                        value={editingDateValue}
                                                        onChange={(e) => setEditingDateValue(e.target.value)}
                                                        className="border p-1 rounded outline-none text-xs"
                                                    />
                                                    <button onClick={() => handleSaveDate(item.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                                        <Check size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingDateId(null)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div 
                                                    className="flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors"
                                                    onClick={() => handleEditDate(item)}
                                                >
                                                    <span className="font-medium">{item.date ? new Date(item.date).toLocaleDateString() : <span className="text-gray-300">-</span>}</span>
                                                    <Edit2 size={14} className="text-blue-500 hover:text-blue-700" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span 
                                                onClick={() => markAsConverted(item.id, item.status)}
                                                className={`cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                    item.status === 'convertido' 
                                                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                }`}
                                            >
                                                {item.status === 'convertido' ? <><Check size={12} /> Convertido</> : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleConvert(item)}
                                                    className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                                                    title="Convertir a Solicitud"
                                                >
                                                    <ArrowRight size={14} /> Solicitud
                                                </button>
                                                {canDelete && (
                                                    <button 
                                                        onClick={() => setDeleteModal({ open: true, id: item.id })}
                                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALES */}
            <NewRequestModal 
                isOpen={isRequestModalOpen} 
                onClose={() => {
                    setIsRequestModalOpen(false);
                    setSelectedContent(null);
                }} 
                initialData={selectedContent ? { 
                    title: selectedContent.title, 
                    briefing: selectedContent.keyPoints,
                    date: selectedContent.date
                } : null}
            />

            <ConfirmModal
                isOpen={deleteModal.open}
                onClose={() => setDeleteModal({ open: false, id: null })}
                onConfirm={handleDelete}
                title="Eliminar Contenido"
                message="¿Estás seguro de que deseas eliminar este contenido? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
            {/* FLOATING AI CHAT */}
            {isChatOpen && (
                <div className="fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5">
                    <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <BotMessageSquare size={20} />
                            <span className="font-bold text-sm">Asistente IA</span>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="text-blue-200 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3 h-80">
                        {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-400 text-xs mt-10">
                                <BotMessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                                <p>Pregúntame sobre los contenidos de esta tabla o pídeme crear solicitudes.</p>
                            </div>
                        ) : (
                            chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border text-gray-700 rounded-bl-sm'}`}>
                                        <div onClick={handleMarkdownClick} dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
                                    </div>
                                </div>
                            ))
                        )}
                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border rounded-xl p-3 rounded-bl-sm flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-white border-t">
                        <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="relative">
                            <input 
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Escribe tu consulta..."
                                className="w-full bg-gray-50 border rounded-full pl-4 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button 
                                type="submit" 
                                disabled={isChatLoading || !chatInput.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                            >
                                <Send size={14} />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl text-white transition-all hover:scale-105 active:scale-95 z-50 ${isChatOpen ? 'bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {isChatOpen ? <X size={24} /> : <BotMessageSquare size={24} />}
            </button>

            {selectedRequest && (
                <RequestDetail 
                    request={selectedRequest} 
                    isOpen={!!selectedRequest} 
                    onClose={() => setSelectedRequest(null)} 
                />
            )}
        </div>
    );
};

export default CuadroContenidos;
