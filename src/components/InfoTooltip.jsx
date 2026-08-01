import React from 'react';
import { Info } from 'lucide-react';

const InfoTooltip = ({ text }) => (
    <div className="group relative inline-flex items-center ml-1.5 align-text-bottom">
        <Info size={13} className="text-cyan-600/60 hover:text-cyan-500 cursor-help transition-colors" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] leading-relaxed rounded-xl shadow-xl z-[100] text-center pointer-events-none normal-case tracking-normal font-medium">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-white"></div>
        </div>
    </div>
);

export default InfoTooltip;
