import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, addDoc, doc, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useRequests } from '../../context/RequestContext';
import {
    Sparkles, Send, User, Trash2, Plus, MessageSquare, Loader2, TrendingUp, Megaphone, FileText, ChevronLeft, Paperclip, X, File
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendSmartMessage } from '../../services/geminiService';
import { toast } from 'sonner';

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

const MessageBubble = ({ msg }) => {
    const isUser = msg.role === 'user';
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
                        <div className="prose prose-sm sm:prose-base max-w-none prose-p:text-gray-700 prose-a:text-blue-600" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    )}
                </div>
                <span className="text-[10px] uppercase font-bold text-gray-400 mt-2 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
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
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);

    const MARKETING_SYSTEM_PROMPT = `Eres la IA de Marketing Avanzada. Tu objetivo es ayudar al usuario con estrategias creativas, análisis de marca y creación de campañas. 
    ESTÁS INTEGRADO DIRECTAMENTE AL MÓDULO DE MARKETING.
    
    REGLAS ESTRICTAS PARA AUTOMATIZACIÓN:
    1. NUNCA crees una solicitud o campaña automáticamente si el usuario solo te está pidiendo ideas o sugerencias. ESPERA a que el usuario te diga EXPRESAMENTE algo como "Crea la solicitud" o "Crea la campaña" para enviar los bloques JSON. Si solo te piden ideas, responde solo con texto normal.
    2. Cuando crees una solicitud de video, EL TÍTULO NO DEBE LLEVAR LA PALABRA "Campaña". Debe ser un título directo para el video (Ej: "El Secreto de Mamá").
    3. El "briefing" SOLO es para ideas generales. Las escenas específicas y el guion técnico DEBEN ir en la estructura "checklist" (que es el Plan de Producción). NUNCA pongas las escenas a grabar dentro del briefing.
    4. Para MODIFICAR una solicitud, debes buscar su ID en la lista de 'solicitudes_disponibles'. Si el nombre que te da el usuario NO COINCIDE o es ambiguo, NO emitas el JSON; en su lugar pregúntale: "No encontré X, ¿te refieres a Y?" y espera su confirmación. Solo cuando estés seguro del ID exacto, emite el JSON para actualizarla.
    
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

    const handleSend = async (textToSend) => {
        const text = textToSend || input;
        if ((!text.trim() && attachments.length === 0) || isLoading) return;
        setInput('');
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
            
            const solicitudes_optimizadas = contextRequests.map(r => {
                const titleLower = (r.title || '').toLowerCase();
                const isMentioned = searchWords.some(w => titleLower.includes(w));
                
                if (isMentioned) {
                    return { id: r.id, title: r.title, briefing: r.briefing, checklist: r.checklist };
                }
                return { id: r.id, title: r.title }; // Payload ligero
            });

            const aiResponse = await sendSmartMessage({ 
                message: text, 
                history: messages, 
                empresa: activeEmpresa, 
                appData: { solicitudes_disponibles: solicitudes_optimizadas },
                appContext: MARKETING_SYSTEM_PROMPT,
                attachments: currentAtts
            });

            let aiText = aiResponse.text;

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
                        await addDoc(collection(db, "solicitudes_contenido"), base);
                        toast.success("¡Solicitud creada exitosamente!");
                        aiText = aiText.replace(match[0], "\n\n> ✅ **He creado la solicitud exitosamente.** Revisa la pestaña de 'Solicitudes'.");
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
                    }
                } catch(e) {
                    console.error("Failed to parse JSON from AI", e);
                }
            }

            const aiMsg = { role: 'model', content: aiText, timestamp: Date.now() };
            const finalMessages = [...newMessages, aiMsg];
            setMessages(finalMessages);
            await updateDoc(doc(db, 'marketing_ai_chats', currentId), { messages: finalMessages, updatedAt: serverTimestamp() });
        } catch (err) { toast.error('Error de red'); } finally { setIsLoading(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
    const createNewChat = () => { setActiveSessionId('new'); setMessages([]); setShowSuggestions(true); localStorage.removeItem('marketing_ai_last_session_' + activeEmpresa); };
    const deleteSession = async (e, id) => { e.stopPropagation(); try { await deleteDoc(doc(db, 'marketing_ai_chats', id)); if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); setShowSuggestions(true); } } catch (err) { toast.error('Error al eliminar'); } };

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-slate-50 font-sans">
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
                                {messages.map((m, i) => (<MessageBubble key={i} msg={m} />))}
                                {isLoading && <LoadingDotsBubble />}
                                <div ref={chatEndRef} className="h-10" />
                            </div>
                        )}
                    </div>

                    <div className="p-4 sm:p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent sticky bottom-0">
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
                            <div className="bg-white border border-gray-300 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl p-2 pl-3 pr-14 transition-all shadow-sm relative flex items-center min-h-[60px]">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                    multiple 
                                    accept=".pdf,image/*,.txt,.csv"
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0"
                                    title="Adjuntar Archivo"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <textarea 
                                    value={input} 
                                    onChange={(e) => setInput(e.target.value)} 
                                    onKeyDown={handleKeyDown} 
                                    placeholder="Escribe tu consulta, pega un texto o pide crear una solicitud/campaña..." 
                                    className="w-full bg-transparent border-none text-gray-800 text-sm py-2 px-2 resize-none outline-none custom-scrollbar placeholder:text-gray-400" 
                                    rows={1} 
                                />
                                <button 
                                    onClick={() => handleSend()} 
                                    disabled={isLoading || (!input.trim() && attachments.length === 0)} 
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
        </div>
    );
}
