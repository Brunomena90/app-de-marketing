import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Palette, Type, Image, Layers, User, TrendingUp, 
    ChevronRight, ArrowLeft, Sparkles, Target, Rocket
} from 'lucide-react';
import AppIcon from '../../components/AppIcon';

const HUB_SECTIONS = [
    {
        id: 'identidad',
        title: 'Identidad Visual',
        description: 'Paletas de colores, tipografías, activos de marca y lineamientos visuales.',
        icon: <Palette size={32} />,
        color: 'from-violet-600 to-indigo-600',
        items: [
            { name: 'Paletas de Color', route: '/branding/paletas', icon: <Palette size={16} /> },
            { name: 'Tipografías', route: '/branding/tipografias', icon: <Type size={16} /> },
            { name: 'Activos de Marca', route: '/branding/activos', icon: <Image size={16} /> },
            { name: 'Lineamientos', route: '/branding/lineamientos', icon: <Layers size={16} /> },
        ]
    },
    {
        id: 'buyer-persona',
        title: 'Buyer Persona',
        description: 'Perfil psicológico y demográfico de tu cliente ideal.',
        icon: <User size={32} />,
        route: '/branding/buyer-persona',
        color: 'from-blue-600 to-cyan-600',
        items: []
    },
    {
        id: 'estrategias',
        title: 'Estrategias',
        description: 'Planes estratégicos y posicionamiento de marca.',
        icon: <TrendingUp size={32} />,
        route: '/branding/estrategias',
        color: 'from-purple-600 to-fuchsia-600',
        items: []
    }
];

const BrandingHub = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col relative overflow-hidden">
            {/* Glow Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
            </div>

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/')}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div className="w-px h-8 bg-white/10 mx-2" />
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center border border-violet-500/30">
                            <Sparkles size={20} className="text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Gestión Estratégica de Marca</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Panel de Control Creativo</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end mr-2">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Estado del Módulo</span>
                        <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Activo
                        </span>
                    </div>
                    <AppIcon className="w-8 h-8 opacity-50" variant="white" />
                </div>
            </header>

            {/* Content */}
            <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-8 py-12">
                <div className="mb-12">
                    <h2 className="text-3xl font-black text-white mb-2">Centro de Marca</h2>
                    <p className="text-gray-500">Selecciona un área para gestionar la identidad y estrategia.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {HUB_SECTIONS.map((section) => (
                        <div key={section.id} className="flex flex-col gap-4">
                            <button
                                onClick={() => section.route && navigate(section.route)}
                                className={`group relative text-left w-full rounded-3xl overflow-hidden border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/20 focus:outline-none ${section.route ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-90 group-hover:opacity-100 transition-opacity`} />
                                <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                                
                                <div className="relative p-8 flex flex-col h-full min-h-[320px]">
                                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 mb-6 group-hover:scale-110 transition-transform duration-500">
                                        {section.icon}
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">{section.title}</h3>
                                    <p className="text-white/70 text-sm leading-relaxed mb-6">{section.description}</p>
                                    
                                    {/* Sub-items list (CARDS INTERNAS) */}
                                    {section.items.length > 0 && (
                                        <div className="mt-4 grid grid-cols-2 gap-3 mb-10">
                                            {section.items.map((item) => (
                                                <div
                                                    key={item.name}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(item.route);
                                                    }}
                                                    className="flex flex-col items-center justify-center p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl transition-all group/item cursor-pointer text-center aspect-square"
                                                >
                                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3 group-hover/item:scale-110 group-hover/item:bg-white/20 transition-all">
                                                        {item.icon}
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/90 leading-tight">{item.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}


                                    {section.route && (
                                        <div className="mt-auto flex items-center justify-between">
                                            <span className="text-white text-xs font-bold uppercase tracking-widest">Abrir Sección</span>
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </button>
                        </div>
                    ))}

                </div>

                {/* Quick Info Card */}
                <div className="mt-16 bg-gradient-to-r from-gray-900 to-[#0d1326] border border-white/5 rounded-[2rem] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Target size={120} className="text-white" />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <h4 className="text-violet-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">Misión Estratégica</h4>
                        <p className="text-xl text-gray-300 leading-relaxed font-medium">
                            "La marca es el activo más valioso. Nuestra misión es construir identidades coherentes, auténticas y poderosas que conecten profundamente con las personas."
                        </p>
                        <div className="mt-8 flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center">
                                <Rocket size={14} className="text-violet-400" />
                             </div>
                             <span className="text-sm text-gray-500 font-medium underline underline-offset-4 decoration-violet-500/30">Artories Brand Management System</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default BrandingHub;
