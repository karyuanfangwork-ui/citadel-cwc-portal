// frontend/pages/CrmDuplicates.tsx
import React, { useState, useEffect, useCallback } from 'react';
import crmService, { CrmDuplicateMatch } from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';
import { useCrmUpdate } from '../src/hooks/useCrmUpdate';

type EntityFilter = 'ALL' | 'LEAD' | 'CONTACT';
type StatusFilter = 'OPEN' | 'MERGED' | 'DISMISSED';

interface MergeState {
  match: CrmDuplicateMatch;
  entityA: Record<string, any> | null;
  entityB: Record<string, any> | null;
  selections: Record<string, string>;
}

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.8 ? 'bg-red-100 text-red-700' : c >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700';

const MERGE_FIELDS: Record<string, string[]> = {
  LEAD: ['title', 'contactName', 'contactEmail', 'contactPhone', 'companyName', 'status', 'source', 'estimatedValue'],
  CONTACT: ['firstName', 'lastName', 'email', 'phone', 'mobile', 'jobTitle', 'department'],
};

export default function CrmDuplicates() {
  const [duplicates, setDuplicates] = useState<CrmDuplicateMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [mergeState, setMergeState] = useState<MergeState | null>(null);
  const [merging, setMerging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmService.listDuplicates(
        entityFilter === 'ALL' ? undefined : entityFilter,
        statusFilter,
      );
      setDuplicates(data);
    } finally {
      setLoading(false);
    }
  }, [entityFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh on remote CRM changes
  useCrmUpdate(['lead', 'contact', 'duplicate'], () => { load(); });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDismiss = async (matchId: string) => {
    await crmService.dismissDuplicate(matchId);
    showToast('Duplicate dismissed');
    load();
  };

  const openMerge = async (match: CrmDuplicateMatch) => {
    let entityA: Record<string, any> | null = null;
    let entityB: Record<string, any> | null = null;
    try {
      if (match.entityType === 'LEAD') {
        const [a, b] = await Promise.all([
          crmService.getLead(match.entityAId),
          crmService.getLead(match.entityBId),
        ]);
        entityA = a;
        entityB = b;
      } else {
        const [a, b] = await Promise.all([
          crmService.getContact(match.entityAId),
          crmService.getContact(match.entityBId),
        ]);
        entityA = a;
        entityB = b;
      }
    } catch {
      showToast('Could not load entity details');
      return;
    }
    const fields = MERGE_FIELDS[match.entityType];
    const selections: Record<string, string> = {};
    fields.forEach((f) => { selections[f] = 'A'; });
    setMergeState({ match, entityA, entityB, selections });
  };

  const handleMerge = async () => {
    if (!mergeState) return;
    setMerging(true);
    try {
      const { match, entityA, entityB, selections } = mergeState;
      const masterEntityId = match.entityAId;
      // Build field values from selections
      const fieldValues: Record<string, string> = {};
      Object.entries(selections).forEach(([field, side]) => {
        const source = side === 'A' ? entityA : entityB;
        if (source && source[field] !== undefined) {
          fieldValues[field] = source[field];
        }
      });
      await crmService.mergeDuplicates(match.id, masterEntityId, fieldValues);
      setMergeState(null);
      showToast('Records merged successfully');
      load();
    } finally {
      setMerging(false);
    }
  };

  return (
    <div>
      <CrmNav />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Duplicate Records</h1>
            <p className="text-sm text-text-secondary mt-1">Review and merge detected duplicate leads and contacts</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary"
            >
              <option value="ALL">All Types</option>
              <option value="LEAD">Leads</option>
              <option value="CONTACT">Contacts</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary"
            >
              <option value="OPEN">Open</option>
              <option value="MERGED">Merged</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-text-secondary">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            Loading duplicates…
          </div>
        ) : duplicates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3">check_circle</span>
            <p className="font-medium">No duplicate records found</p>
            <p className="text-sm mt-1">New duplicates are detected automatically when leads and contacts are created.</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-subtle border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-text-secondary font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-semibold">Record A</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-semibold">Record B</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-semibold">Match Fields</th>
                  <th className="text-left px-4 py-3 text-text-secondary font-semibold">Confidence</th>
                  <th className="text-right px-4 py-3 text-text-secondary font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {duplicates.map((d) => (
                  <tr key={d.id} className="hover:bg-bg-subtle transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${d.entityType === 'LEAD' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {d.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">{d.entityAId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-text-secondary font-mono text-xs">{d.entityBId.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {d.matchFields.map((f) => (
                          <span key={f} className="px-1.5 py-0.5 rounded bg-bg-subtle text-text-secondary text-xs border border-border">{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${CONFIDENCE_COLOR(d.confidence)}`}>
                        {Math.round(d.confidence * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.status === 'OPEN' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openMerge(d)}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                          >
                            Merge
                          </button>
                          <button
                            onClick={() => handleDismiss(d.id)}
                            className="px-3 py-1 text-xs font-semibold rounded-lg border border-border text-text-secondary hover:bg-bg-subtle transition-colors"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                      {d.status !== 'OPEN' && (
                        <span className="text-xs text-text-secondary capitalize">{d.status.toLowerCase()}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {mergeState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-text-primary">Merge Duplicate {mergeState.match.entityType === 'LEAD' ? 'Leads' : 'Contacts'}</h2>
              <button onClick={() => setMergeState(null)} className="p-1 rounded-lg hover:bg-bg-subtle" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined text-text-secondary">close</span>
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-text-secondary mb-4">
                Select which value to keep for each field. Record A will be kept as the master; Record B will be soft-deleted.
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm font-semibold text-text-secondary mb-2">
                <div>Field</div>
                <div>Record A (master)</div>
                <div>Record B</div>
              </div>
              {MERGE_FIELDS[mergeState.match.entityType].map((field) => {
                const valA = mergeState.entityA?.[field];
                const valB = mergeState.entityB?.[field];
                const selected = mergeState.selections[field];
                return (
                  <div key={field} className="grid grid-cols-3 gap-4 items-center py-2 border-t border-border text-sm">
                    <div className="text-text-secondary capitalize">{field}</div>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected === 'A' ? 'bg-brand-50 border border-brand-300' : 'border border-transparent hover:bg-bg-subtle'}`}>
                      <input
                        type="radio"
                        name={field}
                        value="A"
                        checked={selected === 'A'}
                        onChange={() => setMergeState((s) => s ? { ...s, selections: { ...s.selections, [field]: 'A' } } : s)}
                        className="accent-brand-600"
                      />
                      <span className="text-text-primary truncate">{String(valA ?? '—')}</span>
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected === 'B' ? 'bg-brand-50 border border-brand-300' : 'border border-transparent hover:bg-bg-subtle'}`}>
                      <input
                        type="radio"
                        name={field}
                        value="B"
                        checked={selected === 'B'}
                        onChange={() => setMergeState((s) => s ? { ...s, selections: { ...s.selections, [field]: 'B' } } : s)}
                        className="accent-brand-600"
                      />
                      <span className="text-text-primary truncate">{String(valB ?? '—')}</span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={() => setMergeState(null)}
                disabled={merging}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:bg-bg-subtle transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {merging && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}