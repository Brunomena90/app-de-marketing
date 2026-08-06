// src/services/driveService.js
// Necesitarás reemplazar esto con el Client ID de tu proyecto de Google Cloud (OAuth 2.0 Client IDs)
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '539766146005-sfd7r7cqhni340jnl44vv9vf8nko4ogo.apps.googleusercontent.com';
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = import.meta.env.VITE_GOOGLE_REFRESH_TOKEN;
const SCOPES = 'https://www.googleapis.com/auth/drive';

let tokenClient;
let accessToken = null;

/**
 * Inicializa Google Identity Services
 */
export const initGoogleDriveAuth = () => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse.error !== undefined) {
            reject(tokenResponse);
          }
          accessToken = tokenResponse.access_token;
          resolve(accessToken);
        },
      });
      resolve();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              reject(tokenResponse);
            }
            accessToken = tokenResponse.access_token;
            resolve(accessToken);
          },
        });
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load GIS script'));
      document.body.appendChild(script);
    }
  });
};

/**
 * Solicita el token de acceso, mostrando el popup de Google si es necesario
 */
export const authenticate = async () => {
  if (accessToken) {
    return accessToken;
  }

  // Si tenemos credenciales completas, intentamos autenticación silenciosa (Toma el control automático)
  if (REFRESH_TOKEN && CLIENT_SECRET && CLIENT_ID) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: REFRESH_TOKEN,
          grant_type: 'refresh_token'
        })
      });
      const data = await response.json();
      if (data.access_token) {
        accessToken = data.access_token;
        return accessToken;
      }
    } catch (err) {
      console.error('Error en autenticación silenciosa de Drive', err);
    }
  }
  
  // Fallback si no hay credenciales silenciosas o fallan: Usar popup
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      initGoogleDriveAuth().then(() => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
        // The callback in initTokenClient will resolve the actual promise when token arrives
        // Note: For a robust implementation, we should store a reference to the current resolve/reject
        // Here we just override the callback temporarily.
        tokenClient.callback = (tokenResponse) => {
          if (tokenResponse.error !== undefined) {
            reject(tokenResponse);
          }
          accessToken = tokenResponse.access_token;
          resolve(accessToken);
        };
      }).catch(reject);
    } else {
      tokenClient.callback = (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          reject(tokenResponse);
        }
        accessToken = tokenResponse.access_token;
        resolve(accessToken);
      };
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  });
};

/**
 * Crea una carpeta en Google Drive
 */
export const createDriveFolder = async (folderName, parentId = null) => {
  if (!accessToken) await authenticate();

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error('Error al crear la carpeta en Google Drive');
  }

  return response.json();
};

/**
 * Lista archivos/carpetas dentro de una carpeta específica
 */
export const listDriveContents = async (folderId = 'root', queryExtra = '') => {
  if (!accessToken) await authenticate();
  
  // Buscar archivos que tengan al folderId como padre
  const q = `'${folderId}' in parents and trashed = false ${queryExtra}`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webContentLink,webViewLink,thumbnailLink,hasThumbnail)&orderBy=folder,name`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener el contenido de Drive');
  }

  const data = await response.json();
  return data.files;
};

/**
 * Sube un archivo a Google Drive (Carga Multiparte para archivos)
 */
export const uploadFileToDrive = async (file, folderId = null) => {
  if (!accessToken) await authenticate();

  const metadata = {
    name: file.name,
    mimeType: file.type,
  };
  
  if (folderId) {
    metadata.parents = [folderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error('Error al subir el archivo a Google Drive');
  }

  return response.json();
};

/**
 * Busca una carpeta por nombre. Si no existe, la crea.
 */
export const findOrCreateFolder = async (folderName, parentId = null) => {
  if (!accessToken) await authenticate();
  
  // Buscar si la carpeta existe
  let q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) throw new Error('Error al buscar la carpeta en Drive');
  
  const data = await response.json();
  
  // Si existe, devolver su ID
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  
  // Si no existe, crearla
  return await createDriveFolder(folderName, parentId);
};

/**
 * Obtiene o crea la carpeta principal de la aplicación (ARTORIES MANAGEMENT SUIT)
 */
export const getAppRootFolder = async () => {
  return await findOrCreateFolder('ARTORIES MANAGEMENT SUIT');
};

/**
 * Sube un archivo a Google Drive (Carga Multiparte para archivos) con progreso
 */
export const uploadFileWithProgress = (file, folderId, onProgress) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!accessToken) await authenticate();

      const metadata = {
        name: file.name,
        mimeType: file.type,
      };
      
      if (folderId) {
        metadata.parents = [folderId];
      }

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', true);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Error al subir el archivo a Google Drive'));
        }
      };

      xhr.onerror = () => reject(new Error('Error de red al subir el archivo'));
      
      xhr.send(form);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Hace que un archivo en Drive sea público (Cualquier persona con el enlace puede leer)
 */
export const makeFilePublic = async (fileId) => {
  if (!accessToken) await authenticate();
  
  const permission = {
    type: 'anyone',
    role: 'reader',
  };
  
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(permission),
  });

  if (!response.ok) {
    throw new Error('Error al hacer el archivo público');
  }
  
  return response.json();
};

