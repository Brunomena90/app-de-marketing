import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Folder, Plus, Loader2, ArrowLeft, Upload, File as FileIcon, 
  Image as ImageIcon, FileText, Film, Download, RefreshCw
} from 'lucide-react';
import { listDriveContents, createDriveFolder, uploadFileToDrive } from '../../services/driveService';
import { toast } from 'sonner';

export default function PortafolioDetail() {
  const { id } = useParams(); // Folder ID
  const navigate = useNavigate();
  const location = useLocation();
  const folderName = location.state?.name || 'Portafolio';
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchContents();
  }, [id]);

  const fetchContents = async () => {
    try {
      setLoading(true);
      const contents = await listDriveContents(id);
      setItems(contents);
    } catch (error) {
      console.error('Error fetching folder contents:', error);
      toast.error('Error al cargar el contenido del portafolio');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      setIsCreatingFolder(true);
      await createDriveFolder(newFolderName.trim(), id);
      toast.success('Carpeta creada con éxito');
      setNewFolderName('');
      setShowCreateFolderModal(false);
      await fetchContents();
    } catch (error) {
      console.error('Error creando subcarpeta:', error);
      toast.error('Hubo un error al crear la carpeta');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadFileToDrive(files[i], id);
        successCount++;
      }
      toast.success(`${successCount} archivo(s) subido(s) con éxito`);
      await fetchContents();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Hubo un error al subir algunos archivos');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/vnd.google-apps.folder') return <Folder className="w-6 h-6 text-violet-500" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-emerald-500" />;
    if (mimeType.startsWith('video/')) return <Film className="w-6 h-6 text-pink-500" />;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText className="w-6 h-6 text-blue-500" />;
    return <FileIcon className="w-6 h-6 text-zinc-400" />;
  };

  const handleItemClick = (item) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      navigate(`/portafolios/${item.id}`, { state: { name: item.name } });
    } else if (item.webViewLink) {
      window.open(item.webViewLink, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{folderName}</h1>
              <p className="text-zinc-400 text-sm mt-1">Gestiona el contenido de esta carpeta.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={fetchContents}
              disabled={loading || isUploading}
              className="p-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateFolderModal(true)}
              disabled={loading || isUploading}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Folder className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva Carpeta</span>
            </button>
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isUploading}
              className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              <span>{isUploading ? 'Subiendo...' : 'Subir Archivos'}</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p>Cargando contenido...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-12 text-center">
            <Folder className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Carpeta vacía</h3>
            <p className="text-zinc-400 mb-6">Sube archivos o crea subcarpetas para organizar tu trabajo.</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowCreateFolderModal(true)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 px-4 rounded-xl transition-all"
              >
                Crear Carpeta
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium py-2 px-4 rounded-xl transition-all"
              >
                Subir Archivo
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="bg-zinc-900/50 border border-zinc-800/50 hover:border-violet-500/50 hover:bg-zinc-800/50 p-4 rounded-2xl cursor-pointer transition-all group flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-zinc-950/50 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform mb-3 relative overflow-hidden">
                  {item.hasThumbnail && item.thumbnailLink ? (
                    <img src={item.thumbnailLink} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    getFileIcon(item.mimeType)
                  )}
                </div>
                <h3 className="text-zinc-300 font-medium text-sm truncate w-full" title={item.name}>
                  {item.name}
                </h3>
                {item.mimeType !== 'application/vnd.google-apps.folder' && item.webContentLink && (
                  <a 
                    href={item.webContentLink}
                    onClick={(e) => e.stopPropagation()} // Prevent navigating/opening webViewLink
                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-violet-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Modal Nueva Carpeta */}
        {showCreateFolderModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Crear Subcarpeta</h2>
              <form onSubmit={handleCreateFolder}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Nombre de la Carpeta
                  </label>
                  <input
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                    placeholder="Ej. Recursos, Imágenes, etc."
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateFolderModal(false)}
                    className="px-4 py-2.5 text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingFolder}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isCreatingFolder && <Loader2 className="w-4 h-4 animate-spin" />}
                    Crear Carpeta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
