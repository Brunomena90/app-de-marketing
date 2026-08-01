import React, { useState, useEffect } from 'react';
import { X, Calculator, ShieldAlert, Target, Zap, Activity } from 'lucide-react';

// Tablas de Westinghouse
const westinghouseTables = {
    skill: [
        { label: "Excelente (Superskill)", value: 0.15 },
        { label: "Excelente", value: 0.11 },
        { label: "Bueno", value: 0.06 },
        { label: "Medio (Promedio)", value: 0.00 },
        { label: "Aceptable", value: -0.05 },
        { label: "Deficiente", value: -0.16 },
        { label: "Pésimo", value: -0.22 }
    ],
    effort: [
        { label: "Excesivo", value: 0.13 },
        { label: "Excelente", value: 0.10 },
        { label: "Bueno", value: 0.05 },
        { label: "Medio (Promedio)", value: 0.00 },
        { label: "Aceptable", value: -0.04 },
        { label: "Deficiente", value: -0.12 },
        { label: "Pésimo", value: -0.17 }
    ],
    conditions: [
        { label: "Ideales", value: 0.06 },
        { label: "Excelentes", value: 0.04 },
        { label: "Buenas", value: 0.02 },
        { label: "Medias (Promedio)", value: 0.00 },
        { label: "Aceptables", value: -0.03 },
        { label: "Deficientes", value: -0.07 }
    ],
    consistency: [
        { label: "Perfecta", value: 0.04 },
        { label: "Excelente", value: 0.03 },
        { label: "Buena", value: 0.01 },
        { label: "Media (Promedio)", value: 0.00 },
        { label: "Aceptable", value: -0.02 },
        { label: "Deficiente", value: -0.04 }
    ]
};

const RatingCalculatorModal = ({ isOpen, onClose, onSave, currentValoracion }) => {
    const [skill, setSkill] = useState(0);
    const [effort, setEffort] = useState(0);
    const [conditions, setConditions] = useState(0);
    const [consistency, setConsistency] = useState(0);

    // Si currentValoracion es 100, todos asumen 0 (Medio).
    useEffect(() => {
        if (isOpen) {
            setSkill(0);
            setEffort(0);
            setConditions(0);
            setConsistency(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const totalCalculado = 100 + ((skill + effort + conditions + consistency) * 100);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
                            <Calculator size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Asistente de Valoración</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Sistema Westinghouse</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Habilidad */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                                <Target size={14} className="text-blue-500"/> Habilidad
                            </label>
                            <select 
                                value={skill}
                                onChange={e => setSkill(Number(e.target.value))}
                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                            >
                                {westinghouseTables.skill.map((opt, i) => (
                                    <option key={i} value={opt.value}>{opt.label} ({(opt.value > 0 ? '+' : '') + opt.value})</option>
                                ))}
                            </select>
                        </div>

                        {/* Esfuerzo */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                                <Zap size={14} className="text-orange-500"/> Esfuerzo
                            </label>
                            <select 
                                value={effort}
                                onChange={e => setEffort(Number(e.target.value))}
                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                            >
                                {westinghouseTables.effort.map((opt, i) => (
                                    <option key={i} value={opt.value}>{opt.label} ({(opt.value > 0 ? '+' : '') + opt.value})</option>
                                ))}
                            </select>
                        </div>

                        {/* Condiciones */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                                <ShieldAlert size={14} className="text-emerald-500"/> Condiciones
                            </label>
                            <select 
                                value={conditions}
                                onChange={e => setConditions(Number(e.target.value))}
                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                            >
                                {westinghouseTables.conditions.map((opt, i) => (
                                    <option key={i} value={opt.value}>{opt.label} ({(opt.value > 0 ? '+' : '') + opt.value})</option>
                                ))}
                            </select>
                        </div>

                        {/* Consistencia */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                                <Activity size={14} className="text-purple-500"/> Consistencia
                            </label>
                            <select 
                                value={consistency}
                                onChange={e => setConsistency(Number(e.target.value))}
                                className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none"
                            >
                                {westinghouseTables.consistency.map((opt, i) => (
                                    <option key={i} value={opt.value}>{opt.label} ({(opt.value > 0 ? '+' : '') + opt.value})</option>
                                ))}
                            </select>
                        </div>

                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/40 flex justify-between items-center">
                    <div>
                        <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Valoración Calculada</span>
                        <span className="text-3xl font-black text-amber-500">{totalCalculado.toFixed(0)}%</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={() => onSave(Math.round(totalCalculado))} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg transition-colors">
                            Aplicar Valoración
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RatingCalculatorModal;
