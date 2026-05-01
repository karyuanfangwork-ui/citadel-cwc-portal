import React, { useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { DeskFormData } from './useAdminState';

interface ServiceDeskModalProps {
    isOpen: boolean;
    editingDesk: any | null;
    deskFormData: DeskFormData;
    onSave: (e: React.FormEvent) => void;
    onClose: () => void;
    onFormDataChange: (data: DeskFormData) => void;
}

export const ServiceDeskModal: React.FC<ServiceDeskModalProps> = ({
    isOpen,
    editingDesk,
    deskFormData,
    onSave,
    onClose,
    onFormDataChange,
}) => {
    const containerRef = useFocusTrap(isOpen);
    const handleClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(handleClose);

    if (!isOpen) return null;

    const isCodeValid = deskFormData.code.length >= 3 && deskFormData.code.length <= 20 && /^[A-Z0-9_]+$/.test(deskFormData.code);
    const isFormValid = deskFormData.name.trim() !== '' && isCodeValid;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#091e42]/60 backdrop-blur-sm">
            <div
                ref={containerRef}
                className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden scale-in flex flex-col max-h-[90vh]"
                role="dialog"
                aria-modal="true"
                aria-label={editingDesk ? 'Edit Service Desk' : 'New Service Desk'}
            >
                <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h2 className="text-3xl font-black text-[#101418]">
                        {editingDesk ? 'Edit Service Desk' : 'New Service Desk'}
                    </h2>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400">
                        <span className="material-symbols-outlined text-3xl">close</span>
                    </button>
                </div>

                <form onSubmit={onSave} className="p-10 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Service Desk Name *</label>
                            <input
                                required
                                type="text"
                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all"
                                placeholder="e.g. IT Helpdesk"
                                value={deskFormData.name}
                                onChange={e => onFormDataChange({ ...deskFormData, name: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Desk Code * <span className="text-[#8993a4] font-medium normal-case tracking-normal text-[10px]">(3-20 chars, uppercase alphanumeric &amp; underscore)</span></label>
                            <input
                                required
                                type="text"
                                className={`w-full px-6 py-4 bg-gray-50 border rounded-2xl text-base font-bold font-mono tracking-wider focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all ${isCodeValid || deskFormData.code.length === 0 ? 'border-gray-200' : 'border-red-300'}`}
                                placeholder="e.g. IT_HELPDESK"
                                value={deskFormData.code}
                                onChange={e => onFormDataChange({ ...deskFormData, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                                maxLength={20}
                            />
                            {!isCodeValid && deskFormData.code.length > 0 && (
                                <p className="text-xs text-red-500 mt-2 font-medium">Code must be 3-20 uppercase alphanumeric characters or underscores.</p>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Description</label>
                            <textarea
                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all resize-none leading-relaxed"
                                placeholder="Describe the purpose of this service desk..."
                                rows={4}
                                value={deskFormData.description}
                                onChange={e => onFormDataChange({ ...deskFormData, description: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2 pt-4">
                            <label className="flex items-center gap-4 cursor-pointer group">
                                <div className="relative inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={deskFormData.isActive}
                                        onChange={e => onFormDataChange({ ...deskFormData, isActive: e.target.checked })}
                                    />
                                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                                </div>
                                <span className="text-sm font-black text-[#44546f] uppercase tracking-widest group-hover:text-[#101418] transition-colors">Service Desk Active</span>
                            </label>
                        </div>
                    </div>

                    <div className="mt-12 flex gap-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-5 bg-gray-100 text-[#44546f] font-black rounded-3xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                        >
                            Discard
                        </button>
                        <button
                            type="submit"
                            disabled={!isFormValid}
                            className="flex-1 px-8 py-5 bg-[#0052cc] text-white font-black rounded-3xl hover:bg-blue-700 transition-all shadow-sm uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {editingDesk ? 'Commit Changes' : 'Confirm & Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};