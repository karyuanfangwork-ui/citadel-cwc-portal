import React, { useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

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
    const focusTrapRef = useFocusTrap(true);
    const stableOnClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(stableOnClose);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Assign Roles">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[#0052cc]">admin_panel_settings</span>
                        </div>
                        <div>
                            <h2 className="font-bold text-base text-gray-900">Assign Roles</h2>
                            <p className="text-xs text-gray-500">{user.firstName} {user.lastName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <span className="material-symbols-outlined text-gray-400">close</span>
                    </button>
                </div>
                <div className="p-5 overflow-y-auto">
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
                </div>
                <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button
                        onClick={onSave}
                        disabled={selectedRoles.length === 0}
                        className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3] disabled:opacity-50 disabled:cursor-not-allowed"
                    >Save Roles</button>
                </div>
            </div>
        </div>
    );
};