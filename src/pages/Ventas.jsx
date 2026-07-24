import React, { useState } from 'react';
import DirectorioEstrategico from './ventas/DirectorioEstrategico';
import CotizacionesEmitidas from './ventas/CotizacionesEmitidas';
import { LayoutDashboard, FileText } from 'lucide-react';

const Ventas = () => {
    const [activeTab, setActiveTab] = useState('directorio');

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 pb-10">
            {/* Tabs Selector */}
            <div className="flex items-center gap-4 mb-6 px-2 sm:px-4">
                <button 
                    onClick={() => setActiveTab('directorio')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        activeTab === 'directorio' 
                        ? 'bg-blue-600 text-white shadow-[0_4px_14px_0_rgb(37,99,235,0.39)]' 
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                    }`}
                >
                    <LayoutDashboard size={18} /> Directorio Estratégico
                </button>
                <button 
                    onClick={() => setActiveTab('cotizaciones')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        activeTab === 'cotizaciones' 
                        ? 'bg-emerald-600 text-white shadow-[0_4px_14px_0_rgb(5,150,105,0.39)]' 
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10'
                    }`}
                >
                    <FileText size={18} /> Cotizaciones
                </button>
            </div>
            
            {/* Contenido de la pestaña */}
            <div className="flex-1 w-full">
                {activeTab === 'directorio' && <DirectorioEstrategico />}
                {activeTab === 'cotizaciones' && <CotizacionesEmitidas />}
            </div>
        </div>
    );
};

export default Ventas;
