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
    // forzamos una recarga limpia
    if (error.name === 'ChunkLoadError' || (error.message && error.message.includes('Failed to fetch dynamically imported module'))) {
      window.location.reload(true);
    }
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
            <h1>¡Ups! Algo salió mal.</h1>
            <p>Por favor, recarga la página.</p>
            <p style={{ color: 'red' }}>{this.state.error?.toString()}</p>
            <button onClick={() => window.location.reload()}>Recargar</button>
        </div>
      );
    }
    return this.props.children; 
  }
}
export default ErrorBoundary;
