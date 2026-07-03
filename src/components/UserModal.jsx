import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import UserAvatar from './UserAvatar';

const UserModal = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [form, setForm] = useState({ name: '', email: '', role: 'solicitante', area: '', position: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [areas, setAreas] = useState([]);

    // Cargar áreas
    useEffect(() => {
        if (isOpen) {
            const q = query(collection(db, "areas"), orderBy("name"));
            const unsub = onSnapshot(q, (snap) => {
                setAreas(snap.docs.map(d => d.data().name));
            });
            return () => unsub();
        }
    }, [isOpen]);

    // Cargar datos al editar
    useEffect(() => {
        if (userToEdit) {
            setForm({
                name: userToEdit.name || '',
                email: userToEdit.email || '',
                role: userToEdit.role || 'solicitante',
                area: userToEdit.area || '',
                position: userToEdit.position || '',
                password: userToEdit.password || ''
            });
            setShowPassword(false);
        } else {
            setForm({ name: '', email: '', role: 'solicitante', area: '', position: '', password: '' });
            setShowPassword(false);
        }
    }, [userToEdit, isOpen]);

    const handleSubmit = () => {
        if (!form.name || !form.email || !form.role || !form.area) {
            return toast.error("Por favor completa los campos obligatorios");
        }
        // Si es nuevo, requerimos contraseña (bueno, el componente padre dice que genera una por defecto si no hay... 
        // pero el usuario puede querer ponerla).
        // El código del usuario dice: "Crear usuario con contraseña por defecto: GCI... Si no se pasa?"
        // Revisando Users.jsx nuevo: "await addDoc(..., { ...userData, password: 'GCI' + ... })"
        // Así que aquí mandamos lo que hay.

        onSave(form);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in zoom-in-95 relative overflow-hidden flex flex-col max-h-[90vh]">

                <div className="p-6 border-b text-center relative bg-white shrink-0">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                    <div className="flex justify-center mb-4">
                        <UserAvatar name={form.name || "Nuevo Usuario"} size="xl" className="bg-gray-100 text-gray-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">{userToEdit ? 'Editar Perfil' : 'Crear Usuario'}</h2>
                    <p className="text-xs text-gray-500">Actualiza la información del colaborador</p>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Nombre Completo</label>
                        <input className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Alexis Garay" autoFocus />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Correo Corporativo</label>
                        <input type="email" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@gci.net.pe" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Rol</label>
                            <select className="w-full border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-blue-500 text-sm" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                <option value="solicitante">Solicitante</option>
                                <option value="jefe">Jefe</option>
                                <option value="editor">Editor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">Área</label>
                            <select className="w-full border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-blue-500 text-sm" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {areas.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">Cargo</label>
                        <input className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Ej: Coordinador de Marketing" />
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <label className="text-xs font-bold text-gray-800 block mb-2 uppercase flex justify-between">
                            Contraseña
                            <span className="text-[10px] font-normal text-gray-400 normal-case">{userToEdit ? "Opcional (Visible para Admin)" : "Opcional (Defecto: GCI2025)"}</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 text-sm pr-10 font-mono"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                placeholder={userToEdit ? "••••••••" : "Dejar vacío para autogenerar"}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
                    <button onClick={handleSubmit} className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-black text-sm font-bold flex items-center gap-2">
                        <Save size={16} /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserModal;
