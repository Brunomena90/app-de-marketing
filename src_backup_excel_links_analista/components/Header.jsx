import React, { useState } from 'react';
import { Menu, User, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const Header = ({ onMenuClick }) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { user, logout } = useAuth();

    if (!user) return null;

    const getInitials = (name) => {
        if (!name) return '??';
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    return (
        <header className="h-16 bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="p-2 hover:bg-gray-100 rounded-lg md:hidden text-gray-600"
                >
                    <Menu size={24} />
                </button>
                <h2 className="text-lg font-semibold text-gray-800 md:hidden">
                    Central de Solicitudes
                </h2>
            </div>

            <div className="flex items-center gap-4 ml-auto">
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                            {getInitials(user.name)}
                        </div>
                        <div className="hidden md:block text-left mr-2">
                            <p className="text-sm font-medium text-gray-700 leading-none">{user.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 capitalize">{user.role}</p>
                        </div>
                    </button>

                    {isProfileOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-30"
                                onClick={() => setIsProfileOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-40">
                                <div className="px-4 py-2 border-b border-gray-100 md:hidden">
                                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                                </div>
                                <button
                                    onClick={logout}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <LogOut size={16} />
                                    Cerrar Sesión
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <button
                    onClick={logout}
                    title="Cerrar Sesión"
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </header>
    );
};

export default Header;
