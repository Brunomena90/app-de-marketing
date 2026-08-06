import React from 'react';
import AppIcon from './AppIcon';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary atrapó un error: ", error, errorInfo);
    
    // Si es un error de carga de chunk (muy común en PWA con lazy loading tras un deploy)
    // forzamos una recarga limpia, pero limitando para evitar loops infinitos.
    if (error.name === 'ChunkLoadError' || (error.message && error.message.includes('Failed to fetch dynamically imported module'))) {
      const reloadCount = parseInt(sessionStorage.getItem('chunk_reload_count') || '0', 10);
      if (reloadCount < 2) {
        sessionStorage.setItem('chunk_reload_count', (reloadCount + 1).toString());
        window.location.reload(true);
      } else {
        console.error("Demasiados reloads por ChunkLoadError, deteniendo.");
        sessionStorage.removeItem('chunk_reload_count'); // reset para futura vez manual
      }
    }

    // Si la caché de Firestore se corrompió (error clásico de IndexedDB/HMR)
    if (error.message && (error.message.includes('INTERNAL ASSERTION FAILED') || error.message.includes('Unexpected state'))) {
      console.warn("Detectada corrupción de caché Firestore. Limpiando IndexedDB...");
      if (window.indexedDB && window.indexedDB.databases) {
        window.indexedDB.databases().then(async (dbs) => {
          let cleared = false;
          const deletePromises = [];
          for (const db of dbs) {
            if (db.name && db.name.startsWith('firestore/')) {
              deletePromises.push(new Promise((resolve) => {
                const req = window.indexedDB.deleteDatabase(db.name);
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
                req.onblocked = () => {
                  console.warn("Borrado de IndexedDB bloqueado por otra pestaña o conexión activa.");
                  resolve(false);
                };
              }));
              cleared = true;
            }
          }
          if (cleared) {
            const results = await Promise.all(deletePromises);
            // Solo recargar si al menos uno tuvo éxito
            if (results.some(r => r === true)) {
              window.location.reload(true);
            } else {
              console.error("No se pudo limpiar la base de datos automáticamente porque está bloqueada.");
            }
          }
        }).catch(e => console.error("Error al limpiar IndexedDB:", e));
      }
    }
  }

  handleClearCacheAndReload = async () => {
    if (window.indexedDB && window.indexedDB.databases) {
      try {
        const dbs = await window.indexedDB.databases();
        const deletePromises = [];
        for (const db of dbs) {
          if (db.name && db.name.startsWith('firestore/')) {
            deletePromises.push(new Promise((resolve) => {
              const req = window.indexedDB.deleteDatabase(db.name);
              req.onsuccess = resolve;
              req.onerror = resolve;
              req.onblocked = resolve;
            }));
          }
        }
        await Promise.all(deletePromises);
      } catch (e) {
        console.error(e);
      }
    }
    window.location.reload(true);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.error?.name === 'ChunkLoadError' || (this.state.error?.message && this.state.error?.message.includes('Failed to fetch dynamically imported module'))) {
        return (
          <div className="fixed inset-0 bg-[#050505] flex flex-col justify-center items-center z-50">
              <p className="text-[11px] text-zinc-400 uppercase tracking-widest mt-4">Actualizando versión...</p>
          </div>
        );
      }
      return (
        <div style={{ padding: '20px', color: 'white', backgroundColor: 'black', height: '100vh', width: '100vw' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>¡Ups! Algo salió mal.</h1>
            <p>La caché local podría estar corrupta o desincronizada.</p>
            <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '10px', marginBottom: '20px', fontFamily: 'monospace', maxWidth: '80%', wordBreak: 'break-all' }}>
              {this.state.error?.toString()}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{ background: '#333', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Recargar Página
              </button>
              <button 
                onClick={this.handleClearCacheAndReload}
                style={{ background: '#0891b2', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Limpiar Caché y Reparar
              </button>
            </div>
        </div>
      );
    }
    return this.props.children; 
  }
}
export default ErrorBoundary;
