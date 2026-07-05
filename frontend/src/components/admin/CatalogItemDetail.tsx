/**
 * P5-03: Catalog Item Detail — shows governance info for a request type.
 *
 * Displays: lifecycle status, owner, review date, entitlement rules.
 * Allows lifecycle transitions (DRAFT → PUBLISHED → DEPRECATED → RETIRED).
 */

import React, { useState, useEffect, useCallback } from 'react';

interface RequestTypeDetail {
    id: string;
    name: string;
    description?: string;
    lifecycleStatus: string;
    ownerId?: string | null;
    reviewDate?: string | null;
    owner?: { id: string; firstName: string; lastName: string; email: string } | null;
    serviceCategory?: { id: string; name: string };
    requiresApproval: boolean;
    slaHours?: number | null;
    isActive: boolean;
}

interface Entitlement {
    id: string;
    requestTypeId: string;
    targetType: string;
    targetId?: string | null;
    isActive: boolean;
    createdAt: string;
}

interface CatalogItemDetailProps {
    isOpen: boolean;
    requestType: RequestTypeDetail | null;
    onClose: () => void;
    onRefresh: () => void;
}

const LIFECYCLE_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    DEPRECATED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    RETIRED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['PUBLISHED'],
    PUBLISHED: ['DEPRECATED', 'RETIRED'],
    DEPRECATED: ['RETIRED', 'PUBLISHED'],
    RETIRED: [],
};

const TARGET_TYPE_LABELS: Record<string, string> = {
    ROLE: 'Role',
    DEPARTMENT: 'Department',
    ENTITY: 'Entity',
    ALL: 'All Users',
};

export const CatalogItemDetail: React.FC<CatalogItemDetailProps> = ({
    isOpen,
    requestType,
    onClose,
    onRefresh,
}) => {
    const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
    const [loadingEntitlements, setLoadingEntitlements] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEntitlements = useCallback(async () => {
        if (!requestType) return;
        setLoadingEntitlements(true);
        try {
            const token = localStorage.getItem('token') || document.cookie.split('access_token=')[1]?.split(';')[0] || '';
            const res = await fetch(`/api/v1/admin/catalog-entitlements?requestTypeId=${requestType.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setEntitlements(data.data?.entitlements || []);
            }
        } catch {
            // Silently fail — entitlements are supplementary info
        } finally {
            setLoadingEntitlements(false);
        }
    }, [requestType]);

    useEffect(() => {
        if (isOpen && requestType) {
            fetchEntitlements();
        }
    }, [isOpen, requestType, fetchEntitlements]);

    const handleLifecycleTransition = async (newStatus: string) => {
        if (!requestType) return;
        setTransitioning(true);
        setError(null);
        try {
            const token = localStorage.getItem('token') || document.cookie.split('access_token=')[1]?.split(';')[0] || '';
            const res = await fetch(`/api/v1/service-desks/request-types/${requestType.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ lifecycleStatus: newStatus }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update lifecycle status');
            }
            onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to update lifecycle status');
        } finally {
            setTransitioning(false);
        }
    };

    const handleDeleteEntitlement = async (entitlementId: string) => {
        try {
            const token = localStorage.getItem('token') || document.cookie.split('access_token=')[1]?.split(';')[0] || '';
            const res = await fetch(`/api/v1/admin/catalog-entitlements/${entitlementId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setEntitlements(prev => prev.filter(e => e.id !== entitlementId));
            }
        } catch {
            // Silently fail
        }
    };

    if (!isOpen || !requestType) return null;

    const statusBadge = LIFECYCLE_COLORS[requestType.lifecycleStatus] || LIFECYCLE_COLORS.DRAFT;
    const availableTransitions = LIFECYCLE_TRANSITIONS[requestType.lifecycleStatus] || [];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Catalog Item Detail">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-[#101418] dark:text-gray-100">{requestType.name}</h2>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${statusBadge}`}>
                                {requestType.lifecycleStatus}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    </div>
                    {requestType.serviceCategory && (
                        <p className="text-sm text-[#8993a4] mt-1">
                            Category: {requestType.serviceCategory.name}
                        </p>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {/* Governance Section */}
                    <section>
                        <h3 className="text-sm font-bold text-[#44546f] dark:text-gray-400 uppercase tracking-wide mb-3">
                            Governance
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-[#8993a4] dark:text-gray-500">Owner</label>
                                <p className="text-sm font-medium text-[#101418] dark:text-gray-200">
                                    {requestType.owner
                                        ? `${requestType.owner.firstName} ${requestType.owner.lastName}`
                                        : 'Unassigned'}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-[#8993a4] dark:text-gray-500">Review Date</label>
                                <p className="text-sm font-medium text-[#101418] dark:text-gray-200">
                                    {requestType.reviewDate
                                        ? new Date(requestType.reviewDate).toLocaleDateString()
                                        : 'Not set'}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-[#8993a4] dark:text-gray-500">Approval Required</label>
                                <p className="text-sm font-medium text-[#101418] dark:text-gray-200">
                                    {requestType.requiresApproval ? 'Yes' : 'No'}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs text-[#8993a4] dark:text-gray-500">SLA Hours</label>
                                <p className="text-sm font-medium text-[#101418] dark:text-gray-200">
                                    {requestType.slaHours ?? 'None'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Lifecycle Transitions */}
                    {availableTransitions.length > 0 && (
                        <section>
                            <h3 className="text-sm font-bold text-[#44546f] dark:text-gray-400 uppercase tracking-wide mb-3">
                                Lifecycle Transitions
                            </h3>
                            <div className="flex gap-2 flex-wrap">
                                {availableTransitions.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => handleLifecycleTransition(status)}
                                        disabled={transitioning}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                                            status === 'PUBLISHED'
                                                ? 'bg-green-600 text-white hover:bg-green-700'
                                                : status === 'DEPRECATED'
                                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                : 'bg-red-600 text-white hover:bg-red-700'
                                        }`}
                                    >
                                        Move to {status}
                                    </button>
                                ))}
                            </div>
                            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                        </section>
                    )}

                    {/* Entitlements Section */}
                    <section>
                        <h3 className="text-sm font-bold text-[#44546f] dark:text-gray-400 uppercase tracking-wide mb-3">
                            Audience Rules
                        </h3>
                        {entitlements.length === 0 && !loadingEntitlements && (
                            <div className="text-sm text-[#8993a4] dark:text-gray-500 italic">
                                No entitlement rules — this item is visible to all users.
                            </div>
                        )}
                        {loadingEntitlements && (
                            <div className="text-sm text-[#8993a4]">Loading entitlements…</div>
                        )}
                        {entitlements.length > 0 && (
                            <div className="space-y-2">
                                {entitlements.map(ent => (
                                    <div
                                        key={ent.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                                ent.targetType === 'ALL'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                                    : ent.targetType === 'ROLE'
                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                                                    : ent.targetType === 'DEPARTMENT'
                                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                                    : 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                                            }`}>
                                                {TARGET_TYPE_LABELS[ent.targetType] || ent.targetType}
                                            </span>
                                            {ent.targetId && (
                                                <span className="text-sm text-[#101418] dark:text-gray-200">{ent.targetId}</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteEntitlement(ent.id)}
                                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                                            title="Remove entitlement"
                                        >
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Description */}
                    {requestType.description && (
                        <section>
                            <h3 className="text-sm font-bold text-[#44546f] dark:text-gray-400 uppercase tracking-wide mb-3">
                                Description
                            </h3>
                            <p className="text-sm text-[#101418] dark:text-gray-200 whitespace-pre-wrap">
                                {requestType.description}
                            </p>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};