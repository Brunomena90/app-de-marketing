import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { toast } from 'sonner';

const PWAInstallPrompt = () => {
    const [installPromptEvent, setInstallPromptEvent] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Detect if it's already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        
        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIOSDevice);

        if (isStandalone) {
            return; // Already installed, do nothing
        }

        // For Android / Desktop Chrome (Standard PWA Install)
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setInstallPromptEvent(e);
            
            // Show prompt after a short delay so it doesn't annoy immediately on load
            setTimeout(() => {
                const dismissed = localStorage.getItem('pwa_prompt_dismissed');
                if (!dismissed || Date.now() - parseInt(dismissed) > 86400000) { // Ask again after 24 hours if dismissed
                    setIsVisible(true);
                }
            }, 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS (which doesn't fire beforeinstallprompt)
        if (isIOSDevice && !isStandalone) {
            setTimeout(() => {
                const dismissed = localStorage.getItem('pwa_prompt_dismissed');
                if (!dismissed || Date.now() - parseInt(dismissed) > 86400000) {
                    setIsVisible(true);
                }
            }, 3000);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            // Can't automatically install on iOS, show instructions via toast
            toast('Para instalar en iPhone/iPad', {
                description: (
                    <div className="flex flex-col gap-2 mt-2">
                        <span className="flex items-center gap-2"><Share size={16} /> Toca el botón <b>Compartir</b> en Safari</span>
                        <span className="flex items-center gap-2"><PlusSquare size={16} /> Luego selecciona <b>"Agregar a inicio"</b></span>
                    </div>
                ),
                duration: 8000,
            });
            return;
        }

        if (!installPromptEvent) return;

        installPromptEvent.prompt();
        const { outcome } = await installPromptEvent.userChoice;
        
        if (outcome === 'accepted') {
            setIsVisible(false);
            setInstallPromptEvent(null);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('pwa_prompt_dismissed', Date.now().toString());
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[380px] bg-[#111111] text-white p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] border border-white/10 flex items-start gap-4 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                <Download size={24} className="text-white" />
            </div>
            
            <div className="flex-1">
                <h3 className="font-bold text-sm mb-1">Instalar Aplicación</h3>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    Instala Artories en tu dispositivo para una experiencia más rápida, a pantalla completa y nativa.
                </p>
                
                <div className="flex gap-2">
                    <button 
                        onClick={handleInstallClick}
                        className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors active:scale-95"
                    >
                        {isIOS ? 'Ver cómo instalar' : 'Instalar ahora'}
                    </button>
                    <button 
                        onClick={handleDismiss}
                        className="bg-white/10 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-white/20 transition-colors active:scale-95"
                    >
                        Más tarde
                    </button>
                </div>
            </div>
            
            <button 
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white rounded-md transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default PWAInstallPrompt;
