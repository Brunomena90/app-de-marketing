import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Landmark, Printer, CheckCircle2, Package, Tag, ArrowRight, Clock, X, Download } from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { createPortal } from 'react-dom';

const VentasDirectas = () => {
    const { activeEmpresa } = useAuth();
    const [productos, setProductos] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeCompanyData, setActiveCompanyData] = useState(null);
    
    // Historial
    const [historial, setHistorial] = useState([]);
    const [showHistorialModal, setShowHistorialModal] = useState(false);

    // Modals state
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastVenta, setLastVenta] = useState(null);
    const [includeIGV, setIncludeIGV] = useState(false);
    const [ticketSize, setTicketSize] = useState(80); // 80 o 58mm

    // Cargar productos de Almacenes
    useEffect(() => {
        const q = query(collection(db, 'almacen_productos'), orderBy('nombre', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (activeEmpresa && activeEmpresa !== 'Todas') {
                data = data.filter(d => (d.empresa || 'Todas') === activeEmpresa);
            }
            setProductos(data);
        });
        return () => unsub();
    }, [activeEmpresa]);

    // Cargar datos de la empresa activa (para el RUC en el ticket)
    useEffect(() => {
        const fetchCompanyData = async () => {
            if (!activeEmpresa || activeEmpresa === 'Todas') return;
            try {
                const q = query(collection(db, 'empresas'), where('name', '==', activeEmpresa));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setActiveCompanyData(snap.docs[0].data());
                }
            } catch (error) {
                console.error('Error fetching company data:', error);
            }
        };
        fetchCompanyData();
    }, [activeEmpresa]);

    // Cargar Historial (Últimas 50 ventas)
    useEffect(() => {
        const qHist = query(collection(db, 'ventas_directas'), orderBy('createdAt', 'desc'), limit(50));
        const unsubHist = onSnapshot(qHist, (snap) => {
            let data = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                fechaObj: d.data().fecha ? new Date(d.data().fecha) : new Date()
            }));
            if (activeEmpresa && activeEmpresa !== 'Todas') {
                data = data.filter(d => (d.empresa || 'Todas') === activeEmpresa);
            }
            setHistorial(data);
        });
        return () => unsubHist();
    }, [activeEmpresa]);

    // Lógica del Carrito
    const addToCart = (prod) => {
        setCart(prev => {
            const exist = prev.find(item => item.id === prod.id);
            if (exist) {
                return prev.map(item => item.id === prod.id ? { ...item, cantidad: item.cantidad + 1 } : item);
            }
            return [...prev, { 
                id: prod.id, 
                nombre: prod.nombre, 
                precioVenta: Number(prod.precioVenta) || 0, 
                precioCosto: Number(prod.precio) || 0,
                cantidad: 1, 
                esServicio: prod.esServicio || false,
                matriculaId: prod.id
            }];
        });
    };

    const updateQuantity = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQ = item.cantidad + delta;
                return newQ > 0 ? { ...item, cantidad: newQ } : item;
            }
            return item;
        }));
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

    const subtotal = cart.reduce((acc, item) => acc + (item.precioVenta * item.cantidad), 0);
    const igvAmount = includeIGV ? subtotal * 0.18 : 0;
    const total = subtotal + igvAmount;

    const filteredProducts = productos.filter(p => 
        p.nombre?.toLowerCase().includes(search.toLowerCase()) || 
        p.matricula?.toLowerCase().includes(search.toLowerCase()) ||
        p.categoria?.toLowerCase().includes(search.toLowerCase())
    );

    // Lógica de Cobro e Integración
    const handleDeleteVenta = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta venta? Esto revertirá los ingresos en finanzas y almacenes.')) return;
        try {
            await deleteDoc(doc(db, 'ventas_directas', id));
            
            const qTrans = query(collection(db, 'transacciones'), where('ventaId', '==', id));
            const snapTrans = await getDocs(qTrans);
            snapTrans.forEach(async (d) => await deleteDoc(doc(db, 'transacciones', d.id)));

            const qAlm = query(collection(db, 'almacen_movimientos'), where('nota', '==', `Venta Directa #${id.slice(-6).toUpperCase()}`));
            const snapAlm = await getDocs(qAlm);
            snapAlm.forEach(async (d) => await deleteDoc(doc(db, 'almacen_movimientos', d.id)));
            
            toast.success('Venta eliminada correctamente');
        } catch (e) {
            console.error(e);
            toast.error('Error al eliminar la venta');
        }
    };

    const handleCheckout = async (metodoPago) => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            // 1. Guardar Venta Directa
            const ventaRef = await addDoc(collection(db, 'ventas_directas'), {
                empresa: activeEmpresa || 'Todas',
                items: cart,
                subtotal,
                igv: igvAmount,
                includeIGV,
                total,
                metodoPago,
                fecha: new Date().toISOString(),
                createdAt: serverTimestamp()
            });

            // 2. Integración con Finanzas (Colección 'transacciones')
            await addDoc(collection(db, 'transacciones'), {
                tipo: 'ingreso',
                categoria: 'Ventas Directas', // Para distinguir en Finanzas
                monto: subtotal, // Modificado a subtotal para no contabilizar el IGV como ganancia
                descripcion: `Venta Directa - Ticket #${ventaRef.id.slice(-6).toUpperCase()}`,
                fecha: new Date().toISOString().split('T')[0],
                metodoPago,
                empresa: activeEmpresa || 'Todas',
                ventaId: ventaRef.id,
                createdAt: serverTimestamp()
            });

            // 3. Integración con Almacenes (Generar Salidas para productos físicos)
            for (const item of cart) {
                if (!item.esServicio) {
                    await addDoc(collection(db, 'almacen_movimientos'), {
                        tipo: 'salida',
                        matriculaId: item.matriculaId,
                        cantidad: item.cantidad,
                        fecha: new Date().toISOString(),
                        nota: `Venta Directa #${ventaRef.id.slice(-6).toUpperCase()}`,
                        empresa: activeEmpresa || 'Todas',
                        costoUnitario: Number(item.precioCosto || 0),
                        precioVentaUnitario: Number(item.precioVenta || 0),
                        createdAt: serverTimestamp()
                    });
                }
            }

            toast.success('Venta completada con éxito');
            
            // Finalizar flujo y mostrar éxito
            setLastVenta({ 
                id: ventaRef.id, 
                items: cart,
                subtotal,
                igv: igvAmount,
                includeIGV,
                total, 
                metodoPago, 
                fecha: new Date() 
            });
            setCart([]);
            setShowCheckoutModal(false);
            setShowSuccessModal(true);

        } catch (error) {
            console.error(error);
            toast.error('Error al procesar la venta');
        } finally {
            setLoading(false);
        }
    };

    // Generar PDF (Tiquetera dinámica 80mm o 58mm)
    const printTicket = (venta, overrideSize, action = 'print') => {
        if (action === true) action = 'rawbt'; // Retrocompatibilidad
        
        if (!venta) return;
        
        const size = overrideSize || ticketSize;
        const is80 = size === 80;

        let baseHeight = 95; // Aumentar margen base para el pie de página
        if (venta.includeIGV) {
            baseHeight += 12; // Espacio extra para las líneas de subtotal e IGV
        }
        if (activeCompanyData?.logoBase64) {
            baseHeight += is80 ? 35 : 25; // Espacio para el logo
        }

        const itemHeight = 7;
        const totalHeight = baseHeight + (venta.items.length * itemHeight);

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [size, totalHeight]
        });

        const docWidth = doc.internal.pageSize.getWidth();
        const center = docWidth / 2;
        let y = 8; // Iniciar un poco más arriba
        
        if (activeCompanyData?.logoBase64) {
            try {
                const props = doc.getImageProperties(activeCompanyData.logoBase64);
                const imgRatio = props.width / props.height;
                const maxImgWidth = is80 ? 38 : 28;
                const maxImgHeight = is80 ? 32 : 24;
                
                let imgWidth = maxImgWidth;
                let imgHeight = imgWidth / imgRatio;
                
                if (imgHeight > maxImgHeight) {
                    imgHeight = maxImgHeight;
                    imgWidth = imgHeight * imgRatio;
                }
                
                const imgX = (docWidth - imgWidth) / 2;
                doc.addImage(activeCompanyData.logoBase64, 'PNG', imgX, y, imgWidth, imgHeight, undefined, 'FAST');
                y += imgHeight + 8; // Mayor espacio entre el logo y el nombre de la empresa
            } catch (e) {
                // Fallback seguro si getImageProperties falla
                const imgSize = is80 ? 25 : 20;
                const imgX = (docWidth - imgSize) / 2;
                doc.addImage(activeCompanyData.logoBase64, 'PNG', imgX, y, imgSize, imgSize, undefined, 'FAST');
                y += imgSize + 8; // Mayor espacio entre el logo y el nombre de la empresa
            }
        } else {
            y += 2;
        }

        let currentFontSize = is80 ? 14 : 12;
        doc.setFontSize(currentFontSize);
        doc.setFont("helvetica", "bold");
        
        const empresaName = activeCompanyData?.name || activeEmpresa || 'Empresa General';
        
        // Ajustar tamaño de fuente si el nombre de la empresa es muy largo
        let textWidth = doc.getStringUnitWidth(empresaName.toUpperCase()) * currentFontSize / doc.internal.scaleFactor;
        while (textWidth > docWidth - 6 && currentFontSize > 7) {
            currentFontSize -= 1;
            doc.setFontSize(currentFontSize);
            textWidth = doc.getStringUnitWidth(empresaName.toUpperCase()) * currentFontSize / doc.internal.scaleFactor;
        }
        
        // Función para centrar texto
        const printCentered = (text, yPos) => {
            const tWidth = doc.getStringUnitWidth(text) * doc.internal.getFontSize() / doc.internal.scaleFactor;
            const xPos = (docWidth - tWidth) / 2;
            doc.text(text, xPos, yPos);
        };

        printCentered(empresaName.toUpperCase(), y);
        y += 6;

        if (activeCompanyData?.ruc) {
            doc.setFontSize(is80 ? 10 : 9);
            doc.setFont("helvetica", "normal");
            printCentered(`RUC: ${activeCompanyData.ruc}`, y);
            y += 6;
        }

        doc.setFontSize(is80 ? 12 : 10);
        doc.setFont("helvetica", "bold");
        printCentered("TICKET DE VENTA", y);
        y += 6;
        
        doc.setFontSize(is80 ? 9 : 8);
        doc.setFont("helvetica", "normal");
        const vFecha = venta.fechaObj || new Date(venta.fecha);
        const dateStr = vFecha.toLocaleDateString() + ' ' + vFecha.toLocaleTimeString();
        doc.text(`Fecha: ${dateStr}`, center, y, { align: "center" });
        y += 5;
        doc.text(`Ticket #${venta.id.slice(-6).toUpperCase()}`, center, y, { align: "center" });
        y += 7;

        doc.setLineDashPattern([1, 1], 0);
        doc.line(3, y, docWidth - 3, y);
        y += 6;

        doc.setFontSize(is80 ? 8 : 7);
        doc.setFont("helvetica", "bold");
        
        const colCant = 3;
        const colDesc = is80 ? 16 : 14;
        const colTotal = docWidth - 3;

        doc.text("CANT", colCant, y);
        doc.text("DESCRIPCIÓN", colDesc, y);
        doc.text("TOTAL", colTotal, y, { align: "right" });
        y += 2;
        doc.line(3, y, docWidth - 3, y);
        y += 6;

        doc.setFont("helvetica", "normal");

        venta.items.forEach(item => {
            const maxLen = is80 ? 18 : 14;
            const nombreStr = item.nombre.length > (maxLen + 2) ? item.nombre.substring(0, maxLen) + '.' : item.nombre;
            const sub = (item.precioVenta * item.cantidad).toFixed(2);
            
            doc.text(`${item.cantidad}`, colCant, y);
            doc.text(`${nombreStr}`, colDesc, y);
            doc.text(`S/.${sub}`, colTotal, y, { align: "right" });
            y += itemHeight;
        });

        y += 2;
        doc.line(3, y, docWidth - 3, y);
        y += 5;

        doc.setFont("helvetica", "normal");
        const totalsX = is80 ? 45 : 30;

        if (venta.includeIGV) {
            doc.text(`Subtotal:`, totalsX, y);
            doc.text(`S/.${(venta.subtotal || 0).toFixed(2)}`, colTotal, y, { align: "right" });
            y += 5;
            doc.text(`IGV (18%):`, totalsX, y);
            doc.text(`S/.${(venta.igv || 0).toFixed(2)}`, colTotal, y, { align: "right" });
            y += 5;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`TOTAL:`, totalsX, y);
        doc.text(`S/.${Number(venta.total).toFixed(2)}`, colTotal, y, { align: "right" });
        y += 7;

        doc.setFontSize(is80 ? 9 : 8);
        doc.setFont("helvetica", "normal");
        doc.text(`Método: ${venta.metodoPago}`, 3, y);
        y += 12;

        doc.setFont("helvetica", "italic");
        doc.text("¡Gracias por su compra!", center, y, { align: "center" });

        if (action === 'rawbt') {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (!isMobile) {
                toast.info("Imprime desde tu móvil usando la App RawBT");
                return;
            }
            
            const dataUri = doc.output('datauristring');
            const base64Data = dataUri.split('base64,')[1];
            const intentUrl = `intent:data:application/pdf;base64,${base64Data}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
            window.location.href = intentUrl;
        } else if (action === 'download') {
            doc.save(`Ticket_${venta.id.slice(-6).toUpperCase()}.pdf`);
        } else {
            window.open(doc.output('bloburl'), '_blank');
        }
    };

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-6 -mx-2 sm:-mx-4">
            {/* PANEL IZQUIERDO: PRODUCTOS */}
            <div className="flex-1 bg-[#050505] rounded-[32px] p-6 relative overflow-hidden text-white shadow-2xl flex flex-col min-h-0 border border-white/5">
                {/* Bg effects */}
                <div className="absolute top-0 left-0 w-full h-64 bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full min-h-0">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                Punto de Venta <span className="text-orange-400">POS</span>
                            </h1>
                            <p className="text-white/40 text-sm mt-1">Busca y agrega productos al ticket.</p>
                        </div>
                        <div className="flex gap-2">
                            <select 
                                value={ticketSize} 
                                onChange={(e) => setTicketSize(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 text-white/80 px-3 py-2 rounded-xl text-sm font-bold outline-none cursor-pointer hover:bg-white/10 transition-colors appearance-none"
                            >
                                <option value={80} className="bg-[#111] text-white">Papel 80mm</option>
                                <option value={58} className="bg-[#111] text-white">Papel 58mm</option>
                            </select>
                            <button 
                                onClick={() => setShowHistorialModal(true)}
                                className="bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                            >
                                <Clock size={16} /> Historial
                            </button>
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="relative group mb-6 shrink-0">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-white/30 group-focus-within:text-orange-400 transition-colors" size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por código, nombre o categoría..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>

                    {/* Listado de Productos */}
                    <div className="flex-1 overflow-y-auto min-h-0 hide-scrollbar -mx-2 px-2">
                        {filteredProducts.length === 0 ? (
                            <div className="py-20 text-center text-white/30 flex flex-col items-center">
                                <Package size={48} className="mb-4 opacity-20" />
                                <p>No se encontraron productos.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                                {filteredProducts.map(prod => (
                                    <button
                                        key={prod.id}
                                        onClick={() => addToCart(prod)}
                                        className="bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-white/10 rounded-2xl p-4 text-left transition-all active:scale-95 flex flex-col h-full group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                            <div className="bg-orange-500 rounded-full p-1.5 text-white">
                                                <Plus size={14} />
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            {prod.esServicio ? <Tag size={10} className="text-indigo-400" /> : <Package size={10} />}
                                            {prod.categoria}
                                        </span>
                                        <h3 className="font-bold text-sm text-white/90 leading-tight mb-auto line-clamp-2 pr-6">
                                            {prod.nombre}
                                        </h3>
                                        <div className="mt-4 flex items-end justify-between w-full">
                                            <span className="text-xl font-black text-white">S/. {Number(prod.precioVenta || 0).toFixed(2)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PANEL DERECHO: CARRITO */}
            <div className="w-full md:w-96 shrink-0 bg-[#0A0A0A] border border-white/5 md:border-none md:bg-[#050505] rounded-[32px] p-6 relative flex flex-col shadow-2xl">
                <div className="flex items-center justify-between mb-6 shrink-0 border-b border-white/10 pb-4">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                        <ShoppingCart size={20} className="text-orange-400" /> Ticket Actual
                    </h2>
                    {cart.length > 0 && (
                        <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold">
                            {cart.length} ítem{cart.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Items del Carrito */}
                <div className="flex-1 overflow-y-auto hide-scrollbar -mx-2 px-2 min-h-0">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                            <ShoppingCart size={48} className="mb-4" />
                            <p className="text-sm">El ticket está vacío</p>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-4">
                            {cart.map(item => (
                                <div key={item.id} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex flex-col gap-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="text-sm font-bold text-white/90 leading-tight line-clamp-2 flex-1">
                                            {item.nombre}
                                        </h4>
                                        <button onClick={() => removeFromCart(item.id)} className="text-white/30 hover:text-red-400 transition-colors p-1 shrink-0">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 bg-black/40 rounded-xl p-1">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"><Minus size={14} /></button>
                                            <span className="font-bold text-sm w-4 text-center">{item.cantidad}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"><Plus size={14} /></button>
                                        </div>
                                        <span className="font-bold text-white">
                                            S/. {(item.precioVenta * item.cantidad).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Resumen y Botón de Pago */}
                <div className="pt-4 border-t border-white/10 shrink-0 mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-white/50 font-medium">Subtotal</span>
                        <span className="text-lg font-bold text-white/80">S/. {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                        <label className="flex items-center gap-2 cursor-pointer text-white/50 hover:text-white transition-colors">
                            <input 
                                type="checkbox" 
                                checked={includeIGV}
                                onChange={(e) => setIncludeIGV(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 text-orange-500 focus:ring-orange-500/50 bg-white/5"
                            />
                            <span>Incluir IGV (18%)</span>
                        </label>
                        <span className="text-lg font-bold text-white/80">S/. {igvAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-6 pt-2 border-t border-white/5">
                        <span className="text-white/50 font-medium">Total a Pagar</span>
                        <span className="text-3xl font-black text-white">S/. {total.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={() => setShowCheckoutModal(true)}
                        disabled={cart.length === 0}
                        className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] ${cart.length === 0 ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5 shadow-none' : 'bg-orange-500 text-white hover:bg-orange-400 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-[0.98]'}`}
                    >
                        Cobrar <ArrowRight size={20} />
                    </button>
                </div>
            </div>

            {/* MODAL METODO DE PAGO */}
            {showCheckoutModal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative">
                        <h2 className="text-2xl font-black text-white mb-2 text-center">Confirmar Pago</h2>
                        <p className="text-white/40 text-center text-sm mb-8">El monto a cobrar es de <strong className="text-white text-lg">S/. {total.toFixed(2)}</strong></p>

                        <div className="space-y-3 mb-8">
                            <button onClick={() => handleCheckout('Efectivo')} disabled={loading} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                                <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform"><Banknote size={24} /></div>
                                <div className="text-left"><h3 className="font-bold text-white text-lg">Efectivo</h3><p className="text-xs text-white/40">Cobro directo en caja</p></div>
                            </button>
                            <button onClick={() => handleCheckout('Tarjeta')} disabled={loading} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                                <div className="bg-blue-500/20 p-3 rounded-xl text-blue-400 group-hover:scale-110 transition-transform"><CreditCard size={24} /></div>
                                <div className="text-left"><h3 className="font-bold text-white text-lg">Tarjeta</h3><p className="text-xs text-white/40">Crédito o débito</p></div>
                            </button>
                            <button onClick={() => handleCheckout('Transferencia')} disabled={loading} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                                <div className="bg-purple-500/20 p-3 rounded-xl text-purple-400 group-hover:scale-110 transition-transform"><Landmark size={24} /></div>
                                <div className="text-left"><h3 className="font-bold text-white text-lg">Transferencia</h3><p className="text-xs text-white/40">Depósito bancario</p></div>
                            </button>
                        </div>
                        
                        <div className="flex justify-center">
                            <button disabled={loading} onClick={() => setShowCheckoutModal(false)} className="text-white/50 hover:text-white font-medium transition-colors px-6 py-2">
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL ÉXITO Y TICKET */}
            {showSuccessModal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl relative text-center">
                        <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={40} />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2">¡Venta Registrada!</h2>
                        <p className="text-white/40 text-sm mb-8">Los inventarios y finanzas se han actualizado.</p>

                        <div className="space-y-4">
                            <div className="flex gap-2 w-full">
                                <button 
                                    onClick={() => printTicket(lastVenta)}
                                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all border border-white/10 text-sm"
                                    title="Abrir Ticket PDF"
                                >
                                    <Printer size={18} /> Normal
                                </button>
                                <button 
                                    onClick={() => printTicket(lastVenta, null, 'download')}
                                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all border border-white/10 text-sm"
                                    title="Descargar Ticket PDF"
                                >
                                    <Download size={18} /> Descargar
                                </button>
                                <button 
                                    onClick={() => printTicket(lastVenta, null, 'rawbt')}
                                    className="flex-1 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all border border-blue-500/20 text-sm"
                                    title="Imprimir vía app RawBT en Android"
                                >
                                    <Printer size={18} /> RawBT
                                </button>
                            </div>
                            <button 
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold transition-all shadow-lg"
                            >
                                Nueva Venta
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL HISTORIAL */}
            {showHistorialModal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white">Historial de Ventas</h2>
                                <p className="text-white/40 text-sm">Últimas ventas registradas en el POS.</p>
                            </div>
                            <button onClick={() => setShowHistorialModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3">
                            {historial.length === 0 ? (
                                <div className="text-center py-10 text-white/30">
                                    <Clock size={40} className="mx-auto mb-4 opacity-20" />
                                    No hay ventas registradas.
                                </div>
                            ) : (
                                historial.map(venta => (
                                    <div key={venta.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:bg-white/10 transition-colors">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white">Ticket #{venta.id.slice(-6).toUpperCase()}</span>
                                                <span className="text-[10px] uppercase tracking-wider font-bold text-white/30 bg-white/5 px-2 py-0.5 rounded-md">
                                                    {venta.metodoPago}
                                                </span>
                                            </div>
                                            <div className="text-xs text-white/50">
                                                {venta.fechaObj.toLocaleDateString()} {venta.fechaObj.toLocaleTimeString()} • {venta.items?.length || 0} ítems
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between w-full md:w-auto gap-4">
                                            <span className="text-xl font-black text-white">S/. {Number(venta.total).toFixed(2)}</span>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleDeleteVenta(venta.id)}
                                                    className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors"
                                                    title="Eliminar Venta"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => printTicket(venta, null, 'download')}
                                                    className="p-2.5 bg-white/5 text-white/70 hover:bg-white/20 hover:text-white rounded-xl transition-colors"
                                                    title="Descargar Ticket PDF"
                                                >
                                                    <Download size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => printTicket(venta)}
                                                    className="p-2.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white rounded-xl transition-colors"
                                                    title="Reimprimir Ticket PDF"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => printTicket(venta, null, 'rawbt')}
                                                    className="p-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-colors"
                                                    title="Imprimir con RawBT (Android)"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default VentasDirectas;
