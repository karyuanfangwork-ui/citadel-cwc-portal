import React, { useEffect, useState } from 'react';
import { OnboardingRequest, OnboardingTask, OnboardingProgress, RequestPriority } from '../../types';
import apiClient from '../services/api';

interface OnboardingDashboardProps {
    requestId: string;
}

const OnboardingDashboard: React.FC<OnboardingDashboardProps> = ({ requestId }) => {
    const [onboarding, setOnboarding] = useState<OnboardingRequest | null>(null);
    const [progress, setProgress] = useState<OnboardingProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    useEffect(() => {
        fetchOnboardingData();
    }, [requestId]);

    const fetchOnboardingData = async () => {
        try {
            setLoading(true);
            const onboardingRes = await apiClient.get(`/requests/${requestId}/onboarding`);
            console.log('📦 Onboarding API Response:', onboardingRes.data);
            setOnboarding(onboardingRes.data);
            setError(null);

            // Progress is optional — don't let it block the main view
            try {
                const progressRes = await apiClient.get(`/requests/${requestId}/onboarding/progress`);
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

    const getTaskIcon = (status: string) => {
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
            return date.toLocaleDateString();
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
                        <div className="bg-white rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{progress.completedMilestones || 0}/{progress.totalMilestones || 0}</p>
                            <p className="text-sm text-gray-600">Milestones</p>
                        </div>
                    </div>

                    {/* Milestones */}
                    <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <span className="material-symbols-outlined text-base mr-2">military_tech</span>
                            Milestones
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'day1', label: 'Day 1' },
                                { key: 'week1', label: 'Week 1' },
                                { key: 'day30', label: '30 Days' },
                                { key: 'day60', label: '60 Days' },
                                { key: 'day90', label: '90 Days' }
                            ].map(milestone => (
                                <div
                                    key={milestone.key}
                                    className={`px-3 py-1 rounded-full text-sm font-medium ${progress.milestones?.[milestone.key as keyof typeof progress.milestones]
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                        }`}
                                >
                                    {progress.milestones?.[milestone.key as keyof typeof progress.milestones] && '✓ '}
                                    {milestone.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Task Checklist */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
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
                        filteredTasks.map(task => (
                            <div
                                key={task.id}
                                className={`border rounded-lg p-4 transition-all ${task.status === 'COMPLETED'
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-white border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                <div className="flex items-start space-x-3">
                                    {getTaskIcon(task.status)}
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
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingDashboard;
