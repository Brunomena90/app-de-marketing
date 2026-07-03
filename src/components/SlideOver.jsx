import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

const SlideOver = ({ isOpen, onClose, title, children, className }) => {
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div className={cn(
                "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "translate-x-full",
                className
            )}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SlideOver;
