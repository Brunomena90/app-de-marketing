import React, { useState, useEffect, useRef } from 'react';
import { Package, ArrowRightLeft, BarChart3, LayoutDashboard, Plus, TrendingUp, Home, Pencil, Trash2, Tags, Download, Check, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const MultiSelect = ({ options, selectedValues, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const toggleOption = (value) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    return (
        <div className={`relative flex-1 sm:flex-none ${isOpen ? 'z-50' : 'z-10'}`}>
            <div 
                className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white flex items-center justify-between cursor-pointer hover:border-white/20 transition-colors gap-3"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate max-w-[150px] font-medium">
                    {selectedValues.length === 0 
                        ? placeholder 
                        : selectedValues.length === options.length
                            ? `Todos los ${placeholder.toLowerCase()}`
                            : selectedValues.length === 1
                                ? options.find(o => o.value === selectedValues[0])?.label || placeholder
                                : `${selectedValues.length} seleccionados`}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 py-2 max-h-60 overflow-y-auto">
                        <div 
                            className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 text-sm text-gray-300 border-b border-white/5"
                            onClick={() => {
                                if (selectedValues.length === options.length) onChange([]);
                                else onChange(options.map(o => o.value));
                            }}
                        >
                            <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${selectedValues.length === options.length ? 'bg-amber-500 border-amber-500 text-black' : 'border border-gray-600'}`}>
                                {selectedValues.length === options.length && <Check size={12} strokeWidth={3} />}
                            </div>
                            <span className="font-bold text-white">Seleccionar Todos</span>
                        </div>
                        {options.map(opt => (
                            <div 
                                key={opt.value}
                                className="px-4 py-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 text-sm text-gray-300 transition-colors"
                                onClick={() => toggleOption(opt.value)}
                            >
                                <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${selectedValues.includes(opt.value) ? 'bg-amber-500 border-amber-500 text-black' : 'border border-gray-600'}`}>
                                    {selectedValues.includes(opt.value) && <Check size={12} strokeWidth={3} />}
                                </div>
                                <span className="font-medium">{opt.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const Almacenes = () => {
    const { activeEmpresa, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('movimientos');
    const [productos, setProductos] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ id: null, matricula: '', nombre: '', categoria: '', precio: 0, stockMinimo: 0 });
    const alertedProductsRef = useRef({});

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth().toString();
    const mesesOptions = [
        { value: '0', label: 'Enero' }, { value: '1', label: 'Febrero' }, { value: '2', label: 'Marzo' },
        { value: '3', label: 'Abril' }, { value: '4', label: 'Mayo' }, { value: '5', label: 'Junio' },
        { value: '6', label: 'Julio' }, { value: '7', label: 'Agosto' }, { value: '8', label: 'Septiembre' },
        { value: '9', label: 'Octubre' }, { value: '10', label: 'Noviembre' }, { value: '11', label: 'Diciembre' }
    ];
    const aniosOptions = [...Array(5)].map((_, i) => ({ value: (currentYear - i).toString(), label: (currentYear - i).toString() }));

    const [filtroMeses, setFiltroMeses] = useState([currentMonth]);
    const [filtroAnios, setFiltroAnios] = useState([currentYear.toString()]);

    const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
    const [newMovimiento, setNewMovimiento] = useState({ id: null, tipo: 'entrada', matriculaId: '', cantidad: '', nota: '' });
    const [movimientoSearch, setMovimientoSearch] = useState('');
    const [isMovimientoSearchOpen, setIsMovimientoSearchOpen] = useState(false);

    const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
    const [newCategoria, setNewCategoria] = useState({ id: null, nombre: '', descripcion: '', parentId: '' });
    const [expandedCategories, setExpandedCategories] = useState([]);

    const getCategoryHierarchy = (forDisplay = false) => {
        const result = [];
        const level1 = categorias.filter(c => !c.parentId);
        level1.forEach(l1 => {
            const hasChildren1 = categorias.some(c => c.parentId === l1.id);
            result.push({ ...l1, level: 1, hierarchyName: l1.nombre, hasChildren: hasChildren1 });
            
            if (!forDisplay || expandedCategories.includes(l1.id)) {
                const level2 = categorias.filter(c => c.parentId === l1.id);
                level2.forEach(l2 => {
                    const hasChildren2 = categorias.some(c => c.parentId === l2.id);
                    result.push({ ...l2, level: 2, hierarchyName: `— ${l2.nombre}`, hasChildren: hasChildren2 });
                    
                    if (!forDisplay || expandedCategories.includes(l2.id)) {
                        const level3 = categorias.filter(c => c.parentId === l2.id);
                        level3.forEach(l3 => {
                            result.push({ ...l3, level: 3, hierarchyName: `—— ${l3.nombre}`, hasChildren: false });
                        });
                    }
                });
            }
        });
        // Agregar huérfanos por si acaso
        categorias.forEach(c => {
            if (!result.find(r => r.id === c.id)) {
                const parentExists = categorias.some(p => p.id === c.parentId);
                if (!c.parentId || !parentExists) {
                     const hasChildren = categorias.some(child => child.parentId === c.id);
                     result.push({ ...c, level: 1, hierarchyName: c.nombre, hasChildren });
                }
            }
        });
        return result;
    };

    const toggleCategory = (id) => {
        setExpandedCategories(prev => 
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    const [deleteProductModal, setDeleteProductModal] = useState({ open: false, id: null });
    const [deleteMovimientoModal, setDeleteMovimientoModal] = useState({ open: false, id: null });

    // Fetch data
    useEffect(() => {
        if (!activeEmpresa) return;

        const qProd = query(collection(db, 'almacen_productos'), orderBy('createdAt', 'desc'));
        const unSubProd = onSnapshot(qProd, (snap) => {
            const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(d => d.empresa === activeEmpresa);
            setProductos(data);
        });

        const qMov = query(collection(db, 'almacen_movimientos'), orderBy('createdAt', 'desc'));
        const unSubMov = onSnapshot(qMov, (snap) => {
            const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(d => d.empresa === activeEmpresa);
            setMovimientos(data);
        });

        const qCat = query(collection(db, 'almacen_categorias'), orderBy('createdAt', 'desc'));
        const unSubCat = onSnapshot(qCat, (snap) => {
            const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter(d => d.empresa === activeEmpresa);
            setCategorias(data);
        });

        // Request Notification Permission on mount
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }

        return () => {
            unSubProd();
            unSubMov();
            unSubCat();
        };
    }, [activeEmpresa]);

    // Categories Handlers
    const handleCreateCategoria = async (e) => {
        e.preventDefault();
        if (!newCategoria.nombre) {
            toast.error('El nombre de la categoría es obligatorio');
            return;
        }
        try {
            if (newCategoria.id) {
                const catRef = doc(db, 'almacen_categorias', newCategoria.id);
                await updateDoc(catRef, {
                    nombre: newCategoria.nombre,
                    descripcion: newCategoria.descripcion,
                    parentId: newCategoria.parentId || null
                });
                toast.success('Categoría actualizada correctamente');
            } else {
                await addDoc(collection(db, 'almacen_categorias'), {
                    nombre: newCategoria.nombre,
                    descripcion: newCategoria.descripcion,
                    parentId: newCategoria.parentId || null,
                    empresa: activeEmpresa,
                    createdAt: serverTimestamp()
                });
                toast.success('Categoría registrada correctamente');
            }
            setIsCategoriaModalOpen(false);
            setNewCategoria({ id: null, nombre: '', descripcion: '', parentId: '' });
        } catch (error) {
            toast.error('Error al guardar categoría');
            console.error(error);
        }
    };

    const handleEditCategoria = (cat) => {
        setNewCategoria({
            ...cat,
            parentId: cat.parentId || ''
        });
        setIsCategoriaModalOpen(true);
    };

    const handleDeleteCategoria = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar esta categoría?')) return;
        try {
            await deleteDoc(doc(db, 'almacen_categorias', id));
            toast.success('Categoría eliminada');
        } catch (error) {
            toast.error('Error al eliminar categoría');
            console.error(error);
        }
    };

    // Products Handlers
    const handleCreateProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.matricula) {
            toast.error('La matrícula es obligatoria');
            return;
        }

        if (!/\d/.test(newProduct.matricula)) {
            toast.error('La matrícula (código) debe contener al menos un número');
            return;
        }
        try {
            const safePrecio = parseFloat(newProduct.precio) || 0;
            const safeMinimo = parseInt(newProduct.stockMinimo, 10) || 0;

            if (newProduct.id) {
                const productRef = doc(db, 'almacen_productos', newProduct.id);
                await updateDoc(productRef, {
                    matricula: newProduct.matricula,
                    nombre: newProduct.nombre || '',
                    categoria: newProduct.categoria,
                    precio: safePrecio,
                    stockMinimo: safeMinimo
                });
                toast.success('Producto actualizado correctamente');
            } else {
                await addDoc(collection(db, 'almacen_productos'), {
                    matricula: newProduct.matricula,
                    nombre: newProduct.nombre || '',
                    categoria: newProduct.categoria,
                    precio: safePrecio,
                    stockMinimo: safeMinimo,
                    empresa: activeEmpresa,
                    createdAt: serverTimestamp()
                });
                toast.success('Producto registrado correctamente');
            }
            setIsProductModalOpen(false);
            setNewProduct({ id: null, matricula: '', nombre: '', categoria: '', precio: 0, stockMinimo: 0 });
        } catch (error) {
            toast.error('Error al guardar producto');
            console.error(error);
        }
    };

    const handleEditProduct = (product) => {
        setNewProduct(product);
        setIsProductModalOpen(true);
    };

    const handleDeleteProduct = async (id) => {
        setDeleteProductModal({ open: true, id });
    };

    // Movements Handlers
    const handleCreateMovimiento = async (e) => {
        e.preventDefault();
        
        if (!newMovimiento.matriculaId) {
            toast.error('Seleccione un producto válido de la lista');
            return;
        }

        const parsedCantidad = parseInt(newMovimiento.cantidad, 10);
        if (isNaN(parsedCantidad) || parsedCantidad <= 0) {
            toast.error('La cantidad debe ser un número válido mayor a 0');
            return;
        }

        // VALIDACIÓN DE STOCK PARA SALIDAS
        if (newMovimiento.tipo === 'salida') {
            let stockActual = 0;
            movimientos.forEach(m => {
                if (m.matriculaId === newMovimiento.matriculaId) {
                    if (m.tipo === 'entrada') stockActual += m.cantidad;
                    else if (m.tipo === 'salida') stockActual -= m.cantidad;
                }
            });
            
            // Si es edición, ignorar su propia cantidad para el balance temporal
            if (newMovimiento.id) {
                const oldMov = movimientos.find(m => m.id === newMovimiento.id);
                if (oldMov && oldMov.tipo === 'salida') {
                    stockActual += oldMov.cantidad;
                }
            }

            if (parsedCantidad > stockActual) {
                toast.error(`No hay stock suficiente. Stock disponible: ${stockActual}`);
                return;
            }
        }

        const getInitials = (name) => {
            if (!name) return '??';
            const parts = name.trim().split(' ');
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return name.substring(0, 2).toUpperCase();
        };
        const userName = user?.name || 'Desconocido';
        const userInitials = getInitials(userName);

        try {
            if (newMovimiento.id) {
                // UPDATE
                const movRef = doc(db, 'almacen_movimientos', newMovimiento.id);
                await updateDoc(movRef, {
                    tipo: newMovimiento.tipo,
                    matriculaId: newMovimiento.matriculaId,
                    cantidad: parsedCantidad,
                    nota: newMovimiento.nota || ''
                });
                toast.success('Movimiento actualizado');
            } else {
                // CREATE
                await addDoc(collection(db, 'almacen_movimientos'), {
                    tipo: newMovimiento.tipo,
                    matriculaId: newMovimiento.matriculaId,
                    cantidad: parsedCantidad,
                    nota: newMovimiento.nota || '',
                    empresa: activeEmpresa,
                    createdAt: serverTimestamp(),
                    userName: userName,
                    userInitials: userInitials
                });
                toast.success('Movimiento registrado correctamente');
            }
            
            // RESET
            setIsMovimientoModalOpen(false);
            setNewMovimiento({ id: null, tipo: 'entrada', matriculaId: '', cantidad: '', nota: '' });
            setMovimientoSearch('');
        } catch (error) {
            toast.error('Error al guardar movimiento: ' + error.message);
            console.error('Save Movimiento error:', error);
        }
    };

    const handleEditMovimiento = (mov) => {
        const prod = productos.find(p => p.id === mov.matriculaId);
        setMovimientoSearch(prod ? `${prod.matricula} - ${prod.nombre}` : '');
        setNewMovimiento(mov);
        setIsMovimientoModalOpen(true);
    };

    const getBalanceByProduct = () => {
        const balances = {};
        productos.forEach(p => {
            balances[p.id] = { ...p, stock: 0, entradas: 0, salidas: 0, stockMinimo: p.stockMinimo || 0 };
        });

        movimientos.forEach(m => {
            if (balances[m.matriculaId]) {
                if (m.tipo === 'entrada') {
                    balances[m.matriculaId].stock += m.cantidad;
                    balances[m.matriculaId].entradas += m.cantidad;
                } else if (m.tipo === 'salida') {
                    balances[m.matriculaId].stock -= m.cantidad;
                    balances[m.matriculaId].salidas += m.cantidad;
                }
            }
        });

        return Object.values(balances);
    };

    const balances = getBalanceByProduct();

    // NOTIFICATION ALERT LOGIC
    useEffect(() => {
        const currentAlerts = { ...alertedProductsRef.current };
        let hasNewAlert = false;

        balances.forEach(b => {
            const minStock = Number(b.stockMinimo) || 0;
            // Only trigger alert if stock is <= minimum AND stock is not negative (meaning it's a real low stock scenario)
            if (minStock > 0 && b.stock <= minStock && b.stock >= 0) {
                if (currentAlerts[b.id] !== b.stock) {
                    currentAlerts[b.id] = b.stock;
                    hasNewAlert = true;

                    toast.error(`¡Alerta! ${b.nombre || b.matricula} en nivel crítico (Stock: ${b.stock})`, {
                        duration: 8000,
                        icon: '⚠️'
                    });

                    if ("Notification" in window && Notification.permission === "granted") {
                        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.ready.then(registration => {
                                registration.showNotification('¡Alerta de Stock Crítico!', {
                                    body: `${b.nombre || b.matricula} ha bajado al mínimo configurado (Quedan: ${b.stock}).`,
                                    icon: '/pwa-192x192.png',
                                    vibrate: [200, 100, 200]
                                }).catch(e => console.log('Error showing notification', e));
                            });
                        } else {
                            try {
                                new Notification('¡Alerta de Stock Crítico!', {
                                    body: `${b.nombre || b.matricula} ha bajado al mínimo configurado (Quedan: ${b.stock}).`,
                                    icon: '/pwa-192x192.png'
                                });
                            } catch (e) {
                                console.log('Browser notification fallback error', e);
                            }
                        }
                    }
                }
            } else if (minStock > 0 && b.stock > minStock && currentAlerts[b.id] !== undefined) {
                delete currentAlerts[b.id];
                hasNewAlert = true;
            }
        });

        if (hasNewAlert) {
            alertedProductsRef.current = currentAlerts;
        }
    }, [balances]);

    // DASHBOARD LOGIC
    const getDashboardFilteredMovimientos = () => {
        return movimientos.filter(m => {
            if (!m.createdAt) return true;
            const date = m.createdAt.toDate();
            const movMonth = date.getMonth().toString();
            const movYear = date.getFullYear().toString();
            
            if (filtroAnios.length > 0 && !filtroAnios.includes(movYear)) return false;
            if (filtroMeses.length > 0 && !filtroMeses.includes(movMonth)) return false;
            return true;
        });
    };

    const dashboardFilteredMovs = getDashboardFilteredMovimientos();
    const dashboardEntradas = dashboardFilteredMovs.filter(m => m.tipo === 'entrada').reduce((acc, curr) => acc + curr.cantidad, 0);
    const dashboardSalidas = dashboardFilteredMovs.filter(m => m.tipo === 'salida').reduce((acc, curr) => acc + curr.cantidad, 0);

    const getDashboardData = () => {
        const data = productos.map(p => {
            const stockActual = balances.find(b => b.id === p.id)?.stock || 0;
            const prodMovs = dashboardFilteredMovs.filter(m => m.matriculaId === p.id);
            const rotacion = prodMovs.filter(m => m.tipo === 'salida').reduce((acc, curr) => acc + curr.cantidad, 0);
            return {
                name: p.nombre || p.matricula,
                stock: stockActual,
                rotacion: rotacion
            };
        }).sort((a, b) => b.rotacion - a.rotacion).slice(0, 5); 
        return data;
    };

    const handleExportExcel = () => {
        try {
            const resumenData = [
                { Métrica: 'Total Productos en Catálogo', Valor: productos.length },
                { Métrica: 'Entradas (Periodo Seleccionado)', Valor: dashboardEntradas },
                { Métrica: 'Salidas (Periodo Seleccionado)', Valor: dashboardSalidas },
            ];

            const topRotacionData = getDashboardData().map((p, index) => ({
                'Ranking': index + 1,
                'Producto': p.name,
                'Rotación (Salidas)': p.rotacion,
                'Stock Actual': p.stock
            }));

            const movimientosData = dashboardFilteredMovs.map(m => {
                const prod = productos.find(p => p.id === m.matriculaId);
                return {
                    'Fecha': m.createdAt ? m.createdAt.toDate().toLocaleDateString() : 'Desconocida',
                    'Tipo': m.tipo.toUpperCase(),
                    'Producto (SKU)': prod ? `${prod.matricula} - ${prod.nombre}` : 'Desconocido',
                    'Cantidad': m.cantidad,
                    'Nota': m.nota || '-'
                };
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topRotacionData), 'Top 5 Rotación');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movimientosData), 'Movimientos');

            XLSX.writeFile(wb, `Reporte_Almacenes_${new Date().getTime()}.xlsx`);
            toast.success('Reporte Excel descargado correctamente');
        } catch (error) {
            toast.error('Error al exportar a Excel');
            console.error(error);
        }
    };

    const handleExportMovimientosExcel = () => {
        try {
            const data = movimientos.map(m => {
                const prod = productos.find(p => p.id === m.matriculaId);
                return {
                    'Fecha': m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleDateString() : 'Desconocida',
                    'Usuario': m.userName || m.userInitials || 'Desconocido',
                    'Tipo': m.tipo.toUpperCase(),
                    'Producto (SKU)': prod ? `${prod.matricula} - ${prod.nombre}` : 'Desconocido',
                    'Cantidad': m.cantidad,
                    'Nota': m.nota || '-'
                };
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Historial de Movimientos');
            XLSX.writeFile(wb, `Reporte_Historial_Movimientos_${new Date().getTime()}.xlsx`);
            toast.success('Reporte Excel de movimientos descargado correctamente');
        } catch (error) {
            toast.error('Error al exportar movimientos a Excel');
            console.error(error);
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-4 rounded-xl border bg-gray-800 border-gray-700 text-white shadow-xl">
                    <p className="font-bold mb-2">{label}</p>
                    <p className="text-emerald-500 text-sm">Stock Actual: {payload[0].payload.stock}</p>
                    <p className="text-blue-500 text-sm">Unidades de Rotación (Salidas): {payload[0].payload.rotacion}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white relative overflow-x-hidden flex justify-center">
            
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[400px] md:w-[600px] h-[400px] md:h-[600px] bg-amber-600/10 rounded-full blur-[100px] md:blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-orange-600/10 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />

            <div className="w-full max-w-7xl p-4 md:p-8 relative z-10">
                {/* Navigation Bar / Return to App Center */}
            <div className="relative z-10 flex items-center justify-between mb-8">
                <button 
                    onClick={() => navigate('/')} 
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                    <Home size={16} /> <span className="hidden sm:inline">Volver al App Center</span>
                </button>
                {activeEmpresa && activeEmpresa !== 'Todas' && (
                    <div className="flex items-center gap-2 border bg-white/5 border-white/10 rounded-xl px-4 py-2 backdrop-blur-md">
                        <Package size={16} className="text-amber-500" />
                        <div>
                            <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">Entorno</p>
                            <p className="text-xs md:text-sm font-bold">{activeEmpresa}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="relative z-10 mb-8 md:mb-10 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4 backdrop-blur-md bg-white/5 border-white/10 text-amber-400">
                    <Package size={14} />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/70">Módulo Almacenes</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight break-words">
                    Gestión de <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Inventario</span>
                </h1>
            </div>

            {/* Tabs (Responsive horizontal scroll) */}
            <div className="relative z-10 mb-8 w-full overflow-x-auto hide-scrollbar pb-2">
                <div className="flex gap-2 p-1.5 rounded-2xl w-max bg-white/5 border border-white/10">
                    {[
                        { id: 'movimientos', label: 'Movimientos', icon: <ArrowRightLeft size={16} /> },
                        { id: 'balance', label: 'Balance', icon: <BarChart3 size={16} /> },
                        { id: 'productos', label: 'Productos', icon: <Package size={16} /> },
                        { id: 'categorias', label: 'Categorías', icon: <Tags size={16} /> },
                        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id 
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                : 'text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Contents */}
            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Filters and Export */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 md:p-6 rounded-3xl border bg-white/5 border-white/10 shadow-md">
                            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                                <MultiSelect 
                                    options={mesesOptions}
                                    selectedValues={filtroMeses}
                                    onChange={setFiltroMeses}
                                    placeholder="Meses"
                                />
                                <MultiSelect 
                                    options={aniosOptions}
                                    selectedValues={filtroAnios}
                                    onChange={setFiltroAnios}
                                    placeholder="Años"
                                />
                            </div>
                            <button 
                                onClick={handleExportExcel}
                                className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                            >
                                <Download size={16} /> Exportar Excel
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            <div className="p-5 md:p-6 rounded-3xl border bg-white/5 border-white/10 flex items-center justify-between shadow-md">
                                <div>
                                    <p className="text-xs md:text-sm font-bold mb-1 text-white/50">Total Productos</p>
                                    <p className="text-3xl md:text-4xl font-black">{productos.length}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                                    <Package size={20} className="md:w-6 md:h-6" />
                                </div>
                            </div>
                            <div className="p-5 md:p-6 rounded-3xl border bg-white/5 border-white/10 flex items-center justify-between shadow-md">
                                <div>
                                    <p className="text-xs md:text-sm font-bold mb-1 text-white/50">Entradas (Periodo)</p>
                                    <p className="text-3xl md:text-4xl font-black">{dashboardEntradas}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                                    <ArrowRightLeft size={20} className="md:w-6 md:h-6" />
                                </div>
                            </div>
                            <div className="p-5 md:p-6 rounded-3xl border bg-white/5 border-white/10 flex items-center justify-between shadow-md sm:col-span-2 md:col-span-1">
                                <div>
                                    <p className="text-xs md:text-sm font-bold mb-1 text-white/50">Salidas (Periodo)</p>
                                    <p className="text-3xl md:text-4xl font-black">{dashboardSalidas}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                                    <TrendingUp size={20} className="md:w-6 md:h-6 rotate-180" />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 rounded-3xl border bg-white/5 border-white/10 shadow-md">
                            <div className="max-w-5xl mx-auto w-full">
                                <h2 className="text-base md:text-lg font-bold mb-6 flex items-center gap-2 break-words">
                                    <BarChart3 className="text-amber-500 shrink-0" />
                                    Top 5 Productos por Rotación
                                </h2>
                                <div className="h-64 md:h-96 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={getDashboardData()} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                            <XAxis dataKey="name" stroke="#ffffff50" fontSize={12} tickFormatter={(value) => value.length > 10 ? `${value.substring(0,10)}...` : value} />
                                            <YAxis stroke="#ffffff50" fontSize={12} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff10' }} />
                                            <Bar dataKey="rotacion" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Rotación (Salidas)" maxBarSize={50} />
                                            <Bar dataKey="stock" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Stock Actual" maxBarSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'productos' && (
                    <div className="p-4 md:p-6 rounded-3xl border bg-white/5 border-white/10 shadow-md">
                        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Package className="text-amber-500 shrink-0"/> Catálogo</h2>
                            <button 
                                onClick={() => { setNewProduct({ id: null, matricula: '', nombre: '', categoria: '', precio: 0 }); setIsProductModalOpen(true); }}
                                className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                            >
                                <Plus size={16} /> Nuevo Producto
                            </button>
                        </div>

                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                            {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                                {productos.map(p => (
                                    <div key={p.id} className="bg-gray-800 p-4 rounded-2xl shadow-sm border border-white/5 relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-mono font-bold text-amber-500 text-sm">{p.matricula}</div>
                                            <div className="font-bold text-base text-white">S/ {p.precio?.toFixed(2) || '0.00'}</div>
                                        </div>
                                        <div className="font-medium text-white mb-1 break-words">{p.nombre || '-'}</div>
                                        <div className="text-xs text-gray-400 mb-3">{p.categoria || 'Sin categoría'}</div>
                                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                                            <button onClick={() => handleEditProduct(p)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                                {productos.length === 0 && (
                                    <div className="py-8 text-center text-gray-500 text-sm">No hay productos registrados.</div>
                                )}
                            </div>

                            {/* Desktop View */}
                            <table className="w-full min-w-[500px] text-left text-sm hidden md:table">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/50">
                                        <th className="pb-3 font-semibold">Matrícula (SKU)</th>
                                        <th className="pb-3 font-semibold">Nombre</th>
                                        <th className="pb-3 font-semibold">Categoría</th>
                                        <th className="pb-3 font-semibold">Precio Base</th>
                                        <th className="pb-3 font-semibold text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.map(p => (
                                        <tr key={p.id} className="border-b last:border-0 border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-4 font-mono font-bold text-amber-500">{p.matricula}</td>
                                            <td className="py-4 font-medium break-words">{p.nombre}</td>
                                            <td className="py-4 text-sm">{p.categoria || '-'}</td>
                                            <td className="py-4 font-medium whitespace-nowrap">S/ {p.precio?.toFixed(2) || '0.00'}</td>
                                            <td className="py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEditProduct(p)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors" title="Editar"><Pencil size={14} /></button>
                                                    <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {productos.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-gray-500">No hay productos registrados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'categorias' && (
                    <div className="p-4 md:p-6 rounded-3xl border bg-white/5 border-white/10 shadow-md">
                        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Tags className="text-purple-500 shrink-0"/> Categorías</h2>
                            <button 
                                onClick={() => { setNewCategoria({ id: null, nombre: '', descripcion: '' }); setIsCategoriaModalOpen(true); }}
                                className="w-full md:w-auto bg-purple-500 hover:bg-purple-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                            >
                                <Plus size={16} /> Nueva Categoría
                            </button>
                        </div>

                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                            {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                                {getCategoryHierarchy(true).map(c => (
                                    <div key={c.id} className={`bg-gray-800 p-4 rounded-2xl shadow-sm border border-white/5 relative ${c.level === 2 ? 'ml-6' : c.level === 3 ? 'ml-12' : ''}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            {c.hasChildren && (
                                                <button onClick={() => toggleCategory(c.id)} className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white -ml-1">
                                                    <ChevronDown size={14} className={`transition-transform ${expandedCategories.includes(c.id) ? '' : '-rotate-90'}`} />
                                                </button>
                                            )}
                                            <div className="font-bold text-base text-purple-400 break-words">{c.nombre}</div>
                                        </div>
                                        <div className="text-sm text-gray-400 mb-3 break-words">{c.descripcion || 'Sin descripción'}</div>
                                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                                            <button onClick={() => handleEditCategoria(c)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"><Pencil size={14} /></button>
                                            <button onClick={() => handleDeleteCategoria(c.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                                {categorias.length === 0 && (
                                    <div className="py-8 text-center text-gray-500 text-sm">No hay categorías registradas.</div>
                                )}
                            </div>

                            {/* Desktop View */}
                            <table className="w-full min-w-[500px] text-left text-sm hidden md:table">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/50">
                                        <th className="pb-3 font-semibold">Nombre de Categoría</th>
                                        <th className="pb-3 font-semibold">Descripción</th>
                                        <th className="pb-3 font-semibold text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getCategoryHierarchy(true).map(c => (
                                        <tr key={c.id} className="border-b last:border-0 border-white/5 hover:bg-white/5 transition-colors">
                                            <td className={`py-4 font-bold text-purple-400 ${c.level === 2 ? 'pl-6' : c.level === 3 ? 'pl-12' : ''}`}>
                                                <div className="flex items-center gap-2">
                                                    {c.hasChildren ? (
                                                        <button onClick={() => toggleCategory(c.id)} className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white">
                                                            <ChevronDown size={14} className={`transition-transform ${expandedCategories.includes(c.id) ? '' : '-rotate-90'}`} />
                                                        </button>
                                                    ) : (
                                                        <span className="w-[22px]" />
                                                    )}
                                                    {c.hierarchyName}
                                                </div>
                                            </td>
                                            <td className="py-4 text-sm opacity-70 break-words">{c.descripcion || '-'}</td>
                                            <td className="py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEditCategoria(c)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors" title="Editar"><Pencil size={14} /></button>
                                                    <button onClick={() => handleDeleteCategoria(c.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {categorias.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="py-8 text-center text-gray-500">No hay categorías registradas.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'movimientos' && (
                    <div className="p-4 md:p-6 rounded-3xl border bg-white/5 border-white/10 shadow-md">
                        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="text-blue-500 shrink-0"/> Movimientos</h2>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <button 
                                    onClick={handleExportMovimientosExcel}
                                    className="hidden md:flex w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <Download size={16} /> Exportar Excel
                                </button>
                                <button 
                                    onClick={() => { setIsMovimientoModalOpen(true); setMovimientoSearch(''); setNewMovimiento({ id: null, tipo: 'entrada', matriculaId: '', cantidad: '', nota: '' }); }}
                                    className="w-full sm:w-auto bg-blue-500 hover:bg-blue-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <Plus size={16} /> Nuevo Movimiento
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                            {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                                {movimientos.map(m => {
                                    const prod = productos.find(p => p.id === m.matriculaId);
                                    return (
                                        <div key={m.id} className="bg-gray-800 p-4 rounded-2xl shadow-sm border border-white/5 relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${m.tipo === 'entrada' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>{m.tipo}</span>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="text-xs text-gray-400">{m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleDateString() : '...'}</div>
                                                        {m.userInitials && (
                                                            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/80" title={m.userName}>
                                                                {m.userInitials}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`font-bold text-lg ${m.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                                                </div>
                                            </div>
                                            <div className="font-medium text-sm text-white mb-1 break-words">{prod ? `${prod.matricula} - ${prod.nombre}` : 'Desconocido'}</div>
                                            {m.nota && <div className="text-xs text-gray-400 italic mb-3 break-words">Nota: {m.nota}</div>}
                                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                                                <button onClick={() => handleEditMovimiento(m)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors"><Pencil size={14} /></button>
                                                <button onClick={() => setDeleteMovimientoModal({ open: true, id: m.id })} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {movimientos.length === 0 && (
                                    <div className="py-8 text-center text-gray-500 text-sm">No hay movimientos registrados.</div>
                                )}
                            </div>

                            {/* Desktop View */}
                            <table className="w-full min-w-[600px] text-left text-sm hidden md:table">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/50">
                                        <th className="pb-3 font-semibold">Fecha</th>
                                        <th className="pb-3 font-semibold">Usuario</th>
                                        <th className="pb-3 font-semibold">Tipo</th>
                                        <th className="pb-3 font-semibold">Producto</th>
                                        <th className="pb-3 font-semibold text-right">Cantidad</th>
                                        <th className="pb-3 font-semibold pl-4">Nota</th>
                                        <th className="pb-3 font-semibold text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos.map(m => {
                                        const prod = productos.find(p => p.id === m.matriculaId);
                                        return (
                                            <tr key={m.id} className="border-b last:border-0 border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="py-4 whitespace-nowrap">{m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleDateString() : '...'}</td>
                                                <td className="py-4">
                                                    {m.userInitials ? (
                                                        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white cursor-help" title={m.userName}>
                                                            {m.userInitials}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="py-4">
                                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${m.tipo === 'entrada' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                                        {m.tipo}
                                                    </span>
                                                </td>
                                                <td className="py-4 font-medium break-words">{prod ? `${prod.matricula} - ${prod.nombre}` : 'Desconocido'}</td>
                                                <td className="py-4 font-bold text-right text-base">{m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}</td>
                                                <td className="py-4 pl-4 text-xs opacity-70 break-words">{m.nota || '-'}</td>
                                                <td className="py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleEditMovimiento(m)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-colors" title="Editar"><Pencil size={14} /></button>
                                                        <button onClick={() => setDeleteMovimientoModal({ open: true, id: m.id })} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors" title="Eliminar"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {movimientos.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-8 text-center text-gray-500">No hay movimientos registrados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'balance' && (
                    <div className="p-4 md:p-6 rounded-3xl border bg-white/5 border-white/10 shadow-md">
                        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 mb-6"><BarChart3 className="text-emerald-500 shrink-0"/> Balance de Inventarios</h2>
                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                            {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                                {getBalanceByProduct().map(b => {
                                    const minimo = Number(b.stockMinimo) || 0;
                                    const isCritical = minimo > 0 && b.stock <= minimo;
                                    const stockColor = b.stock < 0 ? 'text-rose-500' : isCritical ? 'text-orange-400' : b.stock === 0 ? 'text-gray-500' : 'text-emerald-400';
                                    const cardBorder = isCritical ? 'border-orange-500/40' : 'border-white/5';
                                    return (
                                        <div key={b.matriculaId} className={`bg-gray-800 p-4 rounded-2xl shadow-sm border flex items-center justify-between ${cardBorder}`}>
                                            <div className="pr-4">
                                                <div className="font-mono font-bold text-emerald-500 text-sm mb-1">{b.matricula}</div>
                                                <div className="font-medium text-sm text-white break-words line-clamp-2">{b.nombre}</div>
                                                {minimo > 0 && (
                                                    <div className="text-[10px] text-gray-500 mt-1">Mín. alerta: {minimo}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Stock Actual</div>
                                                <div className={`text-xl font-bold flex items-center gap-1 ${stockColor}`}>
                                                    {isCritical && <span className="text-base">⚠️</span>}
                                                    {b.stock}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {getBalanceByProduct().length === 0 && (
                                    <div className="py-8 text-center text-gray-500 text-sm">No hay datos de balance disponibles.</div>
                                )}
                            </div>

                            {/* Desktop View */}
                            <table className="w-full min-w-[600px] text-left text-sm hidden md:table">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/50">
                                        <th className="pb-3 font-semibold">Matrícula</th>
                                        <th className="pb-3 font-semibold">Producto</th>
                                        <th className="pb-3 font-semibold text-center text-emerald-500">Entradas</th>
                                        <th className="pb-3 font-semibold text-center text-rose-500">Salidas</th>
                                        <th className="pb-3 font-semibold text-right text-base md:text-lg">Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {balances.map(b => {
                                        const minimo = Number(b.stockMinimo) || 0;
                                        const isCritical = minimo > 0 && b.stock <= minimo;
                                        const stockColor = b.stock < 0 ? 'text-rose-500' : isCritical ? 'text-orange-400 font-black' : '';
                                        return (
                                            <tr key={b.id} className="border-b last:border-0 border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="py-4 font-mono font-bold text-amber-500">{b.matricula}</td>
                                                <td className="py-4 font-medium break-words">{b.nombre}</td>
                                                <td className="py-4 text-center font-semibold text-emerald-500">{b.entradas}</td>
                                                <td className="py-4 text-center font-semibold text-rose-500">{b.salidas}</td>
                                                <td className={`py-4 font-black text-right text-base md:text-lg ${stockColor}`}>
                                                    {isCritical && <span className="mr-1">⚠️</span>}
                                                    {b.stock}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {balances.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-gray-500">No hay balances disponibles.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {isCategoriaModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-gray-800 relative max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-6">{newCategoria.id ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                        <form onSubmit={handleCreateCategoria} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Nombre de la Categoría</label>
                                <input type="text" required value={newCategoria.nombre} onChange={e => setNewCategoria({...newCategoria, nombre: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-purple-500" placeholder="Ej: Lácteos, Electrónica..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Descripción (Opcional)</label>
                                <input type="text" value={newCategoria.descripcion} onChange={e => setNewCategoria({...newCategoria, descripcion: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-purple-500" placeholder="Breve descripción..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Categoría Padre (Opcional)</label>
                                <select 
                                    value={newCategoria.parentId || ''} 
                                    onChange={e => setNewCategoria({...newCategoria, parentId: e.target.value})} 
                                    className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-purple-500 appearance-none"
                                >
                                    <option value="">Ninguna (Categoría Principal)</option>
                                    {getCategoryHierarchy()
                                        .filter(c => c.level < 3 && c.id !== newCategoria.id)
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.hierarchyName}</option>
                                        ))}
                                </select>
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                                <button type="button" onClick={() => setIsCategoriaModalOpen(false)} className="w-full sm:flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
                                <button type="submit" className="w-full sm:flex-1 py-3.5 rounded-xl font-bold bg-purple-500 hover:bg-purple-400 text-white transition-colors">Guardar Categoría</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-gray-800 relative max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-6">{newProduct.id ? 'Editar Producto' : 'Registrar Nuevo Producto'}</h3>
                        <form onSubmit={handleCreateProduct} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Matrícula (Código Único)</label>
                                <input type="text" required value={newProduct.matricula} onChange={e => setNewProduct({...newProduct, matricula: e.target.value.toUpperCase()})} className="w-full px-4 py-3.5 rounded-xl border outline-none font-mono bg-gray-800 border-gray-700 text-white focus:border-amber-500" placeholder="Ej: PROD-001" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Nombre del Producto (Opcional)</label>
                                <input type="text" value={newProduct.nombre} onChange={e => setNewProduct({...newProduct, nombre: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-amber-500" placeholder="Nombre descriptivo" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Categoría</label>
                                    <select required value={newProduct.categoria} onChange={e => setNewProduct({...newProduct, categoria: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-amber-500 appearance-none">
                                        <option value="" disabled>Seleccione...</option>
                                        {getCategoryHierarchy().map(c => (
                                            <option key={c.id} value={c.nombre}>{c.hierarchyName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Precio Ref.</label>
                                    <input type="number" step="0.01" value={newProduct.precio} onChange={e => setNewProduct({...newProduct, precio: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-rose-400 flex items-center gap-1"><Tags size={12}/> Min. Alerta</label>
                                    <input type="number" min="0" value={newProduct.stockMinimo || 0} onChange={e => setNewProduct({...newProduct, stockMinimo: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-rose-500" />
                                </div>
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                                <button type="button" onClick={() => setIsProductModalOpen(false)} className="w-full sm:flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
                                <button type="submit" className="w-full sm:flex-1 py-3.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-white transition-colors">Guardar Producto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteProductModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm p-6 rounded-3xl shadow-2xl bg-gray-900 border border-rose-900/50 relative">
                        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-center text-white">¿Eliminar Producto?</h3>
                        <p className="text-gray-400 text-center mb-6 text-sm">Esta acción lo quitará del catálogo. Sus movimientos históricos se mantendrán por seguridad.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteProductModal({ open: false, id: null })} className="flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
                            <button onClick={async () => {
                                try {
                                    await deleteDoc(doc(db, 'almacen_productos', deleteProductModal.id));
                                    toast.success('Producto eliminado');
                                    setDeleteProductModal({ open: false, id: null });
                                } catch (error) {
                                    toast.error('Error: ' + error.message);
                                    console.error('Delete error:', error);
                                }
                            }} className="flex-1 py-3.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteMovimientoModal.open && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm p-6 rounded-3xl shadow-2xl bg-gray-900 border border-rose-900/50 relative">
                        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4 mx-auto">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-center text-white">¿Eliminar Movimiento?</h3>
                        <p className="text-gray-400 text-center mb-6 text-sm">Esta acción es irreversible y afectará el balance actual del inventario.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteMovimientoModal({ open: false, id: null })} className="flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
                            <button onClick={async () => {
                                try {
                                    await deleteDoc(doc(db, 'almacen_movimientos', deleteMovimientoModal.id));
                                    toast.success('Movimiento eliminado');
                                    setDeleteMovimientoModal({ open: false, id: null });
                                } catch (error) {
                                    toast.error('Error: ' + error.message);
                                    console.error('Delete error:', error);
                                }
                            }} className="flex-1 py-3.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {isMovimientoModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-gray-800 relative max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-6">Registrar Movimiento</h3>
                        <form onSubmit={handleCreateMovimiento} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Tipo de Movimiento</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setNewMovimiento({...newMovimiento, tipo: 'entrada'})} className={`flex-1 py-3.5 rounded-xl font-bold border transition-all ${newMovimiento.tipo === 'entrada' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>Entrada (+)</button>
                                    <button type="button" onClick={() => setNewMovimiento({...newMovimiento, tipo: 'salida'})} className={`flex-1 py-3.5 rounded-xl font-bold border transition-all ${newMovimiento.tipo === 'salida' ? 'bg-rose-500/20 border-rose-500 text-rose-500' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}>Salida (-)</button>
                                </div>
                            </div>
                            <div className="relative">
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Producto</label>
                                <input 
                                    type="text" 
                                    required={!newMovimiento.matriculaId}
                                    value={movimientoSearch}
                                    onChange={e => {
                                        setMovimientoSearch(e.target.value);
                                        setNewMovimiento({...newMovimiento, matriculaId: ''});
                                        setIsMovimientoSearchOpen(true);
                                    }}
                                    onFocus={() => setIsMovimientoSearchOpen(true)}
                                    onBlur={() => setTimeout(() => setIsMovimientoSearchOpen(false), 200)}
                                    placeholder="Buscar por código o nombre..."
                                    className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-blue-500"
                                />
                                {isMovimientoSearchOpen && (
                                    <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-xl shadow-2xl">
                                        {productos.filter(p => 
                                            p.matricula.toLowerCase().includes(movimientoSearch.toLowerCase()) || 
                                            p.nombre.toLowerCase().includes(movimientoSearch.toLowerCase())
                                        ).map(p => (
                                            <div 
                                                key={p.id} 
                                                className="px-4 py-3 hover:bg-blue-500 hover:text-white cursor-pointer transition-colors border-b last:border-0 border-gray-700/50"
                                                onClick={() => {
                                                    setNewMovimiento({...newMovimiento, matriculaId: p.id});
                                                    setMovimientoSearch(`${p.matricula} - ${p.nombre}`);
                                                    setIsMovimientoSearchOpen(false);
                                                }}
                                            >
                                                <span className="font-mono text-amber-500 font-bold">{p.matricula}</span> - {p.nombre}
                                            </div>
                                        ))}
                                        {productos.filter(p => p.matricula.toLowerCase().includes(movimientoSearch.toLowerCase()) || p.nombre.toLowerCase().includes(movimientoSearch.toLowerCase())).length === 0 && (
                                            <div className="px-4 py-3 text-gray-500 text-sm">No se encontraron productos.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Cantidad</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={newMovimiento.cantidad}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setNewMovimiento({ ...newMovimiento, cantidad: val === '' ? '' : val });
                                    }}
                                    onFocus={e => { if (e.target.value === '0') setNewMovimiento({ ...newMovimiento, cantidad: '' }); }}
                                    className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-blue-500"
                                    placeholder="Ej: 10"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Nota Adicional</label>
                                <input type="text" value={newMovimiento.nota} onChange={e => setNewMovimiento({...newMovimiento, nota: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-blue-500" placeholder="Ej: Lote A, Ajuste, Venta..." />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                                <button type="button" onClick={() => setIsMovimientoModalOpen(false)} className="w-full sm:flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
                                <button type="submit" className="w-full sm:flex-1 py-3.5 rounded-xl font-bold bg-blue-500 hover:bg-blue-400 text-white transition-colors">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default Almacenes;
