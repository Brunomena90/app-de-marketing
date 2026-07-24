import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Package, ArrowRightLeft, BarChart3, LayoutDashboard, Plus, TrendingUp, Home, Pencil, Trash2, Tags, Download, Check, ChevronDown, ChevronRight, PieChart as PieChartIcon, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
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

const CategoryTreeSelect = ({ 
    categorias, 
    value, 
    onChange, 
    placeholder = "Seleccione...", 
    excludeId = null, 
    valueField = 'nombre',
    allowNone = false,
    maxLevel = 99
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState([]);
    
    const getChildren = (parentId) => categorias.filter(c => c.parentId === parentId && c.id !== excludeId);
    
    const toggleExpand = (e, id) => {
        e.stopPropagation();
        setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    const renderNode = (cat, level = 0) => {
        if (level >= maxLevel) return null;
        const children = getChildren(cat.id);
        const hasChildren = children.length > 0 && (level + 1 < maxLevel);
        const isExpanded = expanded.includes(cat.id);
        
        return (
            <div key={cat.id} className="w-full">
                <div 
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/10 rounded-xl transition-colors ${value === cat[valueField] ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'text-gray-200 border border-transparent'}`}
                    style={{ marginLeft: `${level * 1.5}rem` }}
                    onClick={() => handleSelect(cat[valueField])}
                >
                    <span className="font-bold text-base">{cat.nombre}</span>
                    {hasChildren && (
                        <div 
                            className="p-1.5 hover:bg-white/20 rounded-lg shrink-0 transition-transform bg-black/20" 
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            onClick={(e) => toggleExpand(e, cat.id)}
                        >
                            <ChevronRight size={18} />
                        </div>
                    )}
                </div>
                {isExpanded && hasChildren && (
                    <div className="mt-2 flex flex-col gap-2 relative before:absolute before:left-[1rem] before:top-0 before:bottom-0 before:w-px before:bg-white/10">
                        {children.map(child => renderNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const rootCategories = categorias.filter(c => !c.parentId && c.id !== excludeId);
    const selectedCategory = categorias.find(c => c[valueField] === value);
    let displayValue = placeholder;
    if (value === '') {
        displayValue = allowNone ? 'Ninguna (Categoría Principal)' : placeholder;
    } else if (selectedCategory) {
        const path = [];
        let curr = selectedCategory;
        while(curr) {
            path.unshift(curr.nombre);
            if (curr.parentId) curr = categorias.find(c => c.id === curr.parentId);
            else curr = null;
        }
        displayValue = path.join(' > ');
    }

    return (
        <>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3.5 rounded-xl border flex items-center justify-between cursor-pointer outline-none bg-gray-800 border-gray-700 text-white hover:border-gray-500 transition-colors gap-2"
            >
                <span className={`flex-1 min-w-0 truncate ${value || (allowNone && value === '') ? "text-white" : "text-gray-400"}`}>{displayValue}</span>
                <ChevronDown size={18} className="text-gray-400 shrink-0" />
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
                    <div 
                        className="bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <h4 className="font-black text-xl text-white">Seleccionar Categoría</h4>
                            <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2 custom-scrollbar">
                            {allowNone && (
                                <div 
                                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/10 rounded-xl transition-colors ${value === '' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'text-gray-400 italic border border-transparent'}`}
                                    onClick={() => handleSelect('')}
                                >
                                    <span className="font-bold">Ninguna (Categoría Principal)</span>
                                </div>
                            )}
                            {rootCategories.length > 0 ? rootCategories.map(cat => renderNode(cat, 0)) : (
                                !allowNone && <div className="p-8 text-center text-gray-500">No hay categorías registradas</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const Almacenes = () => {
    const { activeEmpresa, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('movimientos');
    const [productos, setProductos] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [selectedProductForChart, setSelectedProductForChart] = useState('');
    const [chartProductSearch, setChartProductSearch] = useState('');
    const [isChartProductSearchOpen, setIsChartProductSearchOpen] = useState(false);
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({ id: null, matricula: '', nombre: '', categoria: '', precio: 0, precioVenta: 0, stockMinimo: 0 });
    const alertedProductsRef = useRef({});

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    const formatDateForInput = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const [filtroFechaInicio, setFiltroFechaInicio] = useState(formatDateForInput(firstDay));
    const [filtroFechaFin, setFiltroFechaFin] = useState(formatDateForInput(lastDay));
    const [isFilterActive, setIsFilterActive] = useState(false);

    const [isMovimientoModalOpen, setIsMovimientoModalOpen] = useState(false);
    const [newMovimiento, setNewMovimiento] = useState({ id: null, tipo: 'entrada', matriculaId: '', cantidad: '', nota: '' });
    const [movimientoSearch, setMovimientoSearch] = useState('');
    const [isMovimientoSearchOpen, setIsMovimientoSearchOpen] = useState(false);

    const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
    const [newCategoria, setNewCategoria] = useState({ id: null, nombre: '', descripcion: '', parentId: '' });
    const [expandedCategories, setExpandedCategories] = useState([]);
    
    const [massUploadState, setMassUploadState] = useState({ open: false, pendingProducts: [], conflicts: [] });
    const fileInputRef = useRef(null);

    // Estado y Referencia para la Carga Masiva de Movimientos
    const [movUploadState, setMovUploadState] = useState({ open: false, pending: [], conflicts: [], showModal: false });
    const movFileInputRef = useRef(null);

    // Gestos táctiles (Swipe left/right en móvil para cambiar pestañas)
    const tabsList = ['movimientos', 'balance', 'productos', 'categorias', 'dashboard'];
    const touchStateRef = useRef({ startX: 0, startY: 0, endX: 0, endY: 0, disabled: false });

    useEffect(() => {
        const el = document.getElementById(`tab-btn-${activeTab}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeTab]);

    const handleTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        if (e.target.closest('.overflow-x-auto') || e.target.closest('input') || e.target.closest('select') || e.target.closest('textarea') || e.target.closest('button') || e.target.closest('.recharts-responsive-container')) {
            touchStateRef.current.disabled = true;
            return;
        }
        touchStateRef.current.disabled = false;
        touchStateRef.current.startX = e.touches[0].clientX;
        touchStateRef.current.startY = e.touches[0].clientY;
        touchStateRef.current.endX = e.touches[0].clientX;
        touchStateRef.current.endY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
        if (touchStateRef.current.disabled || !e.touches || e.touches.length === 0) return;
        touchStateRef.current.endX = e.touches[0].clientX;
        touchStateRef.current.endY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
        if (touchStateRef.current.disabled) return;
        const { startX, startY, endX, endY } = touchStateRef.current;
        const deltaX = endX - startX;
        const deltaY = endY - startY;

        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            const currentIndex = tabsList.indexOf(activeTab);
            if (currentIndex !== -1) {
                if (deltaX < 0 && currentIndex < tabsList.length - 1) {
                    setActiveTab(tabsList[currentIndex + 1]);
                } else if (deltaX > 0 && currentIndex > 0) {
                    setActiveTab(tabsList[currentIndex - 1]);
                }
            }
        }
    };

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

    const getCategoryPathName = (categoriaNombre) => {
        if (!categoriaNombre) return 'Sin categoría';
        const cat = categorias.find(c => c.nombre === categoriaNombre);
        if (!cat) return categoriaNombre;
        
        const path = [];
        let curr = cat;
        while (curr) {
            path.unshift(curr.nombre);
            if (curr.parentId) curr = categorias.find(c => c.id === curr.parentId);
            else curr = null;
        }
        return path.join(' > ');
    };

    const generateSKU = (categoriaNombre, extraProducts = []) => {
        if (!categoriaNombre) return '';
        const cat = categorias.find(c => c.nombre === categoriaNombre);
        if (!cat) return '';
        
        const path = [];
        let curr = cat;
        while (curr) {
            path.unshift(curr.nombre);
            if (curr.parentId) curr = categorias.find(c => c.id === curr.parentId);
            else curr = null;
        }
        
        let prefix = '';
        path.forEach((name, index) => {
            const cleanName = name.trim();
            if (index === 0) {
                prefix += cleanName.substring(0, 2).toUpperCase();
            } else {
                const words = cleanName.split(' ').filter(w => w.trim().length > 0);
                words.forEach(w => {
                    prefix += w.charAt(0).toUpperCase();
                });
            }
        });
        
        const allProducts = [...productos, ...extraProducts];
        const productsInCat = allProducts.filter(p => p.categoria === categoriaNombre);
        let count = productsInCat.length + 1;
        let sku = `${prefix}${count.toString().padStart(3, '0')}`;
        
        while (allProducts.some(p => p.matricula === sku && p.id !== newProduct.id)) {
            count++;
            sku = `${prefix}${count.toString().padStart(3, '0')}`;
        }
        return sku;
    };

    const toggleCategory = (id) => {
        setExpandedCategories(prev => 
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    const [deleteProductModal, setDeleteProductModal] = useState({ open: false, id: null });
    const [deleteMovimientoModal, setDeleteMovimientoModal] = useState({ open: false, id: null });

    // --- Hook para cerrar modales con el botón de "Atrás" (Android/PopState) ---
    useEffect(() => {
        const isAnyModalOpen = isCategoriaModalOpen || isProductModalOpen || isMovimientoModalOpen || deleteProductModal.open || deleteMovimientoModal.open || massUploadState.open || (movUploadState && movUploadState.showModal);
        
        if (isAnyModalOpen) {
            window.history.pushState({ modalOpen: true }, '');
            
            const handlePopState = () => {
                setIsCategoriaModalOpen(false);
                setIsProductModalOpen(false);
                setIsMovimientoModalOpen(false);
                setDeleteProductModal(prev => ({ ...prev, open: false }));
                setDeleteMovimientoModal(prev => ({ ...prev, open: false }));
                setMassUploadState(prev => ({ ...prev, open: false }));
                setMovUploadState(prev => ({ ...prev, showModal: false }));
            };
            
            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
                if (window.history.state && window.history.state.modalOpen) {
                    window.history.back();
                }
            };
        }
    }, [isCategoriaModalOpen, isProductModalOpen, isMovimientoModalOpen, deleteProductModal.open, deleteMovimientoModal.open, massUploadState.open, movUploadState?.showModal]);

    // Cleanup URLs when modal closes
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
            const safePrecioVenta = parseFloat(newProduct.precioVenta) || 0;
            const safeMinimo = parseInt(newProduct.stockMinimo, 10) || 0;

            if (newProduct.id) {
                const productRef = doc(db, 'almacen_productos', newProduct.id);
                await updateDoc(productRef, {
                    matricula: newProduct.matricula,
                    nombre: newProduct.nombre || '',
                    categoria: newProduct.categoria,
                    precio: safePrecio,
                    precioVenta: safePrecioVenta,
                    stockMinimo: safeMinimo
                });
                toast.success('Producto actualizado correctamente');
            } else {
                await addDoc(collection(db, 'almacen_productos'), {
                    matricula: newProduct.matricula,
                    nombre: newProduct.nombre || '',
                    categoria: newProduct.categoria,
                    precio: safePrecio,
                    precioVenta: safePrecioVenta,
                    stockMinimo: safeMinimo,
                    empresa: activeEmpresa,
                    createdAt: serverTimestamp()
                });
                toast.success('Producto registrado correctamente');
            }
            setIsProductModalOpen(false);
            setNewProduct({ id: null, matricula: '', nombre: '', categoria: '', precio: 0, precioVenta: 0, stockMinimo: 0 });
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
            const relatedProduct = productos.find(p => p.id === newMovimiento.matriculaId);
            const currentCosto = relatedProduct ? (relatedProduct.precio || 0) : 0;
            const currentPrecioVenta = relatedProduct ? (relatedProduct.precioVenta || 0) : 0;

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
                    userInitials: userInitials,
                    costoUnitario: currentCosto,
                    precioVentaUnitario: currentPrecioVenta
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
        if (!isFilterActive) return movimientos;
        return movimientos.filter(m => {
            if (!m.createdAt) return true;
            
            const date = m.createdAt.toDate();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            if (filtroFechaInicio && dateStr < filtroFechaInicio) return false;
            if (filtroFechaFin && dateStr > filtroFechaFin) return false;
            
            return true;
        });
    };

    const dashboardFilteredMovs = getDashboardFilteredMovimientos();
    const dashboardEntradas = dashboardFilteredMovs.filter(m => m.tipo === 'entrada').reduce((acc, curr) => acc + Number(curr.cantidad), 0);
    const dashboardSalidas = dashboardFilteredMovs.filter(m => m.tipo === 'salida').reduce((acc, curr) => acc + Number(curr.cantidad), 0);

    const getDashboardData = () => {
        const data = productos.map(p => {
            const stockActual = balances.find(b => b.id === p.id)?.stock || 0;
            const prodMovs = dashboardFilteredMovs.filter(m => m.matriculaId === p.id);
            const rotacion = prodMovs.filter(m => m.tipo === 'salida').reduce((acc, curr) => acc + Number(curr.cantidad), 0);
            return {
                name: p.nombre || p.matricula,
                stock: stockActual,
                rotacion: rotacion
            };
        }).filter(d => d.rotacion > 0).sort((a, b) => b.rotacion - a.rotacion).slice(0, 5); 
        return data;
    };

    const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    const renderCustomizedPieLabel = (props) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, percent, value, name, stroke } = props;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 1.6;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-bold">
                <tspan x={x} dy="-0.5em">{(percent * 100).toFixed(0)}%</tspan>
                <tspan x={x} dy="1.2em" fill="#9ca3af" fontWeight="normal">({value} Sol.)</tspan>
            </text>
        );
    };

    const getCategorySalesData = () => {
        const salesByCategory = {};
        dashboardFilteredMovs.forEach(m => {
            if (m.tipo === 'salida') {
                const prod = productos.find(p => p.id === m.matriculaId);
                if (prod) {
                    const mainCategory = getCategoryPathName(prod.categoria).split(' > ')[0] || 'Desconocida';
                    const saleValue = Number(m.cantidad) * (prod.precioVenta || 0);
                    if (!salesByCategory[mainCategory]) {
                        salesByCategory[mainCategory] = 0;
                    }
                    salesByCategory[mainCategory] += saleValue;
                }
            }
        });

        return Object.keys(salesByCategory).map((cat, index) => ({
            name: cat,
            value: salesByCategory[cat],
            color: CHART_COLORS[index % CHART_COLORS.length]
        })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
    };

    const getProductCostTrendData = () => {
        if (!chartProductSearch || chartProductSearch.trim().length < 2) return { data: [], matchedName: '' };
        
        const search = chartProductSearch.toLowerCase().trim();
        const prod = productos.find(p => p.matricula.toLowerCase().includes(search) || (p.nombre && p.nombre.toLowerCase().includes(search)));
        
        if (!prod) return { data: [], matchedName: '' };

        const prodMovs = movimientos.filter(m => m.matriculaId === prod.id && m.tipo === 'entrada');
        const monthlyCost = {};
        const fallbackCost = prod.precio || 0;

        prodMovs.forEach(m => {
            if (m.createdAt) {
                const date = m.createdAt.toDate();
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const unitCost = m.costoUnitario !== undefined ? m.costoUnitario : fallbackCost;
                const totalCost = Number(m.cantidad) * unitCost;
                if (!monthlyCost[monthKey]) monthlyCost[monthKey] = 0;
                monthlyCost[monthKey] += totalCost;
            }
        });

        const data = Object.keys(monthlyCost).sort().map(month => {
            const [y, mStr] = month.split('-');
            const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            return {
                mes: `${monthNames[parseInt(mStr) - 1]} ${y}`,
                costo: monthlyCost[month]
            };
        });
        
        return { data, matchedName: prod.nombre || prod.matricula };
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

    const handleExportProductsExcel = () => {
        try {
            const data = productos.map(p => {
                const stock = balances.find(b => b.id === p.id)?.stock || 0;
                const pathStr = getCategoryPathName(p.categoria);
                const pathParts = pathStr === 'Sin categoría' ? [] : pathStr.split(' > ');
                return {
                    'Matrícula (SKU)': p.matricula,
                    'Nombre del Producto': p.nombre || '-',
                    'Categoría': pathParts[0] || 'Sin categoría',
                    'Sub Categoría': pathParts[1] || '-',
                    'Precio Base (S/)': p.precio || 0,
                    'Precio de Venta (S/)': p.precioVenta || 0,
                    'Stock Mínimo': p.stockMinimo || 0,
                    'Stock Actual': stock
                };
            });

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Catálogo de Productos');
            XLSX.writeFile(wb, `Reporte_Catalogo_Productos_${new Date().getTime()}.xlsx`);
            toast.success('Reporte Excel de productos descargado correctamente');
        } catch (error) {
            toast.error('Error al exportar productos a Excel');
            console.error(error);
        }
    };
    const handleDownloadTemplate = () => {
        const templateData = [{
            'Nombre': 'Ejemplo Producto 1',
            'Categoría': 'COMIDA',
            'Sub Categoría': 'comida 2',
            'Precio Base': 12.50,
            'Precio de Venta': 15.00,
            'Stock Mínimo': 5
        }];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "Plantilla_Carga_Masiva.xlsx");
    };

    const processMassUpload = async (productsToImport, extraStateProducts = []) => {
        try {
            const batchProducts = [];
            let currentExtra = [...extraStateProducts];
            for (const p of productsToImport) {
                const sku = generateSKU(p.categoria, currentExtra);
                const prodData = {
                    ...p,
                    matricula: sku,
                    createdAt: serverTimestamp()
                };
                
                const docRef = await addDoc(collection(db, 'almacen_productos'), prodData);
                
                await addDoc(collection(db, 'almacen_movimientos'), {
                    tipo: 'entrada',
                    matriculaId: docRef.id,
                    cantidad: 0,
                    nota: 'Carga masiva inicial',
                    createdAt: serverTimestamp(),
                    userEmail: user?.email || 'Sistema',
                    userName: user?.displayName || 'Sistema',
                    costoUnitario: prodData.precio || 0,
                    precioVentaUnitario: prodData.precioVenta || 0
                });
                
                currentExtra.push({ ...prodData, id: docRef.id });
                batchProducts.push({ ...prodData, id: docRef.id });
            }
            toast.success(`${batchProducts.length} productos importados exitosamente`);
            setMassUploadState({ open: false, pendingProducts: [], conflicts: [] });
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar productos masivos");
        }
    };

    const handleConfirmMassUpload = async () => {
        const { pendingProducts, conflicts } = massUploadState;
        // Proceed with all pending and conflicts
        await processMassUpload([...pendingProducts, ...conflicts]);
    };

    // --- LÓGICA DE CARGA MASIVA DE EXCEL PARA MOVIMIENTOS ---
    const handleMovFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });

                const pending = [];
                const conflicts = [];

                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i];
                    
                    const rawProductName = String(row['Producto'] || row['producto'] || '').trim();
                    if (!rawProductName) continue;
                    
                    let prodId = null;
                    let costoUnitario = 0;
                    let precioVentaUnitario = 0;
                    
                    const matchedProduct = productos.find(p => 
                        p.nombre.toLowerCase() === rawProductName.toLowerCase() || 
                        p.matricula.toLowerCase() === rawProductName.toLowerCase()
                    );
                    
                    if (matchedProduct) {
                        prodId = matchedProduct.id;
                        costoUnitario = parseFloat(matchedProduct.precio) || 0;
                        precioVentaUnitario = parseFloat(matchedProduct.precioVenta) || 0;
                    } else {
                        toast.error(`Producto no encontrado en línea ${i + 2}: ${rawProductName}`);
                        continue;
                    }

                    const tipoRaw = String(row['Tipo'] || row['tipo'] || 'entrada').toLowerCase();
                    const tipo = tipoRaw.includes('salida') ? 'salida' : 'entrada';
                    
                    const cantidad = parseInt(row['Cantidad'] || row['cantidad']) || 0;
                    if (cantidad <= 0) continue;

                    const nota = String(row['Nota'] || row['nota'] || row['Observacion'] || '').trim();
                    
                    const excelDate = row['Fecha'] || row['fecha'] || row['Fecha y Hora'] || row['Fecha y hora'];
                    let dateToUse = new Date();
                    
                    if (excelDate) {
                        if (excelDate instanceof Date) {
                            dateToUse = excelDate;
                        } else {
                            const parsed = new Date(excelDate);
                            if (!isNaN(parsed.getTime())) {
                                dateToUse = parsed;
                            }
                        }
                    }

                    const newMov = {
                        tipo,
                        matriculaId: prodId,
                        productName: matchedProduct.nombre,
                        cantidad,
                        nota,
                        excelDate: dateToUse,
                        costoUnitario,
                        precioVentaUnitario
                    };

                    const isDuplicate = movimientos.some(m => {
                        if (m.matriculaId !== prodId) return false;
                        if (m.tipo !== tipo) return false;
                        if (m.cantidad !== cantidad) return false;
                        
                        const mDate = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
                        if (!mDate || isNaN(mDate.getTime())) return false;
                        
                        const diffTime = Math.abs(dateToUse.getTime() - mDate.getTime());
                        // Tolerancia de 2 minutos para considerar duplicado
                        return diffTime < 120000;
                    });

                    if (isDuplicate) {
                        conflicts.push(newMov);
                    } else {
                        pending.push(newMov);
                    }
                }

                if (conflicts.length > 0) {
                    setMovUploadState({ open: false, pending, conflicts, showModal: true });
                } else if (pending.length > 0) {
                    await processMovMassUpload(pending);
                } else {
                    toast.info('No se encontraron movimientos válidos o todos están vacíos.');
                }
            } catch (err) {
                console.error('Error parseando excel de movimientos:', err);
                toast.error('Error al procesar el archivo Excel.');
            } finally {
                if (movFileInputRef.current) movFileInputRef.current.value = null;
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmMovMassUpload = async (includeConflicts) => {
        const { pending, conflicts } = movUploadState;
        const toUpload = includeConflicts ? [...pending, ...conflicts] : pending;
        
        setMovUploadState({ open: false, pending: [], conflicts: [], showModal: false });
        
        if (toUpload.length > 0) {
            await processMovMassUpload(toUpload);
        } else {
            toast.info('No se cargaron movimientos (se ignoraron todos los duplicados).');
        }
    };

    const processMovMassUpload = async (movementsToUpload) => {
        const loadingToast = toast.loading(`Registrando ${movementsToUpload.length} movimientos...`);
        try {
            for (const mov of movementsToUpload) {
                const userName = user?.displayName || user?.email || 'Usuario';
                const userInitials = userName.substring(0, 2).toUpperCase();

                await addDoc(collection(db, 'almacen_movimientos'), {
                    tipo: mov.tipo,
                    matriculaId: mov.matriculaId,
                    cantidad: mov.cantidad,
                    nota: mov.nota || '',
                    empresa: activeEmpresa,
                    createdAt: mov.excelDate,
                    userName: userName,
                    userInitials: userInitials,
                    costoUnitario: mov.costoUnitario,
                    precioVentaUnitario: mov.precioVentaUnitario
                });
            }
            toast.success(`Se registraron ${movementsToUpload.length} movimientos correctamente.`, { id: loadingToast });
        } catch (error) {
            console.error('Error mass upload mov:', error);
            toast.error('Error registrando los movimientos masivos.', { id: loadingToast });
        }
    };
    // --- FIN LÓGICA DE CARGA MASIVA DE EXCEL PARA MOVIMIENTOS ---

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
                
                const pending = [];
                const conflicts = [];
                let currentCats = [...categorias];
                
                const resolveCategory = async (catName, subCatName) => {
                    let catId = null;
                    let parentId = null;
                    
                    if (catName) {
                        let existingCat = currentCats.find(c => c.nombre.toLowerCase() === catName.toLowerCase() && !c.parentId);
                        if (!existingCat) {
                            const newDocRef = await addDoc(collection(db, 'almacen_categorias'), { nombre: catName, descripcion: '', parentId: null, createdAt: serverTimestamp() });
                            existingCat = { id: newDocRef.id, nombre: catName, parentId: null };
                            currentCats.push(existingCat);
                        }
                        parentId = existingCat.id;
                        catId = existingCat.id;
                    }
                    
                    if (subCatName && parentId) {
                        let existingSubCat = currentCats.find(c => c.nombre.toLowerCase() === subCatName.toLowerCase() && c.parentId === parentId);
                        if (!existingSubCat) {
                            const newDocRef = await addDoc(collection(db, 'almacen_categorias'), { nombre: subCatName, descripcion: '', parentId: parentId, createdAt: serverTimestamp() });
                            existingSubCat = { id: newDocRef.id, nombre: subCatName, parentId: parentId };
                            currentCats.push(existingSubCat);
                        }
                        catId = existingSubCat.id;
                    }
                    
                    return catId ? currentCats.find(c => c.id === catId)?.nombre : '';
                };

                toast.info("Procesando archivo...");
                
                for (const row of data) {
                    if (!row['Nombre']) continue;
                    
                    const catStr = await resolveCategory(row['Categoría'], row['Sub Categoría']);
                    
                    const newProd = {
                        nombre: String(row['Nombre']),
                        categoria: catStr,
                        precio: Number(row['Precio Base']) || 0,
                        precioVenta: Number(row['Precio de Venta']) || 0,
                        stockMinimo: Number(row['Stock Mínimo']) || 0
                    };
                    
                    const existing = productos.find(p => p.nombre.toLowerCase() === newProd.nombre.toLowerCase() && p.categoria === newProd.categoria);
                    if (existing) {
                        conflicts.push(newProd);
                    } else {
                        pending.push(newProd);
                    }
                }
                
                if (conflicts.length > 0) {
                    setMassUploadState({ open: true, pendingProducts: pending, conflicts });
                } else if (pending.length > 0) {
                    await processMassUpload(pending);
                } else {
                    toast.info("No se encontraron productos válidos para importar");
                }
                
            } catch (error) {
                console.error(error);
                toast.error("Error procesando el archivo Excel");
            }
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsBinaryString(file);
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
        <div className="min-h-screen bg-[#050505] text-white relative flex justify-center isolate">
            
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-[#050505] to-[#050505] pointer-events-none" />

            <div className="w-full max-w-7xl p-4 md:p-8 relative z-10">
                {/* Navigation Bar / Return to App Center */}
            <div className="relative z-10 flex items-center justify-between mb-8">
                <button 
                    onClick={() => navigate('/')} 
                    className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-md"
                >
                    <Home size={16} /> <span className="hidden sm:inline">Volver al App Center</span>
                </button>
                {activeEmpresa && activeEmpresa !== 'Todas' && (
                    <div className="flex items-center gap-2 border bg-gray-900 border-white/10 rounded-xl px-4 py-2 shadow-md">
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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4 bg-gray-900 border-amber-500/30 text-amber-400 shadow-md">
                    <Package size={14} />
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/70">Módulo Almacenes</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight break-words">
                    Gestión de <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">Inventario</span>
                </h1>
            </div>

            {/* Tabs (Responsive horizontal scroll) */}
            <div className="relative z-10 mb-8 w-full overflow-x-auto hide-scrollbar pb-2">
                <div className="flex gap-2 p-1.5 rounded-2xl w-max bg-gray-900/90 border border-white/10 shadow-lg">
                    {[
                        { id: 'movimientos', label: 'Movimientos', icon: <ArrowRightLeft size={16} /> },
                        { id: 'balance', label: 'Balance', icon: <BarChart3 size={16} /> },
                        { id: 'productos', label: 'Productos', icon: <Package size={16} /> },
                        { id: 'categorias', label: 'Categorías', icon: <Tags size={16} /> },
                        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            id={`tab-btn-${tab.id}`}
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

            {/* Tab Contents (Soporta deslizamiento táctil / Swipe para cambiar pestañas) */}
            <div 
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative z-10 isolate [transform:translateZ(0)] touch-pan-y"
            >
                {activeTab === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Filters and Export */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 md:p-6 rounded-3xl border bg-gray-900 border-white/10 shadow-md [transform:translateZ(0)]">
                            <div className="flex flex-col sm:flex-row items-end gap-4 w-full md:w-auto">
                                <label className="flex items-center gap-3 cursor-pointer h-10 px-4 rounded-xl bg-gray-900 border border-white/10 hover:border-amber-500/50 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={isFilterActive} 
                                        onChange={(e) => setIsFilterActive(e.target.checked)}
                                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-white uppercase select-none whitespace-nowrap">Filtrar Fechas</span>
                                </label>
                                <div className="flex flex-col gap-1 w-full sm:w-auto">
                                    <label className={`text-xs font-bold uppercase transition-colors ${isFilterActive ? 'text-gray-400' : 'text-gray-600'}`}>Desde:</label>
                                    <input 
                                        type="date" 
                                        disabled={!isFilterActive}
                                        value={filtroFechaInicio}
                                        onChange={(e) => setFiltroFechaInicio(e.target.value)}
                                        className={`px-4 py-2.5 bg-gray-900 border rounded-xl text-sm font-medium outline-none w-full sm:w-auto transition-all ${isFilterActive ? 'text-white border-white/10 focus:border-amber-500' : 'text-gray-600 border-white/5 cursor-not-allowed opacity-50'}`}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 w-full sm:w-auto">
                                    <label className={`text-xs font-bold uppercase transition-colors ${isFilterActive ? 'text-gray-400' : 'text-gray-600'}`}>Hasta:</label>
                                    <input 
                                        type="date" 
                                        disabled={!isFilterActive}
                                        value={filtroFechaFin}
                                        onChange={(e) => setFiltroFechaFin(e.target.value)}
                                        className={`px-4 py-2.5 bg-gray-900 border rounded-xl text-sm font-medium outline-none w-full sm:w-auto transition-all ${isFilterActive ? 'text-white border-white/10 focus:border-amber-500' : 'text-gray-600 border-white/5 cursor-not-allowed opacity-50'}`}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleExportExcel}
                                className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                            >
                                <Download size={16} /> Exportar Excel
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            <div 
                                onClick={() => setActiveTab('productos')}
                                className="p-5 md:p-6 rounded-3xl border bg-gray-900 border-white/10 flex items-center justify-between shadow-md cursor-pointer hover:bg-gray-800 transition-colors [transform:translateZ(0)]"
                            >
                                <div>
                                    <p className="text-xs md:text-sm font-bold mb-1 text-white/50">Total Productos</p>
                                    <p className="text-3xl md:text-4xl font-black">{productos.length}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                                    <Package size={20} className="md:w-6 md:h-6" />
                                </div>
                            </div>
                            <div className="p-5 md:p-6 rounded-3xl border bg-gray-900 border-white/10 flex items-center justify-between shadow-md [transform:translateZ(0)]">
                                <div>
                                    <p className="text-xs md:text-sm font-bold mb-1 text-white/50">Entradas (Periodo)</p>
                                    <p className="text-3xl md:text-4xl font-black">{dashboardEntradas}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                                    <ArrowRightLeft size={20} className="md:w-6 md:h-6" />
                                </div>
                            </div>
                            <div className="p-5 md:p-6 rounded-3xl border bg-gray-900 border-white/10 flex items-center justify-between shadow-md sm:col-span-2 md:col-span-1 [transform:translateZ(0)]">
                                <div>
                                    <p className="text-xs md:text-sm font-bold mb-1 text-white/50">Salidas (Periodo)</p>
                                    <p className="text-3xl md:text-4xl font-black">{dashboardSalidas}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                                    <TrendingUp size={20} className="md:w-6 md:h-6 rotate-180" />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 rounded-3xl border bg-gray-900 border-white/10 shadow-md [transform:translateZ(0)]">
                            <div className="max-w-5xl mx-auto w-full">
                                <h2 className="text-base md:text-lg font-bold mb-6 flex items-center gap-2 break-words">
                                    <BarChart3 className="text-amber-500 shrink-0" />
                                    Top 5 Productos por Rotación
                                </h2>
                                <div className="h-64 md:h-96 w-full">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
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

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-6">
                            {/* Gráfica Circular de Ventas por Categoría */}
                            <div className="p-4 md:p-6 rounded-3xl border bg-gray-900 border-white/10 shadow-md [transform:translateZ(0)]">
                                <div className="w-full h-full">
                                    <h2 className="text-base md:text-lg font-bold mb-6 flex items-center gap-2 break-words">
                                        <PieChartIcon className="text-purple-500 shrink-0" />
                                        Ventas Totales por Categoría
                                    </h2>
                                    <div className="h-64 md:h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                            <PieChart>
                                                <Pie
                                                    data={getCategorySalesData()}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={65}
                                                    outerRadius={90}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                    label={renderCustomizedPieLabel}
                                                    labelLine={{ stroke: '#ffffff40', strokeWidth: 1 }}
                                                >
                                                    {getCategorySalesData().map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl">
                                                                <p className="font-bold text-white mb-1">{data.name}</p>
                                                                <p className="text-emerald-400 font-bold">Ventas: S/ {data.value.toFixed(2)}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }} />
                                                <Legend 
                                                    layout="vertical" 
                                                    verticalAlign="middle" 
                                                    align="right"
                                                    wrapperStyle={{ fontSize: '12px', right: 0 }}
                                                    iconType="circle"
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Gráfica de Tendencia de Costos */}
                            <div className="p-4 md:p-6 rounded-3xl border bg-gray-900 border-white/10 shadow-md [transform:translateZ(0)]">
                                <div className="w-full h-full">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                        <h2 className="text-base md:text-lg font-bold flex items-center gap-2 break-words">
                                            <TrendingUp className="text-emerald-500 shrink-0" />
                                            Inversión Mensual (Costo)
                                        </h2>
                                        <div className="relative w-full sm:w-64">
                                            <input 
                                                type="text" 
                                                value={chartProductSearch}
                                                onChange={e => setChartProductSearch(e.target.value)}
                                                placeholder="Buscar por código o nombre..."
                                                className="w-full px-4 py-2 bg-gray-900 border border-white/10 rounded-xl text-sm font-medium outline-none text-white focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="h-64 md:h-80 w-full">
                                        {(() => {
                                            const trend = getProductCostTrendData();
                                            if (!chartProductSearch || chartProductSearch.trim().length < 2) {
                                                return (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm text-center">
                                                        Escribe el nombre o código del producto para ver su tendencia
                                                    </div>
                                                );
                                            }
                                            if (!trend.matchedName) {
                                                return (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm text-center">
                                                        No se encontró ningún producto
                                                    </div>
                                                );
                                            }
                                            if (trend.data.length === 0) {
                                                return (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 text-sm text-center">
                                                        <span className="text-amber-500 font-bold mb-2">{trend.matchedName}</span>
                                                        No hay registros de entradas
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="w-full h-full flex flex-col">
                                                    <div className="text-center text-amber-500 font-bold text-xs mb-2">Mostrando: {trend.matchedName}</div>
                                                    <div className="flex-1">
                                                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                            <LineChart data={trend.data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                                                <XAxis dataKey="mes" stroke="#ffffff50" fontSize={12} />
                                                                <YAxis stroke="#ffffff50" fontSize={12} />
                                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                                                <Tooltip content={({ active, payload, label }) => {
                                                                    if (active && payload && payload.length) {
                                                                        return (
                                                                            <div className="p-3 bg-gray-900 border border-white/10 rounded-xl shadow-2xl">
                                                                                <p className="font-bold text-white mb-1">{label}</p>
                                                                                <p className="text-amber-500 font-bold">Inversión: S/ {payload[0].value.toFixed(2)}</p>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                }} cursor={{ stroke: '#ffffff20' }} />
                                                                <Line type="monotone" dataKey="costo" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#111827' }} activeDot={{ r: 6 }} />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'productos' && (
                    <div className="p-4 md:p-6 rounded-3xl border bg-gray-900/90 border-white/10 shadow-md">
                        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Package className="text-amber-500 shrink-0"/> Catálogo</h2>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="w-full sm:w-auto bg-blue-500 hover:bg-blue-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <Download size={16} /> Descargar Plantilla
                                </button>
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full sm:w-auto bg-purple-500 hover:bg-purple-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <Plus size={16} /> Carga Masiva
                                </button>
                                <button 
                                    onClick={handleExportProductsExcel}
                                    className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <Download size={16} /> Exportar Leyenda
                                </button>
                                <button 
                                    onClick={() => { setNewProduct({ id: null, matricula: '', nombre: '', categoria: '', precio: 0 }); setIsProductModalOpen(true); }}
                                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                                >
                                    <Plus size={16} /> Nuevo Producto
                                </button>
                            </div>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {productos.map(p => (
                                <div key={p.id} className="bg-[#12141a] p-4 rounded-2xl border border-white/10 relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-mono font-bold text-amber-500 text-sm">{p.matricula}</div>
                                        <div className="text-right">
                                            <div className="font-bold text-base text-white">S/ {p.precio?.toFixed(2) || '0.00'}</div>
                                            <div className="text-xs text-emerald-400">Venta: S/ {p.precioVenta?.toFixed(2) || '0.00'}</div>
                                        </div>
                                    </div>
                                    <div className="font-medium text-white mb-1 break-words">{p.nombre || '-'}</div>
                                    <div className="text-xs text-gray-400 mb-3">{getCategoryPathName(p.categoria)}</div>
                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                                        <button onClick={() => handleEditProduct(p)} className="p-2 bg-gray-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-white/5"><Pencil size={14} /></button>
                                        <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-gray-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors border border-white/5"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            {productos.length === 0 && (
                                <div className="py-8 text-center text-gray-500 text-sm">No hay productos registrados.</div>
                            )}
                        </div>

                        {/* Desktop View */}
                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 hidden md:block">
                            <table className="w-full min-w-[500px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-white/50">
                                        <th className="pb-3 font-semibold">Matrícula (SKU)</th>
                                        <th className="pb-3 font-semibold">Nombre</th>
                                        <th className="pb-3 font-semibold">Categoría</th>
                                        <th className="pb-3 font-semibold">Precio Base</th>
                                        <th className="pb-3 font-semibold">Precio Venta</th>
                                        <th className="pb-3 font-semibold text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.map(p => (
                                        <tr key={p.id} className="border-b last:border-0 border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="py-4 font-mono font-bold text-amber-500">{p.matricula}</td>
                                            <td className="py-4 font-medium break-words">{p.nombre}</td>
                                            <td className="py-4 text-sm">{getCategoryPathName(p.categoria)}</td>
                                            <td className="py-4 font-medium whitespace-nowrap">S/ {p.precio?.toFixed(2) || '0.00'}</td>
                                            <td className="py-4 font-medium text-emerald-400 whitespace-nowrap">S/ {p.precioVenta?.toFixed(2) || '0.00'}</td>
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
                                            <td colSpan="6" className="py-8 text-center text-gray-500">No hay productos registrados.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'categorias' && (
                    <div className="p-4 md:p-6 rounded-3xl border bg-gray-900/90 border-white/10 shadow-md">
                        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><Tags className="text-purple-500 shrink-0"/> Categorías</h2>
                            <button 
                                onClick={() => { setNewCategoria({ id: null, nombre: '', descripcion: '' }); setIsCategoriaModalOpen(true); }}
                                className="w-full md:w-auto bg-purple-500 hover:bg-purple-400 text-white px-4 py-3 md:py-2 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-colors"
                            >
                                <Plus size={16} /> Nueva Categoría
                            </button>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {getCategoryHierarchy(true).map(c => (
                                <div key={c.id} className={`bg-[#12141a] p-4 rounded-2xl border border-white/10 relative ${c.level === 2 ? 'ml-6' : c.level === 3 ? 'ml-12' : ''}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {c.hasChildren && (
                                            <button onClick={() => toggleCategory(c.id)} className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white -ml-1">
                                                <ChevronDown size={14} className={`transition-transform ${expandedCategories.includes(c.id) ? '' : '-rotate-90'}`} />
                                            </button>
                                        )}
                                        <div className="font-bold text-base text-purple-400 break-words">{c.nombre}</div>
                                    </div>
                                    <div className="text-sm text-gray-400 mb-3 break-words">{c.descripcion || 'Sin descripción'}</div>
                                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                                        <button onClick={() => handleEditCategoria(c)} className="p-2 bg-gray-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-white/5"><Pencil size={14} /></button>
                                        <button onClick={() => handleDeleteCategoria(c)} className="p-2 bg-gray-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors border border-white/5"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            {categorias.length === 0 && (
                                <div className="py-8 text-center text-gray-500 text-sm">No hay categorías registradas.</div>
                            )}
                        </div>

                        {/* Desktop View */}
                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 hidden md:block">
                            <table className="w-full min-w-[500px] text-left text-sm">
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
                    <div className="p-4 md:p-6 rounded-3xl border bg-gray-900/90 border-white/10 shadow-md">
                        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2"><ArrowRightLeft className="text-blue-500 shrink-0"/> Movimientos</h2>
                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <input 
                                    type="file" 
                                    accept=".xlsx, .xls" 
                                    style={{ display: 'none' }} 
                                    ref={movFileInputRef} 
                                    onChange={handleMovFileUpload} 
                                />
                                <button 
                                    onClick={() => movFileInputRef.current && movFileInputRef.current.click()}
                                    className="hidden md:flex w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 md:py-2 rounded-xl font-bold items-center justify-center gap-2 text-sm transition-colors"
                                    title="Cargar movimientos masivamente desde Excel"
                                >
                                    <Download size={16} className="rotate-180" /> Cargar Excel
                                </button>
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

                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {movimientos.map(m => {
                                const prod = productos.find(p => p.id === m.matriculaId);
                                return (
                                    <div key={m.id} className="bg-[#12141a] p-4 rounded-2xl border border-white/10 relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${m.tipo === 'entrada' ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' : 'bg-rose-950 text-rose-400 border-rose-500/30'}`}>{m.tipo}</span>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <div className="text-xs text-gray-400">{m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleDateString() : '...'}</div>
                                                    {m.userInitials && (
                                                        <div className="w-5 h-5 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white" title={m.userName}>
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
                                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                                            <button onClick={() => handleEditMovimiento(m)} className="p-2 bg-gray-800 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-colors border border-white/5"><Pencil size={14} /></button>
                                            <button onClick={() => setDeleteMovimientoModal({ open: true, id: m.id })} className="p-2 bg-gray-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors border border-white/5"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                            {movimientos.length === 0 && (
                                <div className="py-8 text-center text-gray-500 text-sm">No hay movimientos registrados.</div>
                            )}
                        </div>

                        {/* Desktop View */}
                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 hidden md:block">
                            <table className="w-full min-w-[600px] text-left text-sm">
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
                    <div className="p-4 md:p-6 rounded-3xl border bg-gray-900/90 border-white/10 shadow-md">
                        <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 mb-6"><BarChart3 className="text-emerald-500 shrink-0"/> Balance de Inventarios</h2>
                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {getBalanceByProduct().map(b => {
                                const minimo = Number(b.stockMinimo) || 0;
                                const isCritical = minimo > 0 && b.stock <= minimo;
                                const stockColor = b.stock < 0 ? 'text-rose-500' : isCritical ? 'text-orange-400' : b.stock === 0 ? 'text-gray-500' : 'text-emerald-400';
                                const cardBorder = isCritical ? 'border-orange-500/40' : 'border-white/10';
                                return (
                                    <div key={b.id} className={`bg-[#12141a] p-4 rounded-2xl border flex items-center justify-between relative ${cardBorder}`}>
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
                        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 hidden md:block">
                            <table className="w-full min-w-[600px] text-left text-sm">
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
            {isCategoriaModalOpen && createPortal(
                <div onClick={() => setIsCategoriaModalOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-gray-800 relative max-h-[90vh] overflow-y-auto">
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
                                <CategoryTreeSelect 
                                    categorias={categorias}
                                    value={newCategoria.parentId || ''}
                                    onChange={(val) => setNewCategoria({...newCategoria, parentId: val})}
                                    valueField="id"
                                    allowNone={true}
                                    excludeId={newCategoria.id}
                                    maxLevel={2}
                                />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                                <button type="button" onClick={() => setIsCategoriaModalOpen(false)} className="w-full sm:flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700">Cancelar</button>
                                <button type="submit" className="w-full sm:flex-1 py-3.5 rounded-xl font-bold bg-purple-500 hover:bg-purple-400 text-white transition-colors">Guardar Categoría</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {isProductModalOpen && createPortal(
                <div onClick={() => setIsProductModalOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-gray-800 relative max-h-[90vh] overflow-y-auto">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Categoría</label>
                                    <CategoryTreeSelect 
                                        categorias={categorias}
                                        value={newProduct.categoria}
                                        onChange={(val) => {
                                            let newMatricula = newProduct.matricula;
                                            if (val !== newProduct.categoria) {
                                                newMatricula = generateSKU(val);
                                            }
                                            setNewProduct({...newProduct, categoria: val, matricula: newMatricula});
                                        }}
                                        valueField="nombre"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Precio Ref.</label>
                                    <input type="number" step="0.01" value={newProduct.precio} onChange={e => setNewProduct({...newProduct, precio: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-emerald-400">Precio Venta</label>
                                    <input type="number" step="0.01" value={newProduct.precioVenta || ''} onChange={e => setNewProduct({...newProduct, precioVenta: e.target.value})} className="w-full px-4 py-3.5 rounded-xl border outline-none bg-gray-800 border-gray-700 text-white focus:border-emerald-500" />
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
                </div>,
                document.body
            )}

            {deleteProductModal.open && createPortal(
                <div onClick={() => setDeleteProductModal({ open: false, id: null })} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-sm p-6 rounded-3xl shadow-2xl bg-gray-900 border border-rose-900/50 relative">
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
                </div>,
                document.body
            )}

            {deleteMovimientoModal.open && createPortal(
                <div onClick={() => setDeleteMovimientoModal({ open: false, id: null })} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-sm p-6 rounded-3xl shadow-2xl bg-gray-900 border border-rose-900/50 relative">
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
                </div>,
                document.body
            )}

            {isMovimientoModalOpen && createPortal(
                <div onClick={() => setIsMovimientoModalOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-md p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-gray-800 relative max-h-[90vh] overflow-y-auto">
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
                </div>,
                document.body
            )}
            
            {/* Modal de Carga Masiva - Conflictos */}
            {massUploadState.open && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setMassUploadState({ open: false, pendingProducts: [], conflicts: [] })}></div>
                    <div className="bg-gray-900 border border-white/10 w-full max-w-xl rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl flex flex-col max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-amber-500">Advertencia: Productos Existentes</h3>
                        <p className="text-sm text-gray-300 mb-4">
                            Hemos detectado que {massUploadState.conflicts.length} producto(s) en tu archivo Excel ya existen en el sistema (tienen el mismo nombre y categoría).
                        </p>
                        <p className="text-sm text-gray-400 mb-6 font-bold">
                            ¿Deseas crearlos de todas maneras generando una nueva matrícula?
                        </p>

                        <div className="overflow-y-auto flex-1 mb-6 border border-white/10 rounded-xl bg-black/20 p-4 space-y-3">
                            {massUploadState.conflicts.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-white">{p.nombre}</span>
                                    <span className="text-gray-400 text-xs px-2 py-1 bg-white/5 rounded-lg">{p.categoria}</span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-white/10 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setMassUploadState({ open: false, pendingProducts: [], conflicts: [] })} 
                                className="w-full sm:flex-1 py-3.5 rounded-xl font-bold transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700"
                            >
                                Cancelar Todo
                            </button>
                            <button 
                                type="button" 
                                onClick={handleConfirmMassUpload} 
                                className="w-full sm:flex-1 py-3.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-white transition-colors"
                            >
                                Crear de todas maneras
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {movUploadState.showModal && createPortal(
                <div onClick={() => setMovUploadState(prev => ({ ...prev, showModal: false }))} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div onClick={e => e.stopPropagation()} className="w-full max-w-lg p-6 md:p-8 rounded-3xl shadow-2xl bg-gray-900 border border-amber-500/50 relative max-h-[90vh] flex flex-col">
                        <div className="flex items-center gap-3 mb-4 text-amber-500">
                            <AlertTriangle size={28} />
                            <h3 className="text-xl font-bold text-white">Duplicados Detectados</h3>
                        </div>
                        <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                            Se detectaron <strong>{movUploadState.conflicts.length}</strong> movimientos en el Excel que coinciden exactamente en Producto, Tipo y Fecha con registros ya existentes en el sistema.
                        </p>
                        
                        <div className="flex-1 overflow-y-auto min-h-[100px] mb-6 p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
                            {movUploadState.conflicts.slice(0, 5).map((c, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-gray-400">
                                    <span>{c.productName} ({c.tipo})</span>
                                    <span>Cant: {c.cantidad} | {c.excelDate.toLocaleDateString()}</span>
                                </div>
                            ))}
                            {movUploadState.conflicts.length > 5 && (
                                <div className="text-xs text-amber-500 italic mt-2">+ {movUploadState.conflicts.length - 5} más...</div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => handleConfirmMovMassUpload(false)} 
                                className="w-full py-3 rounded-xl font-bold transition-colors bg-amber-500 hover:bg-amber-400 text-black shadow-md"
                            >
                                Ignorar Duplicados y Cargar {movUploadState.pending.length} Nuevos
                            </button>
                            <button 
                                onClick={() => handleConfirmMovMassUpload(true)} 
                                className="w-full py-3 rounded-xl font-bold transition-colors bg-gray-800 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                            >
                                Forzar Carga de Todos ({movUploadState.pending.length + movUploadState.conflicts.length})
                            </button>
                            <button 
                                onClick={() => setMovUploadState({ open: false, pending: [], conflicts: [], showModal: false })} 
                                className="w-full py-3 rounded-xl font-bold transition-colors bg-transparent text-gray-500 hover:text-white"
                            >
                                Cancelar Operación
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            </div>

            {/* FAB (Floating Action Button) para Registrar Movimiento Rápidamente */}
            <button
                onClick={() => { setIsMovimientoModalOpen(true); setMovimientoSearch(''); setNewMovimiento({ id: null, tipo: 'entrada', matriculaId: '', cantidad: '', nota: '' }); }}
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] bg-amber-500 hover:bg-amber-400 text-black w-14 h-14 md:w-16 md:h-16 rounded-full shadow-[0_4px_20px_rgba(245,158,11,0.4)] flex items-center justify-center transition-all hover:scale-105 active:scale-95 group"
                title="Registrar Nuevo Movimiento"
                style={{ position: 'fixed' }}
            >
                <Plus size={28} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>

        </div>
    );
};

export default Almacenes;
