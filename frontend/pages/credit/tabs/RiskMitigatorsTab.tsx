import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  RiskAssessment,
  RiskCategory,
  RmdIssue,
  riskAssessmentApi,
  rmdIssueApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const RISK_CATEGORIES: { key: RiskCategory; label: string }[] = [
  { key: 'PROJECT',     label: 'Project Risk' },
  { key: 'PERFORMANCE', label: 'Performance Risk' },
  { key: 'PACKAGING',   label: 'Packaging Risk' },
  { key: 'PAYMENT',     label: 'Payment Risk' },
  { key: 'OTHER',       label: 'Other Risk' },
];

type RiskMap = Record<RiskCategory, Partial<RiskAssessment>>;

const defaultMap = (): RiskMap => Object.fromEntries(RISK_CATEGORIES.map(c => [c.key, { riskCategory: c.key }])) as RiskMap;

// ─── Risk Register Section ────────────────────────────────────────────────────

type AutosaveLike = {
  save: () => Promise<unknown>;
  saving: boolean;
  savedAt: Date | null;
  dirty: boolean;
  error: string | null;
  markDirty: () => void;
  clearDirty: () => void;
  clearError: () => void;
};

type RiskRegisterRefs = {
  rowsRef: React.MutableRefObject<RiskMap>;
  dirtyCategoriesRef: React.MutableRefObject<Set<RiskCategory>>;
};

const RiskRegisterSection: React.FC<{
  appId: string;
  readOnly: boolean;
  autosave: AutosaveLike;
  refs: RiskRegisterRefs;
}> = ({ appId, readOnly, autosave, refs }) => {
  const { rowsRef, dirtyCategoriesRef } = refs;

  const [rows, setRows] = useState<RiskMap>(defaultMap());

  useEffect(() => {
    riskAssessmentApi.list(appId).then(items => {
      const next = defaultMap();
      items.forEach(item => { next[item.riskCategory] = item; });
      rowsRef.current = next;
      setRows(next);
    }).catch(() => {});
  }, [appId, rowsRef]);

  const update = (cat: RiskCategory, key: keyof RiskAssessment, value: string) => {
    const next = { ...rows, [cat]: { ...rows[cat], [key]: value } };
    setRows(next);
    rowsRef.current = next;
    dirtyCategoriesRef.current.add(cat);
    autosave.markDirty();
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Risk Register — Section 16</h3>
      <div className="space-y-4">
        {RISK_CATEGORIES.map(({ key, label }) => (
          <div key={key} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">{label}</span>
              {autosave.saving && dirtyCategoriesRef.current.has(key) && <span className="text-xs text-gray-400">Saving…</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Risk Description</label>
                {readOnly
                  ? <p className="text-sm whitespace-pre-wrap">{rows[key].description || '—'}</p>
                  : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-24" value={rows[key].description ?? ''} onChange={e => update(key, 'description', e.target.value)} onBlur={() => autosave.save()} placeholder="Describe the risk…" />}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mitigation</label>
                {readOnly
                  ? <p className="text-sm whitespace-pre-wrap">{rows[key].mitigation || '—'}</p>
                  : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-24" value={rows[key].mitigation ?? ''} onChange={e => update(key, 'mitigation', e.target.value)} onBlur={() => autosave.save()} placeholder="Describe the mitigation…" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── RMD Issues Section ───────────────────────────────────────────────────────

const RmdIssuesSection: React.FC<{
  appId: string;
  readOnly: boolean;
  onCrudAction?: () => void;
  autosave: ReturnType<typeof useAutosave>;
}> = ({ appId, readOnly, onCrudAction, autosave }) => {
  const [issues, setIssues] = useState<RmdIssue[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rmdIssueApi.list(appId).then(setIssues).catch(() => {});
  }, [appId]);

  const update = (id: string, key: keyof RmdIssue, value: string) => {
    setIssues(is => is.map(i => i.id === id ? { ...i, [key]: value } : i));
    autosave.markDirty();
  };

  const flush = async (issue: RmdIssue) => {
    setSaving(true);
    try {
      await rmdIssueApi.update(appId, issue.id, { issueDescription: issue.issueDescription, businessUnitResponse: issue.businessUnitResponse });
      autosave.clearDirty();
    } finally { setSaving(false); }
  };

  const addIssue = async () => {
    setSaving(true);
    try {
      const created = await rmdIssueApi.create(appId, { issueDescription: 'New issue', sortOrder: issues.length + 1 });
      setIssues(is => [...is, created]);
      onCrudAction?.();
    } finally { setSaving(false); }
  };

  const removeIssue = async (id: string) => {
    await rmdIssueApi.remove(appId, id);
    setIssues(is => is.filter(i => i.id !== id));
    onCrudAction?.();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">RMD Issues</h3>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
      </div>
      <div className="space-y-3">
        {issues.map((issue, idx) => (
          <div key={issue.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500">Issue {idx + 1}</span>
              {!readOnly && <button onClick={() => removeIssue(issue.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
            </div>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Issue Description</label>
                {readOnly
                  ? <p className="text-sm whitespace-pre-wrap">{issue.issueDescription}</p>
                  : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={issue.issueDescription} onChange={e => update(issue.id, 'issueDescription', e.target.value)} onBlur={() => flush(issue)} />}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Business Unit Response</label>
                {readOnly
                  ? <p className="text-sm whitespace-pre-wrap">{issue.businessUnitResponse || '—'}</p>
                  : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={issue.businessUnitResponse ?? ''} onChange={e => update(issue.id, 'businessUnitResponse', e.target.value)} onBlur={() => flush(issue)} placeholder="Business unit's response…" />}
              </div>
            </div>
          </div>
        ))}
        {issues.length === 0 && <p className="text-sm text-gray-400 italic">No RMD issues recorded.</p>}
        {!readOnly && issues.length < 3 && (
          <button onClick={addIssue} className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50">+ Add Issue</button>
        )}
      </div>
    </section>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const RiskMitigatorsTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const appId = application.id;

  // Shared refs for RiskRegister autosave
  const rowsRef = useRef<RiskMap>(defaultMap());
  const dirtyCategoriesRef = useRef<Set<RiskCategory>>(new Set());

  // ── Autosave (for RiskRegister inline edits) ──────────────────────────────
  const autosave = useAutosave<void>({
    saveFn: async () => {
      if (readOnly || dirtyCategoriesRef.current.size === 0) return;
      for (const cat of dirtyCategoriesRef.current) {
        const row = rowsRef.current[cat];
        await riskAssessmentApi.bulkUpsert(appId, [{
          riskCategory: cat,
          description: row.description ?? null,
          mitigation: row.mitigation ?? null,
        }]);
      }
      dirtyCategoriesRef.current.clear();
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  const handleCrudAction = () => {
    autosave.markDirty();
  };

  return (
    <div className="space-y-6">
      <CaMemoSection title="Risk Register" phase="Phase 5" readOnly={readOnly} saving={autosave.saving} savedAt={autosave.savedAt} error={autosave.error}>
        <RiskRegisterSection appId={appId} readOnly={readOnly} autosave={autosave} refs={{ rowsRef, dirtyCategoriesRef }} />
      </CaMemoSection>
      <CaMemoSection title="RMD Issues" phase="Phase 5" readOnly={readOnly} saving={autosave.saving} savedAt={autosave.savedAt} error={autosave.error}>
        <RmdIssuesSection appId={appId} readOnly={readOnly} onCrudAction={handleCrudAction} autosave={autosave} />
      </CaMemoSection>
    </div>
  );
};

export default RiskMitigatorsTab;