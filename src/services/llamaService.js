import { toast } from 'sonner';

// Reemplazar esto temporalmente hasta que el usuario nos de las credenciales exactas
const API_URL = import.meta.env.VITE_LLAMA_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const API_KEY = import.meta.env.VITE_LLAMA_API_KEY || '';
const MODEL = import.meta.env.VITE_LLAMA_MODEL || 'llama-3.3-70b-versatile';

export const sendLlamaMessage = async ({ message, history, empresa, appData, appContext, attachments }) => {
    
    // Construir el contexto en base a appData y empresa para inyectarlo al sistema
    let systemPrompt = appContext || 'Eres un asistente experto.';
    
    if (empresa) {
        systemPrompt += `\n\nEMPRESA SELECCIONADA ACTUALMENTE: "${empresa}".\nTodas tus respuestas y acciones deben estar 100% enfocadas en la empresa ${empresa}.`;
    }

    if (appData) {
        systemPrompt += `\n\nCONTEXTO ACTUAL DE LA APLICACIÓN (JSON):`;
        Object.entries(appData).forEach(([key, value]) => {
            if (value && (Array.isArray(value) ? value.length > 0 : true)) {
                // Truncar datos muy largos para evitar exceder los límites de tokens
                const stringified = JSON.stringify(value);
                systemPrompt += `\n- ${key.toUpperCase()}: ${stringified.length > 1500 ? stringified.substring(0, 1500) + '...' : stringified}`;
            }
        });
    }

    const apiMessages = [
        { role: 'system', content: systemPrompt }
    ];
    
    if (history && history.length > 0) {
        history.forEach(m => {
            if (m.role === 'user' || m.role === 'model' || m.role === 'assistant') {
                apiMessages.push({
                    role: (m.role === 'model' || m.role === 'assistant') ? 'assistant' : 'user',
                    content: m.content
                });
            }
        });
    }

    let userContent = message;
    if (attachments && attachments.length > 0) {
        userContent += `\n\n[Nota: El usuario adjuntó ${attachments.length} archivo(s), pero actualmente la API no soporta visión/archivos. Ignorar este hecho a menos que sea relevante]`;
    }
    
    apiMessages.push({ role: 'user', content: userContent });

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 4096,
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error?.message || 'Error en la respuesta de la API Llama 3.1');
        }

        const data = await res.json();
        return { text: data.choices[0].message.content };
    } catch (error) {
        console.error('Llama Service Error:', error);
        throw error;
    }
};
