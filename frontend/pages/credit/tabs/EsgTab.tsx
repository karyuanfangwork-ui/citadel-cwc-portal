import React, { useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  EsgAssessment,
  EsgGuidingPrinciple,
  EsgCategory,
  esgApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const GP_OPTIONS: { value: EsgGuidingPrinciple; label: string }[] = [
  { value: 'GP1', label: 'GP1 — Climate Mitigation' },
  { value: 'GP2', label: 'GP2 — Climate Adaptation' },
  { value: 'GP3', label: 'GP3 — No Significant Harm' },
  { value: 'GP4', label: 'GP4 — Remedial Efforts' },
  { value: 'GP5', label: 'GP5 — Prohibited Activities' },
];

const CAT_OPTIONS: { value: EsgCategory; label: string; color: string }[] = [
  { value: 'C1', label: 'C1 — Climate Supporting', color: 'text-green-700' },
  { value: 'C2', label: 'C2 — Transitioning (Tier 1)', color: 'text-lime-700' },
  { value: 'C3', label: 'C3 — Transitioning (Tier 2)', color: 'text-yellow-700' },
  { value: 'C4', label: 'C4 — Watchlist (Tier 1)', color: 'text-orange-700' },
  { value: 'C5', label: 'C5 — Watchlist (Tier 2)', color: 'text-red-600' },
  { value: 'C6', label: 'C6 — Prohibited', color: 'text-red-800 font-bold' },
];

const EsgTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const [form, setForm] = useState<Partial<EsgAssessment>>({});
  const dirtyKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    esgApi.get(application.id).then(data => { if (data) setForm(data); }).catch(() => {});
  }, [application.id]);

  // ── Autosave ────────────────────────────────────────────────────────────
  const autosave = useAutosave<EsgAssessment>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return form as EsgAssessment;
      const payload: any = {};
      dirtyKeys.current.forEach(k => { payload[k] = (form as any)[k]; });
      dirtyKeys.current.clear();
      const saved = await esgApi.upsert(application.id, payload);
      setForm(saved);
      return saved;
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  const update = (key: keyof EsgAssessment, value: any) => {
    setForm(f => ({ ...f, [key]: value || null }));
    dirtyKeys.current.add(key);
    autosave.markDirty();
  };

  const gpLabel = GP_OPTIONS.find(o => o.value === form.assignedGp)?.label;
  const catOpt = CAT_OPTIONS.find(o => o.value === form.assignedCategory);

  return (
    <CaMemoSection title="ESG Assessment — Section 17 (BNM CCPT)" phase="Phase 5" readOnly={readOnly} saving={autosave.saving} savedAt={autosave.savedAt} error={autosave.error}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Guiding Principle (GP)</label>
          {readOnly
            ? <p className="text-sm">{gpLabel || '—'}</p>
            : <select className="border rounded px-2 py-1.5 text-sm w-full" value={form.assignedGp ?? ''} onChange={e => update('assignedGp', e.target.value)} onBlur={() => autosave.save()}>
                <option value="">— Select GP —</option>
                {GP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ESG Category</label>
          {readOnly
            ? <p className={`text-sm ${catOpt?.color ?? ''}`}>{catOpt?.label || '—'}</p>
            : <select className="border rounded px-2 py-1.5 text-sm w-full" value={form.assignedCategory ?? ''} onChange={e => update('assignedCategory', e.target.value)} onBlur={() => autosave.save()}>
                <option value="">— Select Category —</option>
                {CAT_OPTIONS.map(o => <option key={o.value} value={o.value} className={o.color}>{o.label}</option>)}
              </select>}
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-xs text-gray-500 mb-1">Justification</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{form.justification || '—'}</p>
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-28" value={form.justification ?? ''} onChange={e => update('justification', e.target.value)} onBlur={() => autosave.save()} placeholder="Justify the GP and category assignment…" />}
      </div>

      <div className="mt-4">
        <label className="block text-xs text-gray-500 mb-1">Mitigating Factors</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{form.mitigatingFactors || '—'}</p>
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-24" value={form.mitigatingFactors ?? ''} onChange={e => update('mitigatingFactors', e.target.value)} onBlur={() => autosave.save()} placeholder="Any mitigating factors that reduce ESG risk…" />}
      </div>
    </CaMemoSection>
  );
};

export default EsgTab;