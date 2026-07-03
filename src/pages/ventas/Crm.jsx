import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { UserCheck, DollarSign, Briefcase, TrendingUp, GripVertical, AlertCircle, Plus, X, Save, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

// Define the custom stages for the pipeline (Dark Mode)
const PIPELINE_STAGES = [
    { id: 'prospeccion', title: 'Prospección', probability: 0.1, color: 'bg-white/[0.02]', borderColor: 'border-white/10', textColor: 'text-white/70', accent: 'bg-white/20' },
    { id: 'calificacion', title: 'Calificación', probability: 0.3, color: 'bg-blue-500/5', borderColor: 'border-blue-500/20', textColor: 'text-blue-400', accent: 'bg-blue-500' },
    { id: 'propuesta', title: 'Propuesta', probability: 0.6, color: 'bg-amber-500/5', borderColor: 'border-amber-500/20', textColor: 'text-amber-400', accent: 'bg-amber-500' },
    { id: 'cerrado', title: 'Cerrado', probability: 1.0, color: 'bg-emerald-500/5', borderColor: 'border-emerald-500/20', textColor: 'text-emerald-400', accent: 'bg-emerald-500' }
];

// --- New Deal Modal (Dark Mode) ---
const NewDealModal = ({ isOpen, onClose, onSave, initialStage }) => {
    const [form, setForm] = useState({ title: '', company: '', amount: '' });

    useEffect(() => {
        if (isOpen) setForm({ title: '', company: '', amount: '' });
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.company.trim() || !form.amount) {
            toast.error('Completa todos los campos');
            return;
        }
        onSave({ ...form, amount: parseFloat(form.amount), stageId: initialStage });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-[#111] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <h2 className="text-2xl font-black text-white">Nuevo Trato</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-all"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Título del Trato</label>
                        <input
                            autoFocus type="text" value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="Ej: Implementación ERP"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Empresa / Cliente</label>
                        <input
                            type="text" value={form.company}
                            onChange={e => setForm({ ...form, company: e.target.value })}
                            placeholder="Ej: TechCorp SA"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Monto (S/.)</label>
                        <input
                            type="number" min="0" value={form.amount}
                            onChange={e => setForm({ ...form, amount: e.target.value })}
                            placeholder="Ej: 15000"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 text-white/50 font-bold rounded-xl hover:bg-white/5 hover:text-white transition-all text-sm border border-white/5">Cancelar</button>
                        <button type="submit" className="flex-1 py-3.5 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                            <Save size={16} /> Guardar Trato
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Deal Card Inner (Dark Mode) ---
const DealCardInner = ({ deal, isDragging, onDelete }) => {
    const stage = PIPELINE_STAGES.find(s => s.id === deal.stageId);
    const expectedValue = deal.amount * (stage?.probability || 0);

    return (
        <div className={`p-4 rounded-2xl border bg-[#151515] relative group transition-all duration-300 w-full text-left flex flex-col gap-2 ${
            isDragging ? 'shadow-2xl border-emerald-500/50 rotate-2 scale-105 z-50 opacity-90' : 'shadow-lg border-white/5 hover:border-white/20'
        }`}>
            <div className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl ${stage?.accent || 'bg-white/20'} opacity-50 group-hover:opacity-100 transition-opacity`} />
            
            <div className="flex justify-between items-start pl-2">
                <div className="font-bold text-white text-sm leading-tight group-hover:text-emerald-400 transition-colors pr-6">
                    {deal.title}
                </div>
                <div className="flex items-center gap-1 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-[#151515]/80 backdrop-blur-sm rounded-lg p-0.5">
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); onDelete(deal.id); }}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                    >
                        <X size={14} />
                    </button>
                    <button className="text-white/30 hover:text-white cursor-grab active:cursor-grabbing p-1.5 hover:bg-white/5 rounded-md">
                        <GripVertical size={16} />
                    </button>
                </div>
            </div>
            <div className="text-[11px] text-white/50 flex items-center gap-1.5 font-bold pl-2 uppercase tracking-wider">
                <Briefcase size={10} className="text-white/30"/> {deal.company}
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-2 pl-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-white/40 font-medium">Monto:</span>
                    <span className="font-bold text-white/90">S/. {deal.amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-lg">
                    <span className="text-emerald-400/80 font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider">
                        <TrendingUp size={10} /> VE:
                    </span>
                    <span className="font-black text-emerald-400">S/. {expectedValue.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

// --- Draggable Wrapper ---
const DraggableDealCard = ({ deal, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: deal.id,
        data: deal,
    });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}
            className={`cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'opacity-50' : ''}`}
        >
            <DealCardInner deal={deal} isDragging={isDragging} onDelete={onDelete} />
        </div>
    );
};

// --- Pipeline Stage Column (Dark Mode) ---
const PipelineStageColumn = ({ stage, deals, onAddDeal, onDelete }) => {
    const { isOver, setNodeRef } = useDroppable({ id: stage.id });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col min-w-[300px] w-[300px] rounded-3xl border transition-all duration-300 relative overflow-hidden ${stage.color} ${
                isOver ? `ring-1 ring-${stage.textColor.split('-')[1]}-500 bg-white/[0.04]` : stage.borderColor
            }`}
        >
            {/* Resplandor superior sutil */}
            <div className={`absolute top-0 left-0 w-full h-1 ${stage.accent} opacity-50`} />

            <div className={`p-5 border-b ${stage.borderColor} flex justify-between items-center bg-black/20`}>
                <div className="flex flex-col">
                    <h3 className={`font-black text-sm uppercase tracking-widest ${stage.textColor}`}>{stage.title}</h3>
                    <span className="text-[10px] font-bold opacity-50 mt-1 uppercase tracking-widest text-white/50">Prob: {stage.probability * 100}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black bg-black/40 border ${stage.borderColor} ${stage.textColor}`}>
                        {deals.length}
                    </div>
                    <button
                        onClick={() => onAddDeal(stage.id)}
                        className={`w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:bg-${stage.textColor.split('-')[1]}-500/20 hover:text-${stage.textColor.split('-')[1]}-400 hover:border-${stage.textColor.split('-')[1]}-500/30 transition-all`}
                        title={`Añadir trato en ${stage.title}`}
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            <div className="p-3 flex-1 flex flex-col gap-3 min-h-[200px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                {deals.map(deal => (
                    <DraggableDealCard key={deal.id} deal={deal} onDelete={onDelete} />
                ))}
                {deals.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-xs font-bold uppercase tracking-widest border border-dashed border-white/20 rounded-2xl m-2 min-h-[100px] bg-white/[0.01]">
                        Soltar aquí
                    </div>
                )}
            </div>

            {/* Stage Totals Footer */}
            <div className={`p-4 border-t ${stage.borderColor} rounded-b-3xl mt-auto bg-black/20`}>
                <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/40 uppercase tracking-widest text-[10px]">Total Etapa:</span>
                    <span className={`font-black ${stage.textColor}`}>
                        S/. {deals.reduce((sum, d) => sum + (d.amount || 0), 0).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
    );
};

// --- Main CRM Component (Dark Mode) ---
const Crm = () => {
    const { activeEmpresa, user } = useAuth();
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState(null);
    const [newDealModal, setNewDealModal] = useState({ open: false, stageId: 'prospeccion' });

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    // --- Cargar tratos desde Firestore filtrados por empresa ---
    useEffect(() => {
        if (!activeEmpresa) return;

        setLoading(true);
        const q = query(collection(db, 'crm_deals'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Filtrado en cliente por empresa
            const filtered = activeEmpresa === 'Todas'
                ? all
                : all.filter(d => (d.empresa || '') === activeEmpresa);
            setDeals(filtered);
            setLoading(false);
        }, (err) => {
            console.error('Error CRM:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [activeEmpresa]);

    // --- Añadir Trato ---
    const handleAddDeal = async (dealData) => {
        try {
            await addDoc(collection(db, 'crm_deals'), {
                ...dealData,
                empresa: activeEmpresa,
                createdBy: user?.name || 'Sistema',
                createdAt: new Date().toISOString(),
            });
            toast.success('Trato añadido');
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar el trato');
        }
    };

    // --- Eliminar Trato ---
    const handleDeleteDeal = async (dealId) => {
        try {
            await deleteDoc(doc(db, 'crm_deals', dealId));
            toast.success('Trato eliminado');
        } catch (e) {
            toast.error('Error al eliminar');
        }
    };

    // --- Mover Trato entre etapas ---
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const dealId = active.id;
        const targetStageId = over.id;
        const deal = deals.find(d => d.id === dealId);

        if (deal && deal.stageId !== targetStageId) {
            // Optimistic update
            setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: targetStageId } : d));
            try {
                await updateDoc(doc(db, 'crm_deals', dealId), {
                    stageId: targetStageId,
                    updatedAt: new Date().toISOString()
                });
                const stageName = PIPELINE_STAGES.find(s => s.id === targetStageId)?.title;
                toast.success(`Trato movido a ${stageName}`);

                if (targetStageId === 'cerrado') {
                    const q = query(
                        collection(db, 'clientes_frecuentes'),
                        where('company', '==', deal.company),
                        where('empresa', '==', deal.empresa || '')
                    );
                    const snap = await getDocs(q);
                    if (snap.empty) {
                        await addDoc(collection(db, 'clientes_frecuentes'), {
                            company: deal.company,
                            empresa: deal.empresa || '',
                            amount: deal.amount || 0,
                            status: 'active',
                            createdAt: new Date().toISOString()
                        });
                        toast.success('Cliente añadido a Frecuentes');
                    } else {
                        const docRef = snap.docs[0].ref;
                        await updateDoc(docRef, { status: 'active', updatedAt: new Date().toISOString() });
                    }
                }
            } catch (e) {
                toast.error('Error al mover el trato');
                // Revert
                setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stageId: deal.stageId } : d));
            }
        }
    };

    const activeDeal = useMemo(() => deals.find(d => d.id === activeId), [activeId, deals]);

    const { totalExpectedValue, totalRawValue } = useMemo(() => {
        let expectedSum = 0, rawSum = 0;
        deals.forEach(deal => {
            const stage = PIPELINE_STAGES.find(s => s.id === deal.stageId);
            if (stage) {
                expectedSum += (deal.amount || 0) * stage.probability;
                rawSum += (deal.amount || 0);
            }
        });
        return { totalExpectedValue: expectedSum, totalRawValue: rawSum };
    }, [deals]);

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] rounded-[32px] p-6 md:p-10 relative overflow-hidden text-white -mx-2 sm:-mx-4 shadow-2xl flex flex-col">
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-800/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            <div className="relative z-10 flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <Activity size={14} className="text-violet-400" />
                            <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Pipeline de Ventas</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            CRM <span className="text-violet-400">Comercial</span>
                        </h1>
                        <p className="text-white/50 text-sm mt-3 max-w-xl leading-relaxed flex items-center gap-2">
                            Mueve las oportunidades por el embudo para cerrar más tratos y conectarlos a finanzas.
                            {activeEmpresa && activeEmpresa !== 'Todas' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80 border border-white/20 uppercase tracking-widest">
                                    {activeEmpresa}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Metrics Summary */}
                    <div className="flex items-center gap-6 bg-white/[0.03] p-4 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
                        <div className="pr-6 border-r border-white/10">
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1.5">Monto Total Bruto</p>
                            <p className="text-xl font-black text-white/90">S/. {totalRawValue.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                Valor Esperado <AlertCircle size={12} className="opacity-50" title="Monto × Probabilidad de etapa"/>
                            </p>
                            <p className="text-3xl font-black text-emerald-400">S/. {totalExpectedValue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                        </div>
                    </div>
                </div>

                {/* Kanban Board */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64 text-white/30 font-bold uppercase tracking-widest animate-pulse">
                            Cargando pipeline...
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCorners}
                            onDragStart={e => setActiveId(e.active.id)}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="flex gap-6 h-full items-stretch pb-2 px-1">
                                {PIPELINE_STAGES.map(stage => {
                                    const stageDeals = deals.filter(d => d.stageId === stage.id);
                                    return (
                                        <PipelineStageColumn
                                            key={stage.id}
                                            stage={stage}
                                            deals={stageDeals}
                                            onAddDeal={(stageId) => setNewDealModal({ open: true, stageId })}
                                            onDelete={handleDeleteDeal}
                                        />
                                    );
                                })}
                            </div>

                            <DragOverlay>
                                {activeDeal ? <div className="rotate-3 scale-105"><DealCardInner deal={activeDeal} isDragging={true} onDelete={() => {}} /></div> : null}
                            </DragOverlay>
                        </DndContext>
                    )}
                </div>
            </div>

            <NewDealModal
                isOpen={newDealModal.open}
                initialStage={newDealModal.stageId}
                onClose={() => setNewDealModal({ open: false, stageId: 'prospeccion' })}
                onSave={handleAddDeal}
            />
        </div>
    );
};

export default Crm;
