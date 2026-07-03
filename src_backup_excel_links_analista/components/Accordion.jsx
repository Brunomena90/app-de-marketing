import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const Accordion = ({ title, icon: Icon, children, defaultOpen = true, headerContent }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6 transition-all duration-300">
            <div className="flex justify-between items-center bg-gray-50 hover:bg-gray-100 border-b border-gray-100 transition-colors">
                <div className="flex-1 flex items-center pr-4">
                    <button 
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex-1 px-5 py-4 flex items-center gap-2 outline-none text-left"
                        title={isOpen ? "Contraer" : "Expandir"}
                    >
                        {Icon && <Icon size={16} className="text-gray-500" />}
                        <h3 className="text-sm font-bold text-gray-700 uppercase">{title}</h3>
                    </button>
                    {/* Header injects buttons like Save Version, + A単adir without collapsing */}
                    {headerContent && (
                        <div className="flex items-center gap-2 pr-2" onClick={(e) => e.stopPropagation()}>
                            {headerContent}
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={() => setIsOpen(!isOpen)} 
                    className="p-4 outline-none text-gray-400 hover:text-gray-600 transition-colors border-l border-gray-100"
                >
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
            </div>
            
            {isOpen && (
                <div className="p-5 md:p-6 animate-in slide-in-from-top-2 fade-in duration-200 bg-white">
                    {children}
                </div>
            )}
        </div>
    );
};

export default Accordion;
