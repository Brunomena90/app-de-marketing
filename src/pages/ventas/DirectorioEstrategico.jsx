import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Mail, MapPin, Plus, Save, Trash2, Edit2, X, Send, Download, Upload, AlertTriangle, Check, Info, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { sendEmailViaGmail, requestGmailAuthorization, initGmailClient } from '../../services/gmailService';
import * as XLSX from 'xlsx';

const DirectorioEstrategico = () => {
    const { activeEmpresa } = useAuth();
    const [clientes, setClientes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const fileInputRef = useRef(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflicts, setConflicts] = useState([]);
    const [pendingUploads, setPendingUploads] = useState([]);

    // Mass Email State
    const [selectedClients, setSelectedClients] = useState([]);
    const [showMassEmailModal, setShowMassEmailModal] = useState(false);
    const [massEmailSubject, setMassEmailSubject] = useState('');
    const [massEmailBody, setMassEmailBody] = useState('');
    const [isSendingMass, setIsSendingMass] = useState(false);
    const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0 });

    // Filtros y Búsqueda
    const [searchTerm, setSearchTerm] = useState('');
    const [columnFilters, setColumnFilters] = useState({});
    const [activeFilterColumn, setActiveFilterColumn] = useState(null);

    // Drag to Scroll State
    const tableContainerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - tableContainerRef.current.offsetLeft);
        setScrollLeft(tableContainerRef.current.scrollLeft);
    };
    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        
        // Si el usuario está seleccionando texto de forma nativa, no forzamos el scroll
        if (window.getSelection().toString().length > 0) return;

        const x = e.pageX - tableContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2; // scroll speed
        tableContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const validStates = ['sin contacto', 'contactado', 'en seguimiento', 'en negociación', 'cerrado', 'perdido', 'no interesado'];
    const getDisplayEstado = (estadoRaw) => {
        const st = (estadoRaw || '').toLowerCase().trim();
        return validStates.includes(st) ? st : 'sin contacto';
    };

    const getUniqueValues = (columnId) => {
        if (columnId === 'estado') return validStates;
        const values = clientes.map(c => c[columnId] || 'N/A');
        return [...new Set(values)].filter(Boolean);
    };

    const handleFilterChange = (columnId, value) => {
        setColumnFilters(prev => {
            const currentFilters = prev[columnId] || [];
            const newFilters = currentFilters.includes(value)
                ? currentFilters.filter(v => v !== value)
                : [...currentFilters, value];
                
            if (newFilters.length === 0) {
                const copy = { ...prev };
                delete copy[columnId];
                return copy;
            }
            return { ...prev, [columnId]: newFilters };
        });
    };

    const filteredClientes = clientes.filter(cliente => {
        // 1. Búsqueda Global
        const searchStr = `${cliente.empresaCliente || ''} ${cliente.rubro || ''} ${cliente.representante || ''}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;
        
        // 2. Filtros de Columnas
        for (const [colId, activeValues] of Object.entries(columnFilters)) {
            if (activeValues.length > 0) {
                const cellValue = colId === 'estado' ? getDisplayEstado(cliente.estado) : (cliente[colId] || 'N/A');
                if (!activeValues.includes(cellValue)) return false;
            }
        }
        return true;
    });

    const renderFilterDropdown = (columnId, label) => {
        const uniqueValues = getUniqueValues(columnId);
        const isOpen = activeFilterColumn === columnId;
        const activeFilters = columnFilters[columnId] || [];
        
        return (
            <th key={columnId} className="px-4 py-4 whitespace-nowrap cursor-pointer hover:bg-white/5 transition-colors" onClick={() => !isOpen && setActiveFilterColumn(columnId)}>
                <div className="flex items-center gap-2">
                    <span>{label}</span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterColumn(isOpen ? null : columnId);
                        }}
                        className={`p-1.5 rounded transition-colors ${activeFilters.length > 0 ? 'text-blue-400 bg-blue-500/20' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                    >
                        <Filter size={14} />
                    </button>
                </div>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setActiveFilterColumn(null)}>
                        <div className="bg-[#111111] border border-blue-500/30 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col font-sans normal-case overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center px-5 py-4 border-b border-white/10 bg-blue-500/10">
                                <span className="text-base font-black text-blue-400 tracking-normal">Filtrar: {label}</span>
                                <button onClick={() => setActiveFilterColumn(null)} className="text-white/40 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-4 max-h-[50vh] overflow-y-auto flex flex-col gap-2">
                                {uniqueValues.length === 0 ? (
                                    <p className="text-white/40 text-sm text-center py-4">No hay datos</p>
                                ) : uniqueValues.map(val => (
                                    <label key={val} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer text-sm font-medium text-white/90 border border-transparent hover:border-white/10 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={activeFilters.includes(val)}
                                            onChange={() => handleFilterChange(columnId, val)}
                                            className="w-4 h-4 rounded border-white/20 bg-black/50 accent-blue-500"
                                        />
                                        <span className="truncate">{columnId === 'estado' ? val.toUpperCase() : val}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="p-4 border-t border-white/10 flex justify-between bg-white/[0.02]">
                                <button onClick={() => {
                                    setColumnFilters(prev => {
                                        const copy = {...prev}; delete copy[columnId]; return copy;
                                    });
                                }} className="text-sm text-red-400 hover:text-red-300 font-bold px-4 py-2 hover:bg-red-500/10 rounded-xl transition-colors">Limpiar Filtro</button>
                                <button onClick={() => setActiveFilterColumn(null)} className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl transition-transform active:scale-95 shadow-sm border border-blue-500">
                                    Aplicar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </th>
        );
    };

    const initialFormState = {
        empresaCliente: '',
        rubro: '',
        direccion: '',
        celular: '',
        correo: '',
        representante: '',
        propuestaValor: '',
        estado: 'sin contacto' // 'sin contacto', 'contactado', 'en seguimiento', 'en negociación', 'cerrado', 'perdido', 'no interesado'
    };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        initGmailClient();
        
        if (!activeEmpresa) return;

        const q = activeEmpresa === 'Todas'
            ? query(collection(db, 'ventas_directorio'), orderBy('createdAt', 'desc'))
            : query(collection(db, 'ventas_directorio'), orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter locally if 'Todas' is not selected, because orderBy and where on different fields requires a composite index
            const filteredData = activeEmpresa === 'Todas' ? data : data.filter(d => d.empresaId === activeEmpresa);
            setClientes(filteredData);
        });

        return () => unsubscribe();
    }, [activeEmpresa]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, 'ventas_directorio', editingId), {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
                toast.success('Cliente actualizado exitosamente');
            } else {
                await addDoc(collection(db, 'ventas_directorio'), {
                    ...formData,
                    empresaId: activeEmpresa,
                    createdAt: serverTimestamp()
                });
                toast.success('Cliente agregado exitosamente');
            }
            setShowModal(false);
            setFormData(initialFormState);
            setEditingId(null);
        } catch (error) {
            console.error("Error saving client: ", error);
            toast.error('Error al guardar cliente');
        }
    };

    const handleEdit = (cliente) => {
        setFormData(cliente);
        setEditingId(cliente.id);
        setShowModal(true);
    };

    const handleEstadoChange = async (clienteId, nuevoEstado) => {
        try {
            await updateDoc(doc(db, 'ventas_directorio', clienteId), {
                estado: nuevoEstado,
                updatedAt: serverTimestamp()
            });
            toast.success('Estado actualizado');
        } catch (error) {
            console.error("Error updating status: ", error);
            toast.error('Error al actualizar estado');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
            try {
                await deleteDoc(doc(db, 'ventas_directorio', id));
                toast.success('Cliente eliminado');
                // Remove from selection if deleted
                if (selectedClients.includes(id)) {
                    setSelectedClients(selectedClients.filter(cId => cId !== id));
                }
            } catch (error) {
                toast.error('Error al eliminar cliente');
            }
        }
    };

    // MASS EMAIL LOGIC
    const toggleSelectAll = () => {
        if (selectedClients.length === clientes.length) {
            setSelectedClients([]);
        } else {
            setSelectedClients(clientes.map(c => c.id));
        }
    };

    const toggleSelect = (id) => {
        if (selectedClients.includes(id)) {
            setSelectedClients(selectedClients.filter(cId => cId !== id));
        } else {
            setSelectedClients([...selectedClients, id]);
        }
    };

    const handleSendEmail = async (cliente) => {
        if (!cliente.correo || cliente.correo === 'N/A') {
            toast.error('El cliente no tiene un correo válido registrado');
            return;
        }

        const subject = prompt("Ingresa el asunto del correo:");
        if (!subject) return;
        
        const body = prompt("Ingresa el cuerpo del correo (puede incluir HTML):");
        if (!body) return;

        const toastId = toast.loading('Autenticando y enviando correo...');
        try {
            await requestGmailAuthorization();
            await sendEmailViaGmail(cliente.correo, subject, body);
            toast.success(`Correo enviado a ${cliente.correo}`, { id: toastId });
            
            // Opcional: Actualizar el estado del cliente tras enviar correo
            if (cliente.estado === 'contactado') {
                 await updateDoc(doc(db, 'ventas_directorio', cliente.id), { estado: 'en seguimiento' });
            }
        } catch (error) {
            toast.error('Error al enviar el correo. Posible falta de Client ID en código.', { id: toastId });
        }
    };

    const handleMassEmailSubmit = async (e) => {
        e.preventDefault();
        if (!massEmailSubject || !massEmailBody) return;
        
        const clientsToEmail = clientes.filter(c => selectedClients.includes(c.id) && c.correo && c.correo !== 'N/A');
        
        if (clientsToEmail.length === 0) {
            toast.error("Ninguno de los clientes seleccionados tiene un correo válido.");
            return;
        }

        setIsSendingMass(true);
        setSendingProgress({ current: 0, total: clientsToEmail.length });
        
        try {
            await requestGmailAuthorization();
            
            let successCount = 0;
            let failCount = 0;
            
            for (let i = 0; i < clientsToEmail.length; i++) {
                const cliente = clientsToEmail[i];
                try {
                    await sendEmailViaGmail(cliente.correo, massEmailSubject, massEmailBody);
                    successCount++;
                    // Optional update state
                    if (cliente.estado === 'contactado') {
                         await updateDoc(doc(db, 'ventas_directorio', cliente.id), { estado: 'en seguimiento' });
                    }
                } catch(err) {
                    failCount++;
                    console.error("Error al enviar a", cliente.correo, err);
                    if (failCount === 1) toast.error(`Error en el primer fallo: ${err.message}`);
                }
                setSendingProgress({ current: i + 1, total: clientsToEmail.length });
            }
            
            toast.success(`Envíos finalizados. Éxitos: ${successCount}. Fallos: ${failCount}`);
            setShowMassEmailModal(false);
            setMassEmailSubject('');
            setMassEmailBody('');
            setSelectedClients([]);
        } catch(err) {
            toast.error('Error de autenticación con Gmail. ¿Configuraste el Client ID?');
        } finally {
            setIsSendingMass(false);
        }
    };

    // EXCEL IMPORT / EXPORT LOGIC
    const handleDownloadTemplate = () => {
        const templateData = [{
            "Empresa / Cliente": "Ejemplo SAC",
            "Rubro": "Tecnología",
            "Dirección": "Av. Ejemplo 123",
            "Celular / Contacto": "999888777",
            "Correo Electrónico": "contacto@ejemplo.com",
            "Representante": "Juan Perez",
            "Propuesta de Valor": "Desarrollo de software a medida"
        }];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "Plantilla_Directorio.xlsx");
        toast.success("Plantilla descargada");
    };

    const handleExportData = () => {
        if (clientes.length === 0) {
            toast.error("No hay datos para exportar");
            return;
        }

        const exportData = clientes.map(c => ({
            "Empresa / Cliente": c.empresaCliente || 'N/A',
            "Rubro": c.rubro || 'N/A',
            "Dirección": c.direccion || 'N/A',
            "Celular / Contacto": c.celular || 'N/A',
            "Correo Electrónico": c.correo || 'N/A',
            "Representante": c.representante || 'N/A',
            "Estado": c.estado || 'contactado',
            "Propuesta de Valor": c.propuestaValor || 'N/A'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Directorio");
        XLSX.writeFile(wb, "Directorio_Estrategico.xlsx");
        toast.success("Excel exportado exitosamente");
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                const newUploads = [];
                const foundConflicts = [];

                data.forEach(row => {
                    const empresaName = row["Empresa / Cliente"] || row["empresaCliente"] || row["Empresa"];
                    if (!empresaName) return; 

                    const existingClient = clientes.find(c => 
                        c.empresaCliente.toLowerCase().trim() === empresaName.toString().toLowerCase().trim()
                    );

                    const parsedRow = {
                        empresaCliente: empresaName.toString(),
                        rubro: (row["Rubro"] || '').toString(),
                        direccion: (row["Dirección"] || row["Direccion"] || '').toString(),
                        celular: (row["Celular / Contacto"] || row["Celular"] || '').toString(),
                        correo: (row["Correo Electrónico"] || row["Correo"] || '').toString(),
                        representante: (row["Representante"] || '').toString(),
                        estado: (row["Estado"] || 'sin contacto').toString().toLowerCase(),
                        propuestaValor: (row["Propuesta de Valor"] || '').toString()
                    };

                    if (existingClient) {
                        let hasChanges = false;
                        const changes = {};
                        
                        Object.keys(parsedRow).forEach(key => {
                            if (parsedRow[key] && parsedRow[key] !== 'N/A' && parsedRow[key] !== (existingClient[key] || '')) {
                                hasChanges = true;
                                changes[key] = {
                                    old: existingClient[key] || 'N/A',
                                    new: parsedRow[key]
                                };
                            }
                        });

                        if (hasChanges) {
                            foundConflicts.push({
                                existingClient,
                                newData: parsedRow,
                                changes,
                                action: 'update' 
                            });
                        }
                    } else {
                        newUploads.push(parsedRow);
                    }
                });

                if (foundConflicts.length > 0) {
                    setConflicts(foundConflicts);
                    setPendingUploads(newUploads);
                    setShowConflictModal(true);
                } else if (newUploads.length > 0) {
                    processBatchUpload(newUploads, []);
                } else {
                    toast.info('No se encontraron registros nuevos ni cambios aplicables.');
                }
                
                if (fileInputRef.current) fileInputRef.current.value = '';

            } catch (error) {
                console.error(error);
                toast.error('Error al leer el archivo Excel. Asegúrate de que sea válido.');
            }
        };
        reader.readAsBinaryString(file);
    };

    const processBatchUpload = async (uploads, resolvedConflicts) => {
        const toastId = toast.loading('Guardando datos en la nube...');
        try {
            for (const item of uploads) {
                await addDoc(collection(db, 'ventas_directorio'), {
                    ...item,
                    empresaId: activeEmpresa,
                    createdAt: serverTimestamp()
                });
            }

            for (const conflict of resolvedConflicts) {
                if (conflict.action === 'update') {
                    const mergedData = { ...conflict.existingClient };
                    Object.keys(conflict.changes).forEach(key => {
                        mergedData[key] = conflict.newData[key];
                    });
                    
                    await updateDoc(doc(db, 'ventas_directorio', conflict.existingClient.id), {
                        ...mergedData,
                        updatedAt: serverTimestamp()
                    });
                }
            }

            toast.success(`Importación exitosa: ${uploads.length} nuevos, ${resolvedConflicts.filter(c => c.action === 'update').length} actualizados.`, { id: toastId });
            setShowConflictModal(false);
            setConflicts([]);
            setPendingUploads([]);
        } catch (error) {
            console.error(error);
            toast.error('Error al procesar la importación', { id: toastId });
        }
    };

    const handleConflictActionToggle = (index) => {
        const newConflicts = [...conflicts];
        newConflicts[index].action = newConflicts[index].action === 'update' ? 'ignore' : 'update';
        setConflicts(newConflicts);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.02] p-6 rounded-2xl border border-white/10 shadow-sm">
                <div className="flex-1 w-full flex flex-col md:flex-row gap-6 md:items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Directorio Estratégico</h2>
                        <p className="text-sm text-white/50 mt-1">Gestión de prospectos, clientes y propuestas de valor</p>
                    </div>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-full md:max-w-xs focus-within:border-white/20 focus-within:bg-white/10 transition-all">
                        <Search size={16} className="text-white/40 mr-2" />
                        <input 
                            type="text" 
                            placeholder="Buscar cliente, rubro, representante..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-white/30"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="text-white/40 hover:text-white">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    
                    {selectedClients.length > 0 && (
                        <button onClick={() => setShowMassEmailModal(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl border border-blue-500 flex items-center gap-2 transition-transform active:scale-95 shadow-sm text-sm">
                            <Send size={16} /> Enviar Correos ({selectedClients.length})
                        </button>
                    )}

                    <button onClick={async () => {
                        try {
                            await requestGmailAuthorization();
                            toast.success('Gmail conectado correctamente');
                        } catch (e) {
                            toast.error('No se pudo conectar a Gmail. Revisa el Client ID en código.');
                        }
                    }} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-4 py-2 rounded-xl border border-red-500/20 flex items-center gap-2 transition-colors text-sm">
                        <Mail size={16} /> Conectar Gmail
                    </button>
                    
                    <button onClick={handleDownloadTemplate} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold px-4 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-2 transition-colors text-sm" title="Descargar formato vacío">
                        <Download size={16} /> Plantilla
                    </button>
                    
                    <button onClick={handleExportData} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold px-4 py-2 rounded-xl border border-blue-500/20 flex items-center gap-2 transition-colors text-sm" title="Exportar datos actuales">
                        <Download size={16} /> Exportar Excel
                    </button>
                    
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl border border-emerald-500 flex items-center gap-2 cursor-pointer shadow-sm transition-transform active:scale-95 text-sm m-0">
                        <Upload size={16} /> Cargar Excel
                    </label>

                    <button onClick={() => { setFormData(initialFormState); setEditingId(null); setShowModal(true); }} className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-transform active:scale-95 border border-white/20 text-sm">
                        <Plus size={16} /> Nuevo Cliente
                    </button>
                </div>
            </div>

            {/* Vista Escritorio/Tablet (Tabla) */}
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl shadow-sm overflow-hidden hidden md:block">
                <div 
                    ref={tableContainerRef}
                    className={`overflow-x-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                >
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white/5 text-white/70 text-xs uppercase font-bold border-b border-white/10">
                            <tr>
                                <th className="px-4 py-4 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        onChange={toggleSelectAll} 
                                        checked={clientes.length > 0 && selectedClients.length === clientes.length} 
                                        className="w-4 h-4 rounded border-white/20 bg-black/50 accent-blue-500 cursor-pointer" 
                                    />
                                </th>
                                {renderFilterDropdown('estado', 'ESTADO')}
                                {renderFilterDropdown('empresaCliente', 'Empresa / Cliente')}
                                {renderFilterDropdown('rubro', 'Rubro')}
                                <th className="px-4 py-4 whitespace-nowrap">Dirección</th>
                                <th className="px-4 py-4 whitespace-nowrap">Celular / Contacto</th>
                                <th className="px-4 py-4 whitespace-nowrap">Correo Electrónico</th>
                                {renderFilterDropdown('representante', 'Representante')}
                                <th className="px-4 py-4 whitespace-nowrap text-center">Google Maps</th>
                                <th className="px-4 py-4 min-w-[250px]">Propuesta de Valor (Estrategiando)</th>
                                <th className="px-4 py-4 whitespace-nowrap text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {filteredClientes.map(cliente => (
                                <tr key={cliente.id} className={`hover:bg-white/[0.04] transition-colors group ${selectedClients.includes(cliente.id) ? 'bg-blue-500/5' : ''}`}>
                                    <td className="px-4 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedClients.includes(cliente.id)} 
                                            onChange={() => toggleSelect(cliente.id)} 
                                            className="w-4 h-4 rounded border-white/20 bg-black/50 accent-blue-500 cursor-pointer" 
                                        />
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <select 
                                            value={getDisplayEstado(cliente.estado)}
                                            onChange={(e) => handleEstadoChange(cliente.id, e.target.value)}
                                            className={`appearance-none cursor-pointer outline-none text-center px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
                                                getDisplayEstado(cliente.estado) === 'sin contacto' ? 'bg-white/10 text-white/70 border-white/20' :
                                                getDisplayEstado(cliente.estado) === 'contactado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                getDisplayEstado(cliente.estado) === 'en seguimiento' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                getDisplayEstado(cliente.estado) === 'cerrado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                getDisplayEstado(cliente.estado) === 'perdido' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                getDisplayEstado(cliente.estado) === 'no interesado' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                'bg-white/10 text-white/70 border-white/20'
                                            }`}
                                        >
                                            {validStates.map(state => (
                                                <option key={state} value={state} className="bg-[#111] text-white uppercase">{state}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-4 py-4 font-bold text-white">{cliente.empresaCliente}</td>
                                    <td className="px-4 py-4 text-white/60">{cliente.rubro || 'N/A'}</td>
                                    <td className="px-4 py-4 text-white/60 max-w-[200px] truncate" title={cliente.direccion}>{cliente.direccion || 'N/A'}</td>
                                    <td className="px-4 py-4 text-white/60">{cliente.celular || 'N/A'}</td>
                                    <td className="px-4 py-4">
                                        {cliente.correo && cliente.correo !== 'N/A' ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-white/60">{cliente.correo}</span>
                                                <button onClick={() => handleSendEmail(cliente)} className="text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity" title="Enviar correo puntual con Gmail">
                                                    <Send size={14} />
                                                </button>
                                            </div>
                                        ) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-4 text-white/60">{cliente.representante || 'N/A'}</td>
                                    <td className="px-4 py-4 text-center">
                                        {cliente.direccion && cliente.direccion !== 'N/A' ? (
                                            <a 
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-full transition-colors border border-blue-500/20"
                                            >
                                                <MapPin size={14} /> Abrir Google Maps
                                            </a>
                                        ) : <span className="text-white/40 text-xs">Sin dirección</span>}
                                    </td>
                                    <td className="px-4 py-4 text-white/70 text-xs leading-relaxed">{cliente.propuestaValor}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEdit(cliente)} className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDelete(cliente.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredClientes.length === 0 && (
                                <tr>
                                    <td colSpan="11" className="px-6 py-12 text-center text-white/40">
                                        <div className="flex flex-col items-center justify-center">
                                            <MapPin size={48} className="mb-4 text-white/20" />
                                            <p className="text-lg font-medium text-white/50">No hay clientes registrados en el directorio</p>
                                            <p className="text-sm mt-1">Haz clic en "Nuevo Cliente" para agregar uno.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Vista Móvil (Tarjetas) */}
            <div className="md:hidden flex flex-col gap-4 mt-4">
                {/* Cabecera Móvil para selección masiva */}
                {clientes.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-xl shadow-sm">
                        <label className="flex items-center gap-3 text-sm text-white/70 font-bold cursor-pointer">
                            <input 
                                type="checkbox" 
                                onChange={toggleSelectAll} 
                                checked={clientes.length > 0 && selectedClients.length === clientes.length} 
                                className="w-5 h-5 rounded border-white/20 bg-black/50 accent-blue-500 cursor-pointer" 
                            />
                            Seleccionar Todos
                        </label>
                        {selectedClients.length > 0 && (
                            <span className="text-xs text-blue-400 font-bold">{selectedClients.length} seleccionados</span>
                        )}
                    </div>
                )}

                {filteredClientes.map(cliente => (
                    <div key={cliente.id} className={`bg-[#111111] border border-white/10 rounded-2xl p-5 relative flex flex-col gap-4 shadow-lg ${selectedClients.includes(cliente.id) ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}>
                        {/* Header de la Tarjeta */}
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex items-start gap-3 flex-1">
                                <input 
                                    type="checkbox" 
                                    checked={selectedClients.includes(cliente.id)} 
                                    onChange={() => toggleSelect(cliente.id)} 
                                    className="w-5 h-5 mt-1 rounded border-white/20 bg-black/50 accent-blue-500 cursor-pointer flex-shrink-0" 
                                />
                                <div className="flex flex-col">
                                    <h4 className="text-lg font-bold text-white leading-tight">{cliente.empresaCliente}</h4>
                                    <span className="text-xs text-white/50 uppercase tracking-wider font-semibold mt-1">{cliente.rubro || 'Sin Rubro'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => handleEdit(cliente)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 size={18}/></button>
                                <button onClick={() => handleDelete(cliente.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={18}/></button>
                            </div>
                        </div>

                        {/* Estado */}
                        <div>
                            <select 
                                value={getDisplayEstado(cliente.estado)}
                                onChange={(e) => handleEstadoChange(cliente.id, e.target.value)}
                                className={`w-full appearance-none cursor-pointer outline-none text-center px-4 py-2.5 text-xs font-black uppercase rounded-xl border ${
                                    getDisplayEstado(cliente.estado) === 'sin contacto' ? 'bg-white/10 text-white/70 border-white/20' :
                                    getDisplayEstado(cliente.estado) === 'contactado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                    getDisplayEstado(cliente.estado) === 'en seguimiento' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                    getDisplayEstado(cliente.estado) === 'cerrado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                    getDisplayEstado(cliente.estado) === 'perdido' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    getDisplayEstado(cliente.estado) === 'no interesado' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                    'bg-white/10 text-white/70 border-white/20'
                                }`}
                            >
                                {validStates.map(state => (
                                    <option key={state} value={state} className="bg-[#111] text-white uppercase">{state}</option>
                                ))}
                            </select>
                        </div>

                        {/* Detalles */}
                        <div className="grid grid-cols-1 gap-3 bg-black/20 p-4 rounded-xl border border-white/5">
                            {cliente.representante && cliente.representante !== 'N/A' && (
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/40 uppercase font-bold">Representante</span>
                                    <span className="text-sm text-white/90">{cliente.representante}</span>
                                </div>
                            )}
                            {cliente.celular && cliente.celular !== 'N/A' && (
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/40 uppercase font-bold">Celular / Contacto</span>
                                    <span className="text-sm text-white/90">{cliente.celular}</span>
                                </div>
                            )}
                            {cliente.correo && cliente.correo !== 'N/A' && (
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/40 uppercase font-bold">Correo Electrónico</span>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm text-white/90 truncate">{cliente.correo}</span>
                                        <button onClick={() => handleSendEmail(cliente)} className="text-blue-400 bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20" title="Enviar correo">
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Propuesta de Valor */}
                        {cliente.propuestaValor && (
                            <div className="flex flex-col bg-white/5 p-4 rounded-xl border border-white/5">
                                <span className="text-[10px] text-white/40 uppercase font-bold mb-1">Propuesta de Valor</span>
                                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{cliente.propuestaValor}</p>
                            </div>
                        )}

                        {/* Google Maps Button */}
                        {cliente.direccion && cliente.direccion !== 'N/A' ? (
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full flex justify-center items-center gap-2 text-sm font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 p-3 rounded-xl transition-colors border border-blue-500/20"
                            >
                                <MapPin size={16} /> Ver en Google Maps
                            </a>
                        ) : (
                            <div className="w-full text-center text-xs text-white/30 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                                Sin dirección registrada
                            </div>
                        )}
                    </div>
                ))}
                
                {filteredClientes.length === 0 && (
                    <div className="p-8 text-center text-white/40 bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col items-center justify-center">
                        <MapPin size={48} className="mb-4 text-white/20" />
                        <p className="text-lg font-medium text-white/50">No hay clientes</p>
                        <p className="text-sm mt-1">Intenta con otros filtros o añade uno nuevo.</p>
                    </div>
                )}
            </div>

            {/* Modal de Envío Masivo */}
            {showMassEmailModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-[#111111] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-blue-500/20 animate-in zoom-in-95 duration-300">
                        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-blue-500/10">
                            <h3 className="text-xl font-black text-blue-400 flex items-center gap-2">
                                <Send size={20} /> Envío Masivo de Correos
                            </h3>
                            {!isSendingMass && (
                                <button onClick={() => setShowMassEmailModal(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                            )}
                        </div>
                        <div className="p-6">
                            {!isSendingMass ? (
                                <form onSubmit={handleMassEmailSubmit} className="space-y-4">
                                    <div className="bg-blue-500/10 text-blue-400 text-sm p-3 rounded-xl border border-blue-500/20 mb-4">
                                        Se enviará este correo a <strong>{clientes.filter(c => selectedClients.includes(c.id) && c.correo && c.correo !== 'N/A').length}</strong> clientes que tienen un correo válido de los {selectedClients.length} seleccionados.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Asunto del correo</label>
                                        <input 
                                            required 
                                            type="text" 
                                            value={massEmailSubject} 
                                            onChange={e => setMassEmailSubject(e.target.value)} 
                                            className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                            placeholder="Ingresa el asunto" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Cuerpo del correo (Acepta HTML básico)</label>
                                        <textarea 
                                            required
                                            value={massEmailBody} 
                                            onChange={e => setMassEmailBody(e.target.value)} 
                                            rows="8" 
                                            className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono" 
                                            placeholder="<p>Hola,</p> <p>Te escribimos para...</p>" 
                                        ></textarea>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                        <button type="button" onClick={() => setShowMassEmailModal(false)} className="px-5 py-2 text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors">Cancelar</button>
                                        <button type="submit" className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 shadow-sm transition-transform active:scale-95 border border-blue-500">
                                            <Send size={16} /> Empezar Envío Masivo
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="text-center py-10 space-y-4">
                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
                                    <h4 className="text-xl font-bold text-white">Enviando correos...</h4>
                                    <p className="text-white/60">Por favor, no cierres esta ventana.</p>
                                    <div className="w-full bg-white/10 rounded-full h-4 mt-6 overflow-hidden relative">
                                        <div 
                                            className="bg-blue-500 h-4 rounded-full transition-all duration-300" 
                                            style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-blue-400 font-bold mt-2">
                                        {sendingProgress.current} de {sendingProgress.total} enviados
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Resolución de Conflictos Excel */}
            {showConflictModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-[#111111] rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-amber-500/20 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-amber-500/10">
                            <div className="flex items-center gap-3">
                                <div className="bg-amber-500/20 p-2 rounded-full text-amber-400">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-amber-400">Conflictos Detectados</h3>
                                    <p className="text-sm text-amber-400/70">Algunos clientes del Excel ya existen y tienen datos diferentes.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowConflictModal(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {pendingUploads.length > 0 && (
                                <div className="flex gap-2 items-center text-sm text-white/70 bg-white/5 p-4 rounded-xl border border-white/10">
                                    <Info size={16} className="text-blue-400" />
                                    <p>Además se han encontrado <strong className="text-emerald-400">{pendingUploads.length}</strong> registros completamente nuevos que se subirán sin problemas.</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {conflicts.map((conflict, index) => (
                                    <div key={index} className={`border rounded-2xl p-5 transition-colors ${conflict.action === 'update' ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5 opacity-50'}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                            <h4 className="font-bold text-lg text-white">{conflict.existingClient.empresaCliente}</h4>
                                            <button 
                                                onClick={() => handleConflictActionToggle(index)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors border ${
                                                    conflict.action === 'update' 
                                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30' 
                                                        : 'bg-white/10 text-white/60 border-white/20 hover:bg-white/20'
                                                }`}
                                            >
                                                {conflict.action === 'update' ? <><Check size={14} /> Reemplazar datos</> : <><X size={14} /> Ignorar cambios</>}
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            {Object.keys(conflict.changes).map(key => (
                                                <div key={key} className="col-span-2 sm:col-span-1 bg-[#0a0a0a] rounded-xl p-3 border border-white/5">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">{key}</div>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start gap-2 text-sm">
                                                            <span className="text-red-400 font-bold min-w-[45px]">Actual:</span>
                                                            <span className="text-white/60 line-through">{conflict.changes[key].old}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2 text-sm">
                                                            <span className="text-emerald-400 font-bold min-w-[45px]">Excel:</span>
                                                            <span className="text-white">{conflict.changes[key].new}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-[#111111]">
                            <button onClick={() => setShowConflictModal(false)} className="px-5 py-2.5 text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-transparent">
                                Cancelar todo
                            </button>
                            <button 
                                onClick={() => processBatchUpload(pendingUploads, conflicts)}
                                className="px-5 py-2.5 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl flex items-center gap-2 shadow-sm transition-transform active:scale-95 border border-amber-500"
                            >
                                <Upload size={18} /> Confirmar Importación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Nuevo/Editar Cliente */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111111] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-black text-white">{editingId ? 'Editar Cliente' : 'Nuevo Cliente Estratégico'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Empresa / Cliente *</label>
                                    <input required type="text" name="empresaCliente" value={formData.empresaCliente} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Rubro</label>
                                    <input type="text" name="rubro" value={formData.rubro} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" placeholder="Ej: Clínicas y Centros Odontológicos" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Dirección</label>
                                    <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" placeholder="Av. Principal 123, Distrito" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Celular / Contacto</label>
                                    <input type="text" name="celular" value={formData.celular} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" placeholder="N/A o número" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Correo Electrónico</label>
                                    <input type="text" name="correo" value={formData.correo} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" placeholder="correo@ejemplo.com o N/A" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Representante</label>
                                    <input type="text" name="representante" value={formData.representante} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" placeholder="Nombre del representante" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Estado</label>
                                    <select name="estado" value={formData.estado} onChange={handleChange} className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none [&>option]:bg-[#111]">
                                        <option value="contactado">Contactado</option>
                                        <option value="en seguimiento">En Seguimiento</option>
                                        <option value="en negociación">En Negociación</option>
                                        <option value="cerrado">Cerrado / Confirmado</option>
                                        <option value="perdido">Perdido</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-white/70 mb-1 uppercase tracking-wide">Propuesta de Valor (Estrategiando)</label>
                                    <textarea name="propuestaValor" value={formData.propuestaValor} onChange={handleChange} rows="3" className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-white/30" placeholder="Ej: App móvil de preventa integrada en tiempo real..."></textarea>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/10">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors border border-transparent">Cancelar</button>
                                <button type="submit" className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center gap-2 shadow-sm transition-transform active:scale-95 border border-blue-500">
                                    <Save size={16} /> {editingId ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DirectorioEstrategico;
