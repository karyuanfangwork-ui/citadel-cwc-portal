import React from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface RequestTypeEditModalProps {
    isOpen: boolean;
    editingTypeName: { id: string; name: string; description: string; workflowTypeId?: string } | null;
    editTypeForm: { name: string; description: string; workflowTypeId: string; slaHours: string };
    savingTypeName: boolean;
    workflowTypes: any[];
    workflowTypesLoading: boolean;
    onSave: () => void;
    onClose: () => void;
    onFormChange: (form: { name: string; description: string; workflowTypeId: string; slaHours: string }) => void;
}

export const RequestTypeEditModal: React.FC<RequestTypeEditModalProps> = ({
    isOpen,
    editingTypeName,
    editTypeForm,
    savingTypeName,
    workflowTypes,
    workflowTypesLoading,
    onSave,
    onClose,
    onFormChange,
}) => {
    const containerRef = useFocusTrap(isOpen);
    useEscapeKey(isOpen ? onClose : () => {});

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Edit Request Type">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" ref={containerRef}>
                <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-[#101418]">Edit Request Type</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            disabled={savingTypeName}
                        >
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-[#101418] mb-2">Name</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                value={editTypeForm.name}
                                onChange={e => onFormChange({ ...editTypeForm, name: e.target.value })}
                                disabled={savingTypeName}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[#101418] mb-2">Description</label>
                            <textarea
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none resize-none"
                                value={editTypeForm.description}
                                onChange={e => onFormChange({ ...editTypeForm, description: e.target.value })}
                                disabled={savingTypeName}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[#101418] mb-2">Workflow Type</label>
                            <select
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none bg-white"
                                value={editTypeForm.workflowTypeId}
                                onChange={e => onFormChange({ ...editTypeForm, workflowTypeId: e.target.value })}
                                disabled={savingTypeName || workflowTypesLoading}
                            >
                                <option value="">Default (by Service Desk)</option>
                                {workflowTypes.map(wt => (
                                    <option key={wt.id} value={wt.id}>{wt.name}</option>
                                ))}
                            </select>
                            <p className="text-xs text-[#8993a4] mt-1">Determines the status stepper displayed for this request type.</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="block text-sm font-bold text-[#101418] mb-2">SLA Hours</label>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="e.g. 24"
                                value={editTypeForm.slaHours}
                                onChange={e => onFormChange({ ...editTypeForm, slaHours: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                disabled={savingTypeName}
                            />
                            <p className="text-xs text-[#8993a4] mt-1">Leave blank to disable SLA tracking for this request type.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end mt-6">
                        <button
                            type="button"
                            className="px-6 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
                            onClick={onClose}
                            disabled={savingTypeName}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="px-6 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#0043a8] transition-colors disabled:opacity-50 flex items-center gap-2"
                            onClick={onSave}
                            disabled={savingTypeName || !editTypeForm.name.trim()}
                        >
                            {savingTypeName ? (
                                <><span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>Saving...</>
                            ) : (
                                <><span className="material-symbols-outlined text-lg">save</span>Save Changes</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};