import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, UploadCloud, Save, ImageIcon, RefreshCw, X } from 'lucide-react';

import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { uploadFileToDrive, getAppRootFolder, findOrCreateFolder, makeFilePublic, initGoogleDriveAuth, authenticate } from '../../services/driveService';

// Default Placeholders
const DEFAULT_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?q=80&w=2070&auto=format&fit=crop',
];

const DEFAULT_CONTENT_ROWS = [
  {
    id: 'row_1',
    title: 'Nuestra Visión y Trabajo',
    text: 'Transformamos ideas en experiencias visuales excepcionales. Cada proyecto que desarrollamos está pensado para maximizar el impacto de tu marca, combinando un diseño de primer nivel con una funcionalidad sin fricciones.',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=2071&auto=format&fit=crop',
    align: 'right' // image on right
  },
  {
    id: 'row_2',
    title: 'Innovación Constante',
    text: 'Nos mantenemos a la vanguardia de la tecnología y las tendencias creativas. Desde el primer boceto hasta la entrega final, nuestro equipo se asegura de que cada detalle comunique excelencia.',
    image: 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=2064&auto=format&fit=crop',
    align: 'left' // image on left
  }
];

// Drive Uploader Helper Component for Inline Use
const InlineDriveUploader = ({ folderName, onUpload, buttonText, icon: Icon, className }) => {
  const hiddenInput = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleButtonClick = (e) => {
    e.preventDefault();
    authenticate().then(() => {
      hiddenInput.current?.click();
    }).catch((err) => {
      console.error(err);
      toast.error('Debes permitir el popup de Google Drive');
    });
  };

  const onSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    toast.info(`Subiendo a ${folderName}...`, { duration: 3000 });
    try {
      const appRoot = await getAppRootFolder();
      const folder = await findOrCreateFolder(folderName, appRoot.id);
      const uploaded = await uploadFileToDrive(file, folder.id);
      await makeFilePublic(uploaded.id);
      const url = uploaded.webContentLink || uploaded.webViewLink;
      toast.success('Imagen subida correctamente');
      onUpload(url);
    } catch (err) {
      console.error(err);
      toast.error('Error al subir la imagen');
    } finally {
      setUploading(false);
      hiddenInput.current.value = '';
    }
  };

  return (
    <>
      <input type="file" accept="image/*" ref={hiddenInput} onChange={onSelect} className="hidden" />
      <button onClick={handleButtonClick} disabled={uploading} className={className}>
        {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        {buttonText && <span className="ml-2">{uploading ? 'Subiendo...' : buttonText}</span>}
      </button>
    </>
  );
};


export default function Portafolios() {
  const { id: urlEmpresaId } = useParams();
  const { user, activeEmpresa } = useAuth();
  
  // Determinamos de quién es el portafolio que estamos viendo
  const targetEmpresaId = urlEmpresaId || activeEmpresa;
  
  // Permisos: Solo el dueño puede editar
  const isOwner = user && (activeEmpresa === targetEmpresaId);

  const [activeTab, setActiveTab] = useState('inicio');
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Estado del contenido
  const [heroImages, setHeroImages] = useState([]);
  const [contentRows, setContentRows] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Inicializar auth de Drive si el usuario es el dueño
  useEffect(() => {
    if (isOwner) {
      initGoogleDriveAuth().catch(console.error);
    }
  }, [isOwner]);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      if (!targetEmpresaId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const docRef = doc(db, 'portafolios_landing', targetEmpresaId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().initialized) {
          const data = docSnap.data();
          setHeroImages(data.heroImages || []);
          setContentRows(data.contentRows || []);
        } else {
          // Defaults
          setHeroImages(DEFAULT_HERO_IMAGES);
          setContentRows(DEFAULT_CONTENT_ROWS);
        }
      } catch (err) {
        console.error("Error cargando portafolio:", err);
      } finally {
        setLoading(false);
        setHasChanges(false);
      }
    };
    loadData();
  }, [targetEmpresaId]);

  const handleSave = async () => {
    try {
      const docRef = doc(db, 'portafolios_landing', targetEmpresaId);
      await setDoc(docRef, {
        initialized: true,
        heroImages,
        contentRows
      }, { merge: true });
      toast.success('Cambios guardados con éxito');
      setHasChanges(false);
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar los cambios');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div></div>;
  }

  return (
    <div className={`min-h-screen bg-[#050505] font-sans selection:bg-blue-500/30 selection:text-white flex flex-col ${isEditMode ? 'ring-4 ring-blue-500/50' : ''}`}>
      
      {/* Navbar Superior Fijo */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 h-16">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          
          {/* Lector SVG + Texto */}
          <div className="flex items-center gap-3">
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span className="text-white font-black tracking-widest uppercase text-sm md:text-base">
              Artories Portafolios
            </span>
          </div>

          {/* Menú y Controles Admin */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 mr-6">
              <button onClick={() => { setActiveTab('inicio'); window.scrollTo(0,0); }} className={`text-sm font-bold tracking-widest transition-all ${activeTab === 'inicio' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}>INICIO</button>
              <button onClick={() => { setActiveTab('portafolio'); window.scrollTo(0,0); }} className={`text-sm font-bold tracking-widest transition-all ${activeTab === 'portafolio' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}>PORTAFOLIO</button>
            </div>

            {isOwner && (
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-lg ${isEditMode ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white text-black hover:bg-gray-200'}`}
              >
                <Settings className="w-4 h-4" /> {isEditMode ? 'Cerrar Edición' : 'Administrador'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Botón Flotante de Guardar (Solo en Modo Edición y si hay cambios) */}
      {isEditMode && hasChanges && (
        <div className="fixed bottom-8 right-8 z-[100] animate-bounce">
          <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(37,99,235,0.6)] flex items-center gap-2">
            <Save className="w-5 h-5" /> Guardar Cambios
          </button>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="w-full pt-16 flex-1">
        {activeTab === 'inicio' ? (
          <>
            {/* HERO SLIDER SECTION */}
            <HeroSliderInline 
               images={heroImages} 
               isEditMode={isEditMode} 
               onChange={(newImages) => { setHeroImages(newImages); setHasChanges(true); }}
            />
            
            {/* CONTENT ROWS SECTION */}
            <section className="bg-white w-full py-20 px-4 md:px-8 min-h-[500px]">
              <div className="max-w-6xl mx-auto space-y-20">
                {contentRows.map((row, index) => (
                   <ContentRowInline 
                     key={row.id} 
                     row={row} 
                     isEditMode={isEditMode}
                     onChange={(updatedRow) => {
                       const newRows = [...contentRows];
                       newRows[index] = updatedRow;
                       setContentRows(newRows);
                       setHasChanges(true);
                     }}
                     onDelete={() => {
                       if(confirm('¿Eliminar esta fila?')) {
                         setContentRows(contentRows.filter(r => r.id !== row.id));
                         setHasChanges(true);
                       }
                     }}
                     onSwapAlign={() => {
                        const newRows = [...contentRows];
                        newRows[index].align = row.align === 'left' ? 'right' : 'left';
                        setContentRows(newRows);
                        setHasChanges(true);
                     }}
                   />
                ))}

                {isEditMode && (
                  <div className="flex justify-center mt-12">
                     <button 
                       onClick={() => {
                          const newRow = { 
                            id: `row_${Date.now()}`, 
                            title: 'Nuevo Título', 
                            text: 'Escribe tu descripción aquí...', 
                            image: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop',
                            align: contentRows.length % 2 === 0 ? 'right' : 'left'
                          };
                          setContentRows([...contentRows, newRow]);
                          setHasChanges(true);
                       }}
                       className="bg-black text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-zinc-800 transition-colors shadow-xl"
                     >
                        <Plus className="w-5 h-5" /> Añadir Nueva Fila
                     </button>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="w-full h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8 text-center bg-[#050505]">
             <h2 className="text-3xl text-zinc-300 font-bold mb-4">Portafolio</h2>
             <p className="text-zinc-600 max-w-lg">Esta sección está lista para recibir tu contenido.</p>
          </div>
        )}
      </main>

      {/* Footer Negro */}
      <footer className="bg-[#050505] w-full py-16 px-4 md:px-8 border-t border-zinc-900 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              <span className="text-white font-black tracking-widest uppercase text-sm">Artories Portafolios</span>
            </div>
            <p className="text-zinc-500 text-sm">info@artories.com • +1 234 567 890</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-3 text-sm">
            <h4 className="text-white font-bold tracking-widest uppercase mb-2">Enlaces</h4>
            <button onClick={() => { setActiveTab('inicio'); window.scrollTo(0,0); }} className="text-zinc-500 hover:text-white transition-colors">Inicio</button>
            <button onClick={() => { setActiveTab('portafolio'); window.scrollTo(0,0); }} className="text-zinc-500 hover:text-white transition-colors">Portafolio</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: HERO SLIDER (INLINE EDITABLE)
// -------------------------------------------------------------
function HeroSliderInline({ images, isEditMode, onChange }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Rotación Automática (solo si NO está en modo edición)
  useEffect(() => {
    if (isEditMode || !images || images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [images, isEditMode]);

  return (
    <div className={`relative w-full h-[calc(100vh-4rem)] bg-zinc-950 overflow-hidden ${isEditMode ? 'border-b-4 border-blue-500' : ''}`}>
      
      {/* Capa de Edición */}
      {isEditMode && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md rounded-xl p-3 flex gap-4 items-center border border-white/20 shadow-2xl">
            <p className="text-white text-xs font-bold uppercase tracking-widest px-2 border-r border-white/20">Slider Hero</p>
            
            <div className="flex gap-2">
               {images.map((_, idx) => (
                 <button key={idx} onClick={() => setCurrentIndex(idx)} className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs ${currentIndex === idx ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                   {idx + 1}
                 </button>
               ))}
            </div>

            <InlineDriveUploader 
               folderName="Slider_Portafolio"
               buttonText="Añadir"
               icon={Plus}
               className="flex items-center bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
               onUpload={(url) => onChange([...images, url])}
            />

            {images.length > 0 && (
              <>
                <InlineDriveUploader 
                   folderName="Slider_Portafolio"
                   buttonText=""
                   icon={UploadCloud}
                   className="flex items-center bg-zinc-700 hover:bg-zinc-600 text-white p-1.5 rounded transition-colors"
                   onUpload={(url) => {
                     const newImages = [...images];
                     newImages[currentIndex] = url;
                     onChange(newImages);
                   }}
                />
                <button 
                  onClick={() => {
                    const newImages = images.filter((_, i) => i !== currentIndex);
                    setCurrentIndex(Math.max(0, currentIndex - 1));
                    onChange(newImages);
                  }}
                  className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                   <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
         </div>
      )}

      {/* Imágenes rotando */}
      {images.map((src, idx) => (
        <img 
          key={idx} 
          src={src} 
          alt={`Slider ${idx}`} 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`} 
        />
      ))}
      
      {images.length === 0 && (
         <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
            <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
            <p>No hay imágenes en el Slider</p>
         </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 pointer-events-none"></div>
      
      {/* Puntos Indicadores Inferiores (solo vista pública) */}
      {!isEditMode && images.length > 1 && (
        <div className="absolute inset-x-0 bottom-8 flex justify-center gap-2 z-30">
           {images.map((_, idx) => (
             <button 
               key={idx} 
               onClick={() => setCurrentIndex(idx)}
               className={`w-3 h-3 rounded-full transition-all duration-300 shadow-md ${
                 idx === currentIndex ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/80'
               }`}
             />
           ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE: CONTENT ROW (INLINE EDITABLE)
// -------------------------------------------------------------
function ContentRowInline({ row, isEditMode, onChange, onDelete, onSwapAlign }) {
  const isImgRight = row.align === 'right';

  const textContent = (
    <div className="flex-1 space-y-4 md:space-y-6 w-full group relative">
      {isEditMode ? (
        <div className="space-y-4 bg-zinc-100 p-6 rounded-2xl border border-zinc-200">
           <input 
             type="text" 
             value={row.title} 
             onChange={(e) => onChange({...row, title: e.target.value})} 
             className="w-full text-3xl md:text-4xl font-extrabold text-black tracking-tight bg-transparent border-b-2 border-blue-200 focus:border-blue-500 outline-none pb-2"
           />
           <textarea 
             value={row.text} 
             onChange={(e) => onChange({...row, text: e.target.value})} 
             className="w-full text-lg text-zinc-700 leading-relaxed bg-transparent border-2 border-blue-200 focus:border-blue-500 rounded-xl outline-none p-4 min-h-[150px] resize-y"
           />
        </div>
      ) : (
        <>
          <h2 className="text-3xl md:text-4xl font-extrabold text-black tracking-tight">{row.title}</h2>
          <p className="text-lg text-zinc-600 leading-relaxed whitespace-pre-wrap">{row.text}</p>
        </>
      )}
    </div>
  );

  const imageContent = (
    <div className="flex-1 w-full relative group">
      <img 
        src={row.image} 
        alt={row.title} 
        className={`w-full h-[300px] md:h-[400px] object-cover rounded-2xl shadow-2xl transition-all ${isEditMode ? 'opacity-90 ring-4 ring-transparent hover:ring-blue-500' : ''}`}
      />
      {isEditMode && (
         <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
            <InlineDriveUploader 
               folderName="Contenido_Landing"
               buttonText="Reemplazar Imagen"
               icon={UploadCloud}
               className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold shadow-xl flex items-center transform hover:scale-105 transition-all"
               onUpload={(url) => onChange({...row, image: url})}
            />
         </div>
      )}
    </div>
  );

  return (
    <div className="relative border-2 border-transparent hover:border-blue-100 rounded-3xl transition-colors p-4 -mx-4">
      
      {/* Controles Flotantes de la Fila entera */}
      {isEditMode && (
         <div className="absolute -top-4 right-4 z-40 flex gap-2 shadow-lg rounded-full bg-white border border-zinc-200 p-1">
            <button onClick={onSwapAlign} className="bg-zinc-100 hover:bg-zinc-200 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
               <RefreshCw className="w-3 h-3" /> Invertir Orden
            </button>
            <button onClick={onDelete} className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-full">
               <Trash2 className="w-4 h-4" />
            </button>
         </div>
      )}

      <div className={`flex flex-col ${isImgRight ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-12`}>
        {isImgRight ? (
          <>{textContent}{imageContent}</>
        ) : (
          <>{imageContent}{textContent}</>
        )}
      </div>
    </div>
  );
}
