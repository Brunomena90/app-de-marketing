import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

import PanelPrincipal from './finanzas/components/PanelPrincipal';
import Transacciones from './finanzas/components/Transacciones';
import Categorias from './finanzas/components/Categorias';
import Planificacion from './finanzas/components/Planificacion';
import AsistenteIA from './finanzas/components/AsistenteIA';
import Administrador from './finanzas/components/Administrador';

const Finanzas = () => {
    const { activeEmpresa } = useAuth();
    
    const [activeTab, setActiveTab] = useState('panel_principal');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data states
    const [ordenes, setOrdenes] = useState([]);
    const [deals, setDeals] = useState([]);
    const [egresos, setEgresos] = useState([]);
    const [clientesFrecuentes, setClientesFrecuentes] = useState([]);
    const [movimientosAlmacen, setMovimientosAlmacen] = useState([]);
    const [ventasDirectas, setVentasDirectas] = useState([]);
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeEmpresa) return;

        const filterByEmpresa = (docs) => activeEmpresa === 'Todas' ? docs : docs.filter(d => (d.empresa || '') === activeEmpresa);
        const unsubs = [];

        // 1. Órdenes facturadas (Ingresos confirmados)
        unsubs.push(onSnapshot(query(collection(db, 'ordenes_compra'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setOrdenes(filterByEmpresa(all));
        }));

        // 2. Deals cerrados (Ingresos por proyectos)
        unsubs.push(onSnapshot(query(collection(db, 'crm_deals'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setDeals(filterByEmpresa(all));
        }));

        // 3. Egresos (Gastos operativos)
        unsubs.push(onSnapshot(query(collection(db, 'finanzas_egresos'), orderBy('date', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setEgresos(filterByEmpresa(all));
        }));

        // 4. Ingresos recurrentes (Clientes frecuentes)
        unsubs.push(onSnapshot(query(collection(db, 'clientes_frecuentes'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setClientesFrecuentes(filterByEmpresa(all).filter(c => c.status === 'active'));
        }));

        // 5. Movimientos de Almacén (Inventario -> Ingresos/Egresos)
        unsubs.push(onSnapshot(query(collection(db, 'almacen_movimientos'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setMovimientosAlmacen(filterByEmpresa(all));
        }));

        // 6. Ventas Directas (Ingresos POS)
        unsubs.push(onSnapshot(query(collection(db, 'ventas_directas'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setVentasDirectas(filterByEmpresa(all));
        }));

        // 7. Cotizaciones (Para ingresos de servicios/proyectos)
        unsubs.push(onSnapshot(query(collection(db, 'cotizaciones'), orderBy('createdAt', 'desc')), snap => {
            const all = snap.docs.map(d => ({ ...d.data(), id: d.id }));
            setCotizaciones(filterByEmpresa(all));
            setLoading(false);
        }));

        return () => unsubs.forEach(u => u());
    }, [activeEmpresa]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#050505] text-white p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto scrollbar-hide">
            <PanelPrincipal 
                ordenes={ordenes} 
                deals={deals} 
                egresos={egresos} 
                clientesFrecuentes={clientesFrecuentes} 
                movimientosAlmacen={movimientosAlmacen}
                ventasDirectas={ventasDirectas}
                cotizaciones={cotizaciones}
            />
        </div>
    );
};

export default Finanzas;
