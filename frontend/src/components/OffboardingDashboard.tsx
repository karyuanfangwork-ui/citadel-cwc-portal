import React, { useEffect, useState } from 'react';
import apiClient from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface OffboardingTask {
    id: string;
    taskName: string;
    taskDescription?: string;
    taskCategory: string;
    priority: string;
    status: string;
    dueDate?: string;
    notes?: string;
    assignedToUser?: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface OffboardingRequest {
    id: string;
    employeeFirstName: string;
    employeeLastName: string;
    employeeEmail: string;
    department?: string;
    lastWorkingDay: string;
    reasonForDeparture?: string;
    overallStatus: string;
    currentPhase: string;
    resignationLetterAttached: boolean;
    resignationLetterUrl?: string | null;
    resignationLetterFileName?: string | null;
    exitInterviewScheduledDate?: string | null;
    tasks?: OffboardingTask[];
    manager?: { id: string; firstName: string; lastName: string; email: string };
}

interface OffboardingProgress {
    overallStatus: string;
    currentPhase: string;
    completionPercentage: number;
    tasks: { total: number; completed: number; pending: number };
}

interface Props {
    requestId: string;
    onComplete?: () => void;
    onPreConditionsChange?: (data: { isAdvancingToFinalWeek: boolean; preConditionsMet: boolean }) => void;
}

const OffboardingDashboard: React.FC<Props> = ({ requestId, onComplete, onPreConditionsChange }) => {
    const { user } = useAuth();
    const toast = useToast();
    const [offboarding, setOffboarding] = useState<OffboardingRequest | null>(null);
    const [progress, setProgress] = useState<OffboardingProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const [advancingPhase, setAdvancingPhase] = useState(false);
    const [savingPreConditions, setSavingPreConditions] = useState(false);
    const [preConditionForm, setPreConditionForm] = useState({
        exitInterviewScheduledDate: '',
    });
    const [uploadingLetter, setUploadingLetter] = useState(false);
    const [deletingLetter, setDeletingLetter] = useState(false);
    const [editingLastWorkingDay, setEditingLastWorkingDay] = useState(false);
    const [lastWorkingDayForm, setLastWorkingDayForm] = useState('');
    const [savingLastWorkingDay, setSavingLastWorkingDay] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [fieldInput, setFieldInput] = useState<Record<string, string>>({});
    const [savingField, setSavingField] = useState(false);

    useEffect(() => {
        fetchData();
    }, [requestId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [offboardingRes] = await Promise.all([
                apiClient.get(`/offboarding/requests/${requestId}/offboarding`),
            ]);
            const data = offboardingRes.data;
            setOffboarding(data);
            setPreConditionForm({
                exitInterviewScheduledDate: data.exitInterviewScheduledDate
                    ? data.exitInterviewScheduledDate.split('T')[0]
                    : '',
            });
            setError(null);
            try {
                const progressRes = await apiClient.get(`/offboarding/requests/${requestId}/offboarding/progress`);
                setProgress(progressRes.data);
            } catch { /* non-fatal */ }
        } catch (err: any) {
            setError(err.message || 'Failed to load offboarding data');
        } finally {
            setLoading(false);
        }
    };

    const canEditTask = (task: OffboardingTask): boolean => {
        if (user?.roles?.includes('ADMIN')) return true;
        if (!user?.roles?.includes('AGENT')) return false;
        const userAgentTeam = (user as any)?.agentTeam?.toUpperCase() || '';
        const cat = task.taskCategory?.toUpperCase() || '';
        if (userAgentTeam === 'IT' && cat === 'IT') return true;
        if (userAgentTeam === 'HR' && ['HR', 'ADMIN', 'TRAINING'].includes(cat)) return true;
        return false;
    };

    const handleTaskToggle = async (task: OffboardingTask) => {
        if (updatingTaskId || !canEditTask(task)) return;
        const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        setUpdatingTaskId(task.id);
        try {
            const res = await apiClient.put(
                `/offboarding/requests/${requestId}/offboarding/tasks/${task.id}`,
                { status: newStatus }
            );
            setOffboarding(prev => prev ? {
                ...prev,
                tasks: prev.tasks?.map(t => t.id === task.id ? res.data : t),
            } : prev);
            try {
                const progressRes = await apiClient.get(`/offboarding/requests/${requestId}/offboarding/progress`);
                setProgress(progressRes.data);
            } catch { /* non-fatal */ }
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.message || err.message || 'Failed to update task'}`);
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const PHASE_SEQUENCE = [
        { phase: 'NOTICE_PERIOD',      label: 'Notice Period',       next: 'KNOWLEDGE_TRANSFER' },
        { phase: 'KNOWLEDGE_TRANSFER', label: 'Knowledge Transfer',  next: 'FINAL_WEEK' },
        { phase: 'FINAL_WEEK',         label: 'Final Week',          next: 'EXIT_PROCEDURES' },
        { phase: 'EXIT_PROCEDURES',    label: 'Exit Procedures',     next: null },
    ];
    const currentPhaseEntry = PHASE_SEQUENCE.find(p => p.phase === offboarding?.currentPhase);
    const nextPhase = currentPhaseEntry?.next ?? null;
    const nextPhaseLabel = nextPhase ? PHASE_SEQUENCE.find(p => p.phase === nextPhase)?.label : null;

    const isAdminOrHRAgent = user?.roles?.includes('ADMIN') ||
        (user?.roles?.includes('AGENT') && (user as any)?.agentTeam?.toUpperCase() === 'HR');
    const isCompleted = offboarding?.overallStatus === 'COMPLETED';
    const allTasksDone = (progress?.tasks?.total ?? 0) > 0 && progress?.tasks?.pending === 0;
    const isAtFinalPhase = offboarding?.currentPhase === 'EXIT_PROCEDURES';
    const canComplete = (isAdminOrHRAgent ?? false) && allTasksDone && !isCompleted && isAtFinalPhase;

    // Pre-conditions for advancing to Final Week
    const isAdvancingToFinalWeek = nextPhase === 'FINAL_WEEK';
    const preConditionsMet = !isAdvancingToFinalWeek || (
        !!offboarding?.resignationLetterAttached &&
        !!offboarding?.exitInterviewScheduledDate
    );
    const canAdvancePhase = isAdminOrHRAgent && !isCompleted && !!nextPhase && preConditionsMet;

    // Notify parent about offboarding pre-condition state for DecisionPanel gating
    React.useEffect(() => {
        onPreConditionsChange?.({ isAdvancingToFinalWeek, preConditionsMet });
    }, [isAdvancingToFinalWeek, preConditionsMet, onPreConditionsChange]);

    const handleAdvancePhase = async () => {
        if (!nextPhase || advancingPhase) return;
        setAdvancingPhase(true);
        try {
            await apiClient.put(`/offboarding/requests/${requestId}/offboarding/update-status`, {
                currentPhase: nextPhase,
            });
            await fetchData();
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.message || err.message || 'Failed to advance phase'}`);
        } finally {
            setAdvancingPhase(false);
        }
    };

    const handleCompleteOffboarding = async () => {
        if (completing) return;
        const pending = progress?.tasks?.pending ?? 0;
        const total = progress?.tasks?.total ?? 0;
        if (total > 0 && pending > 0) {
            alert(`Cannot complete offboarding: ${pending} task${pending > 1 ? 's are' : ' is'} still incomplete.`);
            return;
        }
        if (!window.confirm('Mark this offboarding as COMPLETED and close the ticket? This cannot be undone.')) return;
        setCompleting(true);
        try {
            await apiClient.put(`/offboarding/requests/${requestId}/offboarding/update-status`, {
                overallStatus: 'COMPLETED',
                completedBy: user?.id,
            });
            await fetchData();
            onComplete?.();
        } catch (err: any) {
            toast.error('Completion Failed', err.response?.data?.message || err.message || 'Failed to complete offboarding');
        } finally {
            setCompleting(false);
        }
    };

    const handleSavePreConditions = async () => {
        setSavingPreConditions(true);
        try {
            await apiClient.put(`/offboarding/requests/${requestId}/offboarding/update-status`, {
                exitInterviewScheduledDate: preConditionForm.exitInterviewScheduledDate || null,
            });
            await fetchData();
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.message || err.message || 'Failed to save'}`);
        } finally {
            setSavingPreConditions(false);
        }
    };

    const handleSaveLastWorkingDay = async () => {
        if (savingLastWorkingDay || !lastWorkingDayForm) return;
        setSavingLastWorkingDay(true);
        try {
            await apiClient.put(`/offboarding/requests/${requestId}/offboarding/update-status`, {
                lastWorkingDay: lastWorkingDayForm,
            });
            await fetchData();
            setEditingLastWorkingDay(false);
        } catch (err: any) {
            alert(`Error: ${err.response?.data?.message || err.message || 'Failed to update last working day'}`);
        } finally {
            setSavingLastWorkingDay(false);
        }
    };

    const handleEditField = (field: string, currentValue: string) => {
        setFieldInput(prev => ({ ...prev, [field]: currentValue }));
        setEditingField(field);
    };

    const handleCancelField = () => {
        setEditingField(null);
        setFieldInput({});
    };

    const handleSaveField = async (field: string) => {
        if (savingField) return;
        const value = fieldInput[field] ?? '';
        // Require non-empty for core fields (phone/department/reason are optional)
        if (['employeeFirstName', 'employeeLastName', 'employeeEmail'].includes(field) && !value.trim()) return;
        setSavingField(true);
        try {
            await apiClient.put(`/offboarding/requests/${requestId}/offboarding/update-status`, {
                [field]: value.trim() || null,
            });
            await fetchData();
            setEditingField(null);
            setFieldInput({});
            toast.success('Field Updated', `${field} has been updated successfully.`);
        } catch (err: any) {
            toast.error('Update Failed', err.response?.data?.message || err.message || 'Failed to update field');
        } finally {
            setSavingField(false);
        }
    };

    const handleUploadResignationLetter = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setUploadingLetter(true);
        try {
            await apiClient.post(
                `/offboarding/requests/${requestId}/offboarding/resignation-letter`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            await fetchData();
        } catch (err: any) {
            alert(`Upload failed: ${err.response?.data?.error || err.message}`);
        } finally {
            setUploadingLetter(false);
            e.target.value = '';
        }
    };

    const handleDeleteResignationLetter = async () => {
        if (!window.confirm('Remove the uploaded resignation letter?')) return;
        setDeletingLetter(true);
        try {
            await apiClient.delete(`/offboarding/requests/${requestId}/offboarding/resignation-letter`);
            await fetchData();
        } catch (err: any) {
            alert(`Failed to remove: ${err.response?.data?.error || err.message}`);
        } finally {
            setDeletingLetter(false);
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'IT': return 'bg-blue-100 text-blue-700';
            case 'HR': return 'bg-purple-100 text-purple-700';
            case 'TRAINING': return 'bg-orange-100 text-orange-700';
            case 'ADMIN': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getTaskIcon = (status: string, taskId?: string) => {
        if (updatingTaskId === taskId) {
            return <span className="material-symbols-outlined text-gray-400 animate-spin">autorenew</span>;
        }
        switch (status) {
            case 'COMPLETED': return <span className="material-symbols-outlined text-green-600">check_circle</span>;
            case 'IN_PROGRESS': return <span className="material-symbols-outlined text-blue-600">schedule</span>;
            case 'BLOCKED': return <span className="material-symbols-outlined text-red-600">error</span>;
            default: return <span className="material-symbols-outlined text-gray-400">radio_button_unchecked</span>;
        }
    };

    const formatDate = (d?: string | null) => {
        if (!d) return 'Not set';
        try {
            const normalized = typeof d === 'string' && !d.includes('T') ? d + 'T00:00:00Z' : d;
            const date = new Date(normalized);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB', { timeZone: 'UTC' });
        } catch { return 'Invalid Date'; }
    };

    const filteredTasks = offboarding?.tasks?.filter(t =>
        selectedCategory === 'ALL' || t.taskCategory === selectedCategory
    ) || [];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
            </div>
        );
    }

    if (!offboarding) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-gray-600">No offboarding workflow found for this request.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Employee Info Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Departing Employee</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* First Name */}
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">person_remove</span>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500">First Name</p>
                            {editingField === 'employeeFirstName' ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="text"
                                        value={fieldInput.employeeFirstName ?? ''}
                                        onChange={e => setFieldInput(prev => ({ ...prev, employeeFirstName: e.target.value }))}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        disabled={savingField}
                                    />
                                    <button
                                        onClick={() => handleSaveField('employeeFirstName')}
                                        disabled={savingField || !fieldInput.employeeFirstName?.trim()}
                                        className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {savingField ? <span className="material-symbols-outlined text-sm animate-spin">autorenew</span> : <span className="material-symbols-outlined text-sm">check</span>}
                                        {savingField ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={handleCancelField} disabled={savingField} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{offboarding.employeeFirstName || 'Not set'}</p>
                                    {isAdminOrHRAgent && !isCompleted && (
                                        <button onClick={() => handleEditField('employeeFirstName', offboarding.employeeFirstName || '')} className="text-gray-400 hover:text-amber-600 transition-colors" title="Edit first name">
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Last Name */}
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">person_remove</span>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500">Last Name</p>
                            {editingField === 'employeeLastName' ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="text"
                                        value={fieldInput.employeeLastName ?? ''}
                                        onChange={e => setFieldInput(prev => ({ ...prev, employeeLastName: e.target.value }))}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        disabled={savingField}
                                    />
                                    <button
                                        onClick={() => handleSaveField('employeeLastName')}
                                        disabled={savingField || !fieldInput.employeeLastName?.trim()}
                                        className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {savingField ? <span className="material-symbols-outlined text-sm animate-spin">autorenew</span> : <span className="material-symbols-outlined text-sm">check</span>}
                                        {savingField ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={handleCancelField} disabled={savingField} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{offboarding.employeeLastName || 'Not set'}</p>
                                    {isAdminOrHRAgent && !isCompleted && (
                                        <button onClick={() => handleEditField('employeeLastName', offboarding.employeeLastName || '')} className="text-gray-400 hover:text-amber-600 transition-colors" title="Edit last name">
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Email */}
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">mail</span>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500">Email</p>
                            {editingField === 'employeeEmail' ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="email"
                                        value={fieldInput.employeeEmail ?? ''}
                                        onChange={e => setFieldInput(prev => ({ ...prev, employeeEmail: e.target.value }))}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        disabled={savingField}
                                    />
                                    <button
                                        onClick={() => handleSaveField('employeeEmail')}
                                        disabled={savingField || !fieldInput.employeeEmail?.trim()}
                                        className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {savingField ? <span className="material-symbols-outlined text-sm animate-spin">autorenew</span> : <span className="material-symbols-outlined text-sm">check</span>}
                                        {savingField ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={handleCancelField} disabled={savingField} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{offboarding.employeeEmail || 'Not set'}</p>
                                    {isAdminOrHRAgent && !isCompleted && (
                                        <button onClick={() => handleEditField('employeeEmail', offboarding.employeeEmail || '')} className="text-gray-400 hover:text-amber-600 transition-colors" title="Edit email">
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Last Working Day (already editable, kept as-is) */}
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">calendar_today</span>
                        <div>
                            <p className="text-sm text-gray-500">Last Working Day</p>
                            {editingLastWorkingDay ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="date"
                                        value={lastWorkingDayForm}
                                        onChange={e => setLastWorkingDayForm(e.target.value)}
                                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                        disabled={savingLastWorkingDay}
                                    />
                                    <button
                                        onClick={handleSaveLastWorkingDay}
                                        disabled={savingLastWorkingDay || !lastWorkingDayForm}
                                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                                    >
                                        {savingLastWorkingDay ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        onClick={() => setEditingLastWorkingDay(false)}
                                        disabled={savingLastWorkingDay}
                                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{formatDate(offboarding.lastWorkingDay)}</p>
                                    {isAdminOrHRAgent && !isCompleted && (
                                        <button
                                            onClick={() => {
                                                const d = offboarding.lastWorkingDay
                                                    ? (offboarding.lastWorkingDay.includes('T') ? offboarding.lastWorkingDay.split('T')[0] : offboarding.lastWorkingDay.split('T')[0])
                                                    : '';
                                                setLastWorkingDayForm(d);
                                                setEditingLastWorkingDay(true);
                                            }}
                                            className="material-symbols-outlined text-base text-gray-400 hover:text-amber-600 transition-colors"
                                            title="Edit last working day"
                                        >
                                            edit_calendar
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Department — read-only, not editable */}
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">corporate_fare</span>
                        <div>
                            <p className="text-sm text-gray-500">Department</p>
                            <p className="font-medium text-gray-900">{offboarding.department || 'Not set'}</p>
                        </div>
                    </div>
                    {/* Reason for Departure */}
                    <div className="flex items-start space-x-3 md:col-span-2">
                        <span className="material-symbols-outlined text-gray-400 text-xl">info</span>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500">Reason for Departure</p>
                            {editingField === 'reasonForDeparture' ? (
                                <div className="flex items-start gap-2 mt-1">
                                    <textarea
                                        value={fieldInput.reasonForDeparture ?? ''}
                                        onChange={e => setFieldInput(prev => ({ ...prev, reasonForDeparture: e.target.value }))}
                                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 w-full min-h-[60px]"
                                        disabled={savingField}
                                        placeholder="Optional"
                                    />
                                    <button
                                        onClick={() => handleSaveField('reasonForDeparture')}
                                        disabled={savingField}
                                        className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1 shrink-0"
                                    >
                                        {savingField ? <span className="material-symbols-outlined text-sm animate-spin">autorenew</span> : <span className="material-symbols-outlined text-sm">check</span>}
                                        {savingField ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={handleCancelField} disabled={savingField} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 disabled:opacity-50 shrink-0">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{offboarding.reasonForDeparture || 'Not set'}</p>
                                    {isAdminOrHRAgent && !isCompleted && (
                                        <button onClick={() => handleEditField('reasonForDeparture', offboarding.reasonForDeparture || '')} className="text-gray-400 hover:text-amber-600 transition-colors" title="Edit reason for departure">
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Overview */}
            {progress && progress.tasks && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Offboarding Progress</h3>
                        <span className="text-2xl font-bold text-amber-600">{progress.completionPercentage || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                        <div
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progress.completionPercentage || 0}%` }}
                        ></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-gray-900">{progress.tasks?.total || 0}</p>
                            <p className="text-sm text-gray-600">Total Tasks</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-green-600">{progress.tasks?.completed || 0}</p>
                            <p className="text-sm text-gray-600">Completed</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-orange-600">{progress.tasks?.pending || 0}</p>
                            <p className="text-sm text-gray-600">Pending</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Pre-conditions card — shown when at Knowledge Transfer and advancing to Final Week */}
            {!isCompleted && isAdvancingToFinalWeek && isAdminOrHRAgent && (
                <div className={`border rounded-lg p-5 ${preConditionsMet ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`material-symbols-outlined text-xl ${preConditionsMet ? 'text-green-600' : 'text-yellow-600'}`}>
                            {preConditionsMet ? 'check_circle' : 'warning'}
                        </span>
                        <h4 className={`font-semibold ${preConditionsMet ? 'text-green-900' : 'text-yellow-900'}`}>
                            Requirements before advancing to Final Week
                        </h4>
                    </div>

                    <div className="space-y-4">
                        {/* Resignation Letter Upload */}
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${offboarding?.resignationLetterAttached ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}>
                                {offboarding?.resignationLetterAttached && <span className="material-symbols-outlined text-white text-xs">check</span>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Acceptance of resignation letter</p>
                                <p className="text-xs text-gray-500 mb-2">Upload a softcopy of the signed resignation acceptance letter (PDF, DOC, JPG, PNG — max 10 MB).</p>

                                {offboarding?.resignationLetterAttached && offboarding.resignationLetterFileName ? (
                                    <div className="flex items-center gap-3 p-2.5 bg-white border border-green-200 rounded-lg">
                                        <span className="material-symbols-outlined text-green-600 text-lg">description</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{offboarding.resignationLetterFileName}</p>
                                            <p className="text-xs text-green-700">Uploaded</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <a
                                                href={`http://localhost:3000${offboarding.resignationLetterUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-semibold text-blue-600 hover:underline"
                                            >
                                                View
                                            </a>
                                            <button
                                                onClick={handleDeleteResignationLetter}
                                                disabled={deletingLetter}
                                                className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                                            >
                                                {deletingLetter ? 'Removing...' : 'Remove'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingLetter ? 'border-gray-300 opacity-60' : 'border-amber-300 hover:border-amber-500 hover:bg-amber-50'}`}>
                                        <span className="material-symbols-outlined text-amber-600 text-lg">upload_file</span>
                                        <span className="text-sm font-medium text-amber-700">
                                            {uploadingLetter ? 'Uploading...' : 'Click to upload resignation letter'}
                                        </span>
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            className="hidden"
                                            disabled={uploadingLetter}
                                            onChange={handleUploadResignationLetter}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* Exit Interview Date */}
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${offboarding?.exitInterviewScheduledDate ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}>
                                {offboarding?.exitInterviewScheduledDate && <span className="material-symbols-outlined text-white text-xs">check</span>}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Exit interview scheduled</p>
                                {offboarding?.exitInterviewScheduledDate && (
                                    <p className="text-xs text-green-700 mb-1">Scheduled: {new Date(offboarding.exitInterviewScheduledDate.includes('T') ? offboarding.exitInterviewScheduledDate : offboarding.exitInterviewScheduledDate + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC' })}</p>
                                )}
                                <p className="text-xs text-gray-500 mb-2">Set the date for the exit interview session.</p>
                                <div className="relative inline-flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-500">
                                    <span className="px-3 py-1.5 text-sm text-gray-700 bg-white pointer-events-none select-none min-w-[110px]">
                                        {preConditionForm.exitInterviewScheduledDate
                                            ? (() => { const [y,m,d] = preConditionForm.exitInterviewScheduledDate.split('-'); return `${d}/${m}/${y}`; })()
                                            : 'DD/MM/YYYY'}
                                    </span>
                                    <span className="px-2 py-1.5 bg-gray-50 border-l border-gray-300 text-gray-500 material-symbols-outlined text-base">calendar_month</span>
                                    <input
                                        type="date"
                                        value={preConditionForm.exitInterviewScheduledDate}
                                        onChange={e => setPreConditionForm(p => ({ ...p, exitInterviewScheduledDate: e.target.value }))}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSavePreConditions}
                        disabled={savingPreConditions || !/^\d{4}-\d{2}-\d{2}$/.test(preConditionForm.exitInterviewScheduledDate)}
                        className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {savingPreConditions
                            ? <><span className="material-symbols-outlined animate-spin text-sm">autorenew</span> Saving...</>
                            : <><span className="material-symbols-outlined text-sm">save</span> Save Interview Date</>
                        }
                    </button>
                </div>
            )}

            {/* Blocked advancement notice */}
            {!isCompleted && isAdvancingToFinalWeek && isAdminOrHRAgent && !preConditionsMet && (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-gray-400 text-3xl">lock</span>
                    <div>
                        <p className="font-semibold text-gray-700">Advance to Final Week is locked</p>
                        <p className="text-sm text-gray-500">Complete the requirements above to unlock this action.</p>
                    </div>
                </div>
            )}

            {/* Phase Advancement */}
            {!isCompleted && canAdvancePhase && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <span className="material-symbols-outlined text-amber-600 text-3xl">arrow_forward</span>
                        <div>
                            <p className="font-semibold text-amber-900">
                                Current phase: <span className="font-bold">{currentPhaseEntry?.label ?? offboarding?.currentPhase}</span>
                            </p>
                            <p className="text-sm text-amber-700">Advance to: <span className="font-semibold">{nextPhaseLabel}</span></p>
                        </div>
                    </div>
                    <button
                        onClick={handleAdvancePhase}
                        disabled={advancingPhase}
                        className="ml-4 px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                        {advancingPhase ? (
                            <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">skip_next</span>
                        )}
                        <span>{advancingPhase ? 'Advancing...' : `Move to ${nextPhaseLabel}`}</span>
                    </button>
                </div>
            )}

            {/* Completion State */}
            {isCompleted ? (
                <div className="bg-green-50 border border-green-300 rounded-lg p-5 flex items-center space-x-4">
                    <span className="material-symbols-outlined text-green-600 text-3xl">task_alt</span>
                    <div>
                        <p className="font-semibold text-green-800">Offboarding Completed</p>
                        <p className="text-sm text-green-700">This employee has been fully offboarded. All tasks are done.</p>
                    </div>
                </div>
            ) : canComplete ? (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <span className="material-symbols-outlined text-amber-600 text-3xl">verified</span>
                        <div>
                            <p className="font-semibold text-amber-900">All tasks complete — ready to close</p>
                            <p className="text-sm text-amber-700">Mark this offboarding as completed to close the ticket.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleCompleteOffboarding}
                        disabled={completing}
                        className="ml-4 px-5 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                        {completing ? (
                            <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                        )}
                        <span>{completing ? 'Completing...' : 'Complete Offboarding'}</span>
                    </button>
                </div>
            ) : null}

            {/* Task Checklist */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                {!user?.roles?.includes('ADMIN') && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">info</span>
                        <span>
                            {user?.roles?.includes('AGENT')
                                ? (user as any)?.agentTeam
                                    ? `You can only update ${(user as any).agentTeam === 'IT' ? 'IT' : 'HR/Admin'} tasks`
                                    : 'You have no team assignment'
                                : 'Only admins and assigned agents can update tasks'
                            }
                        </span>
                    </div>
                )}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Task Checklist</h3>
                    <div className="flex space-x-2">
                        {['ALL', 'IT', 'HR', 'ADMIN'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${selectedCategory === cat
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    {filteredTasks.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No tasks found.</p>
                    ) : (
                        filteredTasks.map(task => {
                            const canEdit = canEditTask(task);
                            return (
                                <div
                                    key={task.id}
                                    className={`border rounded-lg p-4 transition-all ${task.status === 'COMPLETED'
                                        ? 'bg-green-50 border-green-200'
                                        : canEdit
                                            ? 'bg-white border-gray-200 hover:border-amber-300 cursor-pointer'
                                            : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                                        } ${updatingTaskId === task.id ? 'opacity-60' : ''}`}
                                    onClick={() => canEdit && handleTaskToggle(task)}
                                    title={!canEdit ? 'You do not have permission to edit this task' : ''}
                                >
                                    <div className="flex items-start space-x-3">
                                        {getTaskIcon(task.status, task.id)}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className={`font-medium ${task.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                                    {task.taskName}
                                                </h4>
                                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-medium ${getCategoryColor(task.taskCategory)}`}>
                                                    {task.taskCategory}
                                                </span>
                                            </div>
                                            {task.taskDescription && (
                                                <p className="text-sm text-gray-500 mt-1">{task.taskDescription}</p>
                                            )}
                                            {task.dueDate && (
                                                <p className="text-xs text-gray-400 mt-1">Due: {formatDate(task.dueDate)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default OffboardingDashboard;
