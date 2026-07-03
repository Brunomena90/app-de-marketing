import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const RequestContext = createContext();
export const useRequests = () => useContext(RequestContext);

export const RequestProvider = ({ children }) => {
    const { activeEmpresa, user } = useAuth();
    const [allRequests, setAllRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "solicitudes_contenido"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            setAllRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Aislamiento de datos en memoria (previene errores de índices en DB)
    const requests = useMemo(() => {
        return allRequests.filter(req => {
            // 1. Filtrado por Empresa
            if (activeEmpresa && activeEmpresa !== 'Todas') {
                const reqEmpresa = req.empresa || 'GRUCOIN'; // Fallback a empresa raíz para datos antiguos
                if (reqEmpresa !== activeEmpresa) return false;
            }

            // 2. Filtrado por Rol y Área
            // "jefe" y "solicitante" solo ven solicitudes de su área
            const userRole = user?.role?.toLowerCase() || '';
            const isAdminOrSuper = userRole === 'admin' || userRole.startsWith('superusuario');
            const isRestrictedRole = userRole === 'jefe';
            
            // Si es Super o Admin, ve todo lo de la empresa seleccionada
            if (isAdminOrSuper) return true;

            if (isRestrictedRole) {
                // Obtenemos todas las áreas a las que el usuario tiene acceso
                const accessibleAreas = [
                    ...(user.area ? [user.area.toLowerCase()] : []),
                    ...(Array.isArray(user.areas) ? user.areas.map(a => a.toLowerCase()) : [])
                ];

                if (req.area && accessibleAreas.includes(req.area.toLowerCase())) {
                    return true;
                }
                
                // Si el rol es restringido y no hay coincidencia de área, no ve la solicitud
                return false;
            }

            // Para otros roles (como solicitante), por ahora ven lo suyo o lo de su empresa
            // Si quieres restringir 'solicitante' a solo ver lo que ellos crearon, añadir aquí:
            // if (userRole === 'solicitante' && req.applicantId !== user.uid) return false;

            return true;
        });
    }, [allRequests, activeEmpresa, user]);

    return (
        <RequestContext.Provider value={{ requests, loading }}>
            {children}
        </RequestContext.Provider>
    );
};
