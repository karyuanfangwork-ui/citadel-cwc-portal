import React, { useCallback, useEffect, useState } from 'react';
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
    availableAgents: Array<{ id: string; firstName: string; lastName: string; email: string; agentTeam: string | null; openRequestCount: number }>;
    agentsLoading: boolean;
    agentsError: string | null;
    loadAgentsForDesk: (deskId: string) => Promise<void>;
    loadAgentsForTeam: (team: string) => Promise<void>;
}

export const ServiceDeskModal: React.FC<ServiceDeskModalProps> = ({
    isOpen,
    editingDesk,
    deskFormData,
    onSave,
    onClose,
    onFormDataChange,
    availableAgents,
    agentsLoading,
    agentsError,
    loadAgentsForDesk,
    loadAgentsForTeam,
}) => {
    const containerRef = useFocusTrap(isOpen);
    const handleClose = useCallback(() => onClose(), [onClose]);
    useEscapeKey(handleClose);

    // Clear the selected agent when team changes and the agent no longer belongs
    const handleTeamChange = useCallback((newTeam: string) => {
        const updates: Partial<DeskFormData> = { autoAssignTeam: newTeam };
        if (newTeam === 'NONE') {
            updates.autoAssignUserId = null;
            updates.assignmentStrategy = 'ROUND_ROBIN';
        }
        // If we already have agents loaded and the selected agent isn't in the new team, clear it
        if (deskFormData.autoAssignUserId && availableAgents.length > 0) {
            const stillEligible = availableAgents.some(a => a.id === deskFormData.autoAssignUserId);
            if (!stillEligible) {
                updates.autoAssignUserId = null;
            }
        }
        onFormDataChange({ ...deskFormData, ...updates });
        void loadAgentsForTeam(newTeam);
    }, [deskFormData, availableAgents, onFormDataChange, loadAgentsForTeam]);

    // Load agents when modal opens with an existing desk that has a team
    useEffect(() => {
        if (isOpen && editingDesk?.id && deskFormData.autoAssignTeam && deskFormData.autoAssignTeam !== 'NONE') {
            loadAgentsForDesk(editingDesk.id);
        }
    }, [isOpen, editingDesk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!isOpen) return null;

    const isCodeValid = editingDesk || (deskFormData.code.length >= 3 && deskFormData.code.length <= 20 && /^[A-Z0-9_]+$/.test(deskFormData.code));
    const isStrategyValid = deskFormData.autoAssignTeam === 'NONE' || deskFormData.assignmentStrategy !== 'FIXED_AGENT' || deskFormData.autoAssignUserId;
    const isFormValid = deskFormData.name.trim() !== '' && isCodeValid && isStrategyValid;

    const selectedAgent = availableAgents.find(a => a.id === deskFormData.autoAssignUserId);

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
                            <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Desk Code * {!editingDesk && <span className="text-[#8993a4] font-medium normal-case tracking-normal text-[10px]">(3-20 chars, uppercase alphanumeric &amp; underscore)</span>}</label>
                            {editingDesk ? (
                                <div className="w-full px-6 py-4 bg-gray-100 border border-gray-200 rounded-2xl text-base font-bold font-mono tracking-wider text-[#8993a4] select-none">
                                    {deskFormData.code}
                                    <span className="block text-[10px] text-[#8993a4] mt-1 font-medium normal-case tracking-normal">Code cannot be changed after creation</span>
                                </div>
                            ) : (
                                <>
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
                                </>
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

                        {/* ── Auto-Assignment Configuration ── */}
                        <div className="md:col-span-2 mt-6 pt-6 border-t border-gray-100">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-amber-600">smart_toy</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-[#101418] uppercase tracking-wider">Auto-Assignment</h3>
                                    <p className="text-xs text-[#44546f]">New tickets in this desk will be automatically assigned to agents on the selected team.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Assign to Team</label>
                                    <select
                                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all cursor-pointer"
                                        value={deskFormData.autoAssignTeam}
                                        onChange={e => handleTeamChange(e.target.value)}
                                        data-testid="auto-assign-team"
                                    >
                                        <option value="NONE">None (Manual assignment only)</option>
                                        <option value="IT">IT Team</option>
                                        <option value="HR">HR Team</option>
                                        <option value="FINANCE">Finance Team</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Assignment Strategy</label>
                                    <select
                                        className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={deskFormData.assignmentStrategy}
                                        onChange={e => onFormDataChange({ ...deskFormData, assignmentStrategy: e.target.value, autoAssignUserId: e.target.value !== 'FIXED_AGENT' ? null : deskFormData.autoAssignUserId })}
                                        disabled={deskFormData.autoAssignTeam === 'NONE'}
                                        data-testid="assignment-strategy"
                                    >
                                        <option value="ROUND_ROBIN">Round Robin</option>
                                        <option value="LEAST_LOADED">Least Loaded</option>
                                        <option value="RANDOM">Random</option>
                                        <option value="FIXED_AGENT">Fixed Agent</option>
                                    </select>
                                    <p className="text-[10px] text-[#8993a4] mt-2 font-medium">
                                        {deskFormData.assignmentStrategy === 'ROUND_ROBIN' && 'Cycles through agents in order, one after another.'}
                                        {deskFormData.assignmentStrategy === 'LEAST_LOADED' && 'Assigns to the agent with the fewest open tickets.'}
                                        {deskFormData.assignmentStrategy === 'RANDOM' && 'Picks a random agent from the team.'}
                                        {deskFormData.assignmentStrategy === 'FIXED_AGENT' && 'Always assigns new tickets to the selected agent.'}
                                    </p>
                                </div>
                            </div>

                            {/* ── Fixed Agent Selector ── */}
                            {deskFormData.assignmentStrategy === 'FIXED_AGENT' && deskFormData.autoAssignTeam !== 'NONE' && (
                                <div className="mt-6">
                                    <label className="block text-xs font-black text-[#44546f] uppercase tracking-widest mb-3">Assign to Agent *</label>
                                    {agentsLoading ? (
                                        <div className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-[#8993a4]">
                                            Loading agents...
                                        </div>
                                    ) : agentsError ? (
                        <div className="w-full px-6 py-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
                            {agentsError}
                        </div>
                    ) : availableAgents.length === 0 ? (
                                        <div className="w-full px-6 py-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600">
                                            No eligible agents found for the {deskFormData.autoAssignTeam} team. Ensure agents are active with AGENT or ADMIN role and assigned to this team.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <select
                                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold focus:ring-4 focus:ring-[#0052cc]/10 focus:border-[#0052cc] outline-none transition-all cursor-pointer"
                                                value={deskFormData.autoAssignUserId || ''}
                                                onChange={e => onFormDataChange({ ...deskFormData, autoAssignUserId: e.target.value || null })}
                                                data-testid="fixed-agent-select"
                                            >
                                                <option value="">Select an agent...</option>
                                                {availableAgents.map(agent => (
                                                    <option key={agent.id} value={agent.id}>
                                                        {agent.firstName} {agent.lastName} ({agent.email}) — {agent.openRequestCount} open
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedAgent && (
                                                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                                                    <span className="material-symbols-outlined text-emerald-600 text-lg">person_check</span>
                                                    <div>
                                                        <span className="text-sm font-bold text-emerald-800">{selectedAgent.firstName} {selectedAgent.lastName}</span>
                                                        <span className="text-xs text-emerald-600 ml-2">{selectedAgent.email}</span>
                                                        <span className="text-xs text-emerald-500 ml-2">({selectedAgent.openRequestCount} open requests)</span>
                                                    </div>
                                                </div>
                                            )}
                                            {!deskFormData.autoAssignUserId && (
                                                <p className="text-xs text-red-500 font-medium">Please select an agent for fixed assignment.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
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