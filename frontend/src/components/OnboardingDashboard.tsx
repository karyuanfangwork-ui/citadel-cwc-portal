import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingRequest, OnboardingTask, OnboardingProgress, RequestPriority, RequestItem } from '../../types';
import apiClient from '../services/api';
import { useAuth } from '../context/AuthContext';

interface OnboardingDashboardProps {
    requestId: string;
}

const OnboardingDashboard: React.FC<OnboardingDashboardProps> = ({ requestId }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [onboarding, setOnboarding] = useState<OnboardingRequest | null>(null);
    const [request, setRequest] = useState<RequestItem | null>(null);
    const [progress, setProgress] = useState<OnboardingProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);
    const [advancingPhase, setAdvancingPhase] = useState(false);

    useEffect(() => {
        fetchOnboardingData();
    }, [requestId]);

    const fetchOnboardingData = async () => {
        try {
            setLoading(true);
            const onboardingRes = await apiClient.get(`/onboarding/requests/${requestId}/onboarding`);
            console.log('📦 Onboarding API Response:', onboardingRes.data);
            setOnboarding(onboardingRes.data);

            // Fetch request details to get parentRequest link
            const requestRes = await apiClient.get(`/requests/${requestId}`);
            setRequest(requestRes.data);

            setError(null);

            // Progress is optional — don't let it block the main view
            try {
                const progressRes = await apiClient.get(`/onboarding/requests/${requestId}/onboarding/progress`);
                console.log('📊 Progress API Response:', progressRes.data);
                setProgress(progressRes.data);
            } catch (progressErr) {
                console.warn('Could not load onboarding progress:', progressErr);
            }
        } catch (err: any) {
            console.error('Error fetching onboarding data:', err);
            setError(err.message || 'Failed to load onboarding data');
        } finally {
            setLoading(false);
        }
    };

    const canEditTask = (task: OnboardingTask): boolean => {
        // Only ADMIN can edit any task
        if (user?.roles?.includes('ADMIN')) return true;

        // Only AGENT can edit tasks in their category
        if (!user?.roles?.includes('AGENT')) return false;

        // Check if agent's team (from user.agentTeam) matches task category
        const userAgentTeam = (user as any)?.agentTeam?.toUpperCase() || '';
        const taskCategory = task.taskCategory?.toUpperCase() || '';

        if (userAgentTeam === 'IT' && taskCategory === 'IT') return true;
        if (userAgentTeam === 'HR' && (taskCategory === 'HR' || taskCategory === 'ADMIN' || taskCategory === 'TRAINING')) return true;

        return false;
    };

    const handleTaskToggle = async (task: OnboardingTask) => {
        if (updatingTaskId || !canEditTask(task)) {
            console.warn('Cannot edit task:', { updatingTaskId, canEdit: canEditTask(task), userAgentTeam: (user as any)?.agentTeam, taskCategory: task.taskCategory });
            return;
        }
        const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        setUpdatingTaskId(task.id);
        try {
            const res = await apiClient.put(
                `/onboarding/requests/${requestId}/onboarding/tasks/${task.id}`,
                { status: newStatus }
            );
            console.log('Task updated successfully:', res.data);
            setOnboarding(prev => prev ? {
                ...prev,
                tasks: prev.tasks?.map(t => t.id === task.id ? res.data : t)
            } : prev);
            // Refresh progress
            try {
                const progressRes = await apiClient.get(`/onboarding/requests/${requestId}/onboarding/progress`);
                setProgress(progressRes.data);
            } catch { /* non-fatal */ }
        } catch (err: any) {
            console.error('Failed to update task:', err.response?.data || err.message);
            alert(`Error: ${err.response?.data?.message || err.message || 'Failed to update task'}`);
        } finally {
            setUpdatingTaskId(null);
        }
    };

    const handleCompleteOnboarding = async () => {
        if (completing) return;
        // Frontend pre-check
        const pending = progress?.tasks?.pending ?? 0;
        const total = progress?.tasks?.total ?? 0;
        if (total > 0 && pending > 0) {
            alert(`Cannot complete onboarding: ${pending} task${pending > 1 ? 's are' : ' is'} still incomplete. Please complete all tasks first.`);
            return;
        }
        if (!window.confirm('Are you sure you want to mark this onboarding as COMPLETED and close the ticket? This action cannot be undone.')) {
            return;
        }
        setCompleting(true);
        try {
            await apiClient.put(`/onboarding/requests/${requestId}/onboarding/update-status`, {
                overallStatus: 'COMPLETED',
                completedBy: user?.id,
            });
            setOnboarding(prev => prev ? { ...prev, overallStatus: 'COMPLETED' } : prev);
        } catch (err: any) {
            const msg = err.response?.data?.message || err.message || 'Failed to complete onboarding';
            alert(msg);
            console.error('Failed to complete onboarding:', err);
        } finally {
            setCompleting(false);
        }
    };

    const isAdminOrHRAgent = user?.roles?.includes('ADMIN') ||
        (user?.roles?.includes('AGENT') && (user as any)?.agentTeam?.toUpperCase() === 'HR');
    const allTasksDone = (progress?.tasks?.total ?? 0) > 0 && progress?.tasks?.pending === 0;
    const isCompleted = onboarding?.overallStatus === 'COMPLETED';
    const canComplete = (isAdminOrHRAgent ?? false) && allTasksDone && !isCompleted;

    // Phase advancement config
    const PHASE_SEQUENCE = [
        { phase: 'PRE_ARRIVAL',  label: 'Pre-Arrival Setup',  next: 'DAY_1_READY' },
        { phase: 'DAY_1_READY',  label: 'Day 1 Ready',        next: 'DAY_1' },
        { phase: 'DAY_1',        label: 'Day 1 Orientation',  next: 'WEEK_1' },
        { phase: 'WEEK_1',       label: 'Week 1',             next: null },
    ];
    const currentPhaseEntry = PHASE_SEQUENCE.find(p => p.phase === onboarding?.currentPhase);
    const nextPhase = currentPhaseEntry?.next ?? null;
    const nextPhaseLabel = nextPhase ? PHASE_SEQUENCE.find(p => p.phase === nextPhase)?.label : null;
    const canAdvancePhase = isAdminOrHRAgent && !isCompleted && !!nextPhase;

    const handleAdvancePhase = async () => {
        if (!nextPhase || advancingPhase) return;
        setAdvancingPhase(true);
        try {
            await apiClient.put(`/onboarding/requests/${requestId}/onboarding/update-status`, {
                currentPhase: nextPhase,
            });
            await fetchOnboardingData();
        } catch (err: any) {
            console.error('Failed to advance phase:', err);
            alert(`Error: ${err.response?.data?.message || err.message || 'Failed to advance phase'}`);
        } finally {
            setAdvancingPhase(false);
        }
    };

    const getTaskIcon = (status: string, taskId?: string) => {
        if (updatingTaskId === taskId) {
            return <span className="material-symbols-outlined text-gray-400 animate-spin">autorenew</span>;
        }
        switch (status) {
            case 'COMPLETED':
                return <span className="material-symbols-outlined text-green-600">check_circle</span>;
            case 'IN_PROGRESS':
                return <span className="material-symbols-outlined text-blue-600">schedule</span>;
            case 'BLOCKED':
                return <span className="material-symbols-outlined text-red-600">error</span>;
            default:
                return <span className="material-symbols-outlined text-gray-400">radio_button_unchecked</span>;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'IT':
                return 'bg-blue-100 text-blue-700';
            case 'HR':
                return 'bg-purple-100 text-purple-700';
            case 'TRAINING':
                return 'bg-orange-100 text-orange-700';
            case 'ADMIN':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    const getPriorityColor = (priority: RequestPriority) => {
        switch (priority) {
            case 'CRITICAL':
                return 'text-red-600';
            case 'HIGH':
                return 'text-orange-600';
            case 'MEDIUM':
                return 'text-yellow-600';
            case 'LOW':
                return 'text-gray-600';
            default:
                return 'text-gray-600';
        }
    };

    const filteredTasks = onboarding?.tasks?.filter(task =>
        selectedCategory === 'ALL' || task.taskCategory === selectedCategory
    ) || [];

    const formatDate = (dateString: string | undefined | null) => {
        if (!dateString) return 'Not set';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid Date';
            return date.toLocaleDateString('en-GB');
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const formatName = (first: string | null | undefined, last: string | null | undefined) => {
        if (!first && !last) return 'Not set';
        return `${first || ''} ${last || ''}`.trim();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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

    if (!onboarding) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p className="text-gray-600">No onboarding workflow found for this request.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Parent Request Link Banner */}
            {request?.parentRequest && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                    <span className="material-symbols-outlined text-base">info</span>
                    <span>Originated from hiring request</span>
                    <button
                        onClick={() => navigate(`/#/requests/${request.parentRequest.id}`)}
                        className="font-semibold underline hover:text-blue-900 ml-auto"
                    >
                        {request.parentRequest.referenceNumber}
                    </button>
                </div>
            )}

            {/* New Hire Info Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">New Hire Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">person</span>
                        <div>
                            <p className="text-sm text-gray-500">Name</p>
                            <p className="font-medium text-gray-900">
                                {formatName(onboarding.newHireFirstName, onboarding.newHireLastName)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">mail</span>
                        <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium text-gray-900">{onboarding.newHireEmail || 'Not set'}</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">work</span>
                        <div>
                            <p className="text-sm text-gray-500">Position</p>
                            <p className="font-medium text-gray-900">{onboarding.jobTitle || 'Not set'}</p>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">calendar_today</span>
                        <div>
                            <p className="text-sm text-gray-500">Start Date</p>
                            <p className="font-medium text-gray-900">
                                {formatDate(onboarding.startDate)}
                            </p>
                        </div>
                    </div>
                    {onboarding.newHirePhone && (
                        <div className="flex items-start space-x-3">
                            <span className="material-symbols-outlined text-gray-400 text-xl">phone</span>
                            <div>
                                <p className="text-sm text-gray-500">Phone</p>
                                <p className="font-medium text-gray-900">{onboarding.newHirePhone}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-start space-x-3">
                        <span className="material-symbols-outlined text-gray-400 text-xl">corporate_fare</span>
                        <div>
                            <p className="text-sm text-gray-500">Department</p>
                            <p className="font-medium text-gray-900">{onboarding.department || 'Not set'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Overview */}
            {progress && progress.tasks && progress.milestones && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Onboarding Progress</h3>
                        <span className="text-2xl font-bold text-blue-600">{progress.completionPercentage || 0}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progress.completionPercentage || 0}%` }}
                        ></div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

            {/* Phase Advancement Banner */}
            {!isCompleted && canAdvancePhase && (
                <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <span className="material-symbols-outlined text-indigo-600 text-3xl">arrow_forward</span>
                        <div>
                            <p className="font-semibold text-indigo-900">
                                Current phase: <span className="font-bold">{currentPhaseEntry?.label ?? onboarding?.currentPhase}</span>
                            </p>
                            <p className="text-sm text-indigo-700">Advance to next phase: <span className="font-semibold">{nextPhaseLabel}</span></p>
                        </div>
                    </div>
                    <button
                        onClick={handleAdvancePhase}
                        disabled={advancingPhase}
                        className="ml-4 px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
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

            {/* Completion Banner */}
            {isCompleted ? (
                <div className="bg-green-50 border border-green-300 rounded-lg p-5 flex items-center space-x-4">
                    <span className="material-symbols-outlined text-green-600 text-3xl">task_alt</span>
                    <div>
                        <p className="font-semibold text-green-800">Onboarding Completed</p>
                        <p className="text-sm text-green-700">This new hire request has been closed. All tasks are done.</p>
                    </div>
                </div>
            ) : canComplete ? (
                <div className="bg-blue-50 border border-blue-300 rounded-lg p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <span className="material-symbols-outlined text-blue-600 text-3xl">verified</span>
                        <div>
                            <p className="font-semibold text-blue-900">All tasks complete — ready to close</p>
                            <p className="text-sm text-blue-700">Mark this onboarding as completed to close the new hire request.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleCompleteOnboarding}
                        disabled={completing}
                        className="ml-4 px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
                    >
                        {completing ? (
                            <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                        )}
                        <span>{completing ? 'Completing...' : 'Complete Onboarding'}</span>
                    </button>
                </div>
            ) : null}

            {/* Task Checklist */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                {/* Role-Based Access Notice */}
                {!user?.roles?.includes('ADMIN') && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">info</span>
                        <span>
                            {user?.roles?.includes('AGENT')
                                ? (user as any)?.agentTeam
                                    ? `You can only update ${(user as any).agentTeam === 'IT' ? 'IT' : 'HR/Training/Admin'} tasks`
                                    : 'You have no team assignment'
                                : 'Only admins and assigned agents can update tasks'
                            }
                        </span>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Task Checklist</h3>

                    {/* Category Filter */}
                    <div className="flex space-x-2">
                        {['ALL', 'IT', 'HR', 'TRAINING', 'ADMIN'].map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${selectedCategory === category
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tasks List */}
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
                                    : canEdit ? 'bg-white border-gray-200 hover:border-blue-300 cursor-pointer' : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                                    } ${updatingTaskId === task.id ? 'opacity-60' : ''}`}
                                onClick={() => canEdit && handleTaskToggle(task)}
                                title={!canEdit ? 'You do not have permission to edit this task' : ''}
                            >
                                <div className="flex items-start space-x-3">
                                    {getTaskIcon(task.status, task.id)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className={`font-medium ${task.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-gray-900'
                                                }`}>
                                                {task.taskName}
                                            </h4>
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(task.taskCategory)}`}>
                                                    {task.taskCategory}
                                                </span>
                                                <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                        </div>
                                        {task.taskDescription && (
                                            <p className="text-sm text-gray-600 mb-2">{task.taskDescription}</p>
                                        )}
                                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                                            {task.assignedToUser && (
                                                <span>Assigned: {task.assignedToUser.firstName} {task.assignedToUser.lastName}</span>
                                            )}
                                            {task.dueDate && (
                                                <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                            )}
                                            {task.completedAt && (
                                                <span className="text-green-600">
                                                    ✓ Completed {new Date(task.completedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {!canEdit && (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">lock</span>
                                        <span>Only {task.taskCategory === 'IT' ? 'IT agents' : 'HR agents'} can update this task</span>
                                    </div>
                                )}
                            </div>
                        );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingDashboard;
