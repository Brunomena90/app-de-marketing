import React, { useState, useEffect } from 'react';
import { X, Calculator, User, AlertTriangle, Eye, Activity, Box } from 'lucide-react';

const AllowanceCalculatorModal = ({ isOpen, onClose, onSave }) => {
    // Constantes OIT
    const [genero, setGenero] = useState('Hombre'); // Hombre 5%, Mujer 7%
    const fatigaBasica = 4; // Fijo 4%

    // Tolerancias variables (OIT)
    const [postura, setPostura] = useState(0); 
    // Sentado = 0, De pie = 2, Incomoda = 2, Muy incomoda = 7
    
    const [fuerza, setFuerza] = useState(0); 
    // Peso levantado. Ej: 2.5kg = 1, 5kg = 2, 10kg = 3, 15kg = 5, 20kg = 7, etc.
    
    const [iluminacion, setIluminacion] = useState(0);
    // Ligeramente por debajo = 0, Bastante por debajo = 2, Insuficiente = 5
    
    const [calidadAire, setCalidadAire] = useState(0);
    // Bien ventilado = 0, Pobremente ventilado = 5, Polvo/Gases = 10
    
    const [tensionVisual, setTensionVisual] = useState(0);
    // Normal = 0, Cierta precisión = 2, Gran precisión = 5
    
    const [tensionMental, setTensionMental] = useState(0);
    // Proceso sencillo = 0, Complejo/Atención = 4, Muy complejo = 8
    
    const [monotonia, setMonotonia] = useState(0);
    // Bajo = 0, Medio = 1, Alto = 4

    useEffect(() => {
        if (isOpen) {
            setGenero('Hombre');
            setPostura(0);
            setFuerza(0);
            setIluminacion(0);
            setCalidadAire(0);
            setTensionVisual(0);
            setTensionMental(0);
            setMonotonia(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const necesidadesPersonales = genero === 'Hombre' ? 5 : 7;
    const demorasEspeciales = postura + fuerza + iluminacion + calidadAire + tensionVisual + tensionMental + monotonia;
    const totalSuplementos = necesidadesPersonales + fatigaBasica + demorasEspeciales;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg">
                            <Calculator size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Asistente de Suplementos</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Tabla de Tolerancias OIT</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* CONSTANTES */}
                        <div>
                            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-4 border-b border-emerald-500/20 pb-2">
                                Suplementos Constantes
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        <User size={14} /> Género del Operador
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="genero" value="Hombre" checked={genero === 'Hombre'} onChange={() => setGenero('Hombre')} className="accent-emerald-500" />
                                            <span className="text-sm dark:text-white">Hombre (5%)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="genero" value="Mujer" checked={genero === 'Mujer'} onChange={() => setGenero('Mujer')} className="accent-emerald-500" />
                                            <span className="text-sm dark:text-white">Mujer (7%)</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Fatiga Básica Fija: <strong className="text-gray-900 dark:text-white">4%</strong> (Estándar OIT para todos los trabajos).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* VARIABLES */}
                        <div>
                            <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-4 border-b border-emerald-500/20 pb-2">
                                Suplementos Variables
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Postura Anormal
                                    </label>
                                    <select value={postura} onChange={e => setPostura(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none">
                                        <option value={0}>Sentado (0%)</option>
                                        <option value={2}>De pie o Incomoda (2%)</option>
                                        <option value={7}>Muy incómoda / Inclinado (7%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Levantamiento de Peso
                                    </label>
                                    <select value={fuerza} onChange={e => setFuerza(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none">
                                        <option value={0}>Sin peso considerable (0%)</option>
                                        <option value={1}>Ligero ~2.5kg (1%)</option>
                                        <option value={2}>Medio ~5kg (2%)</option>
                                        <option value={3}>Pesado ~10kg (3%)</option>
                                        <option value={5}>Muy pesado ~15kg (5%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Calidad del Aire / Condiciones
                                    </label>
                                    <select value={calidadAire} onChange={e => setCalidadAire(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none">
                                        <option value={0}>Bien ventilado / Fresco (0%)</option>
                                        <option value={5}>Mala ventilación (5%)</option>
                                        <option value={10}>Gases, polvo tóxico (10%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                        Tensión Visual o Mental
                                    </label>
                                    <select value={tensionVisual} onChange={e => setTensionVisual(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white outline-none">
                                        <option value={0}>Trabajo normal (0%)</option>
                                        <option value={2}>Cierta atención y precisión (2%)</option>
                                        <option value={5}>Mucha precisión constante (5%)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/40 flex justify-between items-center shrink-0">
                    <div className="flex gap-6">
                        <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Personales</span>
                            <span className="text-xl font-bold dark:text-white">{necesidadesPersonales}%</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Fatiga</span>
                            <span className="text-xl font-bold dark:text-white">{fatigaBasica}%</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Especiales</span>
                            <span className="text-xl font-bold dark:text-white">{demorasEspeciales}%</span>
                        </div>
                        <div className="border-l border-gray-300 dark:border-white/10 pl-6">
                            <span className="text-xs font-bold text-emerald-600 uppercase block mb-1">Total OIT</span>
                            <span className="text-3xl font-black text-emerald-500">{totalSuplementos}%</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={() => onSave(necesidadesPersonales, fatigaBasica, demorasEspeciales)} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg transition-colors">
                            Aplicar Suplementos
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllowanceCalculatorModal;
