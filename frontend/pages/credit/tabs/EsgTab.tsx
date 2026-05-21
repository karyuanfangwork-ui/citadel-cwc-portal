import React, { useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  EsgAssessment,
  EsgGuidingPrinciple,
  EsgCategory,
  esgApi,
} from '../../../src/services/credit.service';

type Props = { application: CreditApplication; onUpdated: (next: CreditApplication) => void };

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

const EsgTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const [form, setForm] = useState<Partial<EsgAssessment>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirty = useRef<Set<string>>(new Set());

  useEffect(() => {
    esgApi.get(application.id).then(data => { if (data) setForm(data); }).catch(() => {});
  }, [application.id]);

  const update = (key: keyof EsgAssessment, value: any) => {
    setForm(f => ({ ...f, [key]: value || null }));
    dirty.current.add(key);
  };

  const flush = async () => {
    if (dirty.current.size === 0) return;
    setSaving(true);
    const payload: any = {};
    dirty.current.forEach(k => { payload[k] = (form as any)[k]; });
    try {
      const saved = await esgApi.upsert(application.id, payload);
      setForm(saved);
      setSavedAt(new Date());
      dirty.current.clear();
    } finally { setSaving(false); }
  };

  const gpLabel = GP_OPTIONS.find(o => o.value === form.assignedGp)?.label;
  const catOpt = CAT_OPTIONS.find(o => o.value === form.assignedCategory);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">ESG Assessment — Section 17 (BNM CCPT)</h3>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
        {!saving && savedAt && <span className="text-xs text-green-600">Saved {savedAt.toLocaleTimeString()}</span>}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Guiding Principle (GP)</label>
          {readOnly
            ? <p className="text-sm">{gpLabel || '—'}</p>
            : <select className="border rounded px-2 py-1.5 text-sm w-full" value={form.assignedGp ?? ''} onChange={e => update('assignedGp', e.target.value)} onBlur={flush}>
                <option value="">— Select GP —</option>
                {GP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ESG Category</label>
          {readOnly
            ? <p className={`text-sm ${catOpt?.color ?? ''}`}>{catOpt?.label || '—'}</p>
            : <select className="border rounded px-2 py-1.5 text-sm w-full" value={form.assignedCategory ?? ''} onChange={e => update('assignedCategory', e.target.value)} onBlur={flush}>
                <option value="">— Select Category —</option>
                {CAT_OPTIONS.map(o => <option key={o.value} value={o.value} className={o.color}>{o.label}</option>)}
              </select>}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Justification</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{form.justification || '—'}</p>
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-28" value={form.justification ?? ''} onChange={e => update('justification', e.target.value)} onBlur={flush} placeholder="Justify the GP and category assignment…" />}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Mitigating Factors</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{form.mitigatingFactors || '—'}</p>
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-24" value={form.mitigatingFactors ?? ''} onChange={e => update('mitigatingFactors', e.target.value)} onBlur={flush} placeholder="Any mitigating factors that reduce ESG risk…" />}
      </div>
    </div>
  );
};

export default EsgTab;
