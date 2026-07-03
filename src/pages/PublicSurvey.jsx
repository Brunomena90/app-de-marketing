import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';
import { CheckCircle, Send, User } from 'lucide-react';

const PublicSurvey = () => {
    const { id } = useParams();
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    
    // Form state
    const [respondentName, setRespondentName] = useState('');
    const [answers, setAnswers] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchTemplate = async () => {
            try {
                const docRef = doc(db, 'brand_templates', id);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    setTemplate({ id: docSnap.id, ...docSnap.data() });
                } else {
                    toast.error('La encuesta no existe o ha sido eliminada.');
                }
            } catch (error) {
                console.error(error);
                toast.error('Error al cargar la encuesta.');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchTemplate();
    }, [id]);

    const handleAnswerChange = (questionId, text) => {
        setAnswers(prev => ({ ...prev, [questionId]: text }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!respondentName.trim()) {
            return toast.error('Por favor, ingresa tu nombre para continuar.');
        }

        setIsSubmitting(true);
        try {
            // Formatear respuestas
            const formattedAnswers = template.questions.map(q => ({
                questionId: q.id,
                question: q.text,
                answer: answers[q.id] || ''
            }));

            await addDoc(collection(db, 'brand_survey_responses'), {
                templateId: template.id,
                surveyTitle: template.title,
                empresa: template.empresa || '', // Keep it linked to the company
                respondentName,
                answers: formattedAnswers,
                createdAt: serverTimestamp()
            });

            setSubmitted(true);
            toast.success('Respuestas enviadas correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Ocurrió un error al enviar el formulario.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!template) {
        return (
            <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center text-white">
                <Toaster position="top-center" richColors />
                <h1 className="text-2xl font-bold mb-2">Encuesta no encontrada</h1>
                <p className="text-gray-500">Este vínculo puede estar roto o caducado.</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-10 max-w-lg w-full flex flex-col items-center text-center shadow-2xl">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-bold mb-4">¡Gracias por tu participación!</h2>
                    <p className="text-gray-400 mb-8">
                        Tus respuestas han sido registradas exitosamente y enviadas al equipo correspondiente.
                    </p>
                    <button onClick={() => window.close()} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all">
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d1117] text-white py-12 px-4 sm:px-6 relative flex flex-col items-center">
            <Toaster position="top-center" richColors />
            
            <div className="w-full max-w-3xl">
                {/* Header Info */}
                <div className="mb-10 text-center space-y-4">
                    <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-fuchsia-400">
                        {template.title}
                    </h1>
                    <p className="text-gray-400 max-w-xl mx-auto">
                        Ayúdanos a mejorar completando la siguiente información. Tus respuestas son vitales para nuestro crecimiento.
                    </p>
                </div>

                {/* Form Container */}
                <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-10">
                    
                    {/* Respondent Info */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest px-1">Tus Datos</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User className="text-gray-500" size={18} />
                            </div>
                            <input
                                type="text"
                                required
                                value={respondentName}
                                onChange={(e) => setRespondentName(e.target.value)}
                                placeholder="Ingresa tu nombre completo..."
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                            />
                        </div>
                    </div>

                    <hr className="border-gray-800" />

                    {/* Questions */}
                    <div className="space-y-8">
                        <div className="mb-4">
                            <label className="text-xs font-bold text-fuchsia-400 uppercase tracking-widest px-1">Cuestionario</label>
                        </div>
                        
                        {template.questions?.map((q, index) => (
                            <div key={q.id} className="space-y-3">
                                <h3 className="text-white font-semibold text-lg flex gap-3">
                                    <span className="text-gray-500">{index + 1}.</span> {q.text}
                                </h3>
                                <textarea
                                    value={answers[q.id] || ''}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    placeholder="Escribe tu respuesta aquí..."
                                    rows={3}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-5 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner resize-none"
                                />
                            </div>
                        ))}

                        {(!template.questions || template.questions.length === 0) && (
                            <div className="text-center py-10 text-gray-500">
                                Esta encuesta no contiene preguntas.
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="pt-6">
                        <button 
                            type="submit" 
                            disabled={isSubmitting || !template.questions?.length}
                            className={`w-full flex items-center justify-center gap-3 px-6 py-5 rounded-2xl font-bold text-base transition-all shadow-xl
                                ${isSubmitting || !template.questions?.length 
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                                }`}
                        >
                            {isSubmitting ? (
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <Send size={20} /> Enviar Respuestas
                                </>
                            )}
                        </button>
                    </div>

                </form>
                
                <div className="mt-8 text-center">
                    <p className="text-gray-600 text-xs">Desarrollado con <span className="font-semibold text-gray-500">Artories Platform</span></p>
                </div>
            </div>
        </div>
    );
};

export default PublicSurvey;
