// frontend/src/components/request-detail/ApproverPicker.tsx
// Dropdown that lets the routing agent / executive choose which approver to
// route a request to, instead of accepting the backend's auto-route.
//
// Used in:
//  - AcknowledgeModal (IT agent → CEO)
//  - CEODecisionModal   (CEO → CTO, on APPROVE)
//
// Backend endpoint: GET /api/v1/users/executives?role=CEO|CTO|CFO|...
// On modal open we fetch the list; user can pick one (manual) or leave the
// "Auto-route" sentinel empty (backend falls back to its findFirst logic).

import React, { useEffect, useState } from 'react';
import api from '../../services/api';

export type ExecutiveRole = 'GROUP_DCEO' | 'CEO' | 'CTO' | 'CFO' | 'CMO' | 'COO' | 'CHRO';

export interface ApproverOption {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle?: string | null;
    executiveRole: ExecutiveRole;
    entity?: { id: string; code: string; name: string } | null;
}

interface ApproverPickerProps {
    /** Executive role to list (e.g. "CEO" for routing to CEO). */
    role: ExecutiveRole;
    /** Currently selected approver id ('' = auto-route). */
    value: string;
    /** Called with the new approver id ('' when the user reverts to auto). */
    onChange: (approverId: string) => void;
    /** Label shown above the dropdown. */
    label?: string;
    /** Helper text shown below the dropdown when a specific person is selected. */
    hint?: string;
    /** Show "(optional)" suffix in the label. Defaults to true. */
    showOptional?: boolean;
    /** Disable the picker (e.g. when an auto-fetched default is locked). */
    disabled?: boolean;
}

/** Sentinel value used in the dropdown's "Auto-route" option. */
export const APPROVER_AUTO = '';

const ApproverPicker: React.FC<ApproverPickerProps> = ({
    role,
    value,
    onChange,
    label = 'Route to',
    hint,
    showOptional = true,
    disabled = false,
}) => {
    const [options, setOptions] = useState<ApproverOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        api
            .get('/users/executives', { params: { role } })
            .then((res) => {
                if (cancelled) return;
                const list: ApproverOption[] = res.data?.data?.executives ?? [];
                setOptions(list);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(
                    err?.response?.data?.error ||
                        `Unable to load ${role} users. The default auto-route will be used.`,
                );
                setOptions([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [role]);

    const selected = options.find((o) => o.id === value);

    return (
        <div>
            <label
                htmlFor={`approver-picker-${role}`}
                className="block text-xs font-bold text-text-secondary uppercase tracking-wide mb-1.5"
            >
                {label}
                {showOptional && (
                    <span className="font-normal normal-case text-text-tertiary ml-1">
                        (optional — auto-route by default)
                    </span>
                )}
            </label>

            <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none text-lg">
                    person
                </span>
                <select
                    id={`approver-picker-${role}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled || loading}
                    className="w-full pl-9 pr-8 py-2.5 text-sm border border-cwc-border rounded-cwc-md bg-white text-text-primary focus:outline-none focus:ring-2 focus:ring-[#0052cc]/30 focus:border-[#0052cc] transition-colors appearance-none disabled:opacity-60"
                >
                    <option value={APPROVER_AUTO}>
                        {loading
                            ? `Loading ${role}s…`
                            : `Auto-route to first active ${role} (default)`}
                    </option>
                    {options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                            {opt.firstName} {opt.lastName}
                            {opt.jobTitle ? ` — ${opt.jobTitle}` : ''}
                            {opt.entity?.name ? ` · ${opt.entity.name}` : ''}
                        </option>
                    ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none text-lg">
                    expand_more
                </span>
            </div>

            {/* Status row */}
            <div className="mt-1.5 min-h-[1.25rem] text-xs">
                {error ? (
                    <span className="text-amber-700">{error}</span>
                ) : !loading && options.length === 0 ? (
                    <span className="text-amber-700">
                        No active {role} user found. The request will use the default
                        auto-route (and may fail if no {role} exists).
                    </span>
                ) : selected ? (
                    <span className="text-text-tertiary">
                        {hint ??
                            `Will route to ${selected.firstName} ${selected.lastName} (${selected.email})`}
                    </span>
                ) : value === APPROVER_AUTO ? (
                    <span className="text-text-tertiary">
                        Will use the system default (first active {role} user).
                    </span>
                ) : null}
            </div>
        </div>
    );
};

export default ApproverPicker;
