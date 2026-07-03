import { google } from 'googleapis';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import process from 'process';
import { authorize } from './auth.js';

// Cargar variables de entorno
dotenv.config();

// Inicializar Firebase Admin SDK
// Nota: Necesitas serviceAccountKey.json descargado desde Configuración del Proyecto > Cuentas de Servicio en Firebase
const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');
try {
    admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT_PATH)
    });
} catch (error) {
    if (!admin.apps.length) {
        console.error('Error inicializando Firebase Admin. Verifica que serviceAccountKey.json existe en backend/ y es válido.');
        process.exit(1);
    }
}

const db = admin.firestore();

/**
 * Decodifica Base64 de un body de Gmail
 */
function decodeBase64(data) {
    return Buffer.from(data, 'base64').toString('utf-8');
}

/**
 * Busca y extrae el texto plano del mensaje de correo.
 */
function getEmailBody(payload) {
    let body = '';
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain') {
                body += decodeBase64(part.body.data);
            } else if (part.parts) {
                body += getEmailBody(part); // recursive for multi-part
            }
        }
    } else if (payload.body && payload.body.data) {
        body = decodeBase64(payload.body.data);
    }
    return body;
}

/**
 * Sincroniza correos no leídos y los enlaza a contactos en Firestore
 */
async function syncEmails(authClient) {
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    console.log('Buscando correos no leídos en Gmail...');
    
    // Buscar mensajes con la etiqueta UNREAD o una query específica
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread -from:me', // Ignorar correos enviados por nosotros mismos
        maxResults: 20
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) {
        console.log('No hay mensajes nuevos.');
        return;
    }

    console.log(`Se encontraron ${messages.length} mensajes. Analizando...`);

    for (const msg of messages) {
        const msgId = msg.id;
        
        try {
            // Obtener el formato completo del mensaje
            const messageData = await gmail.users.messages.get({
                userId: 'me',
                id: msgId,
                format: 'full'
            });

            const payload = messageData.data.payload;
            const headers = payload.headers;

            // Extraer Subject y From
            const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject');
            const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
            
            const subject = subjectHeader ? subjectHeader.value : '(Sin Asunto)';
            const fromRaw = fromHeader ? fromHeader.value : '';
            
            // Extraer solo el email (e.g. "Nombre <correo@dominio.com>" -> "correo@dominio.com")
            const emailMatch = fromRaw.match(/<([^>]+)>/) || [null, fromRaw.trim()];
            const senderEmail = emailMatch[1].trim().toLowerCase();

            // Extraer cuerpo (texto)
            const snippet = messageData.data.snippet;
            const fullBodyText = getEmailBody(payload) || snippet;

            console.log(`Procesando email de: ${senderEmail} - Asunto: ${subject}`);

            // Buscar en Firebase si el remitente existe en Contactos
            // Nota: Aquí asumo que tu colección se llama "contactos" y el campo email es "email"
            const contactsRef = db.collection('contactos');
            const snapshot = await contactsRef.where('email', '==', senderEmail).limit(1).get();

            if (!snapshot.empty) {
                const contactDoc = snapshot.docs[0];
                const contactId = contactDoc.id;
                console.log(` ¡Contacto encontrado! ID: ${contactId}. Registrando actividad...`);

                // Insertar actividad relacionada a este contacto
                // Esto permite tener el historial en un subcolección `actividades` o collection central
                await contactDoc.ref.collection('actividades').add({
                    tipo: 'email',
                    origen: 'gmail_sync',
                    fecha: admin.firestore.FieldValue.serverTimestamp(),
                    asunto: subject,
                    cuerpo: fullBodyText,
                    msgId: msgId
                });

                console.log(' Actividad registrada con éxito.');
            } else {
                console.log(` No se encontró contacto para ${senderEmail}.`);
            }

            // Marcar mensaje como leído quitando UNREAD
            // (Opcional: Si prefieres no quitar UNREAD, puedes agregar una etiqueta personalizada)
            const labelsToRemove = ['UNREAD'];
            const syncLabelName = process.env.SYNC_LABEL_NAME;
            
            let labelsToAdd = [];
            
            // Si configuraste una etiqueta custom (requiere haber creado la etiqueta primero en Gmail)
            if (syncLabelName) {
                // Para agregarla se necesitaría saber su ID de etiqueta internamente.
                // Como workaround seguro y directo solo quitamos el UNREAD.
            }

            await gmail.users.messages.modify({
                userId: 'me',
                id: msgId,
                requestBody: {
                    removeLabelIds: labelsToRemove,
                    addLabelIds: labelsToAdd
                }
            });
            console.log(' - Mensaje marcado como procesado (leído).');
            
        } catch (err) {
            console.error(`Error procesando el mensaje ${msgId}:`, err.message);
        }
    }
}

// Ejecución principal
async function run() {
    try {
        const client = await authorize();
        await syncEmails(client);
        console.log('Sincronización completada.');
        process.exit(0);
    } catch (error) {
        console.error('Error durante la sincronización:', error);
        process.exit(1);
    }
}

// Iniciar
run();
