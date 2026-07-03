import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Video, FileText, Save, Plus, X, Calendar, User, AlignLeft, Trash2 } from 'lucide-react';
import { useRequests } from '../context/RequestContext';
import { useCampaigns } from '../context/CampaignContext';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

// Schema Definition
const requestSchema = z.object({
    type: z.enum(['video', 'post']),
    title: z.string().min(1, "El título es requerido"),
    area: z.string().min(1, "El área es requerida"),
    requestDate: z.string().min(1, "La fecha de solicitud es requerida"),
    campaign: z.string().optional(),

    // Video Specific - Made optional/lenient
    objective: z.string().optional().or(z.literal('')),
    targetAudience: z.string().optional().or(z.literal('')),
    keyMessage: z.string().optional().or(z.literal('')),
    briefing: z.string().optional().or(z.literal('')),
    personnel: z.string().optional().or(z.literal('')),
    recordingDate: z.string().optional().or(z.literal('')),
    recordingTime: z.string().optional().or(z.literal('')),
    recordingStartDate: z.string().optional().or(z.literal('')),
    recordingStartTime: z.string().optional().or(z.literal('')),
    recordingEndDate: z.string().optional().or(z.literal('')),
    recordingEndTime: z.string().optional().or(z.literal('')),
    deadline: z.string().optional().or(z.literal('')),
    format: z.string().optional().or(z.literal('')),

    // Post Specific
    additionalDetails: z.string().optional().or(z.literal('')),
});
// Removed superRefine to prevent silent blocking. Validation is now minimal.

const RequestForm = ({ onSuccess, initialDate, isOpen = true }) => {
    const { user } = useAuth();

    // 1. Hooks (useForm FIRST)
    // 1. Hooks (useForm FIRST)
    // 1. Hooks (useForm FIRST)
    const { register, getValues, reset, setValue, watch } = useForm({
        defaultValues: {
            type: 'video',
            area: user?.area || 'Marketing',
            requestDate: new Date().toISOString().split('T')[0],
            format: 'Horizontal (16:9)',
            recordingTime: '10:00' // Default time
        }
    });

    // 2. States
    const [activeTab, setActiveTab] = useState('video');
    const { addRequest } = useRequests();
    const { campaigns, addCampaign } = useCampaigns();

    // State for creating new campaign on the fly
    const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState('');
    const [areasList, setAreasList] = useState([]);

    // State for Briefing List Builder
    const [briefingItems, setBriefingItems] = useState([]);
    const [currentBriefingItem, setCurrentBriefingItem] = useState("");
    const [loading, setLoading] = useState(false);

    // Watch type to update active tab visually if needed
    const currentArea = watch('area');

    // 3. Effects

    // Fetch Areas
    useEffect(() => {
        const q = query(collection(db, "areas"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const areas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAreasList(areas);

            // Auto-select user area if it exists in the list
            if (user?.area) {
                const userAreaExists = areas.some(a => a.name === user.area);
                if (userAreaExists) {
                    setValue('area', user.area);
                }
            }
        });
        return () => unsubscribe();
    }, [user, setValue]);

    // Update form type when tab changes
    useEffect(() => {
        setValue('type', activeTab);
    }, [activeTab, setValue]);

    // Reset form when modal opens
    useEffect(() => {
        const initializeForm = async () => {
            if (isOpen && user) {
                let currentArea = user.area; // Default fallback

                // 1. IF NOT ADMIN/EDITOR, FETCH FRESH DATA FROM FIREBASE
                if (user.role !== 'admin' && user.role !== 'editor') {
                    try {
                        const userDoc = await getDoc(doc(db, "users", user.id));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            currentArea = userData.area || user.area;
                            console.log("Área actualizada desde BD:", currentArea);
                        }
                    } catch (error) {
                        console.error("Error al refrescar usuario:", error);
                    }
                } else {
                    // If admin, leave empty for selection
                    currentArea = '';
                }

                // 2. RESET FORM WITH FRESH DATA
                reset({
                    type: 'video', // Always reset to video tab
                    title: '',
                    area: currentArea,
                    requestDate: new Date().toISOString().split('T')[0],
                    campaign: '',
                    objective: '',
                    targetAudience: '',
                    keyMessage: '',
                    briefing: '',
                    personnel: '',
                    recordingDate: '',
                    recordingTime: '10:00',
                    recordingStartDate: '',
                    recordingStartTime: '',
                    recordingEndDate: '',
                    recordingEndTime: '',
                    deadline: '',
                    format: 'Horizontal (16:9)',
                    additionalDetails: ''
                });

                setBriefingItems([]);
                setActiveTab('video');
            }
        };

        initializeForm();
    }, [isOpen, user, reset]);

    // Force update area when tab changes (in addition to reset on open)
    useEffect(() => {
        if (user && (user.role === 'jefe' || user.role === 'solicitante')) {
            setValue('area', user.area);
        }
    }, [activeTab, user, setValue]);

    // Pre-fill deadline and recording details if initialDate is provided
    useEffect(() => {
        if (initialDate) {
            const dateObj = new Date(initialDate);
            // Use local date to avoid timezone issues
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;

            setValue('deadline', formattedDate);
            setValue('requestDate', formattedDate); // Also set request date to selected date

            // If it has specific time (not 00:00:00 which is default for day click sometimes, 
            // but react-big-calendar returns 00:00 for month view clicks usually)
            // Actually, let's just check if we are in video tab and set recordingDate too
            setValue('recordingStartDate', formattedDate);

            // Extract time in HH:mm format
            const hours = dateObj.getHours().toString().padStart(2, '0');
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;

            // Only set specific time if it's not midnight (unless user clicked midnight slot)
            // For month view clicks, it might be 00:00. For day view slots, it will be specific.
            setValue('recordingTime', timeString);
        }
    }, [initialDate, setValue]);

    const handleCreateCampaign = async () => {
        if (!newCampaignName.trim()) return;

        try {
            const newCampaign = {
                name: newCampaignName,
                client: currentArea,
                deadline: new Date().toISOString().split('T')[0],
                status: 'Activa',
                progress: 0
            };

            const docRef = await addCampaign(newCampaign);

            setIsCreatingCampaign(false);
            setNewCampaignName('');
            setValue('campaign', docRef.id);
        } catch (error) {
            console.error("Error creating campaign:", error);
        }
    };

    const handleAddBriefingItem = () => {
        if (currentBriefingItem.trim()) {
            setBriefingItems([...briefingItems, currentBriefingItem.trim()]);
            setCurrentBriefingItem("");
        }
    };

    const onError = (errors) => {
        console.error("ERRORES DE VALIDACIÓN:", errors);
        toast.error("Faltan campos por llenar (Revisa la consola)");
    };

    return (
        <div className="space-y-6">
            {/* Type Selection Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                    type="button"
                    onClick={() => setActiveTab('video')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'video'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Video size={18} />
                    Video
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('post')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'post'
                        ? 'bg-white text-purple-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <FileText size={18} />
                    Publicación
                </button>
            </div>

            <form className="space-y-8">

                {/* === VIDEO FORM === */}
                {activeTab === 'video' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Fila 1: Título */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título del Video</label>
                            <input
                                {...register('title')}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ej: Video Corporativo Q1"
                            />
                            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                        </div>

                        {/* Fila 2: Área y Campaña */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div key={`area-video-${activeTab}`}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Área Solicitante</label>
                                <select
                                    {...register('area')}
                                    disabled={user?.role !== 'admin' && user?.role !== 'editor'}
                                    className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none ${user?.role !== 'admin' && user?.role !== 'editor' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                                >
                                    {areasList.map(area => (
                                        <option key={area.id} value={area.name}>{area.name}</option>
                                    ))}
                                </select>
                                {errors.area && <p className="text-red-500 text-xs mt-1">{errors.area.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Campaña (Opcional)</label>
                                {isCreatingCampaign ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCampaignName}
                                            onChange={(e) => setNewCampaignName(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            placeholder="Nombre campaña"
                                            autoFocus
                                        />
                                        <button type="button" onClick={handleCreateCampaign} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                            <Save size={16} />
                                        </button>
                                        <button type="button" onClick={() => setIsCreatingCampaign(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <select
                                            {...register('campaign')}
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {campaigns.filter(c => c.status === 'Activa').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingCampaign(true)}
                                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sección Estrategia */}
                        <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <AlignLeft size={16} /> Estrategia
                            </h3>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Objetivo Principal</label>
                                <input {...register('objective')} className="w-full p-2 rounded border border-gray-300 text-sm focus:border-blue-500 outline-none" placeholder="¿Qué queremos lograr?" />
                                {errors.objective && <p className="text-red-500 text-xs mt-1">{errors.objective.message}</p>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Público Objetivo</label>
                                    <input {...register('targetAudience')} className="w-full p-2 rounded border border-gray-300 text-sm focus:border-blue-500 outline-none" placeholder="¿A quién va dirigido?" />
                                    {errors.targetAudience && <p className="text-red-500 text-xs mt-1">{errors.targetAudience.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mensaje Clave</label>
                                    <input {...register('keyMessage')} className="w-full p-2 rounded border border-gray-300 text-sm focus:border-blue-500 outline-none" placeholder="Idea central" />
                                    {errors.keyMessage && <p className="text-red-500 text-xs mt-1">{errors.keyMessage.message}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Sección Producción (Briefing) */}
                        <div className="bg-white border border-gray-200 p-4 rounded-xl space-y-4">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={16} /> Puntos del Briefing
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    value={currentBriefingItem}
                                    onChange={(e) => setCurrentBriefingItem(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBriefingItem())}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Escribe un punto clave y presiona Enter..."
                                />
                                <button type="button" onClick={handleAddBriefingItem} className="bg-gray-900 text-white p-2 rounded-lg hover:bg-gray-800">
                                    <Plus size={20} />
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {briefingItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm bg-gray-50 p-2 rounded border border-gray-100 group">
                                        <span className="text-blue-500 font-bold">•</span>
                                        <span className="flex-1 text-gray-700">{item}</span>
                                        <button type="button" onClick={() => handleRemoveBriefingItem(idx)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                    </li>
                                ))}
                                {briefingItems.length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">No hay puntos agregados.</p>}
                            </ul>
                        </div>

                        {/* Sección Logística */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Fila 1: Plazos */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Solicitud</label>
                                <input type="date" {...register('requestDate')} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Entrega</label>
                                <input type="date" {...register('deadline')} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                                {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline.message}</p>}
                            </div>

                            {/* Fila 2: Grabación */}
                            {(activeTab === 'video') && (
                                <>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                        <h4 className="text-xs font-black text-blue-700 uppercase">Grabación</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Inicio — Fecha</label>
                                                <input type="date" {...register('recordingStartDate')} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Inicio — Hora</label>
                                                <input type="time" {...register('recordingStartTime')} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Fin — Fecha</label>
                                                <input type="date" {...register('recordingEndDate')} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Fin — Hora</label>
                                                <input type="time" {...register('recordingEndTime')} className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Fila Final: Formato */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Formato de Entrega</label>
                            <select {...register('format')} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="Horizontal (16:9)">Horizontal (16:9) - Youtube/TV</option>
                                <option value="Vertical (9:16)">Vertical (9:16) - Reels/TikTok</option>
                                <option value="Cuadrado (1:1)">Cuadrado (1:1) - Feed</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* === POST FORM === */}
                {activeTab === 'post' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Fila 1: Título */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Título de la Publicación</label>
                            <input
                                {...register('title')}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Ej: Post Día de la Madre"
                            />
                            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                        </div>

                        {/* Fila 2: Área y Campaña */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div key={`area-post-${activeTab}`}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Área Solicitante</label>
                                <select
                                    {...register('area')}
                                    disabled={user?.role !== 'admin' && user?.role !== 'editor'}
                                    className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none ${user?.role !== 'admin' && user?.role !== 'editor' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
                                >
                                    {areasList.map(area => (
                                        <option key={area.id} value={area.name}>{area.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Campaña (Opcional)</label>
                                {isCreatingCampaign ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCampaignName}
                                            onChange={(e) => setNewCampaignName(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                                            placeholder="Nombre campaña"
                                            autoFocus
                                        />
                                        <button type="button" onClick={handleCreateCampaign} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                                            <Save size={16} />
                                        </button>
                                        <button type="button" onClick={() => setIsCreatingCampaign(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <select
                                            {...register('campaign')}
                                            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {campaigns.filter(c => c.status === 'Activa').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingCampaign(true)}
                                            className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fila 3: Fechas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Solicitud</label>
                                <input type="date" {...register('requestDate')} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Límite</label>
                                <input type="date" {...register('deadline')} className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none" />
                                {errors.deadline && <p className="text-red-500 text-xs mt-1">{errors.deadline.message}</p>}
                            </div>
                        </div>

                        {/* Fila 4: Copy / Detalles */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Copy / Detalles Visuales</label>
                            <textarea
                                {...register('additionalDetails')}
                                rows={6}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Escribe aquí el texto del post, ideas visuales, hashtags, etc..."
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-6 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={handleManualSubmit}
                        disabled={loading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium shadow-sm hover:shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeTab === 'video' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                    >
                        <Save size={20} />
                        {loading ? 'Guardando...' : 'Crear Solicitud'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RequestForm;
