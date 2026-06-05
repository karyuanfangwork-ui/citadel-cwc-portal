import { useState, useEffect, useCallback } from 'react';
import { serviceDeskService } from '../../services/serviceDesk.service';
import workflowService, { WorkflowStep, WorkflowType } from '../../services/workflow.service';

const AVAILABLE_ROLES = ['ADMIN', 'AGENT', 'HR', 'IT', 'FINANCE', 'CEO', 'VP', 'GROUP_DCEO'];

interface EscalationRule {
    id: string;
    requestTypeId: string;
    triggerHoursAfterBreach: number;
    notifyRoles: string[];
    label: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface ServiceDesk {
    id: string;
    name: string;
    code: string;
}

interface Category {
    id: string;
    name: string;
    serviceDeskId: string;
}

interface RequestType {
    id: string;
    name: string;
    slaHours: number | null;
}

export function SLAEscalationTab() {
    const [desks, setDesks] = useState<ServiceDesk[]>([]);
    const [selectedDeskId, setSelectedDeskId] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState('');
    const [rules, setRules] = useState<EscalationRule[]>([]);
    const [newRule, setNewRule] = useState({ triggerHoursAfterBreach: '', notifyRoles: [] as string[], label: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // SLA Pause state
    const [workflowTypes, setWorkflowTypes] = useState<WorkflowType[]>([]);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
    const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
    const [pauseSaving, setPauseSaving] = useState<string | null>(null);

    useEffect(() => {
        serviceDeskService.getAllServiceDesks().then(setDesks).catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedDeskId) { setCategories([]); return; }
        serviceDeskService.getCategories(selectedDeskId).then(setCategories).catch(() => setCategories([]));
        setSelectedCategoryId('');
        setSelectedTypeId('');
        setRules([]);
    }, [selectedDeskId]);

    useEffect(() => {
        if (!selectedDeskId || !selectedCategoryId) { setRequestTypes([]); return; }
        serviceDeskService.getRequestTypes(selectedDeskId, selectedCategoryId).then(setRequestTypes).catch(() => setRequestTypes([]));
        setSelectedTypeId('');
        setRules([]);
    }, [selectedDeskId, selectedCategoryId]);

    const loadRules = useCallback(async (typeId: string) => {
        try {
            const data = await serviceDeskService.getEscalationRules(typeId);
            setRules(data);
        } catch {
            setError('Failed to load escalation rules.');
        }
    }, []);

    useEffect(() => {
        if (!selectedTypeId) { setRules([]); return; }
        loadRules(selectedTypeId);
    }, [selectedTypeId, loadRules]);

    const toggleRole = (role: string) => {
        setNewRule(prev => ({
            ...prev,
            notifyRoles: prev.notifyRoles.includes(role)
                ? prev.notifyRoles.filter(r => r !== role)
                : [...prev.notifyRoles, role],
        }));
    };

    const handleAddRule = async () => {
        if (!selectedTypeId || newRule.triggerHoursAfterBreach === '' || newRule.notifyRoles.length === 0) {
            setError('Select a request type, enter trigger hours, and pick at least one role.');
            return;
        }
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await serviceDeskService.createEscalationRule({
                requestTypeId: selectedTypeId,
                triggerHoursAfterBreach: parseInt(newRule.triggerHoursAfterBreach, 10),
                notifyRoles: newRule.notifyRoles,
                label: newRule.label || undefined,
            });
            setNewRule({ triggerHoursAfterBreach: '', notifyRoles: [], label: '' });
            await loadRules(selectedTypeId);
            setSuccess('Escalation rule created.');
        } catch {
            setError('Failed to create escalation rule.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (rule: EscalationRule) => {
        try {
            await serviceDeskService.updateEscalationRule(rule.id, { isActive: !rule.isActive });
            await loadRules(selectedTypeId);
            setSuccess(rule.isActive ? 'Rule disabled.' : 'Rule activated.');
        } catch {
            setError('Failed to update rule.');
        }
    };

    const handleDelete = async (ruleId: string) => {
        if (!confirm('Delete this escalation rule?')) return;
        try {
            await serviceDeskService.deleteEscalationRule(ruleId);
            await loadRules(selectedTypeId);
            setSuccess('Rule deleted.');
        } catch {
            setError('Failed to delete rule.');
        }
    };

    // Clear success message after 3s
    useEffect(() => {
        if (!success) return;
        const t = setTimeout(() => setSuccess(''), 3000);
        return () => clearTimeout(t);
    }, [success]);

    // Load workflow types for SLA Pause config
    useEffect(() => {
        workflowService.getWorkflowTypes().then(setWorkflowTypes).catch(() => {});
    }, []);

    // Load workflow steps when a workflow is selected
    useEffect(() => {
        if (!selectedWorkflowId) { setWorkflowSteps([]); return; }
        workflowService.getWorkflowType(selectedWorkflowId).then(wf => setWorkflowSteps(wf.steps || [])).catch(() => setWorkflowSteps([]));
    }, [selectedWorkflowId]);

    const handleToggleSlaPause = async (step: WorkflowStep) => {
        setPauseSaving(step.id);
        try {
            await workflowService.updateWorkflowStep(selectedWorkflowId, step.id, { slaPause: !step.slaPause });
            setWorkflowSteps(prev => prev.map(s => s.id === step.id ? { ...s, slaPause: !s.slaPause } : s));
            setSuccess(`SLA pause ${step.slaPause ? 'disabled' : 'enabled'} for ${step.status}`);
        } catch {
            setError('Failed to update SLA pause setting.');
        } finally {
            setPauseSaving(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-black text-[#101418] mb-1">SLA Escalation Rules</h2>
                <p className="text-sm text-[#44546f]">
                    Define who gets notified when a request breached its SLA by N hours. Rules fire once per request per rule.
                </p>
            </div>

            {/* Request Type Selector */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-[#101418] mb-1.5">Service Desk</label>
                    <select
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none bg-white"
                        value={selectedDeskId}
                        onChange={e => setSelectedDeskId(e.target.value)}
                    >
                        <option value="">Select desk...</option>
                        {desks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-[#101418] mb-1.5">Category</label>
                    <select
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                        value={selectedCategoryId}
                        onChange={e => setSelectedCategoryId(e.target.value)}
                        disabled={!selectedDeskId}
                    >
                        <option value="">Select category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-[#101418] mb-1.5">Request Type</label>
                    <select
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                        value={selectedTypeId}
                        onChange={e => setSelectedTypeId(e.target.value)}
                        disabled={!selectedCategoryId}
                    >
                        <option value="">Select type...</option>
                        {requestTypes.map(t => (
                            <option key={t.id} value={t.id}>
                                {t.name}{t.slaHours ? ` (${t.slaHours}h SLA)` : ' (no SLA)'}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Success / Error messages */}
            {success && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold">
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">
                    <span className="material-symbols-outlined text-lg">error</span>
                    {error}
                    <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
                </div>
            )}

            {/* Rules List */}
            {selectedTypeId && (
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-[#101418]">Active Rules</h3>
                    {rules.length === 0 ? (
                        <div className="text-sm text-[#8993a4] italic py-8 text-center bg-gray-50 rounded-xl">
                            No escalation rules configured for this request type.
                        </div>
                    ) : (
                        <div className="divide-y border border-gray-100 rounded-xl overflow-hidden">
                            {rules.map(rule => (
                                <div key={rule.id} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50/50 transition-colors">
                                    <div>
                                        <p className="text-sm font-bold text-[#101418]">
                                            +{rule.triggerHoursAfterBreach}h after breach
                                            {rule.label && <span className="ml-2 text-[#8993a4] font-medium">— {rule.label}</span>}
                                        </p>
                                        <p className="text-xs text-[#8993a4] mt-0.5">
                                            Notify: {rule.notifyRoles.join(', ')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleToggleActive(rule)}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                                                rule.isActive
                                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                            }`}
                                        >
                                            {rule.isActive ? 'Active' : 'Disabled'}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rule.id)}
                                            className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Rule Form */}
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50">
                        <h4 className="text-sm font-black text-[#101418]">Add Escalation Rule</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-[#101418] mb-1.5">Trigger (hours after breach)</label>
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    placeholder="e.g. 4"
                                    value={newRule.triggerHoursAfterBreach}
                                    onChange={e => setNewRule(p => ({ ...p, triggerHoursAfterBreach: e.target.value }))}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#101418] mb-1.5">Label (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Manager escalation"
                                    value={newRule.label}
                                    onChange={e => setNewRule(p => ({ ...p, label: e.target.value }))}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#101418] mb-2">Notify Roles</label>
                            <div className="flex flex-wrap gap-2">
                                {AVAILABLE_ROLES.map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => toggleRole(role)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            newRule.notifyRoles.includes(role)
                                                ? 'bg-[#0052cc] text-white shadow-sm'
                                                : 'bg-white text-[#44546f] border border-gray-200 hover:border-[#0052cc] hover:text-[#0052cc]'
                                        }`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={handleAddRule}
                            disabled={saving}
                            className="px-5 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#0043a8] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <><span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>Creating...</>
                            ) : (
                                <><span className="material-symbols-outlined text-lg">add</span>Add Rule</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* SLA Pause Configuration */}
            <div className="border-t border-gray-200 pt-8 mt-8">
                <div className="mb-4">
                    <h2 className="text-lg font-black text-[#101418] mb-1">SLA Pause Configuration</h2>
                    <p className="text-sm text-[#44546f]">
                        Choose which workflow statuses should pause the SLA timer. When a request enters a paused status, the SLA clock stops until it leaves that status. This is typically used for approval/pending statuses where the assigned agent has no control over response time.
                    </p>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-[#101418] mb-1.5">Workflow</label>
                    <select
                        className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] outline-none bg-white"
                        value={selectedWorkflowId}
                        onChange={e => setSelectedWorkflowId(e.target.value)}
                    >
                        <option value="">Select workflow...</option>
                        {workflowTypes.map(wt => (
                            <option key={wt.id} value={wt.id}>{wt.name} ({wt.code})</option>
                        ))}
                    </select>
                </div>

                {selectedWorkflowId && workflowSteps.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Label</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Pause SLA</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {workflowSteps
                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                    .map(step => (
                                        <tr key={step.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-indigo-700">{step.status}</td>
                                            <td className="px-4 py-3 text-gray-900">{step.label}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleToggleSlaPause(step)}
                                                    disabled={pauseSaving === step.id}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                        step.slaPause
                                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                                    title={step.slaPause ? 'Click to disable SLA pause' : 'Click to enable SLA pause'}
                                                >
                                                    {pauseSaving === step.id ? (
                                                        <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-sm">
                                                            {step.slaPause ? 'pause_circle' : 'play_circle'}
                                                        </span>
                                                    )}
                                                    {step.slaPause ? 'Paused' : 'Running'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                {step.isInitial && <span className="text-xs px-2 py-0.5 bg-green-50 rounded-full text-green-700">Initial</span>}
                                                {step.isFinal && <span className="text-xs px-2 py-0.5 bg-red-50 rounded-full text-red-600">Final</span>}
                                                {!step.isInitial && !step.isFinal && <span className="text-xs text-gray-400">Step</span>}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {selectedWorkflowId && workflowSteps.length === 0 && (
                    <div className="text-sm text-[#8993a4] italic py-6 text-center bg-gray-50 rounded-xl">
                        No steps configured for this workflow.
                    </div>
                )}
            </div>
        </div>
    );
}

export default SLAEscalationTab;