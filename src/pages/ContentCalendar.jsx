import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useRequests } from '../context/RequestContext';
import NewRequestModal from '../components/NewRequestModal';
import RequestDetail from '../components/RequestDetail';
import { useSwipeable } from 'react-swipeable';

// Configuración de localizer para react-big-calendar con date-fns
const locales = { 'es': es };
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// Parser de fechas para manejar formatos de Firebase y strings
const parseDate = (val) => {
    if (!val) return null;
    try {
        if (val.seconds) return new Date(val.seconds * 1000);
        if (typeof val === 'string') return new Date(val.includes('T') ? val : val + 'T12:00:00');
        return new Date(val);
    } catch (e) {
        return null;
    }
};

// Componente personalizado para el evento en el calendario
const CustomEvent = ({ event }) => {
    const isMobile = window.innerWidth < 768;
    return isMobile
        ? <div className="w-full h-1 mt-1 rounded" style={{ backgroundColor: event.color }} />
        : (
            <div 
                className="text-[10px] px-1.5 py-0.5 truncate text-white rounded shadow-sm font-medium" 
                style={{ backgroundColor: event.color }}
                title={event.title}
            >
                {event.title}
            </div>
        );
};

const ContentCalendar = () => {
    const { requests } = useRequests();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState(window.innerWidth < 768 ? 'day' : 'month');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [modals, setModals] = useState({ create: false, detail: null, date: null });

    // Sincronizar vista según el ancho de pantalla
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            // Asegurar que la vista sea válida para el dispositivo
            if (mobile && view !== 'day') {
                setView('day');
            } else if (!mobile && view === 'day') {
                setView('month');
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [view]);

    // Transformar solicitudes en eventos de calendario
    const events = useMemo(() => {
        if (!requests) return [];
        const list = [];
        requests.forEach(req => {
            if (req.archived) return; // No mostrar las archivadas en el calendario principal

            // 1. Fecha de Entrega (Prioridad 1)
            const delivery = parseDate(req.deliveryDate || req.fechaEntrega);
            if (delivery && !isNaN(delivery)) {
                list.push({
                    title: `🚀 ${req.title}`,
                    start: delivery,
                    end: delivery,
                    allDay: true,
                    color: req.type === 'video' ? '#2563eb' : '#16a34a', // Azul para video, verde para otros
                    resource: req
                });
            }

            // 2. Fechas de Grabación Múltiples (Prioridad 2)
            if (req.recordings && req.recordings.length > 0) {
                req.recordings.forEach((rec, idx) => {
                    const recStart = parseDate(rec.date);
                    if (recStart && !isNaN(recStart)) {
                        const start = new Date(recStart);
                        if (!rec.startTime || typeof rec.startTime !== 'string') {
                            start.setHours(9, 0);
                        } else {
                            const parts = rec.startTime.split(':');
                            start.setHours(parseInt(parts[0]) || 9, parseInt(parts[1]) || 0);
                        }

                        const end = new Date(recStart);
                        if (!rec.endTime || typeof rec.endTime !== 'string') {
                            end.setHours(11, 0);
                        } else {
                            const parts = rec.endTime.split(':');
                            end.setHours(parseInt(parts[0]) || 11, parseInt(parts[1]) || 0);
                        }

                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                            list.push({
                                title: `🎥 [GRAB] ${req.title} ${req.recordings.length > 1 ? `(${idx + 1}/${req.recordings.length})` : ''}`,
                                start: start,
                                end: end,
                                allDay: !rec.startTime,
                                color: '#f97316',
                                resource: req
                            });
                        }
                    }
                });
            } else {
                // Legado (Antiguo formato de rango)
                const recStart = parseDate(req.recordingStartDate || req.recordingDate);
                const recEnd = parseDate(req.recordingEndDate || req.recordingStartDate || req.recordingDate);
                
                if (recStart && !isNaN(recStart)) {
                    const start = new Date(recStart);
                    if (!req.recordingStartTime || typeof req.recordingStartTime !== 'string') {
                        start.setHours(9, 0);
                    } else {
                        const parts = req.recordingStartTime.split(':');
                        if (parts.length >= 2) {
                            start.setHours(parseInt(parts[0]) || 9, parseInt(parts[1]) || 0);
                        } else {
                            start.setHours(9, 0);
                        }
                    }

                    const end = new Date(recEnd || recStart);
                    if (!req.recordingEndTime || typeof req.recordingEndTime !== 'string') {
                        end.setHours(11, 0);
                    } else {
                        const parts = req.recordingEndTime.split(':');
                        if (parts.length >= 2) {
                            end.setHours(parseInt(parts[0]) || 11, parseInt(parts[1]) || 0);
                        } else {
                            end.setHours(11, 0);
                        }
                    }

                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        list.push({
                            title: `🎥 [GRAB] ${req.title}`,
                            start: start,
                            end: end,
                            allDay: !req.recordingStartTime,
                            color: '#f97316',
                            resource: req
                        });
                    }
                }
            }
            // 3. Fecha de Solicitud/Creación (Siempre visible)
            const created = parseDate(req.requestDate || req.createdAt);
            if (created && !isNaN(created)) {
                list.push({
                    title: `📄 [SOL] ${req.title}`,
                    start: created,
                    end: created,
                    allDay: true,
                    color: '#9ca3af', // Gris
                    resource: req
                });
            }
        });
        return list;
    }, [requests]);

    // Handlers para gestos táctiles (deslizar para cambiar de mes)
    const handlers = useSwipeable({
        onSwipedLeft: () => setCurrentDate(d => {
            const newDate = new Date(d);
            newDate.setMonth(d.getMonth() + 1);
            return newDate;
        }),
        onSwipedRight: () => setCurrentDate(d => {
            const newDate = new Date(d);
            newDate.setMonth(d.getMonth() - 1);
            return newDate;
        }),
    });

    return (
        <div {...handlers} className="h-[calc(100vh-120px)] bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <style>{`
                .rbc-month-row { min-height: 120px !important; }
                .rbc-event { padding: 0 !important; background: transparent !important; }
                .rbc-selected-cell { background-color: rgba(59, 130, 246, 0.05) !important; }
                .rbc-today { background-color: rgba(59, 130, 246, 0.02) !important; }
                .rbc-header { padding: 10px 0 !important; font-weight: 700 !important; font-size: 0.75rem !important; text-transform: uppercase !important; color: #6b7280 !important; }
            `}</style>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">CALENDARIO DE CONTENIDOS</h1>
                    <p className="text-sm text-gray-500 mt-1">Visualización de todas las solicitudes por fecha</p>
                </div>
                <div className="flex flex-wrap gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#2563eb]"></div>
                        <span className="text-xs font-medium text-gray-600">Entrega Video</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#16a34a]"></div>
                        <span className="text-xs font-medium text-gray-600">Entrega Diseño/Otros</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
                        <span className="text-xs font-medium text-gray-600">Grabación</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#9ca3af]"></div>
                        <span className="text-xs font-medium text-gray-600">Fecha Solicitud</span>
                    </div>
                </div>
                <div className="flex gap-2 ml-auto">
                    <button 
                        onClick={() => setCurrentDate(new Date())} 
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                    >
                        Hoy
                    </button>
                    <button 
                        onClick={() => setModals({ ...modals, create: true, date: currentDate })}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95"
                    >
                        Nueva Solicitud
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-gray-100">
                <Calendar
                    localizer={localizer}
                    events={events}
                    date={currentDate}
                    onNavigate={setCurrentDate}
                    view={view}
                    onView={setView}
                    views={isMobile ? ['day'] : ['month', 'week']}
                    style={{ height: '100%' }}
                    culture='es'
                    selectable
                    onSelectSlot={({ start }) => setModals({ ...modals, create: true, date: start })}
                    onSelectEvent={(ev) => setModals({ ...modals, detail: ev.resource })}
                    components={{
                        event: CustomEvent
                    }}
                    messages={{
                        today: 'Hoy',
                        previous: 'Anterior',
                        next: 'Siguiente',
                        month: 'Mes',
                        week: 'Semana',
                        day: 'Día',
                        date: 'Fecha',
                        time: 'Hora',
                        event: 'Evento',
                        noEventsInRange: 'No hay eventos en este rango',
                        showMore: total => `+ Ver más (${total})`
                    }}
                />
            </div>

            {/* Modales */}
            <NewRequestModal 
                isOpen={modals.create} 
                onClose={() => setModals({ ...modals, create: false })} 
                initialDate={modals.date} 
            />

            {modals.detail && (
                <div className="fixed inset-0 z-[9999]">
                    <RequestDetail 
                        request={modals.detail} 
                        onClose={() => setModals({ ...modals, detail: null })} 
                        isOpen={true} 
                    />
                </div>
            )}
        </div>
    );
};

export default ContentCalendar;
