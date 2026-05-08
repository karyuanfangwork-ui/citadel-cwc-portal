import React, { useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { IconPicker } from './IconPicker';

interface ServiceFormData {
    name: string;
    description: string;
    icon: string;
    requiresApproval: boolean;
    slaHours: string;
    requiredRole: string;
}

interface ServiceModalProps {
    isOpen: boolean;
    selectedCategory: any;
    availableRoles: { id: string; name: string; description: string }[];
    serviceFormData: ServiceFormData;
    editingService?: any | null;
    onCreateService: (e: React.FormEvent) => void;
    onUpdateService?: (e: React.FormEvent) => void;
    onClose: () => void;
    onFormDataChange: (data: ServiceFormData) => void;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
    isOpen,
    selectedCategory,
    availableRoles,
    serviceFormData,
    editingService,
    onCreateService,
    onUpdateService,
    onClose,
    onFormDataChange,
}) => {
    const containerRef = useFocusTrap(isOpen);
    const handleClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(handleClose);

    if (!isOpen) return null;

    const isEdit = !!editingService;

    return (
        <div ref={containerRef} className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#091e42]/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit Service' : 'New Service'}>
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden scale-in flex flex-col max-h-[90vh]">
                <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-2xl font-black text-[#101418]">{isEdit ? 'Edit Service' : 'New Service'}</h2>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400" aria-label="Close">
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>
                </div>
                <form onSubmit={isEdit && onUpdateService ? onUpdateService : onCreateService} className="p-10 space-y-6 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Service Name *</label>
                        <input
                            required
                            type="text"
                            className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                            placeholder="e.g. Laptop Replacement"
                            value={serviceFormData.name}
                            onChange={e => onFormDataChange({ ...serviceFormData, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Description</label>
                        <textarea
                            className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all resize-none"
                            placeholder="What does this service cover?"
                            rows={3}
                            value={serviceFormData.description}
                            onChange={e => onFormDataChange({ ...serviceFormData, description: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Icon</label>
                        <IconPicker value={serviceFormData.icon} onChange={(icon) => onFormDataChange({ ...serviceFormData, icon })} />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">SLA (hours)</label>
                            <input
                                type="number"
                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                placeholder="e.g. 24"
                                value={serviceFormData.slaHours}
                                onChange={e => onFormDataChange({ ...serviceFormData, slaHours: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center pt-8">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded accent-[#0052cc]"
                                    checked={serviceFormData.requiresApproval}
                                    onChange={e => onFormDataChange({ ...serviceFormData, requiresApproval: e.target.checked })}
                                />
                                <span className="text-sm font-bold text-[#44546f]">Requires Approval</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[#101418] mb-2">Required Role (optional)</label>
                        <select
                            value={serviceFormData.requiredRole}
                            onChange={e => onFormDataChange({ ...serviceFormData, requiredRole: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                        >
                            <option value="">No restriction</option>
                            {availableRoles.map(role => (
                                <option key={role.name} value={role.name}>{role.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-[#44546f] mt-1">Only users with this role can submit this request type.</p>
                    </div>
                    <div className="flex gap-6 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest">Cancel</button>
                        <button type="submit" className="flex-1 py-4 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all text-xs uppercase tracking-widest">{isEdit ? 'Save Changes' : 'Create Service'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
