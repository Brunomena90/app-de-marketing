import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { authenticate } from '@google/cloud-local-auth';
import { google } from 'googleapis';

// If modifying these scopes, delete token.json.
// "https://www.googleapis.com/auth/gmail.modify" scope allows us to read and add labels (to mark as read or synced).
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
export async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }

  // Fallback to authenticate flow if no token is saved or token is invalid
  try {
      client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
      });
  } catch (error) {
      console.error('Error authenticate -> No se encontró credentials.json o falló el login local.');
      console.error('Asegúrate de haber descargado credentials.json desde Google Cloud Console.');
      process.exit(1);
  }
  
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// Function to immediately trigger the auth flow from the console
if (process.argv[1] && process.argv[1].endsWith('auth.js')) {
    console.log("Iniciando flujo de autenticación de Gmail...");
    authorize().then(() => {
        console.log("Autenticación exitosa. Token guardado en token.json.");
    }).catch(console.error);
}
