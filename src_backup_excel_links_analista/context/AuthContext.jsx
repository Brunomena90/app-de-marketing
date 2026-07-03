import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

/* ── Helpers de rol exportados para usar en toda la app ─── */

// Los roles super usuario (nivel 1 = más alto privilegio)
export const SUPER_ROLES = [
    'superusuario_1',
    'superusuario_2',
    'superusuario_3',
    'superusuario_4',
    'superusuario_5',
];

export const SUPER_ROLE_LABELS = {
    superusuario_1: 'Super Usuario Nv.1',
    superusuario_2: 'Super Usuario Nv.2',
    superusuario_3: 'Super Usuario Nv.3',
    superusuario_4: 'Super Usuario Nv.4',
    superusuario_5: 'Super Usuario Nv.5',
};

// Empresa propietaria de los roles super usuario
export const ARTORIES_EMPRESA = 'ARTORIES - TUS HISTORIAS';

export const isSuperUser = (role) => {
    const r = (role || '').toLowerCase();
    return SUPER_ROLES.includes(r);
};

export const isSuperUser1 = (role) => {
    const r = (role || '').toLowerCase();
    return r === 'superusuario_1';
};

export const isSuperUser2 = (role) => {
    const r = (role || '').toLowerCase();
    return r === 'superusuario_2';
};

export const isSuperUserOrAdmin = (role) => {
    const r = (role || '').toLowerCase();
    return isSuperUser(r) || r === 'admin';
};

/* ─────────────────────────────────────────────────────────── */

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [activeEmpresa, setActiveEmpresa] = useState(null);
    const [activeEmpresaData, setActiveEmpresaData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Cargar sesión y empresa activa desde LocalStorage al iniciar
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('gci_user');
            const storedEmpresa = localStorage.getItem('gci_active_empresa');
            
            if (storedUser && storedUser !== "undefined" && storedUser !== "[object Object]") {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                
                // Lógica de empresa activa
                if (storedEmpresa && storedEmpresa !== "undefined") {
                    setActiveEmpresa(storedEmpresa);
                } else if (parsedUser.empresas && parsedUser.empresas.length === 1) {
                    // Si solo tiene una empresa, se autoasigna
                    setActiveEmpresa(parsedUser.empresas[0]);
                    localStorage.setItem('gci_active_empresa', parsedUser.empresas[0]);
                }
            } else if (storedUser) {
                // Si storedUser es inválido, limpiamos localStorage para no quedarnos atascados
                localStorage.removeItem('gci_user');
            }
        } catch (error) {
            console.error("Error al cargar la sesión inicial:", error);
            localStorage.removeItem('gci_user'); // Evitar bloqueo persistente
        } finally {
            setLoading(false);
        }
    }, []);

    // Login
    const login = async (email, password) => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), where('email', '==', email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) throw new Error('El correo no existe');

            const userDoc = querySnapshot.docs[0];
            const userData = { id: userDoc.id, ...userDoc.data() };

            if (userData.password !== password) throw new Error('La contraseña es incorrecta');

            const sessionUser = {
                uid: userData.id,
                name: userData.name,
                email: userData.email,
                role: userData.role,
                area: userData.area,
                areas: userData.areas || [],
                empresas: userData.empresas || [],  // empresas a las que tiene acceso
                accessibleApps: userData.accessibleApps || [], // apps a las que tiene acceso
                position: userData.position,
            };

            // Determinar empresa inicial
            if (sessionUser.empresas && sessionUser.empresas.length === 1) {
                setActiveEmpresa(sessionUser.empresas[0]);
                localStorage.setItem('gci_active_empresa', sessionUser.empresas[0]);
            } else {
                setActiveEmpresa(null);
                localStorage.removeItem('gci_active_empresa');
            }

            setUser(sessionUser);
            localStorage.setItem('gci_user', JSON.stringify(sessionUser));
            return true;

        } catch (error) {
            console.error('Login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // Logout
    const logout = () => {
        setUser(null);
        setActiveEmpresa(null);
        localStorage.removeItem('gci_user');
        localStorage.removeItem('gci_active_empresa');
        window.location.href = '/login';
    };

    // Helper para cambiar de empresa
    const changeActiveEmpresa = (empresaName) => {
        setActiveEmpresa(empresaName);
        if (empresaName) {
            localStorage.setItem('gci_active_empresa', empresaName);
        } else {
            localStorage.removeItem('gci_active_empresa');
        }
    };

    // Escuchar cambios en la empresa activa para obtener su status
    useEffect(() => {
        if (activeEmpresa && activeEmpresa !== 'Todas') {
            const q = query(collection(db, 'empresas'), where('name', '==', activeEmpresa));
            const unsub = onSnapshot(q, (snap) => {
                if (!snap.empty) {
                    setActiveEmpresaData(snap.docs[0].data());
                } else {
                    setActiveEmpresaData(null);
                }
            });
            return () => unsub();
        } else {
            setActiveEmpresaData(null);
        }
    }, [activeEmpresa]);

    // Helpers derivados del usuario actual
    const isArtoriesWorker = Array.isArray(user?.empresas) && 
        user.empresas.some(e => e.toUpperCase() === ARTORIES_EMPRESA.toUpperCase());
    const globalAccess = isSuperUser(user?.role) || isArtoriesWorker;

    const value = {
        user,
        activeEmpresa,
        loading,
        login,
        logout,
        changeActiveEmpresa,
        // Helpers de rol disponibles en el contexto
        isSuper1: isSuperUser1(user?.role),
        isSuper2: isSuperUser2(user?.role),
        isSuperUser: isSuperUser(user?.role),
        isAdmin: user?.role === 'admin' || isSuperUser(user?.role),
        isArtoriesWorker,
        hasGlobalAccess: globalAccess,
        activeEmpresaData,
        isEmpresaDisabled: activeEmpresaData?.status === 'off' && !isSuperUser(user?.role)
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#050505] flex flex-col justify-center items-center z-50">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-violet-600/20 blur-xl rounded-full animate-pulse"></div>
                    <div className="animate-spin" style={{ animationDuration: '3s' }}>
                        {/* Se usa SVG manual para no depender del import si es la causa */}
                        <svg viewBox="0 0 1061 1015" className="w-20 h-20 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)] relative z-10" fill="#FFFFFF">
                            <g>
                                <polygon points="947.88 185.39 947.88 315.11 880.53 315.11 880.53 249.7 623.19 249.7 623.19 314.55 555.81 314.55 555.81 185.39 947.88 185.39" />
                                <rect x="555.81" y="184.83" width="67.38" height=".56" />
                            </g>
                            <g>
                                <polygon points="504.99 185.68 504.99 315.4 437.6 315.4 437.6 249.97 180.29 249.97 180.29 314.84 112.91 314.84 112.91 185.68 504.99 185.68" />
                                <rect x="112.91" y="185.12" width="67.38" height=".56" />
                            </g>
                            <polygon points="947.88 699.34 947.88 829.06 623.16 829.06 623.16 829.62 555.81 829.62 555.81 699.9 623.16 699.9 623.16 764.78 880.5 764.78 880.5 699.34 947.88 699.34" />
                            <g>
                                <polygon points="504.99 699.34 504.99 829.06 112.91 829.06 112.91 699.9 180.26 699.9 180.26 764.75 437.6 764.75 437.6 699.34 504.99 699.34" />
                                <rect x="112.91" y="829.06" width="67.35" height=".56" />
                            </g>
                        </svg>
                    </div>
                </div>
                <h1 className="text-white font-black tracking-[0.25em] text-sm uppercase opacity-80 mt-2">
                    Artories<span className="text-violet-500 font-normal">.</span>
                </h1>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
