import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../../services/crm.service';
import { AuditLogEntry } from '../../services/auditLog.service';
import EmptyState from '../ui/EmptyState';

interface CrmAuditLogProps {
  entityType: 'account' | 'contact' | 'lead' | 'opportunity';
  entityId: string;
}

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CREATE:  { bg: 'rgba(34,197,94,0.08)',  text: '#16a34a', border: 'rgba(34,197,94,0.3)'  },
  UPDATE:  { bg: 'rgba(245,158,11,0.08)', text: '#d97706', border: 'rgba(245,158,11,0.3)' },
  DELETE:  { bg: 'rgba(239,68,68,0.08)',  text: '#dc2626', border: 'rgba(239,68,68,0.3)'  },
  CONVERT: { bg: 'rgba(139,92,246,0.08)',  text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  APPROVE: { bg: 'rgba(59,130,246,0.08)',  text: '#2563eb', border: 'rgba(59,130,246,0.3)' },
};

const DEFAULT_COLOR = { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' };

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

/** Pretty-format a single value for display */
const fmtVal = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/** Parse oldValues / newValues JSON and compute diff entries */
const computeDiff = (
  oldRaw: string | null,
  newRaw: string | null,
): Array<{ key: string; oldVal: string; newVal: string; type: 'added' | 'removed' | 'changed' }> => {
  let oldObj: Record<string, unknown> = {};
  let newObj: Record<string, unknown> = {};

  try { if (oldRaw) oldObj = JSON.parse(oldRaw); } catch { /* ignore */ }
  try { if (newRaw) newObj = JSON.parse(newRaw); } catch { /* ignore */ }

  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).sort();
  const result: Array<{ key: string; oldVal: string; newVal: string; type: 'added' | 'removed' | 'changed' }> = [];

  for (const key of allKeys) {
    const inOld = key in oldObj;
    const inNew = key in newObj;
    const o = fmtVal(oldObj[key]);
    const n = fmtVal(newObj[key]);

    if (inOld && !inNew) {
      result.push({ key, oldVal: o, newVal: n, type: 'removed' });
    } else if (!inOld && inNew) {
      result.push({ key, oldVal: o, newVal: n, type: 'added' });
    } else if (o !== n) {
      result.push({ key, oldVal: o, newVal: n, type: 'changed' });
    }
  }
  return result;
};

const SkeletonRow = () => (
  <div className="bg-bg-surface border border-border rounded-xl p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-3">
      <div className="h-4 bg-gray-200 rounded w-40" />
      <div className="h-5 bg-gray-200 rounded-full w-16" />
    </div>
    <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-1/2" />
  </div>
);

const CrmAuditLog: React.FC<CrmAuditLogProps> = ({ entityType, entityId }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLogs = useCallback(async (pageNum: number, append = false) => {
    try {
      const res = await crmService.getEntityAuditTrail(entityType, entityId, pageNum, 20);
      if (append) {
        setLogs(prev => [...prev, ...res.logs]);
      } else {
        setLogs(res.logs);
      }
      setHasMore(pageNum < res.pagination.totalPages);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    setPage(nextPage);
    fetchLogs(nextPage, true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState icon="history" title="No audit trail entries yet" description="Audit entries will appear when changes are made to this record." />
    );
  }

  return (
    <div className="space-y-3">
      {logs.map(entry => {
        const color = ACTION_COLORS[entry.action] ?? DEFAULT_COLOR;
        const diff = computeDiff(entry.oldValues, entry.newValues);
        const userName = entry.user
          ? `${entry.user.firstName} ${entry.user.lastName}`
          : entry.userEmail || 'Unknown';

        return (
          <div
            key={entry.id}
            className="bg-bg-surface rounded-xl p-4"
            style={{ borderLeft: `3px solid ${color.text}`, border: `1px solid var(--color-border)`, borderLeftWidth: 3, borderLeftColor: color.text }}
          >
            {/* Header: user + timestamp + action badge */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-sm font-semibold text-text-primary">{userName}</span>
              <span className="text-xs text-text-secondary">·</span>
              <span className="text-xs text-text-secondary">{formatTimestamp(entry.createdAt)}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ml-1"
                style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
              >
                {entry.action}
              </span>
              <span className="text-xs text-text-secondary ml-1">{entry.resourceType}</span>
            </div>

            {/* Diff rendering */}
            {diff.length > 0 && (
              <div className="space-y-1 ml-1">
                {diff.map(d => {
                  if (d.type === 'added') {
                    return (
                      <div key={d.key} className="text-xs flex flex-wrap gap-1">
                        <span className="font-medium text-text-secondary">{d.key}:</span>
                        <span className="text-[var(--color-success)]">+ {d.newVal}</span>
                      </div>
                    );
                  }
                  if (d.type === 'removed') {
                    return (
                      <div key={d.key} className="text-xs flex flex-wrap gap-1">
                        <span className="font-medium text-text-secondary">{d.key}:</span>
                        <span className="text-[var(--color-danger)]">- {d.oldVal}</span>
                      </div>
                    );
                  }
                  // changed
                  return (
                    <div key={d.key} className="text-xs flex flex-wrap gap-1">
                      <span className="font-medium text-text-secondary">{d.key}:</span>
                      <span className="text-[var(--color-danger)] line-through opacity-60">{d.oldVal}</span>
                      <span className="text-text-secondary">→</span>
                      <span className="text-[var(--color-success)]">{d.newVal}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-50"
            style={{ background: 'var(--bg-surface)', cursor: loadingMore ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {loadingMore ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                Loading…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">expand_more</span>
                Load More
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CrmAuditLog;