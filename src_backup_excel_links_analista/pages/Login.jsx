import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Lock, User, ArrowRight } from 'lucide-react';
import AppIcon from '../components/AppIcon';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) return toast.error("Por favor completa todos los campos");

        setIsSubmitting(true);
        try {
            await login(email, password);
            toast.success(`Bienvenido de nuevo`);
            navigate('/dashboard');
        } catch (error) {
            toast.error(error.message || "Error al iniciar sesión");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">

                {/* Header con Nuevo Nombre */}
                <div className="bg-gray-900 p-8 text-center flex flex-col items-center">
                    <div className="mb-4">
                        <AppIcon className="w-24 h-24" variant="white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-wide uppercase">ARTORIES MANAGEMENT SUITE</h2>
                    <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest font-medium opacity-60">Panel Administrativo</p>
                </div>

                {/* Formulario */}
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Correo Corporativo</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <User size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                    placeholder="usuario@empresa.com"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-lg shadow-lg transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                        >
                            {isSubmitting ? 'Verificando...' : <>Ingresar <ArrowRight size={18} /></>}
                        </button>
                    </form>
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <p className="text-xs text-gray-400">App creada por Bruno Mena</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
