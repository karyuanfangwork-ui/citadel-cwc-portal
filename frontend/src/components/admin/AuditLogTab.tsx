import React, { useState, useEffect, useCallback } from 'react';
import { auditLogService, AuditLogEntry, AuditLogParams } from '../../services/auditLog.service';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    CONFIDENTIAL_VIEW: { label: 'View', color: 'bg-blue-50 text-blue-700' },
    CONFIDENTIAL_RESUME_ACCESS: { label: 'Resume', color: 'bg-amber-50 text-amber-700' },
    CONFIDENTIAL_ATTACHMENT_DOWNLOAD: { label: 'Download', color: 'bg-red-50 text-red-700' },
};

export function AuditLogTab() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filterAction, setFilterAction] = useState('');
    const [filterResourceId, setFilterResourceId] = useState('');
    const limit = 20;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: AuditLogParams = { page, limit };
            if (filterAction) params.action = filterAction;
            if (filterResourceId) params.resourceId = filterResourceId;
            const res = await auditLogService.getLogs(params);
            setLogs(res.data.logs);
            setTotalPages(res.data.pagination.totalPages);
            setTotal(res.data.pagination.total);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [page, filterAction, filterResourceId]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const formatDate = (d: string) => new Date(d).toLocaleString();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[#101418]">Confidential Access Logs</h2>
                    <p className="text-sm text-[#5f6b7a]">Track who accessed confidential requests, resumes, and attachments</p>
                </div>
                <span className="text-xs text-[#5f6b7a] bg-gray-50 px-2.5 py-1 rounded-full font-medium">{total} entries</span>
            </div>

            {/* ── Filters ── */}
            <div className="flex flex-wrap gap-3 items-end">
                <div>
                    <label className="block text-xs font-medium text-[#5f6b7a] mb-1">Action</label>
                    <select
                        value={filterAction}
                        onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                        <option value="">All Actions</option>
                        <option value="CONFIDENTIAL_VIEW">View Request</option>
                        <option value="CONFIDENTIAL_RESUME_ACCESS">Resume Access</option>
                        <option value="CONFIDENTIAL_ATTACHMENT_DOWNLOAD">Download Attachment</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-[#5f6b7a] mb-1">Request ID</label>
                    <input
                        type="text"
                        placeholder="Paste request ID..."
                        value={filterResourceId}
                        onChange={e => { setFilterResourceId(e.target.value); setPage(1); }}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-60"
                    />
                </div>
                <button
                    onClick={() => { setFilterAction(''); setFilterResourceId(''); setPage(1); }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1.5"
                >
                    Reset
                </button>
            </div>

            {/* ── Table ── */}
            <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/60">
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Timestamp</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">User</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Action</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">Request ID</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-[#5f6b7a] uppercase tracking-wider">IP Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-8 text-[#5f6b7a]">Loading...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-[#5f6b7a]">No confidential access logs found</td></tr>
                        ) : logs.map(log => {
                            const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-50 text-gray-700' };
                            return (
                                <tr key={log.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                    <td className="py-2.5 px-4 text-[#44546f] whitespace-nowrap">{formatDate(log.createdAt)}</td>
                                    <td className="py-2.5 px-4">
                                        <div className="font-medium text-[#101418]">{log.user?.firstName} {log.user?.lastName}</div>
                                        <div className="text-xs text-[#5f6b7a]">{log.user?.email}</div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${meta.color}`}>
                                            {meta.label}
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 font-mono text-xs text-[#44546f]">
                                        {log.resourceId ? log.resourceId.substring(0, 8) + '...' : '—'}
                                    </td>
                                    <td className="py-2.5 px-4 text-xs text-[#5f6b7a] font-mono">{log.ipAddress || '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Prev
                    </button>
                    <span className="text-sm text-[#5f6b7a]">Page {page} of {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}