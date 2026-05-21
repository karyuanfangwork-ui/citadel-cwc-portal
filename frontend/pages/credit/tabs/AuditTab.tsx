import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import creditService, { CreditAuditEvent } from '../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import { formatDateTime, STATE_COLORS } from '../creditUtils';

interface AuditTabProps {
  // No props needed — fetches its own data based on URL param
}

const AuditTab: React.FC<AuditTabProps> = () => {
  const { id } = useParams<{ id: string }>();
  const [audit, setAudit] = useState<CreditAuditEvent[]>([]);

  const fetchAudit = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.getApplicationAudit(id);
      setAudit(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load audit trail')); }
  }, [id]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5">
      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Audit Trail</h3>
      {audit.length === 0 ? (
        <p className="text-sm text-text-secondary">No audit events recorded.</p>
      ) : (
        <div className="space-y-4">
          {audit.map(a => {
            const isStateChange = a.oldState && a.newState;
            return (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isStateChange ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
                    <span className="material-symbols-outlined text-base">{isStateChange ? 'swap_horiz' : 'edit_note'}</span>
                  </div>
                  {a !== audit[audit.length - 1] && <div className="w-0.5 flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-text-primary">{a.action.replace(/_/g, ' ')}</span>
                    {isStateChange && (
                      <span className="text-xs">
                        <span className="font-medium" style={{ color: (STATE_COLORS[a.oldState!]?.text) || '#6366f1' }}>{a.oldState!.replace(/_/g, ' ')}</span>
                        <span className="text-text-secondary mx-1">→</span>
                        <span className="font-medium" style={{ color: (STATE_COLORS[a.newState!]?.text) || '#6366f1' }}>{a.newState!.replace(/_/g, ' ')}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.actor && <span className="text-xs text-text-secondary">by {a.actor.firstName} {a.actor.lastName}</span>}
                    {!a.actor && a.actorId && <span className="text-xs text-text-secondary font-mono">actor: {a.actorId.substring(0, 8)}…</span>}
                    <span className="text-xs text-text-secondary">{formatDateTime(a.createdAt)}</span>
                  </div>
                  {a.metadata?.reason && <p className="text-xs text-text-secondary mt-1 bg-bg-subtle border border-border rounded-lg px-3 py-1.5">{a.metadata.reason}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AuditTab;