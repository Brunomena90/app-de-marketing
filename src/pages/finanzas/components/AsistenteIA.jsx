import React from 'react';
import { Sparkles } from 'lucide-react';

const AsistenteIA = () => {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#050505] text-white p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto scrollbar-hide w-full">
            <div className="space-y-6 max-w-7xl mx-auto pb-10 flex flex-col h-full">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    Asistente Financiero IA <Sparkles size={20} className="text-amber-400" />
                </h2>
                <p className="text-gray-400 text-sm mt-1">Consulta insights y análisis automatizados de tus finanzas.</p>
            </div>
            
            <div className="flex-1 bg-[#111520] border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[400px] shadow-xl">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/30">
                    <Sparkles size={36} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Tu Analista Virtual</h3>
                <p className="text-gray-400 max-w-md mb-8">
                    El asistente podrá analizar tus transacciones, encontrar patrones de gasto y recomendarte estrategias de ahorro en tiempo real.
                </p>
                <div className="w-full max-w-xl bg-[#0a0f1e] border border-white/5 rounded-xl p-4 flex gap-3 text-left">
                    <div className="w-10 h-10 rounded-full bg-[#1a2133] shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-[#1a2133] rounded w-3/4 animate-pulse" />
                        <div className="h-4 bg-[#1a2133] rounded w-1/2 animate-pulse" />
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default AsistenteIA;
