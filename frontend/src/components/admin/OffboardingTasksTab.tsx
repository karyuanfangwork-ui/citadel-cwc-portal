import React, { useState, useEffect, useCallback } from 'react';
import { OnboardingTaskTemplate } from '../../../types';
import { adminService } from '../../services/admin.service';
import apiClient from '../../services/api';

interface OffboardingTemplateForm {
    taskName: string;
    taskDescription: string;
    taskCategory: 'IT' | 'HR' | 'ADMIN';
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    dueDayOffset: number;
    displayOrder: number;
}

interface ItAgent {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    agentTeam: string | null;
}

interface OffboardingTasksTabProps {
    templates: OnboardingTaskTemplate[];
    templatesLoading: boolean;
    templateError: string | null;
    showTemplateForm: boolean;
    editingTemplate: OnboardingTaskTemplate | null;
    templateForm: OffboardingTemplateForm;
    onSaveTemplate: () => void;
    onDeleteTemplate: (id: string) => void;
    onEditTemplate: (template: OnboardingTaskTemplate) => void;
    onShowTemplateForm: (show: boolean) => void;
    onTemplateFormChange: (form: OffboardingTemplateForm) => void;
}

export const OffboardingTasksTab: React.FC<OffboardingTasksTabProps> = ({
    templates,
    templatesLoading,
    templateError,
    showTemplateForm,
    editingTemplate,
    templateForm,
    onSaveTemplate,
    onDeleteTemplate,
    onEditTemplate,
    onShowTemplateForm,
    onTemplateFormChange,
}) => {
    // ── Dedicated IT Agent state (shared setting with onboarding) ────
    const [itAgents, setItAgents] = useState<ItAgent[]>([]);
    const [selectedItAgentId, setSelectedItAgentId] = useState<string>('');
    const [currentItAgent, setCurrentItAgent] = useState<ItAgent | null>(null);
    const [itAgentLoading, setItAgentLoading] = useState(true);
    const [itAgentSaving, setItAgentSaving] = useState(false);
    const [itAgentToast, setItAgentToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showToast = useCallback((type: 'success' | 'error', text: string) => {
        setItAgentToast({ type, text });
        setTimeout(() => setItAgentToast(null), 4000);
    }, []);

    useEffect(() => {
        const fetchItAgentData = async () => {
            setItAgentLoading(true);
            try {
                const [agentsRes, configuredAgent] = await Promise.all([
                    apiClient.get('/users/agents'),
                    adminService.getOnboardingItAgent(),
                ]);
                const allAgents = agentsRes.data.data.agents as ItAgent[];
                const itOnly = allAgents.filter(a => a.agentTeam?.toUpperCase() === 'IT');
                setItAgents(itOnly);
                setCurrentItAgent(configuredAgent);
                setSelectedItAgentId(configuredAgent?.id || '');
            } catch {
                showToast('error', 'Failed to load IT agent data');
            } finally {
                setItAgentLoading(false);
            }
        };
        fetchItAgentData();
    }, [showToast]);

    const handleSaveItAgent = useCallback(async () => {
        if (!selectedItAgentId) {
            showToast('error', 'Please select an IT agent');
            return;
        }
        setItAgentSaving(true);
        try {
            const agent = await adminService.setOnboardingItAgent(selectedItAgentId);
            setCurrentItAgent(agent);
            showToast('success', `Dedicated IT agent set to ${agent.firstName} ${agent.lastName}`);
        } catch (err: any) {
            showToast('error', err.response?.data?.message || 'Failed to save IT agent');
        } finally {
            setItAgentSaving(false);
        }
    }, [selectedItAgentId, showToast]);

    return (
        <div className="space-y-6">
            {/* ── Dedicated IT Agent Configuration ────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm p-8">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-[#101418]">Dedicated IT Agent for Offboarding</h2>
                        <p className="text-sm text-[#44546f] mt-1">
                            When an offboarding ticket is created with IT tasks, only this agent will be notified.
                            This setting is shared with onboarding — changing it here also applies to onboarding notifications.
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-2xl text-amber-600 flex-shrink-0">support_agent</span>
                </div>

                {itAgentLoading ? (
                    <div className="flex items-center gap-2 py-4">
                        <span className="animate-spin material-symbols-outlined text-xl text-[#0052cc]">progress_activity</span>
                        <span className="text-sm text-[#44546f]">Loading IT agents…</span>
                    </div>
                ) : itAgents.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-sm text-amber-800">
                            No active IT team agents found. Please assign at least one user to the IT team with AGENT or ADMIN role.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Current agent display */}
                        {currentItAgent && (
                            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl text-amber-600">check_circle</span>
                                <div>
                                    <p className="text-sm font-bold text-amber-900">
                                        Currently assigned: {currentItAgent.firstName} {currentItAgent.lastName}
                                    </p>
                                    <p className="text-xs text-amber-700">{currentItAgent.email}</p>
                                </div>
                            </div>
                        )}

                        {/* Agent selector */}
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1.5">
                                    Select IT Agent
                                </label>
                                <select
                                    value={selectedItAgentId}
                                    onChange={e => setSelectedItAgentId(e.target.value)}
                                    disabled={itAgentSaving}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                                >
                                    <option value="">— Select an IT agent —</option>
                                    {itAgents.map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.firstName} {agent.lastName} ({agent.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleSaveItAgent}
                                disabled={!selectedItAgentId || itAgentSaving || selectedItAgentId === currentItAgent?.id}
                                className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {itAgentSaving && <span className="animate-spin material-symbols-outlined text-base">progress_activity</span>}
                                Save
                            </button>
                        </div>

                        {itAgentToast && (
                            <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${itAgentToast.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {itAgentToast.text}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Offboarding Task Templates ───────────────────────────── */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm p-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-[#101418]">Offboarding Task Templates</h2>
                        <p className="text-sm text-[#44546f] mt-1">These tasks are automatically added to every departing employee&apos;s offboarding checklist.</p>
                    </div>
                    <button
                        onClick={() => { onShowTemplateForm(true); onTemplateFormChange({ taskName: '', taskDescription: '', taskCategory: 'HR', priority: 'MEDIUM', dueDayOffset: 0, displayOrder: 0 }); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">add</span>
                        Add Task
                    </button>
                </div>

                {templateError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{templateError}</div>}

                {showTemplateForm && (
                    <div className="mb-6 p-5 border border-amber-400 rounded-lg bg-amber-50">
                        <h3 className="font-semibold text-[#101418] mb-4">{editingTemplate ? 'Edit Task Template' : 'New Task Template'}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Task Name *</label>
                                <input
                                    type="text"
                                    value={templateForm.taskName}
                                    onChange={e => onTemplateFormChange({ ...templateForm, taskName: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="e.g. Revoke System Access"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Description</label>
                                <input
                                    type="text"
                                    value={templateForm.taskDescription}
                                    onChange={e => onTemplateFormChange({ ...templateForm, taskDescription: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="Brief description of what needs to be done"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Category *</label>
                                <select
                                    value={templateForm.taskCategory}
                                    onChange={e => onTemplateFormChange({ ...templateForm, taskCategory: e.target.value as any })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="IT">IT</option>
                                    <option value="HR">HR</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Priority *</label>
                                <select
                                    value={templateForm.priority}
                                    onChange={e => onTemplateFormChange({ ...templateForm, priority: e.target.value as any })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Due Date Offset (days)</label>
                                <input
                                    type="number"
                                    value={templateForm.dueDayOffset}
                                    onChange={e => onTemplateFormChange({ ...templateForm, dueDayOffset: parseInt(e.target.value) || 0 })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <p className="text-xs text-[#44546f] mt-1">Negative = before last day, 0 = on last day, positive = after</p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#44546f] uppercase mb-1">Display Order</label>
                                <input
                                    type="number"
                                    value={templateForm.displayOrder}
                                    onChange={e => onTemplateFormChange({ ...templateForm, displayOrder: parseInt(e.target.value) || 0 })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={onSaveTemplate}
                                disabled={!templateForm.taskName}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                            >
                                {editingTemplate ? 'Save Changes' : 'Add Template'}
                            </button>
                            <button
                                onClick={() => { onShowTemplateForm(false); }}
                                className="px-4 py-2 border border-gray-300 text-[#44546f] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {templatesLoading ? (
                    <div className="text-center py-8 text-[#44546f]">Loading templates...</div>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">#</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Task Name</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Category</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Priority</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Due Offset</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Status</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-[#44546f] uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {templates.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[#44546f]">No templates yet. Add one above.</td></tr>
                                ) : templates.map((template, index) => (
                                    <tr key={template.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-[#44546f]">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium text-[#101418]">{template.taskName}</p>
                                            {template.taskDescription && <p className="text-xs text-[#44546f] mt-0.5">{template.taskDescription}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                template.taskCategory === 'IT' ? 'bg-blue-100 text-blue-700' :
                                                template.taskCategory === 'HR' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>{template.taskCategory}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold ${
                                                template.priority === 'CRITICAL' ? 'text-red-600' :
                                                template.priority === 'HIGH' ? 'text-orange-600' :
                                                template.priority === 'MEDIUM' ? 'text-yellow-600' : 'text-gray-500'
                                            }`}>{template.priority}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[#44546f]">
                                            {template.dueDayOffset === 0 ? 'Last day' :
                                             template.dueDayOffset < 0 ? `${Math.abs(template.dueDayOffset)}d before` :
                                             `${template.dueDayOffset}d after`}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {template.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <button onClick={() => onEditTemplate(template)} className="text-[#0052cc] hover:text-[#0747a6] text-xs font-semibold">Edit</button>
                                                <button onClick={() => onDeleteTemplate(template.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};