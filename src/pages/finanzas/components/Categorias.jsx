import React from 'react';
import { FolderPlus } from 'lucide-react';

const Categorias = () => {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-[#050505] text-white p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto scrollbar-hide w-full">
            <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Categorías</h2>
                    <p className="text-gray-400 text-sm mt-1">Organiza tus transacciones por categorías de ingreso y egreso.</p>
                </div>
                <button className="bg-[#649a4a] hover:bg-[#4a7238] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
                    <FolderPlus size={18} /> Nueva Categoría
                </button>
            </div>
            
            <div className="bg-[#111520] border border-white/5 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-[400px] shadow-xl">
                <div className="w-16 h-16 bg-[#1a2133] rounded-2xl flex items-center justify-center text-gray-500 mb-4">
                    <FolderPlus size={32} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Sección en Construcción</h3>
                <p className="text-gray-500 max-w-md">Pronto podrás estructurar y jerarquizar tus categorías financieras aquí.</p>
            </div>
            </div>
        </div>
    );
};

export default Categorias;
