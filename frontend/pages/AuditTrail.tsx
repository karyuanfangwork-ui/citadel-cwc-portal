import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { auditLogService, AuditLogEntry, AuditLogParams } from '../src/services/auditLog.service';
import Breadcrumbs from '../src/components/Breadcrumbs';

const ACTION_OPTIONS = [
    { value: '', label: 'All Actions' },
    { value: 'REQUEST_CREATED', label: 'Request Created' },
    { value: 'STATUS_CHANGED', label: 'Status Changed' },
    { value: 'REQUEST_ASSIGNED', label: 'Assigned' },
    { value: 'APPROVAL_DECISION', label: 'Approval Decision' },
    { value: 'CONFIDENTIAL_VIEW', label: 'Confidential View' },
    { value: 'CONFIDENTIAL_RESUME_ACCESS', label: 'Resume Access' },
    { value: 'CONFIDENTIAL_ATTACHMENT_DOWNLOAD', label: 'Download Attachment' },
];

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    REQUEST_CREATED: { label: 'Created', color: 'bg-green-50 text-green-700' },
    STATUS_CHANGED: { label: 'Status Changed', color: 'bg-blue-50 text-blue-700' },
    REQUEST_ASSIGNED: { label: 'Assigned', color: 'bg-purple-50 text-purple-700' },
    APPROVAL_DECISION: { label: 'Approval', color: 'bg-teal-50 text-teal-700' },
    CONFIDENTIAL_VIEW: { label: 'Confidential View', color: 'bg-sky-50 text-sky-700' },
    CONFIDENTIAL_RESUME_ACCESS: { label: 'Resume Access', color: 'bg-amber-50 text-amber-700' },
    CONFIDENTIAL_ATTACHMENT_DOWNLOAD: { label: 'Download', color: 'bg-red-50 text-red-700' },
};

const RESOURCE_TYPE_OPTIONS = [
    { value: '', label: 'All Resources' },
    { value: 'request', label: 'Request' },
    { value: 'user', label: 'User' },
    { value: 'asset', label: 'Asset' },
    { value: 'approval', label: 'Approval' },
];

function getResourceLink(resourceType: string, resourceId: string): string | null {
    switch (resourceType.toUpperCase()) {
        case 'REQUEST':
            return `/request/${resourceId}`;
        case 'USER':
            return `/admin/settings?tab=users`;
        case 'ASSET':
            return `/assets`;
        case 'APPROVAL':
            return `/approvals`;
        default:
            return null;
    }
}

const AuditTrail: React.FC = () => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Filters
    const [filterAction, setFilterAction] = useState('');
    const [filterResourceType, setFilterResourceType] = useState('');
    const [filterResourceId, setFilterResourceId] = useState('');
    const [filterUserSearch, setFilterUserSearch] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const limit = 20;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: AuditLogParams = { page, limit };
            if (filterAction) params.action = filterAction;
            if (filterResourceType) params.resourceType = filterResourceType;
            if (filterResourceId) params.resourceId = filterResourceId;
            if (filterUserSearch) params.userId = filterUserSearch;
            if (filterStartDate) params.startDate = filterStartDate;
            if (filterEndDate) params.endDate = filterEndDate;
            const res = await auditLogService.getLogs(params);
            setLogs(res.data.logs);
            setTotalPages(res.data.pagination.totalPages);
            setTotal(res.data.pagination.total);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [page, filterAction, filterResourceType, filterResourceId, filterUserSearch, filterStartDate, filterEndDate]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleResetFilters = () => {
        setFilterAction('');
        setFilterResourceType('');
        setFilterResourceId('');
        setFilterUserSearch('');
        setFilterStartDate('');
        setFilterEndDate('');
        setPage(1);
    };

    const formatDate = (d: string) => new Date(d).toLocaleString();

    const hasActiveFilters = filterAction || filterResourceType || filterResourceId || filterUserSearch || filterStartDate || filterEndDate;

    const formatChangeValue = (value: unknown): string => {
        if (typeof value === 'string') {
            try {
                return JSON.stringify(JSON.parse(value), null, 2);
            } catch {
                return value;
            }
        }
        return JSON.stringify(value, null, 2);
    };

    return (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
            <Breadcrumbs items={[
                { label: 'Home', to: '/' },
                { label: 'Admin', to: '/admin/settings' },
                { label: 'Audit Trail' },
            ]} />

            <div className="mb-6">
                <h1 className="text-3xl font-black text-[#101418] tracking-tight">Audit Trail</h1>
                <p className="text-[#44546f] mt-1 text-sm">System-wide activity log — who changed what, and when</p>
            </div>

            {/* ── Filters ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-[#101418]">Filters</h2>
                    {hasActiveFilters && (
                        <button
                            onClick={handleResetFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                        >
                            Reset All
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[#5f6b7a] mb-1.5">Action</label>
                        <select
                            value={filterAction}
                            onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                        >
                            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#5f6b7a] mb-1.5">Resource Type</label>
                        <select
                            value={filterResourceType}
                            onChange={e => { setFilterResourceType(e.target.value); setPage(1); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                        >
                            {RESOURCE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#5f6b7a] mb-1.5">Resource ID</label>
                        <input
                            type="text"
                            placeholder="Paste resource ID..."
                            value={filterResourceId}
                            onChange={e => { setFilterResourceId(e.target.value); setPage(1); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#5f6b7a] mb-1.5">User (User ID)</label>
                        <input
                            type="text"
                            placeholder="Enter user ID..."
                            value={filterUserSearch}
                            onChange={e => { setFilterUserSearch(e.target.value); setPage(1); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#5f6b7a] mb-1.5">From Date</label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={e => { setFilterStartDate(e.target.value); setPage(1); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[#5f6b7a] mb-1.5">To Date</label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={e => { setFilterEndDate(e.target.value); setPage(1); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                </div>
            </div>

            {/* ── Table header info ── */}
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#5f6b7a]">
                    {loading ? 'Loading...' : `${total} ${total === 1 ? 'entry' : 'entries'} found`}
                </span>
            </div>

            {/* ── Table ── */}
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Timestamp</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">User</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Action</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Resource Type</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Resource ID</th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Changes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-12 text-[#5f6b7a]">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0052cc]"></div>
                                    <span>Loading audit logs...</span>
                                </div>
                            </td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12 text-[#5f6b7a]">
                                <div className="flex flex-col items-center gap-2">
                                    <span className="material-symbols-outlined text-3xl text-gray-300">filter_list_off</span>
                                    <span>No audit log entries found</span>
                                </div>
                            </td></tr>
                        ) : logs.map(log => {
                            const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-50 text-gray-700' };
                            const hasChanges = log.oldValues || log.newValues;
                            const isExpanded = expandedRow === log.id;
                            const resourceLink = getResourceLink(log.resourceType, log.resourceId);
                            return (
                                <React.Fragment key={log.id}>
                                    <tr className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                        <td className="py-3 px-4 text-[#44546f] whitespace-nowrap text-xs">{formatDate(log.createdAt)}</td>
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-[#101418] text-sm">{log.user?.firstName} {log.user?.lastName}</div>
                                            <div className="text-xs text-[#5f6b7a]">{log.userEmail}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${meta.color}`}>
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm text-[#44546f] capitalize">{log.resourceType || '—'}</span>
                                        </td>
                                        <td className="py-3 px-4 text-xs">
                                            {log.resourceId && resourceLink ? (
                                                <Link
                                                    to={resourceLink}
                                                    className="text-blue-600 hover:text-blue-800 font-mono hover:underline"
                                                >
                                                    {log.resourceId.substring(0, 8)}...
                                                </Link>
                                            ) : log.resourceId ? (
                                                <span className="font-mono text-[#44546f]">{log.resourceId.substring(0, 8)}...</span>
                                            ) : (
                                                <span className="text-[#9aa5b4]">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            {hasChanges ? (
                                                <button
                                                    onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                                >
                                                    {isExpanded ? 'Hide' : 'View'}
                                                </button>
                                            ) : <span className="text-xs text-[#9aa5b4]">—</span>}
                                        </td>
                                    </tr>
                                    {isExpanded && hasChanges && (
                                        <tr className="bg-gray-50/80">
                                            <td colSpan={6} className="px-4 py-3">
                                                <div className="flex gap-6 text-xs font-mono">
                                                    {log.oldValues && (
                                                        <div>
                                                            <div className="text-[#5f6b7a] font-sans font-semibold mb-1">Before</div>
                                                            <pre className="text-red-700 bg-red-50 rounded-lg p-3 max-w-xs overflow-auto whitespace-pre-wrap">{formatChangeValue(log.oldValues)}</pre>
                                                        </div>
                                                    )}
                                                    {log.newValues && (
                                                        <div>
                                                            <div className="text-[#5f6b7a] font-sans font-semibold mb-1">After</div>
                                                            <pre className="text-green-700 bg-green-50 rounded-lg p-3 max-w-xs overflow-auto whitespace-pre-wrap">{formatChangeValue(log.newValues)}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-[#5f6b7a]">
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                        >
                            First
                        </button>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                        >
                            Prev
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                        >
                            Next
                        </button>
                        <button
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                        >
                            Last
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTrail;