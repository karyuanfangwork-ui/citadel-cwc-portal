import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import creditService, { CreditAuditEvent } from '../../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../../src/utils/errorMessages';
import { formatDateTime, STATE_COLORS, STATE_ICONS } from '../../creditUtils';
import StateBadge from '../../../../src/components/credit/StateBadge';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import EmptyState from '../../../../src/components/EmptyState';

interface AuditTabProps {
  // No props needed — fetches its own data based on URL param
}

const AuditTab: React.FC<AuditTabProps> = () => {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<CreditAuditEvent[]>([]);
  // Sprint 4 — Filters
  const [actorFilter, setActorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.getApplicationAudit(id);
      setAudit(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load audit trail')); }
  }, [id]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  // Unique event types for filter dropdown
  const eventTypes = useMemo(() => {
    const set = new Set(audit.map(a => a.eventType));
    return Array.from(set).sort();
  }, [audit]);

  // Filtered events
  const filteredAudit = useMemo(() => {
    return audit.filter(a => {
      if (typeFilter && a.eventType !== typeFilter) return false;
      if (actorFilter) {
        const actorName = a.actor ? `${a.actor.firstName} ${a.actor.lastName}`.toLowerCase() : '';
        const actorId = a.actorId?.toLowerCase() ?? '';
        const q = actorFilter.toLowerCase();
        if (!actorName.includes(q) && !actorId.includes(q)) return false;
      }
      return true;
    });
  }, [audit, actorFilter, typeFilter]);

  // Sprint 4 — Render metadata as diff view
  const renderMetadata = (metadata: Record<string, any> | null) => {
    if (!metadata) return null;
    const entries = Object.entries(metadata);
    if (entries.length === 0) return null;

    return (
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
        <div className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 border-b border-gray-200">
          Metadata / Change Details
        </div>
        <table className="w-full text-xs">
          <tbody>
            {entries.map(([key, value]) => {
              const isObj = typeof value === 'object' && value !== null;
              const display = isObj ? JSON.stringify(value, null, 2) : String(value);
              return (
                <tr key={key} className="border-t border-gray-200">
                  <td className="px-3 py-1.5 font-medium text-gray-600 align-top whitespace-nowrap" style={{ width: '40%' }}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}
                  </td>
                  <td className="px-3 py-1.5 text-gray-800 font-mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {display}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <CaMemoSection title="Audit Trail" phase="Meta" readOnly>
      {audit.length === 0 ? (
        <EmptyState
          icon="history"
          title="No Audit Events"
          description="State transitions and key actions on this application will be recorded here as they happen."
        />
      ) : (
        <>
          {/* Sprint 4 — Filters */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All event types</option>
              {eventTypes.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filter by actor..."
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 w-48"
            />
            <span className="text-xs text-gray-400">
              {filteredAudit.length} / {audit.length} events
            </span>
          </div>

          <div className="space-y-4">
            {filteredAudit.map(a => {
              const isStateChange = a.oldState && a.newState;
              const hasMetadata = a.metadata && Object.keys(a.metadata).length > 0;
              const isExpanded = expandedId === a.id;
              return (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isStateChange ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
                      <span className="material-symbols-outlined text-base">{isStateChange ? 'swap_horiz' : 'edit_note'}</span>
                    </div>
                    {a !== filteredAudit[filteredAudit.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text-primary">{a.action.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{a.eventType}</span>
                      {isStateChange && (
                        <span className="text-xs flex items-center gap-1">
                          <StateBadge state={a.oldState!} />
                          <span className="text-text-secondary mx-1">&rarr;</span>
                          <StateBadge state={a.newState!} />
                        </span>
                      )}
                      {hasMetadata && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          className="text-xs text-blue-600 hover:underline ml-auto"
                        >
                          {isExpanded ? 'Hide details' : 'Show details'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.actor && <span className="text-xs text-text-secondary">by {a.actor.firstName} {a.actor.lastName}</span>}
                      {!a.actor && a.actorId && <span className="text-xs text-text-secondary font-mono">actor: {a.actorId.substring(0, 8)}...</span>}
                      <span className="text-xs text-text-secondary">{formatDateTime(a.createdAt)}</span>
                      {a.hash && (
                        <span className="text-xs text-gray-400 font-mono" title="Hash-chain reference">
                          #{a.hash.substring(0, 12)}
                        </span>
                      )}
                    </div>
                    {a.metadata?.reason && <p className="text-xs text-text-secondary mt-1 bg-bg-subtle border border-border rounded-lg px-3 py-1.5">{a.metadata.reason}</p>}
                    {isExpanded && renderMetadata(a.metadata)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </CaMemoSection>
  );
};

export default AuditTab;