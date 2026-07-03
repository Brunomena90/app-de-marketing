import React, { useState, useMemo } from 'react';
import { Search, ChevronRight, CheckCircle, Check, Loader2 } from 'lucide-react';
import { useRequests } from '../context/RequestContext';
import Modal from './Modal';

const ScenePickerModal = ({ isOpen, onClose, onImport, existingSections = [] }) => {
    const { requests, loading: loadingRequests } = useRequests();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [selectedScenes, setSelectedScenes] = useState([]);

    // Identificar escenas ya importadas para la solicitud seleccionada
    const alreadyImportedTexts = useMemo(() => {
        if (!selectedRequest) return [];
        const section = existingSections.find(s => s.requestId === selectedRequest.id);
        return section ? section.scenes.map(s => s.text) : [];
    }, [selectedRequest, existingSections]);

    const filteredRequests = useMemo(() => {
        return requests.filter(req =>
            req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.applicantName?.toLowerCase().includes(searchTerm.toLowerCase())
        ).slice(0, 10); // Limit to top 10 for performance in picker
    }, [requests, searchTerm]);

    const handleSelectRequest = (req) => {
        setSelectedRequest(req);
        // Pre-select all or none? Usually none is safer.
        setSelectedScenes([]);
    };

    const toggleScene = (index) => {
        if (selectedScenes.includes(index)) {
            setSelectedScenes(prev => prev.filter(i => i !== index));
        } else {
            setSelectedScenes(prev => [...prev, index]);
        }
    };

    const handleImport = () => {
        if (!selectedRequest || selectedScenes.length === 0) return;

        const scenesToImport = selectedScenes.map(idx => ({
            ...selectedRequest.checklist[idx],
            originalIndex: idx
        }));
        onImport({
            requestId: selectedRequest.id,
            requestTitle: selectedRequest.title,
            scenes: scenesToImport
        });

        // Reset state
        setSelectedRequest(null);
        setSelectedScenes([]);
        setSearchTerm('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                setSelectedRequest(null);
                setSelectedScenes([]);
                setSearchTerm('');
                onClose();
            }}
            title="Importar Escenas"
            className="max-w-3xl"
        >
            <div className="flex flex-col h-[500px]">
                {/* SEARCH BAR (Sticky at top) */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar solicitud por título o solicitante..."
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-hidden flex gap-6">
                    {/* LEFT SIDE: REQUEST LIST */}
                    <div className="w-1/2 border-r border-gray-100 flex flex-col">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Solicitudes</h4>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {loadingRequests ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
                            ) : filteredRequests.length > 0 ? (
                                filteredRequests.map(req => (
                                    <button
                                        key={req.id}
                                        onClick={() => handleSelectRequest(req)}
                                        className={`w-full p-3 rounded-xl text-left transition-all border ${selectedRequest?.id === req.id
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                            : 'bg-white border-gray-50 hover:border-blue-200 text-gray-700'
                                            }`}
                                    >
                                        <p className="font-bold text-sm line-clamp-1">{req.title}</p>
                                        <p className={`text-[10px] uppercase font-medium mt-1 ${selectedRequest?.id === req.id ? 'text-blue-100' : 'text-gray-400'}`}>
                                            {req.applicantName}
                                        </p>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-10 text-gray-400 text-sm">No hay resultados</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDE: SCENE LIST */}
                    <div className="w-1/2 flex flex-col">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Plan de Producción</h4>
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {selectedRequest ? (
                                selectedRequest.checklist && selectedRequest.checklist.length > 0 ? (
                                    selectedRequest.checklist.map((scene, idx) => {
                                        const isAlreadyImported = alreadyImportedTexts.includes(scene.text);
                                        const isSelected = selectedScenes.includes(idx);

                                        return (
                                            <button
                                                key={idx}
                                                disabled={isAlreadyImported}
                                                onClick={() => toggleScene(idx)}
                                                className={`w-full p-3 rounded-xl text-left transition-all border flex items-start gap-3 ${isAlreadyImported
                                                    ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                                        : 'bg-white border-gray-50 hover:border-gray-200 text-gray-600'
                                                    }`}
                                            >
                                                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isAlreadyImported
                                                    ? 'bg-green-100 border-green-200 text-green-600'
                                                    : isSelected
                                                        ? 'bg-blue-600 border-blue-600'
                                                        : 'border-gray-300 bg-white'
                                                    }`}>
                                                    {isAlreadyImported ? <CheckCircle size={12} /> : isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium ${isAlreadyImported ? 'text-gray-400' : ''}`}>{scene.text}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[9px] uppercase font-bold py-0.5 px-2 rounded inline-block ${isAlreadyImported
                                                            ? 'bg-gray-200 text-gray-400'
                                                            : isSelected ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {scene.type}
                                                        </span>
                                                        {isAlreadyImported && (
                                                            <span className="text-[9px] font-bold text-green-600 uppercase tracking-tight flex items-center gap-1">
                                                                <Check size={10} /> Ya importada
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-10 text-gray-400 text-sm italic">Esta solicitud no tiene plan de producción</div>
                                )
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 text-center px-4">
                                    <ChevronRight size={32} className="mb-2 opacity-20" />
                                    <p className="text-sm">Selecciona una solicitud para ver sus escenas</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="pt-6 border-t border-gray-50 flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                        {selectedScenes.length} escena(s) seleccionada(s)
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={selectedScenes.length === 0}
                            onClick={handleImport}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all text-sm disabled:opacity-50 disabled:shadow-none"
                        >
                            Importar Escenas
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ScenePickerModal;
