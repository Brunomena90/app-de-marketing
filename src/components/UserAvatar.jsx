import React from 'react';

const UserAvatar = ({ name, size = 'md', className = '' }) => {
    // Lógica segura para obtener iniciales
    const getInitials = (fullName) => {
        if (!fullName) return "??";
        const parts = fullName.trim().split(' ').filter(p => p.length > 0);
        if (parts.length === 0) return "??";
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    };

    // Tamaños predefinidos con Tailwind
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-16 h-16 text-xl',
        xl: 'w-24 h-24 text-3xl'
    };

    return (
        <div className={`
      ${sizeClasses[size] || sizeClasses.md} 
      rounded-full bg-gray-100 text-gray-600 font-bold 
      flex items-center justify-center border border-gray-200 
      uppercase tracking-wider select-none ${className}
    `}>
            {getInitials(name)}
        </div>
    );
};

export default UserAvatar;
