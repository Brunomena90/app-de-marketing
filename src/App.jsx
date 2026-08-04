import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RequestProvider } from './context/RequestContext';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import AppIcon from './components/AppIcon'; // IMPORT NEW ISOTYPE
import PWAInstallPrompt from './components/PWAInstallPrompt';

// --- PWA y Optimización: Carga Perezosa (Lazy Loading) de Páginas ---
// Esto divide el código en fragmentos (chunks) más pequeños, haciendo que la carga inicial sea ultrarrápida.
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Requests = lazy(() => import('./pages/Requests'));
const RequestDetailPage = lazy(() => import('./pages/RequestDetailPage'));
const Requerimientos = lazy(() => import('./pages/marketing/Requerimientos'));
const RequerimientoDetail = lazy(() => import('./pages/marketing/RequerimientoDetail'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail'));
const CuadroContenidos = lazy(() => import('./pages/marketing/CuadroContenidos'));
const Users = lazy(() => import('./pages/Users'));
const Empresas = lazy(() => import('./pages/Empresas'));
const CuadernosPage = lazy(() => import('./pages/CuadernosPage'));
const CuadernoDetailPage = lazy(() => import('./pages/CuadernoDetailPage'));
const LinksPage = lazy(() => import('./pages/LinksPage'));
const FuncionIA = lazy(() => import('./pages/marketing/FuncionIA'));
const AppCenter = lazy(() => import('./pages/AppCenter'));
const ContentCalendar = lazy(() => import('./pages/ContentCalendar'));
const Ventas = lazy(() => import('./pages/Ventas'));
const PorFacturar = lazy(() => import('./pages/ventas/PorFacturar'));
const VentasDirectas = lazy(() => import('./pages/ventas/VentasDirectas'));
const CotizacionesEmitidas = lazy(() => import('./pages/ventas/CotizacionesEmitidas'));
const Facturacion = lazy(() => import('./pages/ventas/Facturacion'));
const OrdenesCompraVentas = lazy(() => import('./pages/ventas/OrdenesCompraVentas'));
const Crm = lazy(() => import('./pages/ventas/Crm'));
const ClientesFrecuentes = lazy(() => import('./pages/ventas/ClientesFrecuentes'));
const Finanzas = lazy(() => import('./pages/Finanzas'));
const CuentasPorCobrar = lazy(() => import('./pages/finanzas/CuentasPorCobrar'));
const Egresos = lazy(() => import('./pages/finanzas/Egresos'));
const CotizacionesRecibidas = lazy(() => import('./pages/finanzas/CotizacionesRecibidas'));

const Portafolios = lazy(() => import('./pages/portafolios/Portafolios'));
const PortafolioDetail = lazy(() => import('./pages/portafolios/PortafolioDetail'));
const Transacciones = lazy(() => import('./pages/finanzas/components/Transacciones'));
const Categorias = lazy(() => import('./pages/finanzas/components/Categorias'));
const Planificacion = lazy(() => import('./pages/finanzas/components/Planificacion'));
const AsistenteIA = lazy(() => import('./pages/finanzas/components/AsistenteIA'));
const Administrador = lazy(() => import('./pages/finanzas/components/Administrador'));

const WorkFlowAIDashboard = lazy(() => import('./pages/workflow-ai/WorkFlowAIDashboard'));
const Almacenes = lazy(() => import('./pages/almacenes/Almacenes'));
const ProcesosDashboard = lazy(() => import('./pages/procesos/ProcesosDashboard'));
const ProcesoDetail = lazy(() => import('./pages/procesos/ProcesoDetail'));
const ProcesosDashboardMetrics = lazy(() => import('./pages/procesos/ProcesosDashboardMetrics'));
const EstudioTiempos = lazy(() => import('./pages/procesos/EstudioTiempos'));

const Paletas = lazy(() => import('./pages/branding/Paletas'));
const Tipografias = lazy(() => import('./pages/branding/Tipografias'));
const Activos = lazy(() => import('./pages/branding/Activos'));
const Lineamientos = lazy(() => import('./pages/branding/Lineamientos'));
const BuyerPersona = lazy(() => import('./pages/branding/BuyerPersona'));
const Estrategias = lazy(() => import('./pages/branding/Estrategias'));
const BrandingHub = lazy(() => import('./pages/branding/BrandingHub'));
const PublicSurvey = lazy(() => import('./pages/PublicSurvey'));
const MediaHub = lazy(() => import('./pages/media-suite/MediaHub'));
const PhotoEditor = lazy(() => import('./pages/media-suite/PhotoEditor'));
const DesignEditor = lazy(() => import('./pages/media-suite/DesignEditor'));
const AudioEditor = lazy(() => import('./pages/media-suite/AudioEditor'));
const VideoEditor = lazy(() => import('./pages/media-suite/VideoEditor'));
const PdfEditor = lazy(() => import('./pages/media-suite/PdfEditor'));
const FileConverter = lazy(() => import('./pages/media-suite/FileConverter'));
const PrivateRoute = ({ children }) => {
    const { user, activeEmpresa, loading } = useAuth();
    if (loading) return <FallbackLoader />;
    if (!user) return <Navigate to="/login" />;
    
    // Si no hay empresa activa seleccionada y llegamos aquí (fuera del AppCenter),
    // forzamos a que vuelva al AppCenter para elegir una empresa primero.
    if (!activeEmpresa) return <Navigate to="/" />;
    
    return <Layout>{children}</Layout>;
};

// Ruta privada exclusiva para Branding (Bloquea Vista Global)
const PrivateRouteBranding = ({ children }) => {
    const { user, activeEmpresa, loading } = useAuth();
    if (loading) return <FallbackLoader />;
    if (!user) return <Navigate to="/login" />;
    
    // Si es Vista Global o no hay empresa, no permitimos branding
    if (!activeEmpresa || activeEmpresa === 'Todas') return <Navigate to="/" />;
    
    return <Layout>{children}</Layout>;
};

// Ruta para Branding sin Sidebar y con bloqueo de Vista Global
const PrivateRouteBrandingNoLayout = ({ children }) => {
    const { user, activeEmpresa, loading } = useAuth();
    if (loading) return <FallbackLoader />;
    if (!user) return <Navigate to="/login" />;
    if (!activeEmpresa || activeEmpresa === 'Todas') return <Navigate to="/" />;
    return children;
};

// Ruta privada sin sidebar (para el App Center)
const PrivateRouteNoLayout = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <FallbackLoader />;
    return user ? children : <Navigate to="/login" />;
};

// Ruta privada con layout pero sin padding en el main (para chat full-screen)
const PrivateRouteFullHeight = ({ children }) => {
    const { user, activeEmpresa, loading } = useAuth();
    if (loading) return <FallbackLoader />;
    if (!user) return <Navigate to="/login" />;
    if (!activeEmpresa) return <Navigate to="/" />;
    return <Layout noPadding>{children}</Layout>;
};

// Loader para la navegación perezosa usando el ISOTIPO
const FallbackLoader = () => (
    <div className="fixed inset-0 bg-[#050505] flex flex-col justify-center items-center z-50">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-violet-600/20 blur-xl rounded-full animate-pulse"></div>
            <div className="animate-spin" style={{ animationDuration: '3s' }}>
                <AppIcon className="w-20 h-20 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)] relative z-10" variant="white" />
            </div>
        </div>
        <h1 className="text-white font-black tracking-[0.25em] text-sm uppercase opacity-80 mt-2">
            Artories<span className="text-violet-500 font-normal">.</span>
        </h1>
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-2 font-bold animate-pulse">Iniciando Ecosistema...</p>
    </div>
);

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
const Router = isElectron ? HashRouter : BrowserRouter;

const FileLaunchHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const handleFile = async (fileOrBuffer, fileName) => {
            window.externalFileToOpen = { data: fileOrBuffer, name: fileName };
            navigate('/media-suite/pdf');
        };

        // PWA Launch Queue
        if ('launchQueue' in window) {
            window.launchQueue.setConsumer(async (launchParams) => {
                if (!launchParams.files.length) return;
                const fileHandle = launchParams.files[0];
                const file = await fileHandle.getFile();
                handleFile(file, file.name);
            });
        }

        // Electron IPC
        if (window.electronAPI && window.electronAPI.onExternalFileOpen) {
            const cleanup = window.electronAPI.onExternalFileOpen(async (filePath) => {
                if (filePath && window.electronAPI.readFile) {
                    const result = await window.electronAPI.readFile(filePath);
                    if (result.success) {
                        handleFile(result.buffer, result.name);
                    }
                }
            });
            return cleanup;
        }
    }, [navigate]);

    return null;
};

function App() {
    return (
        <AuthProvider>
            <RequestProvider>
                <Router>
                    <FileLaunchHandler />
                    <Suspense fallback={<FallbackLoader />}>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/p/:empresaId" element={<Portafolios publicView={true} />} />
                            <Route path="/encuesta/:id" element={<PublicSurvey />} />
                            <Route path="/" element={<PrivateRouteNoLayout><AppCenter /></PrivateRouteNoLayout>} />
                            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                            <Route path="/solicitudes" element={<PrivateRoute><Requests /></PrivateRoute>} />
                            <Route path="/solicitudes/:id" element={<PrivateRoute><RequestDetailPage /></PrivateRoute>} />
                            <Route path="/requerimientos" element={<PrivateRoute><Requerimientos /></PrivateRoute>} />
                            <Route path="/requerimientos/:id" element={<PrivateRoute><RequerimientoDetail /></PrivateRoute>} />
                            <Route path="/campanas" element={<PrivateRoute><Campaigns /></PrivateRoute>} />
                            <Route path="/campanas/:id" element={<PrivateRoute><CampaignDetail /></PrivateRoute>} />
                            <Route path="/cuadro-contenidos" element={<PrivateRoute><CuadroContenidos /></PrivateRoute>} />
                            <Route path="/usuarios" element={<PrivateRoute><Users /></PrivateRoute>} />
                            <Route path="/empresas" element={<PrivateRoute><Empresas /></PrivateRoute>} />
                            <Route path="/cuadernos" element={<PrivateRoute><CuadernosPage /></PrivateRoute>} />
                            <Route path="/cuadernos/:id" element={<PrivateRoute><CuadernoDetailPage /></PrivateRoute>} />
                            <Route path="/links" element={<PrivateRoute><LinksPage /></PrivateRoute>} />
                            <Route path="/calendario-contenidos" element={<PrivateRoute><ContentCalendar /></PrivateRoute>} />
                            <Route path="/funcion-ia" element={<PrivateRouteFullHeight><FuncionIA /></PrivateRouteFullHeight>} />
                            <Route path="/ventas" element={<PrivateRoute><Ventas /></PrivateRoute>} />
                            <Route path="/ventas/cotizaciones-emitidas" element={<PrivateRoute><CotizacionesEmitidas /></PrivateRoute>} />
                            <Route path="/ventas/por-facturar" element={<PrivateRoute><PorFacturar /></PrivateRoute>} />
                            <Route path="/ventas/facturacion" element={<PrivateRoute><Facturacion /></PrivateRoute>} />
                            <Route path="/ventas/directas" element={<PrivateRoute><VentasDirectas /></PrivateRoute>} />
                            <Route path="/ventas/ordenes-compra" element={<PrivateRoute><OrdenesCompraVentas /></PrivateRoute>} />
                            <Route path="/ventas/crm" element={<PrivateRoute><Crm /></PrivateRoute>} />
                            <Route path="/ventas/clientes-frecuentes" element={<PrivateRoute><ClientesFrecuentes /></PrivateRoute>} />
                            <Route path="/finanzas" element={<PrivateRouteFullHeight><Finanzas /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/cuentas-cobrar" element={<PrivateRouteFullHeight><CuentasPorCobrar /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/egresos" element={<PrivateRouteFullHeight><Egresos /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/cotizaciones-recibidas" element={<PrivateRouteFullHeight><CotizacionesRecibidas /></PrivateRouteFullHeight>} />
                            
                            <Route path="/finanzas/transacciones" element={<PrivateRouteFullHeight><Transacciones /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/categorias" element={<PrivateRouteFullHeight><Categorias /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/planificacion" element={<PrivateRouteFullHeight><Planificacion /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/asistente-ia" element={<PrivateRouteFullHeight><AsistenteIA /></PrivateRouteFullHeight>} />
                            <Route path="/finanzas/administrador" element={<PrivateRouteFullHeight><Administrador /></PrivateRouteFullHeight>} />

                            <Route path="/workflow-ai" element={<PrivateRouteNoLayout><WorkFlowAIDashboard /></PrivateRouteNoLayout>} />
                            <Route path="/almacenes" element={<PrivateRouteNoLayout><Almacenes /></PrivateRouteNoLayout>} />
                            <Route path="/procesos" element={<PrivateRoute><ProcesosDashboard /></PrivateRoute>} />
                            <Route path="/procesos/dashboard" element={<PrivateRoute><ProcesosDashboardMetrics /></PrivateRoute>} />
                            <Route path="/procesos/estudio-tiempos" element={<PrivateRoute><EstudioTiempos /></PrivateRoute>} />
                            <Route path="/procesos/:id/estudio-tiempos/:fase/:taskId" element={<PrivateRoute><EstudioTiempos /></PrivateRoute>} />
                            <Route path="/procesos/:id" element={<PrivateRoute><ProcesoDetail /></PrivateRoute>} />
                            <Route path="/branding" element={<PrivateRouteBrandingNoLayout><BrandingHub /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/branding/paletas" element={<PrivateRouteBrandingNoLayout><Paletas /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/branding/tipografias" element={<PrivateRouteBrandingNoLayout><Tipografias /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/branding/activos" element={<PrivateRouteBrandingNoLayout><Activos /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/branding/lineamientos" element={<PrivateRouteBrandingNoLayout><Lineamientos /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/branding/buyer-persona" element={<PrivateRouteBrandingNoLayout><BuyerPersona /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/branding/estrategias" element={<PrivateRouteBrandingNoLayout><Estrategias /></PrivateRouteBrandingNoLayout>} />
                            <Route path="/media-suite" element={<PrivateRouteNoLayout><MediaHub /></PrivateRouteNoLayout>} />
                            <Route path="/media-suite/photo" element={<PrivateRouteNoLayout><PhotoEditor /></PrivateRouteNoLayout>} />
                            <Route path="/media-suite/design" element={<PrivateRouteNoLayout><DesignEditor /></PrivateRouteNoLayout>} />
                            <Route path="/media-suite/audio" element={<PrivateRouteNoLayout><AudioEditor /></PrivateRouteNoLayout>} />
                            <Route path="/media-suite/video" element={<PrivateRouteNoLayout><VideoEditor /></PrivateRouteNoLayout>} />
                            <Route path="/media-suite/pdf" element={<PrivateRouteNoLayout><PdfEditor /></PrivateRouteNoLayout>} />
                            <Route path="/media-suite/converter" element={<PrivateRouteNoLayout><FileConverter /></PrivateRouteNoLayout>} />
                            
                            <Route path="/portafolios" element={<PrivateRouteNoLayout><Portafolios /></PrivateRouteNoLayout>} />
                            <Route path="/portafolios/:id" element={<PrivateRouteNoLayout><PortafolioDetail /></PrivateRouteNoLayout>} />
                            
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                    <PWAInstallPrompt />
                    <Toaster position="top-right" richColors />
                </Router>
            </RequestProvider>
        </AuthProvider>
    );
}

export default App;

