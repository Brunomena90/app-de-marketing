/**
 * Servicio para integración con Gmail vía Google Identity Services (OAuth2) y Gmail REST API.
 * 
 * NOTA: Para que esto funcione en producción, debes reemplazar 'YOUR_GOOGLE_CLIENT_ID' 
 * por un Client ID de OAuth 2.0 válido desde Google Cloud Console configurado para 
 * Aplicaciones Web con la URL de tu aplicación en orígenes autorizados.
 */

const CLIENT_ID = '539766146005-sfd7r7cqhni340jnl44vv9vf8nko4ogo.apps.googleusercontent.com'; // Reemplazar con el Client ID real
const SCOPES = 'https://www.googleapis.com/auth/gmail.send';

let tokenClient;
let accessToken = null;

/**
 * Inicializa el cliente de token de Google. 
 * Debe llamarse cuando el componente se monta y window.google está disponible.
 */
export const initGmailClient = () => {
    if (!window.google) {
        console.error("Google Identity Services no está cargado.");
        return;
    }

    if (!tokenClient) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    // Trigger custom event so UI knows authentication is complete
                    window.dispatchEvent(new CustomEvent('gmail-authenticated', { detail: tokenResponse }));
                }
            },
        });
    }
};

/**
 * Solicita autorización al usuario (abre popup de Google).
 * Retorna una promesa que se resuelve con el access_token o se rechaza en caso de error.
 */
export const requestGmailAuthorization = () => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            reject(new Error("Cliente de Gmail no inicializado."));
            return;
        }

        if (accessToken) {
            resolve(accessToken);
            return;
        }

        const handleAuth = (e) => {
            window.removeEventListener('gmail-authenticated', handleAuth);
            resolve(e.detail.access_token);
        };

        window.addEventListener('gmail-authenticated', handleAuth);
        
        try {
            // Solicitar el token (abre popup)
            tokenClient.requestAccessToken();
        } catch (error) {
            window.removeEventListener('gmail-authenticated', handleAuth);
            reject(error);
        }
    });
};

/**
 * Codifica un string en Base64 URL Safe, requerido por la API de Gmail.
 */
const encodeBase64URLSafe = (str) => {
    // Usar btoa para codificar, pero manejar UTF-8 correctamente
    const utf8Bytes = new TextEncoder().encode(str);
    let binaryStr = '';
    utf8Bytes.forEach((byte) => {
        binaryStr += String.fromCharCode(byte);
    });
    
    return btoa(binaryStr)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

/**
 * Envía un correo utilizando la API de Gmail.
 * Si no hay token, solicitará autorización primero.
 * 
 * @param {string} to Dirección de correo destino
 * @param {string} subject Asunto del correo
 * @param {string} body Cuerpo del mensaje
 * @returns Promesa con la respuesta de la API
 */
export const sendEmailViaGmail = async (to, subject, body) => {
    if (!accessToken) {
        await requestGmailAuthorization();
    }

    const emailLines = [];
    emailLines.push(`To: ${to}`);
    emailLines.push('Content-type: text/html; charset=utf-8');
    emailLines.push('MIME-Version: 1.0');
    emailLines.push(`Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`);
    emailLines.push('');
    emailLines.push(body); // Permitir HTML en el body

    const email = emailLines.join('\r\n');
    const base64EncodedEmail = encodeBase64URLSafe(email);

    try {
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                raw: base64EncodedEmail
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al enviar correo');
        }

        return await response.json();
    } catch (error) {
        console.error('Error enviando email:', error);
        throw error;
    }
};
