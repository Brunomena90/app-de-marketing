/**
 * Artories IA - Motores Generación 3 (Confirmados)
 */

const GEMINI_API_KEY = 'AIzaSyA22WNzyce8_CBFmCIsGCrEi67v_AgGvlk';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const MODELS = {
    FLASH: 'gemini-3-flash-preview',
    PRO:   'gemini-3.1-pro-preview'
};

export const sendSmartMessage = async ({ message, history = [], empresa, appContext = '', appData, attachments = [] }) => {
    const contextData = JSON.stringify(appData || {});
    
    // System Instruction: Define el carácter, aprendizaje y prevención de vacíos de la IA
    const instructions = `Eres ARTORIES IA (G3 Strategic Assistant), un analista y asistente estratégico extremadamente inteligente, empático y MUY amable.
REGLA 1 (Sin Vacíos): Tu respuesta JAMÁS debe estar vacía ni contener solo espacios. Siempre debes proveer una respuesta valiosa, bien estructurada.
REGLA 2 (Personalidad): Eres servicial, cálido y proactivo. Aprende del contexto que te da el usuario en el historial. Trátalo con respeto y usa un tono consultivo premium.
REGLA 3 (Formato): Usa Markdown estructurado (# para títulos, negritas, viñetas). NUNCA uses código HTML crudo. 
CONCTEXTO DE EMPRESA: Estás ayudando a la empresa "${empresa || 'Global'}".
DATOS ACTUALES: ${contextData.substring(0, 3000)} // Truncado para seguridad
INSTRUCCIÓN ADICIONAL: ${appContext}`;

    // Unir historial y mensaje actual asegurando alternancia estricta de roles (Requisito de Gemini)
    const allMessages = [...history, { role: 'user', content: message, attachments }];
    const contents = [];
    
    allMessages.forEach(msg => {
        const role = msg.role === 'model' ? 'model' : 'user';
        const parts = [{ text: msg.content || '...' }];
        
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(att => {
                if (att.mimeType && att.data) {
                    parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
                }
            });
        }

        if (contents.length > 0 && contents[contents.length - 1].role === role) {
            // Si el rol es el mismo que el anterior, combinamos las partes para no romper la regla
            contents[contents.length - 1].parts.push({ text: '\n\n---\n\n' });
            contents[contents.length - 1].parts.push(...parts);
        } else {
            contents.push({ role, parts });
        }
    });

    const payload = {
        systemInstruction: {
            parts: [{ text: instructions }]
        },
        contents: contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
        }
    };

    try {
        const response = await fetch(`${BASE_URL}/${MODELS.FLASH}:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Error en Motor G3');
        }

        const data = await response.json();
        
        let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // Prevención de vacíos por seguridad
        if (!responseText || responseText.trim() === '') {
            responseText = "Comprendo lo que me indicas. ¿Hay algún detalle adicional que te gustaría analizar sobre la empresa?";
        }

        return {
            text: responseText,
            tier: 'G3-Strategic',
            modelName: MODELS.PRO
        };
    } catch (error) {
        console.error('Artories G3 Engine Error:', error);
        throw error;
    }
};
