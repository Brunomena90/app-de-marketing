import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, addDoc, doc, onSnapshot, serverTimestamp, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useRequests } from '../../context/RequestContext';
import {
    Sparkles, Send, User, Trash2, Plus, MessageSquare, Loader2, TrendingUp, Megaphone, FileText, ChevronLeft, Paperclip, X, File, Download, DownloadCloud
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendSmartMessage } from '../../services/geminiService';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import RequestDetail from '../../components/RequestDetail';

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
        const cleanCode = (code || '').trim();
        return '<pre class="bg-gray-50 border border-gray-200 rounded-xl p-5 my-6 overflow-x-auto text-[13px] font-mono text-gray-800 whitespace-pre-wrap leading-relaxed shadow-sm">' + cleanCode + '</pre>';
    });
    content = content.replace(/^#### (.*$)/gm, '<h4 class="text-gray-800 font-bold text-sm mt-6 mb-3 flex items-center gap-2 uppercase tracking-widest"><div class="w-1 h-3 bg-gray-400 rounded-full"></div> $1</h4>');
    content = content.replace(/^### (.*$)/gm, '<h3 class="text-gray-900 font-black text-base mt-8 mb-4 flex items-center gap-3"><div class="w-1.5 h-4 bg-blue-500 rounded-full"></div> $1</h3>');
    content = content.replace(/^## (.*$)/gm, '<h2 class="text-gray-900 font-black text-xl mt-10 mb-5 border-b border-gray-200 pb-3">$1</h2>');
    content = content.replace(/^# (.*$)/gm, '<h1 class="text-gray-900 font-black text-3xl mt-12 mb-6 tracking-tight">$1</h1>');
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 font-bold">$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em class="text-gray-600 italic">$1</em>');
    content = content.replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-blue-500 bg-blue-50 text-blue-800 p-4 rounded-r-lg my-4 font-medium">$1</blockquote>');
    content = content.replace(/^[\s]*[-*] (.*$)/gm, '<div class="flex items-start gap-3 my-2 group/item ml-2"><div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5 shrink-0"></div><span class="text-gray-700 text-[14px] leading-relaxed">$1</span></div>');
    
    const bArray = [];
    content = content.replace(/(<(div|pre|h1|h2|h3|blockquote|a|span)[\s\S]*?<\/\2>)/gi, (m) => { bArray.push(m); return "__STRUCT_BLOCK_" + (bArray.length - 1) + "__"; });
    content = content.replace(/\n/g, '<br />');
    bArray.forEach((b, i) => { content = content.replace("__STRUCT_BLOCK_" + i + "__", b); });
    return content.replace(/(<br \/>){3,}/g, '<br /><br />');
};

const QUICK_PROMPTS = [
    { icon: <TrendingUp size={16} />, label: 'Estrategia de Contenido', text: 'Propón una estrategia de contenido para este mes enfocada en ventas.' },
    { icon: <FileText size={16} />, label: 'Crear Solicitud Video', text: 'Crea una solicitud de video promocional de 30s para Instagram.' },
    { icon: <Megaphone size={16} />, label: 'Crear Campaña', text: 'Crea una nueva campaña llamada "CyberDays" con 3 sub-grupos.' }
];

const MessageBubble = ({ msg, onOpenRequest }) => {
    const isUser = msg.role === 'user';

    const handleMarkdownClick = (e) => {
        const btn = e.target.closest('.action-request-btn');
        if (btn && onOpenRequest) {
            onOpenRequest(btn.dataset.id);
        }
    };

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
            .replace(/```json[\s\S]*?```/g, '') // Ocultar bloques JSON de creacion
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
        <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-4 sm:gap-6 group mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105 ${isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-600 to-indigo-600'}`}>
                {isUser ? <User size={20} className="text-white" /> : <Sparkles size={20} className="text-white" />}
            </div>
            <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl p-5 sm:p-6 shadow-sm border ${isUser ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
                    {isUser ? (
                        <p className="text-[15px] font-medium leading-relaxed text-blue-900 whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                        <div onClick={handleMarkdownClick} className="prose prose-sm sm:prose-base max-w-none prose-p:text-gray-700 prose-a:text-blue-600" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    )}
                </div>
                <div className="flex items-center gap-3 mt-2 px-2 opacity-100 transition-opacity">
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isUser && (
                        <button onClick={handleExport} className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-500 hover:text-blue-700 transition-colors bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full">
                            <Download size={12} /> Exportar Doc
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const LoadingDotsBubble = () => (
    <div className={`flex flex-row gap-4 sm:gap-6 mb-8 animate-in fade-in duration-500`}>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-600`}>
            <Sparkles size={20} className="text-white animate-pulse" />
        </div>
        <div className={`max-w-[80%] flex flex-col items-start`}>
            <div className={`rounded-2xl p-6 bg-white border border-gray-100 shadow-sm h-14 flex items-center`}>
                <div className="flex gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                </div>
            </div>
        </div>
    </div>
);

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

export default function FuncionIA() {
    const navigate = useNavigate();
    const { user, activeEmpresa } = useAuth();
    const { requests: contextRequests } = useRequests();
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [attachments, setAttachments] = useState([]);
    
    // Local AI States
    const [activeModel, setActiveModel] = useState('gemini');
    const [modelStatuses, setModelStatuses] = useState({});
    const [downloads, setDownloads] = useState({});
    const [localEngineRunning, setLocalEngineRunning] = useState(false);
    const [isStartingEngine, setIsStartingEngine] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [mapsSearchEnabled, setMapsSearchEnabled] = useState(false);

    const LOCAL_MODELS = [
        { id: 'gemma', name: 'Gemma 4 (Local)', size: '1.6 GB' },
        { id: 'qwen', name: 'Qwen 3.5 (Local)', size: '2.1 GB' },
        { id: 'llama', name: 'Llama 4 (Local)', size: '3.8 GB' },
        { id: 'deepseek', name: 'DeepSeek (Local)', size: '2.4 GB' }
    ];

    useEffect(() => {
        if (!isElectron || activeModel === 'gemini') return;
        let started = false;
        
        const checkStatus = async () => {
            try {
                if (modelStatuses[activeModel] === undefined) {
                    setModelStatuses(prev => ({ ...prev, [activeModel]: 'checking' }));
                }
                const res = await window.electronAPI.getModelStatus(activeModel);
                const status = res.status;
                setModelStatuses(prev => ({ ...prev, [activeModel]: status }));
                if (status === 'ready') {
                    if (!started) {
                        started = true;
                        setIsStartingEngine(true);
                        setLocalEngineRunning(false);
                        try {
                            await window.electronAPI.startModel(activeModel);
                            setLocalEngineRunning(true);
                        } catch(err) {
                            console.error("Failed to start model:", err);
                            toast.error("Error al iniciar el motor de IA");
                        } finally {
                            setIsStartingEngine(false);
                        }
                    }
                } else {
                    setLocalEngineRunning(false);
                    started = false;
                }
            } catch (error) {
                console.error("Error checking model status:", error);
                setModelStatuses(prev => ({ ...prev, [activeModel]: 'error' }));
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, [activeModel]);

    useEffect(() => {
        if (!isElectron) return;
        const cleanup = window.electronAPI.onDownloadProgress((data) => {
            if (data.modelId) {
                setDownloads(prev => ({ ...prev, [data.modelId]: data.percent }));
                if (data.status === 'completed') {
                    setModelStatuses(prev => ({ ...prev, [data.modelId]: 'ready' }));
                    if (activeModel === data.modelId) {
                        setIsStartingEngine(true);
                        setLocalEngineRunning(false);
                        window.electronAPI.startModel(activeModel).then(() => {
                            setLocalEngineRunning(true);
                            setIsStartingEngine(false);
                        }).catch(e => {
                            toast.error("Error al iniciar el modelo");
                            setIsStartingEngine(false);
                        });
                    }
                }
            }
        });
        return cleanup;
    }, [activeModel]);

    const handleDownloadModel = async (modelId) => {
        if (!isElectron) return;
        try {
            await window.electronAPI.downloadModel(modelId);
            setModelStatuses(prev => ({ ...prev, [modelId]: 'downloading' }));
            setDownloads(prev => ({ ...prev, [modelId]: 0 }));
        } catch (error) {
            toast.error("Error al iniciar descarga");
        }
    };
    
    // Additional contexts for Marketing Module
    const [contextCampanas, setContextCampanas] = useState([]);
    const [contextCuadro, setContextCuadro] = useState([]);
    const [contextLinks, setContextLinks] = useState([]);
    const [contextCuadernos, setContextCuadernos] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);

    const handleOpenRequest = async (id) => {
        try {
            const docSnap = await getDoc(doc(db, "solicitudes_contenido", id));
            if (docSnap.exists()) {
                setSelectedRequest({ id: docSnap.id, ...docSnap.data() });
            } else {
                toast.error("La solicitud ya no existe.");
            }
        } catch (error) {
            toast.error("Error al cargar la solicitud.");
        }
    };

    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    const MARKETING_SYSTEM_PROMPT = `Eres la IA de Marketing Avanzada. Tu objetivo es ayudar al usuario con estrategias creativas, análisis de marca y creación de campañas. 
    ESTÁS INTEGRADO DIRECTAMENTE AL MÓDULO DE MARKETING.
    
    REGLAS ESTRICTAS PARA AUTOMATIZACIÓN:
    1. NUNCA crees una solicitud o campaña automáticamente si el usuario solo te está pidiendo ideas o sugerencias. ESPERA a que el usuario te diga EXPRESAMENTE algo como "Crea la solicitud" o "Crea la campaña" para enviar los bloques JSON. Si solo te piden ideas, responde solo con texto normal.
    2. Cuando crees una solicitud de video, EL TÍTULO NO DEBE LLEVAR LA PALABRA "Campaña". Debe ser un título directo para el video (Ej: "El Secreto de Mamá").
    3. El "briefing" SOLO es para ideas generales. Las escenas específicas y el guion técnico DEBEN ir en la estructura "checklist" (que es el Plan de Producción). NUNCA pongas las escenas a grabar dentro del briefing.
    4. Para MODIFICAR una solicitud, debes buscar su ID en la lista de 'solicitudes_disponibles'. Si el nombre que te da el usuario NO COINCIDE o es ambiguo, NO emitas el JSON; en su lugar pregúntale: "No encontré X, ¿te refieres a Y?" y espera su confirmación. Solo cuando estés seguro del ID exacto, emite el JSON para actualizarla.
    5. NO saludes ("Hola", "Qué gusto", etc.) en cada mensaje. Solo saluda si es el primer mensaje de la conversación. En los siguientes mensajes, ve directo al grano, responde de forma conversacional pero directa, sin saludos iniciales repetitivos.
    
    Para CREAR UNA SOLICITUD (SOLO CUANDO TE LO PIDAN EXPLÍCITAMENTE), responde en CUALQUIER PARTE de tu mensaje con este bloque de código JSON EXACTO (NO incluyas fechas de grabación):
    
    \`\`\`json
    {
      "action": "create_request",
      "data": {
        "title": "Título llamativo para la solicitud (SIN la palabra campaña)",
        "type": "video", 
        "area": "Marketing",
        "objetivo": "Objetivo de la pieza de contenido",
        "publico": "Público objetivo",
        "mensaje": "Mensaje principal a transmitir",
        "briefing": "Ideas generales (No poner escenas aquí)",
        "format": "Vertical (9:16)",
        "campaign": null,
        "checklist": [
          { "text": "Escena 1: Descripción visual y de audio", "completed": false, "type": "Solo Video" },
          { "text": "Escena 2: Descripción visual y de audio", "completed": false, "type": "Solo Video" }
        ]
      }
    }
    \`\`\`
    
    Para CREAR UNA CAMPAÑA (SOLO CUANDO TE LO PIDAN EXPLÍCITAMENTE), responde con este bloque de código JSON EXACTO:
    
    \`\`\`json
    {
      "action": "create_campaign",
      "data": {
        "name": "Nombre de la Campaña",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "subGroups": ["Sub-grupo 1", "Sub-grupo 2"]
      }
    }
    \`\`\`

    Para ACTUALIZAR UNA SOLICITUD (SOLO CUANDO ESTÉS SEGURO DEL ID), responde con este bloque:
    
    \`\`\`json
    {
      "action": "update_request",
      "data": {
        "id": "ID_DE_LA_SOLICITUD",
        "updates": {
          "briefing": "El briefing completo con las modificaciones (no omitas lo anterior si debe mantenerse)",
          "checklist": [
            { "text": "Escena 1...", "completed": false, "type": "Solo Video" }
          ]
        }
      }
    }
    \`\`\`

    Para ACTUALIZAR UNA CAMPAÑA:
    \`\`\`json
    {
      "action": "update_campaign",
      "data": { "id": "ID", "updates": { "name": "Nombre", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "subGroups": [] } }
    }
    \`\`\`

    Para CREAR O ACTUALIZAR CUADRO DE CONTENIDOS (Ideas):
    \`\`\`json
    {
      "action": "create_cuadro",
      "data": { "title": "Tema", "keyPoints": "Puntos clave", "date": "YYYY-MM-DD" }
    }
    \`\`\`
    \`\`\`json
    {
      "action": "update_cuadro",
      "data": { "id": "ID", "updates": { "title": "Tema", "keyPoints": "Puntos", "date": "YYYY-MM-DD", "status": "pendiente o convertido" } }
    }
    \`\`\`

    Para CREAR O ACTUALIZAR LINK (Libreta):
    \`\`\`json
    {
      "action": "create_link",
      "data": { "title": "Nombre", "url": "https://...", "description": "Desc", "category": "Categoria" }
    }
    \`\`\`
    \`\`\`json
    {
      "action": "update_link",
      "data": { "id": "ID", "updates": { "title": "Nombre", "url": "https://...", "description": "Desc", "category": "Categoria" } }
    }
    \`\`\`

    Para CREAR O ACTUALIZAR CUADERNO:
    \`\`\`json
    {
      "action": "create_cuaderno",
      "data": { "title": "Título" }
    }
    \`\`\`
    \`\`\`json
    {
      "action": "update_cuaderno",
      "data": { "id": "ID", "updates": { "title": "Título" } }
    }
    \`\`\`

    (Nota: 'type' para solicitudes puede ser 'video' o 'post'). Asegúrate de ser creativo, persuasivo y muy estructurado en tus respuestas. Conoces la marca actual por la empresa seleccionada.`;

    useEffect(() => {
        if (!user || !activeEmpresa) return;
        const q = query(collection(db, 'marketing_ai_chats'), where('empresa', '==', activeEmpresa), where('userId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const sessionsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setSessions(sessionsData);
            
            const savedId = localStorage.getItem('marketing_ai_last_session_' + activeEmpresa);
            if (!activeSessionId) {
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
    }, [user, activeEmpresa, activeSessionId]);

    // Load additional marketing contexts
    useEffect(() => {
        if (!activeEmpresa) return;
        
        const qCampanas = activeEmpresa === 'Todas' ? query(collection(db, 'campanas')) : query(collection(db, 'campanas'), where('empresa', '==', activeEmpresa));
        const unsubCampanas = onSnapshot(qCampanas, snap => setContextCampanas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qCuadro = activeEmpresa === 'Todas' ? query(collection(db, 'cuadro_contenidos')) : query(collection(db, 'cuadro_contenidos'), where('empresa', '==', activeEmpresa));
        const unsubCuadro = onSnapshot(qCuadro, snap => setContextCuadro(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qLinks = activeEmpresa === 'Todas' ? query(collection(db, 'links')) : query(collection(db, 'links'), where('empresa', '==', activeEmpresa));
        const unsubLinks = onSnapshot(qLinks, snap => setContextLinks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qCuadernos = activeEmpresa === 'Todas' ? query(collection(db, 'cuadernos')) : query(collection(db, 'cuadernos'), where('empresa', '==', activeEmpresa));
        const unsubCuadernos = onSnapshot(qCuadernos, snap => setContextCuadernos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => {
            unsubCampanas();
            unsubCuadro();
            unsubLinks();
            unsubCuadernos();
        };
    }, [activeEmpresa]);

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
        if ((!text.trim() && attachments.length === 0) || isLoading) return;
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
                const newChat = { empresa: activeEmpresa, userId: user.uid, title: text.substring(0, 40), messages: [userMsg], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
                const docRef = await addDoc(collection(db, 'marketing_ai_chats'), newChat);
                currentId = docRef.id;
                setActiveSessionId(currentId);
                localStorage.setItem('marketing_ai_last_session_' + activeEmpresa, currentId);
            }

            const textLower = text.toLowerCase();
            const searchWords = textLower.split(/\s+/).filter(w => w.length > 3);
            
            // Obtener solo las últimas 10 solicitudes de la empresa
            const solicitudes_optimizadas = contextRequests
                .filter(r => r.empresa === activeEmpresa)
                .slice(0, 10)
                .map(r => {
                    return { 
                        id: r.id, 
                        title: r.title, 
                        status: r.status,
                        briefing: r.briefing, 
                        checklist: r.checklist 
                    };
                });

            let aiText = "";

            if (activeModel !== 'gemini' && isElectron && localEngineRunning) {
                // Interceptar llamada para usar Local AI en Marketing
                const globalMemory = localStorage.getItem('artories_global_memory') || '';
                
                // Add short context of existing DB items directly into system prompt since we don't have embeddings setup yet
                const localContextStr = `
EMPRESA SELECCIONADA ACTUALMENTE: "${activeEmpresa}".
Todas tus respuestas y acciones deben estar 100% enfocadas en la empresa ${activeEmpresa}.
${globalMemory ? `MEMORIA A LARGO PLAZO DE LA MARCA:\n${globalMemory}\n` : ''}
ÚLTIMAS 10 SOLICITUDES DE LA MARCA PARA CONTEXTO DE MARKETING: ${JSON.stringify(solicitudes_optimizadas).substring(0, 800)}...
CAMPAÑAS DE LA MARCA: ${JSON.stringify(contextCampanas).substring(0, 800)}...
                `;

                const combinedSystemPrompt = MARKETING_SYSTEM_PROMPT + "\n\n" + localContextStr;

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
                aiText = data.choices[0].message.content;
            } else {
                // Gemini Cloud
                const aiResponse = await sendSmartMessage({ 
                    message: text, 
                    history: messages, 
                    empresa: activeEmpresa, 
                    appData: { 
                        solicitudes_disponibles: solicitudes_optimizadas,
                        campanas_disponibles: contextCampanas,
                        cuadro_contenidos_disponibles: contextCuadro,
                        links_disponibles: contextLinks,
                        cuadernos_disponibles: contextCuadernos
                    },
                    appContext: MARKETING_SYSTEM_PROMPT,
                    attachments: currentAtts
                });
                aiText = aiResponse.text;
            }

            // Procesar Múltiples JSON Actions si existen
            const jsonMatches = [...aiText.matchAll(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/g)];
            for (const match of jsonMatches) {
                try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.action === 'create_request' && parsed.data) {
                        const data = parsed.data;
                        const base = {
                            title: data.title || 'Solicitud generada por IA',
                            area: data.area || 'Marketing',
                            type: data.type || 'video',
                            campaign: data.campaign || null,
                            status: 'solicitado',
                            applicantName: user.name,
                            applicantId: user.uid,
                            createdAt: new Date().toISOString(),
                            requestDate: new Date().toISOString().split('T')[0],
                            empresa: activeEmpresa,
                            objetivo: data.objetivo || '',
                            publico: data.publico || '',
                            mensaje: data.mensaje || '',
                            briefing: data.briefing || '',
                            format: data.format || 'Horizontal (16:9)',
                            checklist: Array.isArray(data.checklist) ? data.checklist : [],
                        };
                        const docRef = await addDoc(collection(db, "solicitudes_contenido"), base);
                        toast.success("¡Solicitud creada exitosamente!");
                        aiText = aiText.replace(match[0], `\n\n> ✅ **He creado la solicitud exitosamente.** <button class="action-request-btn text-blue-600 font-bold hover:text-blue-800 transition-colors" data-id="${docRef.id}">Haz clic aquí para revisarla y editar su plan de producción</button>.`);
                    } else if (parsed.action === 'create_campaign' && parsed.data) {
                        const data = parsed.data;
                        const base = {
                            name: data.name || 'Campaña generada por IA',
                            startDate: data.startDate || new Date().toISOString().split('T')[0],
                            endDate: data.endDate || '',
                            status: 'activa',
                            createdAt: new Date().toISOString(),
                            empresa: activeEmpresa,
                            subGroups: Array.isArray(data.subGroups) ? data.subGroups : []
                        };
                        await addDoc(collection(db, "campanas"), base);
                        toast.success("¡Campaña creada exitosamente!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He creado la campaña exitosamente.** Revisa la pestaña de 'Campañas'.");
                    } else if (parsed.action === 'update_request' && parsed.data && parsed.data.id) {
                        await updateDoc(doc(db, "solicitudes_contenido", parsed.data.id), parsed.data.updates);
                        toast.success("¡Solicitud actualizada exitosamente!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He modificado la solicitud exitosamente.** Puedes revisarla en la pestaña de 'Solicitudes'.");
                    } else if (parsed.action === 'update_campaign' && parsed.data && parsed.data.id) {
                        await updateDoc(doc(db, "campanas", parsed.data.id), parsed.data.updates);
                        toast.success("¡Campaña actualizada exitosamente!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He modificado la campaña exitosamente.**");
                    } else if (parsed.action === 'create_cuadro' && parsed.data) {
                        const base = {
                            title: parsed.data.title || 'Nueva Idea',
                            keyPoints: parsed.data.keyPoints || parsed.data.points || '',
                            date: parsed.data.date || new Date().toISOString().split('T')[0],
                            status: 'pendiente',
                            createdAt: serverTimestamp(),
                            empresa: activeEmpresa
                        };
                        await addDoc(collection(db, "cuadro_contenidos"), base);
                        toast.success("¡Añadido al Cuadro de Contenidos!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He añadido tu idea al Cuadro de Contenidos.**");
                    } else if (parsed.action === 'update_cuadro' && parsed.data && parsed.data.id) {
                        await updateDoc(doc(db, "cuadro_contenidos", parsed.data.id), parsed.data.updates);
                        toast.success("¡Cuadro de Contenidos actualizado!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He actualizado el Cuadro de Contenidos.**");
                    } else if (parsed.action === 'create_link' && parsed.data) {
                        const base = {
                            title: parsed.data.title || 'Nuevo Link',
                            url: parsed.data.url || '#',
                            description: parsed.data.description || '',
                            category: parsed.data.category || '',
                            createdAt: serverTimestamp(),
                            empresa: activeEmpresa
                        };
                        await addDoc(collection(db, "links"), base);
                        toast.success("¡Link guardado en la libreta!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He guardado el enlace en tu Libreta de Links.**");
                    } else if (parsed.action === 'update_link' && parsed.data && parsed.data.id) {
                        await updateDoc(doc(db, "links", parsed.data.id), { ...parsed.data.updates, updatedAt: serverTimestamp() });
                        toast.success("¡Link actualizado!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He modificado el enlace en la libreta.**");
                    } else if (parsed.action === 'create_cuaderno' && parsed.data) {
                        const base = {
                            title: parsed.data.title || 'Nuevo Cuaderno',
                            createdAt: serverTimestamp(),
                            createdBy: user?.name || 'IA',
                            createdByUid: user?.uid || '',
                            sections: [],
                            empresa: activeEmpresa
                        };
                        await addDoc(collection(db, "cuadernos"), base);
                        toast.success("¡Cuaderno creado!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He creado un nuevo Cuaderno de Escenas para ti.**");
                    } else if (parsed.action === 'update_cuaderno' && parsed.data && parsed.data.id) {
                        await updateDoc(doc(db, "cuadernos", parsed.data.id), parsed.data.updates);
                        toast.success("¡Cuaderno actualizado!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He actualizado el Cuaderno.**");
                    }
                } catch(e) {
                    console.error("Failed to parse JSON from AI", e);
                }
            }

            const aiMsg = { role: 'model', content: aiText, timestamp: Date.now() };
            const finalMessages = [...newMessages, aiMsg];
            setMessages(finalMessages);
            await updateDoc(doc(db, 'marketing_ai_chats', currentId), { messages: finalMessages, updatedAt: serverTimestamp() });
        } catch (err) { 
            console.error(err);
            toast.error(err.message || 'Error de comunicación con la IA'); 
        } finally { 
            setIsLoading(false); 
        }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
    const createNewChat = () => { setActiveSessionId('new'); setMessages([]); setShowSuggestions(true); localStorage.removeItem('marketing_ai_last_session_' + activeEmpresa); };
    const deleteSession = async (e, id) => { e.stopPropagation(); try { await deleteDoc(doc(db, 'marketing_ai_chats', id)); if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); setShowSuggestions(true); } } catch (err) { toast.error('Error al eliminar'); } };

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans">
            <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-gray-800 font-bold text-lg flex items-center gap-2">
                            Función IA 
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wide font-bold border border-blue-200">
                                Marketing
                            </span>
                        </h1>
                    </div>
                    {/* SELECTOR DE MODELOS CLONADO */}
                    <div className="ml-4 relative group">
                        <select 
                            value={activeModel}
                            onChange={(e) => setActiveModel(e.target.value)}
                            className="appearance-none bg-white border border-gray-300 text-gray-700 text-sm font-bold py-1.5 pl-4 pr-10 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                        >
                            <option value="gemini">Gemini Cloud (Online)</option>
                            {isElectron && LOCAL_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
                <button onClick={createNewChat} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-transform active:scale-95">
                    <Plus size={16} /> Nuevo Chat
                </button>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Historial Lateral */}
                <div className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-xs font-bold uppercase text-gray-400">Historial de Consultas</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {sessions.map(s => (
                            <div key={s.id} onClick={() => { setActiveSessionId(s.id); setMessages(s.messages || []); setShowSuggestions(false); localStorage.setItem('marketing_ai_last_session_' + activeEmpresa, s.id); }} className={`group p-3 rounded-lg cursor-pointer transition-all border ${activeSessionId === s.id ? 'bg-blue-50 border-blue-200' : 'bg-transparent border-transparent hover:bg-gray-50'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className={`text-[13px] font-medium truncate ${activeSessionId === s.id ? 'text-blue-700 font-bold' : 'text-gray-600'}`}>{s.title}</p>
                                    <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-400 rounded-md transition-colors shrink-0"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No hay historial</p>
                        )}
                    </div>
                </div>

                {/* Área de Chat */}
                <div className="flex-1 flex flex-col relative bg-slate-50">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
                        {showSuggestions ? (
                            <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                                    <Sparkles className="text-white w-10 h-10 sm:w-12 sm:h-12" />
                                </div>
                                <div className="text-center">
                                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Asistente IA de Marketing</h2>
                                    <p className="text-gray-500 text-sm sm:text-base">Puedo ayudarte a planificar estrategias, redactar copy y <strong className="text-blue-600">crear solicitudes o campañas</strong> directamente en el sistema.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                    {QUICK_PROMPTS.map((p, i) => (
                                        <button key={i} onClick={() => handleSend(p.text)} className="bg-white border border-gray-200 p-5 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-left group">
                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">{p.icon}</div>
                                            <p className="font-bold text-sm text-gray-800 mb-1">{p.label}</p>
                                            <p className="text-xs text-gray-500 leading-relaxed">{p.text}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto py-4">
                                {isElectron && activeModel !== 'gemini' && modelStatuses[activeModel] !== 'ready' && modelStatuses[activeModel] !== 'checking' && modelStatuses[activeModel] !== undefined && (
                                    <div className="mb-6 p-4 bg-white border border-blue-200 rounded-2xl flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><DownloadCloud size={18} /></div>
                                            <div>
                                                <h4 className="text-gray-800 font-bold text-sm">Modelo Requerido</h4>
                                                <p className="text-gray-500 text-xs">El modelo {LOCAL_MODELS.find(m=>m.id === activeModel)?.name} no está en tu disco.</p>
                                            </div>
                                        </div>
                                        <div>
                                            {modelStatuses[activeModel] === 'downloading' ? (
                                                <div className="text-right">
                                                    <div className="w-24 sm:w-32 bg-gray-200 rounded-full h-2 mb-1">
                                                        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${downloads[activeModel]}%` }}></div>
                                                    </div>
                                                    <span className="text-xs text-blue-600 font-bold">{downloads[activeModel]}%</span>
                                                </div>
                                            ) : (
                                                <button onClick={() => handleDownloadModel(activeModel)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm">
                                                    Descargar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {messages.map((m, i) => (<MessageBubble key={i} msg={m} onOpenRequest={handleOpenRequest} />))}
                                {isLoading && <LoadingDotsBubble />}
                                <div ref={chatEndRef} className="h-10" />
                            </div>
                        )}
                    </div>

                    <div className="p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1.5rem)] chat-bottom-gradient sticky bottom-0">
                        <div className="max-w-3xl mx-auto">
                            {attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {attachments.map((att, i) => (
                                        <div key={i} className="bg-white border border-blue-200 shadow-sm rounded-lg py-1.5 px-3 flex items-center gap-2 text-xs text-blue-700 animate-in fade-in zoom-in-95">
                                            <File size={14} className="text-blue-500 shrink-0" />
                                            <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                                            <button onClick={() => removeAttachment(i)} className="hover:text-red-500 transition-colors ml-1 shrink-0"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="flex items-center gap-4 mb-3 ml-2">
                                {isElectron && activeModel !== 'gemini' && (
                                    <>
                                        <button onClick={() => { setWebSearchEnabled(!webSearchEnabled); setMapsSearchEnabled(false); }} className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all border ${webSearchEnabled ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : 'bg-white text-gray-500 border-gray-300 hover:text-gray-700'}`}>
                                            <div className={`w-2 h-2 rounded-full ${webSearchEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                            Conexión Web
                                        </button>
                                        <button onClick={() => { setMapsSearchEnabled(!mapsSearchEnabled); setWebSearchEnabled(false); }} className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all border ${mapsSearchEnabled ? 'bg-blue-50 text-blue-600 border-blue-300' : 'bg-white text-gray-500 border-gray-300 hover:text-gray-700'}`}>
                                            <div className={`w-2 h-2 rounded-full ${mapsSearchEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                                            Buscar Mapa
                                        </button>
                                    </>
                                )}
                            </div>
                            
                            <div className="flex gap-2 relative">
                                {isStartingEngine && (
                                    <div className="absolute -top-10 left-0 right-0 flex items-center justify-center">
                                        <div className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
                                            <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                            Iniciando motor de IA Local... (puede tardar unos 20s)
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onPaste={handlePaste}
                                    onInput={(e) => {
                                        e.target.style.height = 'inherit';
                                        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                                    }}
                                    placeholder={isStartingEngine ? "Esperando al motor local..." : "Escribe tu consulta, pega un texto o pide crear una solicitud/campaña..."}
                                    className="w-full bg-transparent border-none text-gray-800 text-sm py-2 px-2 resize-none outline-none custom-scrollbar placeholder:text-gray-400" 
                                    rows={1}
                                    disabled={isStartingEngine}
                                />
                                <button 
                                    onClick={() => handleSend()} 
                                    disabled={isLoading || isStartingEngine || (!input.trim() && attachments.length === 0)} 
                                    className="absolute right-2 bottom-2 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 rounded-xl transition-all shadow-sm"
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin text-white" /> : <Send size={18} className={(!input.trim() && attachments.length === 0) ? "text-gray-400" : "text-white"} />}
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-gray-400 mt-3 font-medium uppercase tracking-widest">
                                Inteligencia Artificial con permisos de escritura en la app
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {selectedRequest && (
                <RequestDetail 
                    request={selectedRequest} 
                    isOpen={!!selectedRequest} 
                    onClose={() => setSelectedRequest(null)} 
                />
            )}
        </div>
    );
}
