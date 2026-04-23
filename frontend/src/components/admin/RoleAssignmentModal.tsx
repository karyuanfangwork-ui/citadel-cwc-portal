import React from 'react';

interface RoleAssignmentModalProps {
    isOpen: boolean;
    user: any;
    availableRoles: { id: string; name: string; description: string }[];
    selectedRoles: string[];
    onSave: () => void;
    onClose: () => void;
    onRoleToggle: (roleName: string, checked: boolean) => void;
}

export const RoleAssignmentModal: React.FC<RoleAssignmentModalProps> = ({
    isOpen,
    user,
    availableRoles,
    selectedRoles,
    onSave,
    onClose,
    onRoleToggle,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden scale-in flex flex-col max-h-[90vh]">
                <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-[#101418]">Assign Roles</h2>
                        <p className="text-sm text-[#44546f] mt-1">{user.firstName} {user.lastName}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>
                </div>
                <div className="p-10 overflow-y-auto">
                    <p className="text-xs font-black text-[#44546f] uppercase tracking-widest mb-6">Select one or more roles</p>
                    <div className="space-y-3">
                        {availableRoles.map(role => (
                            <label key={role.id} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-[#0052cc]/30 hover:bg-blue-50/20 cursor-pointer transition-all">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded accent-[#0052cc]"
                                    checked={selectedRoles.includes(role.name)}
                                    onChange={e => onRoleToggle(role.name, e.target.checked)}
                                />
                                <div>
                                    <div className="font-bold text-[#101418] text-sm">{role.name}</div>
                                    <div className="text-xs text-[#44546f]">{role.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                    <div className="flex gap-4 mt-8">
                        <button onClick={onClose} className="flex-1 py-4 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">Cancel</button>
                        <button
                            onClick={onSave}
                            disabled={selectedRoles.length === 0}
                            className="flex-1 py-4 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                        >Save Roles</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
