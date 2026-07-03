/**
 * Configuración de los módulos principales de ARTORIES Management Suite.
 * Se utiliza para:
 * 1. Renderizar el Centro de Aplicaciones (AppCenter).
 * 2. Gestionar el acceso por usuario en NewUserModal.
 */
export const APP_MODULES = [
    {
        id: 'marketing',
        name: 'Marketing',
        label: 'Módulo de Marketing',
        description: 'Gestión completa de solicitudes, campañas, contenido digital y comunicación creativa.',
        route: '/dashboard',
        badge: 'Contenido & Creatividad',
    },
    {
        id: 'ventas',
        name: 'Ventas',
        label: 'Módulo de Ventas',
        description: 'Control de cotizaciones, órdenes de compra y CRM integrado para gestión comercial.',
        route: '/ventas',
        badge: 'Comercial & Negocios',
    },
    {
        id: 'finanzas',
        name: 'Finanzas',
        label: 'Módulo de Finanzas',
        description: 'Gestión de ingresos, egresos, flujo de caja y cuentas por cobrar/pagar.',
        route: '/finanzas',
        badge: 'Gestión Financiera',
    },
    {
        id: 'workflow-ai',
        name: 'Artories IA',
        label: 'Artories IA',
        description: 'Asistente de inteligencia artificial impulsado por Gemini.',
        route: '/workflow-ai',
        badge: 'Inteligencia & Análisis',
    },
    {
        id: 'branding',
        name: 'Marca',
        label: 'Gestión Estratégica de Marca',
        description: 'Decisiones de marca, estrategias de posicionamiento, identidad visual.',
        route: '/branding',
        badge: 'Estrategia & Marca',
    },
    {
        id: 'empresas',
        name: 'Empresas',
        label: 'Gestión Empresarial',
        description: 'Administra las empresas, sus áreas operativas y los usuarios con acceso al sistema.',
        route: '/empresas',
        badge: 'Administración',
    },
    {
        id: 'almacenes',
        name: 'Almacenes',
        label: 'Módulo de Almacenes',
        description: 'Gestión de inventario, productos, ingresos y salidas, y balances.',
        route: '/almacenes',
        badge: 'Inventario & Logística',
    },
];
