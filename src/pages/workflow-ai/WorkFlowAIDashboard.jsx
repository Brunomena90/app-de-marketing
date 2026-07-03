import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, where, addDoc, doc, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useRequests } from '../../context/RequestContext';
import {
    Sparkles, Send, Bot, User, Trash2, Copy, Check, TrendingUp, FileText, Zap, Brain, Cpu, ChevronLeft, ChevronDown, History, PanelLeftClose, PanelLeft, Loader2, Plus, MessageSquare, FolderGit2, Settings, PlusCircle, Wand2, Edit3, Home, Download, Paperclip, X, File, HardDrive, DownloadCloud
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendSmartMessage, MODELS } from '../../services/geminiService';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

const renderMarkdown = (text) => {
    if (!text) return "";
    let content = text.trim().replace(/\n{3,}/g, '\n\n');
    content = content.replace(/[ \t]*`(svg|csv|[\s\w]*)\n?([\s\S]*?)`/gi, (match, lang, code) => {
        const cleanLang = (lang || '').toLowerCase().trim();
        const cleanCode = (code || '').trim();
        if (cleanLang === 'svg') {
            return '<div class="my-8 flex justify-center bg-zinc-950/50 p-12 rounded-[3rem] border border-zinc-800/50 shadow-2xl overflow-hidden backdrop-blur-xl relative group"><div class="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>' + cleanCode + '</div>';
        }
        if (cleanLang === 'csv') {
            const encodedCsv = encodeURIComponent(cleanCode);
            return '<div class="bg-zinc-950/80 border border-zinc-800/50 rounded-[2.5rem] p-8 my-10 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5"><div class="flex items-center justify-between mb-6 border-b border-zinc-900/50 pb-5"><div class="flex items-center gap-3"><div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div><span class="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Smart Data Persistence</span></div><a href="data:text/csv;charset=utf-8,' + encodedCsv + '" download="artories_analysis.csv" class="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white px-5 py-2 rounded-full transition-all duration-300 font-black uppercase tracking-widest border border-emerald-500/20">Export CSV Data</a></div><pre class="text-[11px] font-mono text-emerald-500/60 overflow-x-auto custom-scrollbar leading-relaxed">' + cleanCode + '</pre></div>';
        }
        return '<pre class="bg-black/80 border border-zinc-800/50 rounded-[2rem] p-7 my-8 overflow-x-auto text-[12px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed shadow-xl">' + cleanCode + '</pre>';
    });
    content = content.replace(/^#### (.*$)/gm, '<h4 class="text-zinc-200 font-bold text-sm mt-6 mb-3 flex items-center gap-3 uppercase tracking-widest"><div class="w-1 h-3 bg-zinc-700 rounded-full"></div> $1</h4>');
    content = content.replace(/^### (.*$)/gm, '<h3 class="text-white font-black text-base mt-8 mb-4 flex items-center gap-4 uppercase tracking-tighter"><div class="w-1.5 h-4 bg-violet-600 rounded-full shadow-[0_0_15px_#7c3aed]"></div> $1</h3>');
    content = content.replace(/^## (.*$)/gm, '<h2 class="text-white font-black text-2xl mt-10 mb-6 border-b border-zinc-900/50 pb-4 tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">$1</h2>');
    content = content.replace(/^# (.*$)/gm, '<h1 class="text-white font-black text-4xl mt-14 mb-8 bg-gradient-to-r from-violet-400 via-pink-400 to-amber-400 bg-clip-text text-transparent tracking-tighter leading-none">$1</h1>');
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-violet-400 font-bold tracking-tight px-0.5">$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em class="text-zinc-400 italic font-medium">$1</em>');
    content = content.replace(/^[\s]*[-*] (.*$)/gm, '<div class="flex items-start gap-4 my-2 group/item ml-2"><div class="w-2 h-2 rounded-full bg-violet-950 border border-violet-500 mt-1.5 shrink-0 group-hover/item:bg-violet-500 transition-all duration-300 shadow-[0_0_0_0_rgba(124,58,237,0)] group-hover/item:shadow-[0_0_10px_#7c3aed]"></div><span class="text-zinc-300 text-[14px] font-medium tracking-tight">$1</span></div>');
    const bArray = [];
    content = content.replace(/(<(div|pre|h1|h2|h3|a|span)[\s\S]*?<\/\2>)/gi, (m) => { bArray.push(m); return "__STRUCT_BLOCK_" + (bArray.length - 1) + "__"; });
    content = content.replace(/\n/g, '<br />');
    bArray.forEach((b, i) => { content = content.replace("__STRUCT_BLOCK_" + i + "__", b); });
    return content.replace(/(<br \/>){3,}/g, '<br /><br />');
};

const QUICK_PROMPTS = [
    { icon: <TrendingUp size={14} />, label: 'Análisis estratégico', text: 'Realiza un análisis estratégico completo de los datos actuales.' },
    { icon: <FileText size={14} />, label: 'Resumen Ejecutivo', text: 'Dame un resumen ejecutivo del estado actual de producción.' },
    { icon: <Zap size={14} />, label: 'Plan de Mejora', text: 'Genera un plan de acción para optimizar los procesos.' }
];

const MessageBubble = ({ msg }) => {
    const isUser = msg.role === 'user';

    const handleExport = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Documento Generado por IA", 20, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        let text = msg.content
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/#(.*)/g, '$1')
            .replace(/>(.*)/g, '$1')
            .replace(/```json[\s\S]*?```/g, '')
            .trim();
            
        const splitText = doc.splitTextToSize(text, 170);
        let y = 35;
        for (let i = 0; i < splitText.length; i++) {
            if (y > 280) {
                doc.addPage();
                y = 20;
            }
            doc.text(splitText[i], 20, y);
            y += 6;
        }
        doc.save(`IA_Document_${new Date().getTime()}.pdf`);
    };

    return (
        <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-6 group mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 tracking-tight`}>
            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-2xl transition-all duration-500 group-hover:scale-110 ${isUser ? 'bg-zinc-900 border border-zinc-800' : 'bg-gradient-to-br from-violet-600 to-pink-600 shadow-violet-900/20'}`}>
                {isUser ? <User size={20} className="text-zinc-400" /> : <Brain size={22} className="text-white animate-pulse" />}
            </div>
            <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-[2rem] p-6 transition-all duration-500 ${isUser ? 'bg-zinc-900/80 border border-zinc-800/50 hover:border-zinc-700' : 'bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-2xl hover:bg-zinc-900/60'}`}>
                    {isUser ? (
                        <p className="text-[15px] font-medium leading-relaxed text-zinc-300 whitespace-pre-wrap selection:bg-violet-500/30">{msg.content}</p>
                    ) : (
                        <div className="prose-invert prose-sm max-w-none space-y-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    )}
                </div>
                <div className="flex items-center gap-3 mt-3 px-4 opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600">
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isUser && (
                        <button onClick={handleExport} className="flex items-center gap-1 text-[10px] uppercase font-bold text-violet-500 hover:text-violet-400 transition-colors bg-violet-500/10 hover:bg-violet-500/20 px-2 py-0.5 rounded-full">
                            <Download size={12} /> Exportar Doc
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const LoadingDotsBubble = () => (
    <div className={`flex flex-row gap-6 group mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 tracking-tight`}>
        <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-2xl transition-all duration-500 bg-gradient-to-br from-violet-600 to-pink-600 shadow-violet-900/20`}>
            <Brain size={22} className="text-white animate-pulse" />
        </div>
        <div className={`max-w-[80%] flex flex-col items-start`}>
            <div className={`rounded-[2rem] p-6 transition-all duration-500 bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-2xl h-16 flex items-center`}>
                <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-bounce"></div>
                </div>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600 mt-2 px-4 animate-pulse">
                Analizando contexto...
            </span>
        </div>
    </div>
);

const ProjectsView = ({ activeEmpresa, onProjectSelect, projects, setProjects }) => {
    const [name, setName] = useState('');
    const [instructions, setInstructions] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim() || !instructions.trim()) return toast.error('Completar todos los campos');
        try {
            if (editingId) {
                await updateDoc(doc(db, 'workflow_ai_projects', editingId), { 
                    name, instructions, updatedAt: serverTimestamp() 
                });
                toast.success('Asistente actualizado');
            } else {
                await addDoc(collection(db, 'workflow_ai_projects'), { 
                    empresa: activeEmpresa, name, instructions, createdAt: serverTimestamp() 
                });
                toast.success('Asistente (Gem) creado');
            }
            resetForm();
        } catch (e) { toast.error('Error al guardar proyecto'); }
    };

    const resetForm = () => {
        setIsCreating(false);
        setName('');
        setInstructions('');
        setEditingId(null);
    };

    const handleEdit = (e, p) => {
        e.stopPropagation();
        setName(p.name);
        setInstructions(p.instructions);
        setEditingId(p.id);
        setIsCreating(true);
    };

    const handleMagicPrompt = async () => {
        if (!name.trim() && !instructions.trim()) {
            return toast.error('Escribe al menos un nombre o idea básica para generar el prompt.');
        }
        setIsGeneratingPrompt(true);
        try {
            const prompt = `Actúa como un Ingeniero de Prompts Experto. 
Tu tarea es tomar esta idea de asistente y redactar un "System Prompt" detallado, estricto y profesional para que una IA lo utilice como base de comportamiento.
Objetivo del Asistente (Nombre): ${name || 'Asistente Empresarial'}
Borrador inicial del usuario: ${instructions || 'Necesito que me ayude con tareas generales de la empresa.'}
            
El texto que generes será inyectado directamente en el núcleo de la IA. Usa un tono directo, lista de reglas, y delimita claramente su alcance, tono, y cómo debe responder.
DEVUELVE ÚNICAMENTE EL TEXTO DE LAS INSTRUCCIONES LOGRADAS, sin introducciones ni comillas.`;
            
            const response = await sendSmartMessage({ message: prompt, history: [], empresa: activeEmpresa, appData: {} });
            setInstructions(response.text);
            toast.success('Instrucciones optimizadas con IA');
        } catch (e) {
            toast.error('Error al generar instrucciones');
        } finally {
            setIsGeneratingPrompt(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        try {
            await deleteDoc(doc(db, 'workflow_ai_projects', id));
            toast.success('Asistente eliminado');
        } catch(e) {}
    };

    return (
        <div className="h-full flex flex-col p-4 sm:p-8 lg:p-12 animate-in fade-in zoom-in-95 duration-500 overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter mb-2 flex items-center gap-3"><FolderGit2 /> Mis Proyectos (Gems)</h2>
            <p className="text-zinc-500 mb-8 sm:mb-10 text-sm">Crea asistentes de IA personalizados con instrucciones y contextos específicos para tu empresa.</p>

            {isCreating ? (
                <form onSubmit={handleCreate} className="bg-zinc-900/40 p-8 rounded-[2rem] border border-zinc-800 shadow-2xl mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-bold tracking-tight">{editingId ? 'Editar Asistente' : 'Crear Nuevo Asistente Personalizado'}</h3>
                        <button type="button" onClick={handleMagicPrompt} disabled={isGeneratingPrompt} className="text-xs bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 disabled:opacity-50 px-4 py-2 rounded-full font-bold transition-all flex items-center gap-2 border border-violet-500/30">
                            {isGeneratingPrompt ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Magic Prompt
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del Asistente (Ej: Analista de Ventas, CRM Bot...)" className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 transition-colors outline-none" />
                        <div className="relative">
                            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instrucciones detalladas de cómo debe comportarse este asistente..." rows={6} className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 transition-colors outline-none resize-none custom-scrollbar" />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={resetForm} className="px-5 py-2.5 hover:bg-zinc-800 text-zinc-400 rounded-xl text-sm font-semibold transition-colors">Cancelar</button>
                            <button type="submit" disabled={isGeneratingPrompt} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"><Check size={16}/> {editingId ? 'Actualizar' : 'Guardar'} Asistente</button>
                        </div>
                    </div>
                </form>
            ) : (
                <button onClick={() => setIsCreating(true)} className="w-full p-6 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 border-dashed rounded-[2rem] text-violet-400 font-bold tracking-tight mb-8 transition-colors flex items-center justify-center gap-2">
                    <PlusCircle size={20} /> Crear Asistente Personalizado
                </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(p => (
                    <div key={p.id} onClick={() => onProjectSelect(p)} className="bg-zinc-900/40 border border-zinc-800/50 hover:border-violet-500/50 p-6 rounded-[2rem] transition-all cursor-pointer group hover:-translate-y-1 shadow-xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg"><Brain className="text-white" size={20}/></div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => handleEdit(e, p)} className="text-zinc-500 hover:text-violet-400 p-2 rounded-lg hover:bg-violet-500/10 transition-colors"><Edit3 size={16}/></button>
                                <button onClick={(e) => handleDelete(e, p.id)} className="text-zinc-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <h4 className="font-bold text-white tracking-tight mb-2">{p.name}</h4>
                        <p className="text-xs text-zinc-500 line-clamp-3">{p.instructions}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingsView = ({ globalMemory, setGlobalMemory }) => (
    <div className="h-full flex flex-col p-4 sm:p-8 lg:p-12 animate-in fade-in zoom-in-95 duration-500 overflow-y-auto custom-scrollbar">
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter mb-2 flex items-center gap-3"><Settings /> Configuración AI</h2>
        <p className="text-zinc-500 mb-8 sm:mb-10 text-sm">Gestiona las preferencias globales de Artories IA y el comportamiento base del asistente.</p>
        
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-[2rem] p-8 shadow-xl max-w-2xl space-y-8">
            <div>
                <h3 className="text-white font-bold tracking-tight border-b border-zinc-800 pb-4 mb-4">Cerebro Global (Memoria a Largo Plazo)</h3>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">Escribe aquí información clave, reglas o contexto sobre tu empresa que la IA deba recordar siempre, en todas las conversaciones.</p>
                <textarea 
                    value={globalMemory} 
                    onChange={(e) => {
                        setGlobalMemory(e.target.value);
                        localStorage.setItem('artories_global_memory', e.target.value);
                    }} 
                    placeholder="Ej: Nuestra empresa vende software SaaS B2B. El tono debe ser siempre profesional y conciso..." 
                    rows={4} 
                    className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 transition-colors outline-none resize-none custom-scrollbar" 
                />
            </div>

            <div>
                <h3 className="text-white font-bold tracking-tight border-b border-zinc-800 pb-4 mb-4">Parámetros del Motor</h3>
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Motor Conectado (Prueba)</label>
                        <div className="bg-black/50 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3"><Cpu className="text-emerald-400" size={20} /> <span className="text-white font-medium text-sm">G3 Strategic Engine</span></div>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase">Ready</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Precisión Analítica (Temperatura)</label>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-zinc-500">Creativo</span>
                            <input type="range" min="0" max="100" defaultValue="70" className="flex-1 accent-violet-500" disabled />
                            <span className="text-xs text-zinc-500">Preciso</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="pt-4 border-t border-zinc-800 flex justify-end">
                <button className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-all">Guardar Preferencias (Próximamente)</button>
            </div>
        </div>
    </div>
);

export default function WorkFlowAIDashboard() {
    const { user, activeEmpresa } = useAuth();
    const navigate = useNavigate();
    const { requests: contextRequests } = useRequests();
    const [sessions, setSessions] = useState([]);
    const [projects, setProjects] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [activeView, setActiveView] = useState('chat'); // 'chat' | 'projects' | 'settings'
    const [selectedProject, setSelectedProject] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [attachments, setAttachments] = useState([]);
    const hasInitializedRef = useRef(false);
    const chatEndRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    
    // --- LOCAL AI STATE ---
    const isElectron = typeof window !== 'undefined' && window.electronAPI;
    const [activeModel, setActiveModel] = useState('gemini');
    const [hwInfo, setHwInfo] = useState(null);
    const [modelStatuses, setModelStatuses] = useState({});
    const [downloads, setDownloads] = useState({});
    const [localEngineRunning, setLocalEngineRunning] = useState(false);
    const [isStartingEngine, setIsStartingEngine] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [mapsSearchEnabled, setMapsSearchEnabled] = useState(false);
    const [globalMemory, setGlobalMemory] = useState('');

    const LOCAL_MODELS = [
        { id: 'gemma', name: 'Gemma 4 (Local)', size: '1.6 GB' },
        { id: 'qwen', name: 'Qwen 3.5 (Local)', size: '2.5 GB' },
        { id: 'llama', name: 'Llama 3 (Local)', size: '4.9 GB' },
        { id: 'deepseek', name: 'DeepSeek Coder (Local)', size: '9.0 GB' }
    ];

    useEffect(() => {
        if (isElectron) {
            window.electronAPI.checkHardware().then(setHwInfo);
            const cleanup = window.electronAPI.onDownloadProgress((data) => {
                setDownloads(prev => ({ ...prev, [data.modelId]: data.progress }));
                if (data.done || data.error) checkModelStatus(data.modelId);
            });
            LOCAL_MODELS.forEach(m => checkModelStatus(m.id));
            return cleanup;
        }
    }, [isElectron]);

    const checkModelStatus = async (modelId) => {
        if (!isElectron) return;
        const res = await window.electronAPI.getModelStatus(modelId);
        setModelStatuses(prev => ({ ...prev, [modelId]: res.status }));
    };

    const handleDownloadModel = async (modelId) => {
        if (!isElectron) return;
        await window.electronAPI.downloadModel(modelId);
        checkModelStatus(modelId);
    };

    const handleModelChange = async (e) => {
        const newModel = e.target.value;
        if (newModel !== 'gemini' && isElectron) {
            const status = modelStatuses[newModel];
            if (status === 'ready') {
                const loadingToast = toast.loading(`Iniciando motor local para ${newModel}...`);
                try {
                    await window.electronAPI.startModel(newModel);
                    setLocalEngineRunning(true);
                    toast.success('Motor local iniciado.', { id: loadingToast });
                    toast.success('Motor local iniciado.');
                } catch (err) {
                    toast.error('Error al iniciar motor local');
                    return;
                } finally {
                    setIsStartingEngine(false);
                }
            }
        } else if (newModel === 'gemini' && isElectron && localEngineRunning) {
            window.electronAPI.stopModel();
            setLocalEngineRunning(false);
        }
        setActiveModel(newModel);
    };

    useEffect(() => {
        hasInitializedRef.current = false;
        setActiveSessionId(null);
        setMessages([]);
        setShowSuggestions(true);
        const mem = localStorage.getItem('artories_global_memory');
        if (mem) setGlobalMemory(mem);
    }, [activeEmpresa]);

    useEffect(() => {
        if (!user || !activeEmpresa) return;
        const q = query(collection(db, 'workflow_ai_chats'), where('empresa', '==', activeEmpresa), where('userId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const sessionsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setSessions(sessionsData);
            
            if (!hasInitializedRef.current) {
                hasInitializedRef.current = true;
                const savedId = localStorage.getItem('artories_last_session_' + activeEmpresa);
                if (savedId && sessionsData.some(s => s.id === savedId)) {
                    const session = sessionsData.find(s => s.id === savedId);
                    setActiveSessionId(savedId);
                    setMessages(session.messages || []);
                    setShowSuggestions((session.messages || []).length === 0);
                } else if (sessionsData.length > 0) {
                    setActiveSessionId(sessionsData[0].id);
                    setMessages(sessionsData[0].messages || []);
                    setShowSuggestions((sessionsData[0].messages || []).length === 0);
                } else {
                    setActiveSessionId('new');
                    setMessages([]);
                    setShowSuggestions(true);
                }
            }
        });
        return () => unsub();
    }, [user, activeEmpresa]);

    useEffect(() => {
        if (!user || !activeEmpresa) return;
        const qProj = query(collection(db, 'workflow_ai_projects'), where('empresa', '==', activeEmpresa));
        const unsubProj = onSnapshot(qProj, (snap) => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsubProj();
    }, [user, activeEmpresa]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        const newAttachments = [];
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error(`El archivo ${file.name} es muy grande (Max 5MB)`);
                continue;
            }
            try {
                const base64 = await fileToBase64(file);
                newAttachments.push({
                    name: file.name,
                    mimeType: file.type,
                    data: base64
                });
            } catch (err) {
                toast.error(`Error al procesar ${file.name}`);
            }
        }
        setAttachments(prev => [...prev, ...newAttachments]);
        e.target.value = ''; // Reset
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handlePaste = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const newAttachments = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    try {
                        const base64 = await fileToBase64(file);
                        newAttachments.push({
                            name: `Imagen pegada (${new Date().toLocaleTimeString()}).png`,
                            mimeType: file.type,
                            data: base64
                        });
                    } catch (err) {
                        toast.error(`Error al procesar imagen pegada`);
                    }
                }
            }
        }
        
        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const handleSend = async (textToSend) => {
        const text = textToSend || input;
        if ((!text.trim() && attachments.length === 0) || isLoading || isStartingEngine) return;
        setInput('');
        
        // Reset textarea height manually after sending
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(t => t.style.height = 'inherit');

        setShowSuggestions(false);
        const currentAtts = [...attachments];
        setAttachments([]);

        const userContent = text + (currentAtts.length > 0 ? `\n[Adjuntaste ${currentAtts.length} archivo(s)]` : '');
        const userMsg = { role: 'user', content: userContent, timestamp: Date.now() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        try {
            let currentId = activeSessionId === 'new' ? null : activeSessionId;
            if (!currentId) {
                const newChat = { empresa: activeEmpresa, userId: user.uid, title: text.substring(0, 40) || 'Nuevo Análisis', messages: [userMsg], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
                const docRef = await addDoc(collection(db, 'workflow_ai_chats'), newChat);
                currentId = docRef.id;
                setActiveSessionId(currentId);
                localStorage.setItem('artories_last_session_' + activeEmpresa, currentId);
            }
            let aiResponseText = "";
            
            if (activeModel !== 'gemini' && isElectron && localEngineRunning) {
                // Interceptar llamada para usar Local AI (OpenAI compatible en localhost:8080)
                const agenticInstructions = `
ERES UN AGENTE AUTÓNOMO. Tienes la habilidad de ejecutar acciones en la aplicación usando comandos especiales. 
Si el usuario te pide crear una solicitud, DEBES incluir este bloque exacto en tu respuesta:
[ACTION:CREATE_REQUEST]
{"title": "Título corto", "description": "Descripción detallada"}
[/ACTION]

Si el usuario te pide navegar o ir a otra pantalla (ej. dashboard, solicitudes, ventas, finanzas), DEBES incluir este bloque:
[ACTION:NAVIGATE]
{"path": "/ruta"}
[/ACTION]
Rutas disponibles: /dashboard, /solicitudes, /finanzas, /ventas, /campanas, /usuarios, /empresas.

Responde naturalmente al usuario, pero usa los bloques [ACTION] cuando te pidan ejecutar algo.
`;
                let combinedSystemPrompt = agenticInstructions;
                if (globalMemory) combinedSystemPrompt += `\nMEMORIA GLOBAL DEL USUARIO: ${globalMemory}`;
                if (selectedProject) combinedSystemPrompt += `\nINSTRUCCIONES DEL PROYECTO: ${selectedProject.instructions}`;

                const apiMessages = [
                    { role: 'system', content: combinedSystemPrompt }
                ];
                messages.forEach(m => {
                    apiMessages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content });
                });
                
                let userPrompt = text;
                if (mapsSearchEnabled) {
                    const searchToast = toast.loading('Buscando ubicación en el mapa...', { id: 'search-maps-toast' });
                    try {
                        const mapResults = await window.electronAPI.searchMaps(text);
                        userPrompt = `El usuario pregunta por un lugar: "${text}"\n\nResultados de OpenStreetMap:\n${mapResults}\n\nSi encontraste el lugar, responde con un enlace en este formato exacto para Google Maps: https://www.google.com/maps/search/?api=1&query=LATITUD,LONGITUD. Responde de forma amable y provee el enlace.`;
                        toast.success('Ubicación encontrada', { id: searchToast });
                    } catch (e) {
                        toast.error('Error buscando ubicación', { id: searchToast });
                    }
                } else if (webSearchEnabled) {
                    const searchToast = toast.loading('Buscando en la web...', { id: 'search-toast' });
                    try {
                        const webResults = await window.electronAPI.searchWeb(text);
                        userPrompt = `El usuario pregunta: "${text}"\n\nResultados de búsqueda web recientes:\n${webResults}\n\nResponde basándote en los resultados si es necesario.`;
                        toast.success('Búsqueda completada', { id: searchToast });
                    } catch (e) {
                        toast.error('Error en búsqueda web', { id: searchToast });
                    }
                }
                apiMessages.push({ role: 'user', content: userPrompt });

                const res = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: apiMessages, temperature: 0.7 })
                });
                if (!res.ok) {
                    let errMsg = 'Error en IA local';
                    try {
                        const errData = await res.json();
                        if (errData?.error?.message) errMsg = errData.error.message;
                    } catch(e) {}
                    if (res.status === 503 && errMsg.toLowerCase().includes('loading')) {
                        throw new Error('El modelo de IA aún está cargando en la memoria RAM. Por favor, espera unos segundos e intenta de nuevo.');
                    }
                    throw new Error(errMsg);
                }
                const data = await res.json();
                aiResponseText = data.choices[0].message.content;

                // Agentic Protocol Interceptor
                const actionRegex = /\[ACTION:(.*?)\]([\s\S]*?)\[\/ACTION\]/g;
                let match;
                let actionsExecuted = 0;
                let cleanResponseText = aiResponseText;

                while ((match = actionRegex.exec(aiResponseText)) !== null) {
                    const actionType = match[1].trim();
                    const jsonString = match[2].trim();
                    try {
                        const payload = JSON.parse(jsonString);
                        
                        if (actionType === 'NAVIGATE') {
                            if (payload.path) {
                                navigate(payload.path);
                                toast.success(`Navegando a: ${payload.path}`);
                                actionsExecuted++;
                            }
                        } else if (actionType === 'CREATE_REQUEST') {
                            if (payload.title) {
                                await addDoc(collection(db, 'solicitudes'), {
                                    titulo: payload.title,
                                    descripcion: payload.description || 'Creado por IA Local',
                                    estado: 'Pendiente',
                                    empresa: activeEmpresa,
                                    fechaRequerida: new Date().toISOString().split('T')[0],
                                    creador: user.uid,
                                    creadoEn: serverTimestamp()
                                });
                                toast.success('Solicitud creada exitosamente por la IA');
                                actionsExecuted++;
                            }
                        }
                    } catch (e) {
                        console.error("Error parsing AI action payload:", e);
                    }
                }
                
                // Clean the output so the user doesn't see the JSON blocks
                cleanResponseText = cleanResponseText.replace(/\[ACTION:.*?\][\s\S]*?\[\/ACTION\]/g, '').trim();
                
                if (actionsExecuted > 0 && !cleanResponseText) {
                    cleanResponseText = "¡He completado la acción solicitada!";
                }
                aiResponseText = cleanResponseText;

            } else {
                // Gemini Cloud
                const aiResponse = await sendSmartMessage({ 
                    message: text, 
                    history: messages, 
                    empresa: activeEmpresa, 
                    appData: { solicitudes: contextRequests },
                    appContext: selectedProject ? `INSTRUCCIONES DEL PROYECTO/ASISTENTE (${selectedProject.name}): ` + selectedProject.instructions : '',
                    attachments: currentAtts
                });
                aiResponseText = aiResponse.text;
            }

            const aiMsg = { role: 'model', content: aiResponseText, timestamp: Date.now() };
            const finalMessages = [...newMessages, aiMsg];
            setMessages(finalMessages);
            await updateDoc(doc(db, 'workflow_ai_chats', currentId), { messages: finalMessages, updatedAt: serverTimestamp() });
        } catch (err) { toast.error('Error al procesar mensaje'); } finally { setIsLoading(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
    const createNewChat = () => { 
        setActiveSessionId('new'); 
        setMessages([]); 
        setShowSuggestions(true); 
        setActiveView('chat');
        setSelectedProject(null);
        localStorage.removeItem('artories_last_session_' + activeEmpresa); 
    };
    
    const handleProjectSelect = (proj) => {
        setSelectedProject(proj);
        setActiveView('chat');
        setActiveSessionId('new');
        setMessages([]);
        setShowSuggestions(true);
    };

    const deleteSession = async (e, id) => {
        e.stopPropagation();
        try {
            await deleteDoc(doc(db, 'workflow_ai_chats', id));
            if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); setShowSuggestions(true); }
        } catch (err) { toast.error('Error al eliminar'); }
    };

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
            {isSidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
            
            <aside className={`${isSidebarOpen ? 'translate-x-0 w-[85vw] sm:w-80' : '-translate-x-full w-0'} absolute lg:relative z-50 h-full bg-[#0a0a0a] border-r border-zinc-900 transition-all duration-500 overflow-hidden flex flex-col shadow-2xl shadow-violet-900/10 shrink-0`}>
                
                {/* Navegación Superior */}
                <div className="p-4 space-y-2 border-b border-zinc-900 relative z-10 bg-[#0a0a0a]">
                    <button onClick={() => { createNewChat(); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'chat' && activeSessionId === 'new' && !selectedProject ? 'bg-violet-600/10 text-violet-400 font-bold border border-violet-500/20' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'}`}>
                        <MessageSquare size={18}/> <span className="text-sm">Nuevo Chat</span>
                    </button>
                    <button onClick={() => { setActiveView('projects'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'projects' ? 'bg-violet-600/10 text-violet-400 font-bold border border-violet-500/20' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'}`}>
                        <FolderGit2 size={18}/> <span className="text-sm">Proyectos (Gems)</span>
                    </button>
                    <button onClick={() => { setActiveView('settings'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'settings' ? 'bg-violet-600/10 text-violet-400 font-bold border border-violet-500/20' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'}`}>
                        <Settings size={18}/> <span className="text-sm">Configuración</span>
                    </button>
                </div>

                {/* Historial de Memorias */}
                <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-black/20">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] bg-gradient-to-r from-violet-400 to-pink-500 bg-clip-text text-transparent">Memorias Artories</h2>
                    <button onClick={() => { createNewChat(); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="p-2 hover:bg-zinc-800 rounded-xl transition-all border border-zinc-800 shadow-lg"><Plus size={16} className="text-violet-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {sessions.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => { setActiveSessionId(s.id); setMessages(s.messages || []); setShowSuggestions(false); localStorage.setItem('artories_last_session_' + activeEmpresa, s.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                            className={`group p-4 sm:p-5 rounded-[1.5rem] cursor-pointer transition-all duration-300 border relative overflow-hidden ${activeSessionId === s.id ? 'bg-violet-600/10 border-violet-500/30 shadow-[0_0_30px_rgba(124,58,237,0.1)]' : 'bg-zinc-900/20 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/40'}`}
                        >
                            {activeSessionId === s.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-600 shadow-[0_0_10px_#7c3aed]"></div>}
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[13px] font-bold truncate transition-colors ${activeSessionId === s.id ? 'text-violet-400' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                                        {s.title || 'Nueva conversación'}
                                    </p>
                                    <p className="text-[10px] text-zinc-600 font-medium mt-1 uppercase tracking-widest">
                                        {s.updatedAt?.seconds ? new Date(s.updatedAt.seconds * 1000).toLocaleDateString() : 'Reciente'}
                                    </p>
                                </div>
                                <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-zinc-600"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>
            <main className="flex-1 flex flex-col relative overflow-hidden">
                <header className="h-16 sm:h-20 border-b border-zinc-900 flex items-center justify-between px-3 sm:px-8 bg-black/40 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 sm:p-2.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all">
                                {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                            </button>
                            <button onClick={() => navigate('/')} className="p-2 sm:p-2.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all" title="Volver al App Center">
                                <Home size={18} />
                            </button>
                        </div>
                        <div>
                            <h1 className="text-sm sm:text-lg font-black tracking-tighter flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
                                Artories IA 
                                <select 
                                    value={activeModel} 
                                    onChange={handleModelChange}
                                    className="ml-2 bg-zinc-900 border border-zinc-800 text-white text-[10px] sm:text-xs rounded-xl px-2 py-1 outline-none font-bold"
                                >
                                    <option value="gemini">☁️ Gemini Pro (Cloud)</option>
                                    {isElectron && LOCAL_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </h1>
                            {selectedProject && <p className="text-[9px] sm:text-[10px] text-emerald-400 uppercase tracking-widest font-bold mt-1 sm:mt-1.5 flex items-center gap-1.5"><FolderGit2 size={10}/> Proyecto: {selectedProject.name}</p>}
                        </div>
                    </div>
                </header>

                {activeView === 'projects' && <ProjectsView activeEmpresa={activeEmpresa} onProjectSelect={(p) => { handleProjectSelect(p); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} projects={projects} setProjects={setProjects} />}
                
                {activeView === 'settings' && <SettingsView globalMemory={globalMemory} setGlobalMemory={setGlobalMemory} />}

                {activeView === 'chat' && (
                    <>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
                    {showSuggestions ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-8 sm:space-y-12 max-w-4xl mx-auto py-10 sm:py-20 animate-in slide-in-from-bottom duration-700">
                            <div className="text-center space-y-4"><div className="w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-violet-600 to-pink-600 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(124,58,237,0.4)] rotate-3 hover:rotate-0 transition-transform"><Brain className="text-white w-8 h-8 sm:w-12 sm:h-12" /></div><h2 className="text-2xl sm:text-4xl font-black tracking-tighter bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">¿Qué analizamos hoy?</h2></div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                                {QUICK_PROMPTS.map((p, i) => (<button key={i} onClick={() => handleSend(p.text)} className="bg-zinc-900/40 border border-zinc-800/50 p-6 rounded-[2rem] hover:border-violet-500/50 hover:bg-zinc-800/40 transition-all text-left group shadow-xl backdrop-blur-sm">{p.icon}<p className="font-black text-sm text-zinc-300 mb-2 mt-4 uppercase tracking-tighter">{p.label}</p><p className="text-xs text-zinc-500 leading-relaxed font-medium">{p.text}</p></button>))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto py-10 space-y-12">
                            {messages.map((m, i) => (<MessageBubble key={i} msg={m} />))}
                            {isLoading && <LoadingDotsBubble />}
                        </div>
                    )}
                    <div ref={chatEndRef} className="h-24 sm:h-32" />
                </div>
                
                {/* Local Download / Status Banner */}
                {activeModel !== 'gemini' && modelStatuses[activeModel] !== 'ready' && (
                    <div className="absolute inset-x-0 bottom-24 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 p-6 z-20 mx-4 sm:mx-8 rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom">
                        <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0">
                                    <HardDrive size={24} />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold tracking-tight">Modelo No Instalado</h3>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        Tu Hardware: {hwInfo ? `${hwInfo.ram}GB RAM, ${hwInfo.cores} Hilos` : 'Analizando...'}
                                    </p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">Se descargará el motor y el modelo <span className="text-violet-400 font-bold">{LOCAL_MODELS.find(m => m.id === activeModel)?.name}</span> (Tamaño aprox: <span className="text-white font-bold">{LOCAL_MODELS.find(m => m.id === activeModel)?.size}</span>) para procesar 100% local sin internet.</p>
                                </div>
                            </div>
                            
                            {downloads[activeModel] !== undefined ? (
                                <div className="w-full sm:w-48 text-right">
                                    <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
                                        <div className="bg-violet-500 h-2 rounded-full transition-all duration-300" style={{ width: `${downloads[activeModel]}%` }}></div>
                                    </div>
                                    <span className="text-xs text-zinc-400 font-bold">{downloads[activeModel]}% Descargado</span>
                                </div>
                            ) : (
                                <button onClick={() => handleDownloadModel(activeModel)} className="w-full sm:w-auto px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-900/50 flex items-center justify-center gap-2">
                                    <DownloadCloud size={16} /> Descargar e Instalar
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className="p-4 sm:p-8 bg-gradient-to-t from-black via-black/90 to-transparent sticky bottom-0 border-t border-zinc-900/50 backdrop-blur-xl">
                    <div className="max-w-4xl mx-auto relative group">
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {attachments.map((att, i) => (
                                    <div key={i} className="bg-zinc-900 border border-zinc-800 shadow-sm rounded-lg py-1.5 px-3 flex items-center gap-2 text-xs text-zinc-300 animate-in fade-in zoom-in-95">
                                        <File size={14} className="text-violet-500 shrink-0" />
                                        <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                                        <button onClick={() => removeAttachment(i)} className="hover:text-red-500 transition-colors ml-1 shrink-0"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-4 mb-3 ml-2">
                            {isElectron && activeModel !== 'gemini' && (
                                <>
                                    <button onClick={() => { setWebSearchEnabled(!webSearchEnabled); setMapsSearchEnabled(false); }} className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all border ${webSearchEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}>
                                        <div className={`w-2 h-2 rounded-full ${webSearchEnabled ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-zinc-700'}`}></div>
                                        Conexión Web
                                    </button>
                                    <button onClick={() => { setMapsSearchEnabled(!mapsSearchEnabled); setWebSearchEnabled(false); }} className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all border ${mapsSearchEnabled ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}>
                                        <div className={`w-2 h-2 rounded-full ${mapsSearchEnabled ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-zinc-700'}`}></div>
                                        Buscar Mapa
                                    </button>
                                </>
                            )}
                        </div>
                        <div className="bg-zinc-950/80 border border-zinc-800 rounded-[2rem] sm:rounded-[2.5rem] p-3 sm:p-4 pr-24 sm:pr-28 focus-within:border-violet-500/50 transition-all shadow-2xl backdrop-blur-md ring-1 ring-white/5 relative">
                            {isStartingEngine && (
                                <div className="absolute -top-12 left-0 right-0 flex items-center justify-center">
                                    <div className="bg-violet-600 text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.4)] animate-pulse border border-violet-500">
                                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                        Iniciando motor de IA Local... (puede tardar unos 20s)
                                    </div>
                                </div>
                            )}
                            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste} onInput={(e) => { e.target.style.height = 'inherit'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; }} placeholder={isStartingEngine ? "Esperando al motor local..." : "Consultar Artories IA o pega una imagen..."} className="w-full bg-transparent border-none focus:ring-0 text-white text-sm px-3 sm:px-4 py-2 sm:py-3 resize-none custom-scrollbar min-h-[40px] sm:min-h-[50px] font-medium leading-relaxed placeholder:text-zinc-600" rows={1} disabled={isStartingEngine} />
                            
                            <div className="absolute right-3.5 sm:right-6 bottom-3.5 sm:bottom-6 flex items-center gap-2">
                                <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || isStartingEngine} className="p-3 sm:p-4 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-2xl sm:rounded-[1.5rem] transition-all disabled:opacity-50">
                                    <Paperclip size={18} />
                                </button>
                                <button onClick={() => handleSend()} disabled={isLoading || isStartingEngine || (!input.trim() && attachments.length === 0)} className="p-3 sm:p-4 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-2xl sm:rounded-[1.5rem] transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)]">{isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button>
                            </div>
                            
                            <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden" />
                        </div>
                    </div>
                </div>
                    </>
                )}
            </main>
        </div>
    );
}
