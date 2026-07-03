import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { spawn } from 'child_process';
import os from 'os';
import si from 'systeminformation';

const IALocalFolder = path.join(app.getPath('userData'), 'IA local');

if (!fs.existsSync(IALocalFolder)) {
    fs.mkdirSync(IALocalFolder, { recursive: true });
}

// Modelos GGUF recomendados (HuggingFace links directos)
const MODELS = {
    'gemma': {
        name: 'Gemma 4 (Q4_K_M)',
        url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=true',
        filename: 'gemma-2-2b-it-Q4_K_M.gguf'
    },
    'qwen': {
        name: 'Qwen 3.5 (Q4_K_M)',
        url: 'https://huggingface.co/Qwen/Qwen1.5-4B-Chat-GGUF/resolve/main/qwen1_5-4b-chat-q4_k_m.gguf?download=true',
        filename: 'qwen1_5-4b-chat-q4_k_m.gguf'
    },
    'llama': {
         name: 'Llama 3 (8B Q4)',
         url: 'https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf?download=true',
         filename: 'llama-3-8b-instruct.Q4_K_M.gguf'
    },
    'deepseek': {
        name: 'DeepSeek Coder (Q4)',
        url: 'https://huggingface.co/QuantFactory/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct.Q4_K_M.gguf?download=true',
        filename: 'deepseek-coder-v2-lite-q4_k_m.gguf'
    }
};

const LLAMA_SERVER_URL = 'https://github.com/ggerganov/llama.cpp/releases/download/b3252/llama-b3252-bin-win-avx2-x64.zip'; // Ejemplo
const LLAMA_EXE_NAME = 'llama-server.exe';

let llamaProcess = null;
let currentDownloads = {};

export function setupAIManager(mainWindow) {
    ipcMain.handle('ai:checkHardware', async () => {
        try {
            const memory = await si.mem();
            const totalRamGB = (memory.total / (1024 ** 3)).toFixed(1);
            return {
                ram: totalRamGB,
                cores: os.cpus().length,
                arch: os.arch(),
                platform: os.platform()
            };
        } catch (e) {
            return { error: e.message };
        }
    });

    ipcMain.handle('ai:getModelStatus', async (event, modelId) => {
        if (!MODELS[modelId]) return { status: 'error', message: 'Modelo no encontrado' };
        
        const filePath = path.join(IALocalFolder, MODELS[modelId].filename);
        if (fs.existsSync(filePath)) {
            return { status: 'ready', path: filePath };
        }
        
        return { status: 'not_downloaded' };
    });

    ipcMain.handle('ai:downloadModel', async (event, modelId) => {
        if (currentDownloads[modelId]) return { status: 'already_downloading' };
        
        const modelInfo = MODELS[modelId];
        if (!modelInfo) throw new Error("Modelo inválido");

        const filePath = path.join(IALocalFolder, modelInfo.filename);
        currentDownloads[modelId] = true;

        mainWindow.webContents.session.once('will-download', (event, item, webContents) => {
            item.setSavePath(filePath);
            item.on('updated', (event, state) => {
                if (state === 'progressing' && !item.isPaused()) {
                    const progress = Math.round((item.getReceivedBytes() / item.getTotalBytes()) * 100);
                    mainWindow.webContents.send('ai:downloadProgress', { modelId, progress });
                }
            });
            item.once('done', (event, state) => {
                delete currentDownloads[modelId];
                if (state === 'completed') {
                    mainWindow.webContents.send('ai:downloadProgress', { modelId, progress: 100, done: true });
                } else {
                    mainWindow.webContents.send('ai:downloadProgress', { modelId, progress: 0, error: `Descarga falló: ${state}` });
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            });
        });

        mainWindow.webContents.downloadURL(modelInfo.url);
        return { status: 'started' };
    });

    ipcMain.handle('ai:startModel', async (event, modelId) => {
        if (llamaProcess) {
            llamaProcess.kill();
            llamaProcess = null;
        }

        const modelInfo = MODELS[modelId];
        const filePath = path.join(IALocalFolder, modelInfo.filename);
        
        // Obtener la ruta del ejecutable pre-empaquetado
        const isPackaged = app.isPackaged;
        const exePath = isPackaged
            ? path.join(process.resourcesPath, 'bin', LLAMA_EXE_NAME)
            : path.join(process.cwd(), 'electron', 'bin', LLAMA_EXE_NAME);

        return new Promise((resolve, reject) => {
            try {
                // Iniciar el servidor real llama-server.exe
                // Se aumentó el contexto a 8192 tokens para memoria a largo plazo
                llamaProcess = spawn(exePath, ['-m', filePath, '--port', '8080', '-c', '8192', '-ngl', '33']);
                
                llamaProcess.stdout.on('data', (data) => {
                    const text = data.toString();
                    mainWindow.webContents.send('ai:modelLog', text);
                    if (text.includes('model loaded') || text.includes('starting the main loop')) {
                        resolve({ status: 'running', port: 8080 });
                    }
                });

                llamaProcess.stderr.on('data', (data) => {
                    const text = data.toString();
                    mainWindow.webContents.send('ai:modelLog', text);
                    if (text.includes('model loaded') || text.includes('starting the main loop')) {
                        resolve({ status: 'running', port: 8080 });
                    }
                });

                llamaProcess.on('close', (code) => {
                    mainWindow.webContents.send('ai:modelLog', `Motor finalizado (código ${code})`);
                });

                llamaProcess.on('error', (err) => {
                    reject({ error: `Error al iniciar el motor: ${err.message}` });
                });

                // Timeout de seguridad amplio (60 segundos)
                setTimeout(() => {
                    resolve({ status: 'running', port: 8080 });
                }, 60000);

            } catch (err) {
                reject({ error: err.message });
            }
        });
    });

    ipcMain.handle('ai:stopModel', async () => {
        if (llamaProcess) {
            llamaProcess.kill();
            llamaProcess = null;
            return { status: 'stopped' };
        }
        return { status: 'not_running' };
    });

    ipcMain.handle('ai:searchWeb', async (event, query) => {
        try {
            // Realizar búsqueda en DuckDuckGo HTML
            const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const text = await res.text();
            
            // Extraer resultados usando Regex simple
            const snippets = [];
            const regex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                // Limpiar etiquetas HTML
                const cleanText = match[1].replace(/<\/?[^>]+(>|$)/g, "").trim();
                if (cleanText) snippets.push(cleanText);
            }
            
            // Unir los primeros 3 resultados
            if (snippets.length > 0) {
                return snippets.slice(0, 3).join('\n');
            }
            return "No se encontraron resultados relevantes.";
        } catch (err) {
            console.error('Error web search:', err);
            return "Error al buscar en internet.";
        }
    });

    ipcMain.handle('ai:searchMaps', async (event, query) => {
        try {
            // Realizar búsqueda en OpenStreetMap (Nominatim)
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3`, {
                headers: {
                    // Nominatim requiere un User-Agent válido
                    'User-Agent': 'ArtoriesLocalAI/1.0 (contact@artories.com)' 
                }
            });
            const data = await res.json();
            
            if (data && data.length > 0) {
                const mapResults = data.map(place => {
                    return `Nombre/Lugar: ${place.display_name} | Latitud: ${place.lat} | Longitud: ${place.lon} | Tipo: ${place.type}`;
                });
                return mapResults.join('\n');
            }
            return "No se encontraron ubicaciones relevantes en el mapa para esa consulta.";
        } catch (err) {
            console.error('Error map search:', err);
            return "Error al buscar en mapas.";
        }
    });
}
