import React, { useState, useEffect } from 'react';
import { X, Search, Check, ChevronRight, Megaphone, Layers } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

const CampaignSelectorModal = ({ isOpen, onClose, onSelect, activeEmpresa, selectedCampaign, selectedSubGroup }) => {
    const [campaigns, setCampaigns] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [expandedCampaign, setExpandedCampaign] = useState(null);
    const [subSearch, setSubSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            // Consultamos todos con orden, y filtramos en memoria para evitar errores de índice compuesto de Firestore
            const q = query(collection(db, "campanas"), orderBy("createdAt", "desc"));

            const unsub = onSnapshot(q, (snap) => {
                const allCampaigns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Filtrado en memoria (Multi-tenant y Estado Activo)
                const filteredList = allCampaigns.filter(c => {
                    const matchesEmpresa = activeEmpresa === 'Todas' || (c.empresa || 'GRUCOIN') === activeEmpresa;
                    const isActive = c.status === 'activa';
                    return matchesEmpresa && isActive;
                });

                setCampaigns(filteredList);
                setLoading(false);
            }, (error) => {
                console.error("Error loading campaigns for selector:", error);
                setLoading(false);
                toast.error("Error al cargar campañas");
            });
            return () => unsub();
        }
    }, [isOpen, activeEmpresa]);

    const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 h-[600px]">
                
                {/* HEADER */}
                <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                             <Megaphone size={20} className="text-blue-600" /> Seleccionar Campaña
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Elige una campaña y sub-grupo opcional</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* SEARCH */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar campaña..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* LIST */}
                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-sm font-medium">Cargando campañas...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                            <Megaphone size={40} className="opacity-20" />
                            <p className="text-sm font-medium">No se encontraron campañas activas.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* OPCIÓN SIN CAMPAÑA */}
                            <button 
                                onClick={() => { onSelect(null, null); onClose(); }}
                                className="w-full text-left p-4 rounded-xl border border-dashed border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-bold flex items-center gap-3"
                            >
                                <X size={18} /> -- Sin Campaña --
                            </button>

                            {filtered.map(camp => {
                                const isSelected = selectedCampaign === camp.name;
                                const hasSubGroups = camp.subGroups && camp.subGroups.length > 0;
                                const isExpanded = expandedCampaign === camp.id;

                                return (
                                    <div key={camp.id} className={`border rounded-2xl transition-all overflow-hidden ${isSelected ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                        <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => {
                                            if (hasSubGroups) {
                                                setExpandedCampaign(isExpanded ? null : camp.id);
                                                setSubSearch(""); // Reset search when toggling
                                            } else {
                                                onSelect(camp.name, null);
                                                onClose();
                                            }
                                        }}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                    <Megaphone size={18} />
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{camp.name}</p>
                                                    {hasSubGroups && <p className="text-[10px] text-slate-400 font-bold uppercase">{camp.subGroups.length} Sub-grupos</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isSelected && !selectedSubGroup && <Check size={18} className="text-blue-600" />}
                                                {hasSubGroups && (
                                                    <ChevronRight size={18} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                )}
                                            </div>
                                        </div>

                                        {/* SUB-GROUPS COLLAPSIBLE */}
                                        {hasSubGroups && isExpanded && (
                                            <div className="bg-white border-t border-blue-50 p-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                {/* SUB-SEARCH */}
                                                <div className="relative group" onClick={(e) => e.stopPropagation()}>
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                                    <input 
                                                        type="text" 
                                                        value={subSearch}
                                                        onChange={(e) => setSubSearch(e.target.value)}
                                                        placeholder={`Buscar en ${camp.name}...`}
                                                        className="w-full text-[11px] bg-slate-50 border border-slate-100 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-bold text-slate-600"
                                                        autoFocus
                                                    />
                                                </div>

                                                <button 
                                                    onClick={() => { onSelect(camp.name, null); onClose(); }}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${isSelected && !selectedSubGroup ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                                                >
                                                    Seleccionar Principal (Sin sub-grupo)
                                                    {isSelected && !selectedSubGroup && <Check size={14} />}
                                                </button>
                                                {camp.subGroups
                                                    .filter(sg => sg.toLowerCase().includes(subSearch.toLowerCase()))
                                                    .map((sg, idx) => {
                                                    const isSgSelected = isSelected && selectedSubGroup === sg;
                                                    return (
                                                        <button 
                                                            key={idx}
                                                            onClick={() => { onSelect(camp.name, sg); onClose(); }}
                                                            className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-3 ${isSgSelected ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600'}`}
                                                        >
                                                            <div className={`shrink-0 ${isSgSelected ? 'text-white' : 'text-blue-200'}`}><Layers size={14} /></div>
                                                            <span className="flex-1">{sg}</span>
                                                            {isSgSelected && <Check size={14} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-slate-50 border-t flex justify-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">Solo se muestran campañas con estado "ACTIVA"</p>
                </div>
            </div>
        </div>
    );
};

export default CampaignSelectorModal;
