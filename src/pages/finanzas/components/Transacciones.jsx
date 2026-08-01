import React from 'react';
import { Plus, Search, Filter } from 'lucide-react';

const Transacciones = () => {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#050505] text-white p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto scrollbar-hide w-full">
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Transacciones</h2>
                        <p className="text-gray-400 text-sm mt-1">Gestiona todos los ingresos y egresos de la empresa.</p>
                    </div>
                    <button className="bg-[#649a4a] hover:bg-[#4a7238] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
                        <Plus size={18} /> Nueva Transacción
                    </button>
                </div>

                <div className="bg-[#111520] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar transacción..."
                                className="w-full bg-[#1a2133] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none focus:border-[#649a4a] transition-colors"
                            />
                        </div>
                        <button className="bg-[#1a2133] border border-white/10 hover:bg-[#252f48] text-gray-300 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap">
                            <Filter size={18} /> Filtros
                        </button>
                    </div>

                    <div className="p-10 text-center flex flex-col items-center justify-center min-h-[400px]">
                        <div className="w-16 h-16 bg-[#1a2133] rounded-2xl flex items-center justify-center text-gray-500 mb-4">
                            <Filter size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Sección en Construcción</h3>
                        <p className="text-gray-500 max-w-md">Pronto podrás visualizar y registrar todas las transacciones financieras desde aquí.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Transacciones;
