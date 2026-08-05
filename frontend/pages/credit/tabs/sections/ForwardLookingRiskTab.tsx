import React, { useEffect, useRef, useState } from 'react';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../../src/hooks/useAutosave';
import {
  CreditApplication,
  EsgAssessment,
  EsgGuidingPrinciple,
  EsgCategory,
  SicrAssessment,
  SicrTriggerType,
  esgApi,
  sicrApi,
} from '../../../../src/services/credit.service';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

// ── ESG Options ──────────────────────────────────────────────────
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

// ── SICR Options ─────────────────────────────────────────────────
const TRIGGER_TYPES: { key: SicrTriggerType; label: string; description: string }[] = [
  { key: 'OBLIGATORY_WATCHLIST', label: 'Obligatory — Watchlist', description: 'Borrower placed on internal/regulatory watchlist' },
  { key: 'OBLIGATORY_IMPAIRED', label: 'Obligatory — Impaired', description: 'Borrower classified as impaired / NPL' },
  { key: 'OBJECTIVE_JUDGMENTAL', label: 'Objective Judgemental', description: 'Days-past-due threshold breached (e.g. >30 DPD)' },
  { key: 'SUBJECTIVE_JUDGMENTAL', label: 'Subjective Judgemental', description: 'Qualitative deterioration without DPD breach' },
];

const CLASSIFICATION_OPTIONS = ['PERFORMING', 'WATCHLIST', 'SUBSTANDARD', 'DOUBTFUL', 'LOSS'];

type SicrMap = Record<SicrTriggerType, Partial<SicrAssessment>>;

/**
 * §3.5 — Consolidated "Forward-Looking Risk" tab.
 *
 * Merges the former ESG Assessment (Section 17) and SICR Assessment (Section 16)
 * into a single tab with two collapsible sections. Both datasets remain
 * independently saved via their own API endpoints.
 */
const ForwardLookingRiskTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';

  // ── Collapsible state ────────────────────────────────────────
  const [esgOpen, setEsgOpen] = useState(true);
  const [sicrOpen, setSicrOpen] = useState(true);

  // ── ESG state ────────────────────────────────────────────────
  const [esgForm, setEsgForm] = useState<Partial<EsgAssessment>>({});
  const esgDirtyKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    esgApi.get(application.id).then(data => { if (data) setEsgForm(data); }).catch(() => {});
  }, [application.id]);

  const esgAutosave = useAutosave<EsgAssessment>({
    saveFn: async () => {
      if (readOnly || esgDirtyKeys.current.size === 0) return esgForm as EsgAssessment;
      const payload: any = {};
      esgDirtyKeys.current.forEach(k => { payload[k] = (esgForm as any)[k]; });
      esgDirtyKeys.current.clear();
      const saved = await esgApi.upsert(application.id, payload);
      setEsgForm(saved);
      return saved;
    },
    readOnly,
    debounceMs: 1500,
  });

  const updateEsg = (key: keyof EsgAssessment, value: any) => {
    setEsgForm(f => ({ ...f, [key]: value || null }));
    esgDirtyKeys.current.add(key);
    esgAutosave.markDirty();
  };

  // ── SICR state ────────────────────────────────────────────────
  const [sicrRows, setSicrRows] = useState<SicrMap>(() =>
    Object.fromEntries(TRIGGER_TYPES.map(t => [t.key, { triggerType: t.key }])) as SicrMap
  );
  const sicrDirtyKeys = useRef<Set<SicrTriggerType>>(new Set());
  const sicrRowsRef = useRef<SicrMap>(sicrRows);

  useEffect(() => { sicrRowsRef.current = sicrRows; }, [sicrRows]);

  useEffect(() => {
    sicrApi.list(application.id).then(items => {
      setSicrRows(prev => {
        const next = { ...prev };
        items.forEach(item => { next[item.triggerType] = item; });
        return next;
      });
    }).catch(() => {});
  }, [application.id]);

  const updateSicr = (type: SicrTriggerType, key: keyof SicrAssessment, value: any) => {
    setSicrRows(r => ({ ...r, [type]: { ...r[type], [key]: value } }));
    sicrDirtyKeys.current.add(type);
    sicrAutosave.markDirty();
  };

  const sicrAutosave = useAutosave<SicrAssessment[]>({
    saveFn: async () => {
      if (readOnly || sicrDirtyKeys.current.size === 0) return [];
      const items = Array.from(sicrDirtyKeys.current).map(type => sicrRowsRef.current[type]);
      sicrDirtyKeys.current.clear();
      const saved = await sicrApi.bulkUpsert(application.id, items);
      setSicrRows(prev => {
        const next = { ...prev };
        saved.forEach(item => { next[item.triggerType] = item; });
        return next;
      });
      return saved;
    },
    readOnly,
    debounceMs: 1500,
  });

  // ── Notify parent of dirty state ─────────────────────────────
  useEffect(() => {
    onDirtyChange?.(esgAutosave.dirty || sicrAutosave.dirty);
  }, [esgAutosave.dirty, sicrAutosave.dirty, onDirtyChange]);

  const gpLabel = GP_OPTIONS.find(o => o.value === esgForm.assignedGp)?.label;
  const catOpt = CAT_OPTIONS.find(o => o.value === esgForm.assignedCategory);

  return (
    <div className="space-y-6">
      {/* ── ESG Assessment Section ─────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setEsgOpen(!esgOpen)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          aria-expanded={esgOpen}
          aria-controls="esg-section"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-800">ESG Assessment — Section 17 (BNM CCPT)</h3>
            <p className="text-xs text-gray-500">Guiding principle, category, and justification</p>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform" style={{ transform: esgOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
        </button>
        {esgOpen && (
          <div id="esg-section" className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Guiding Principle (GP)</label>
                {readOnly
                  ? <p className="text-sm">{gpLabel || '—'}</p>
                  : <select className="border rounded px-2 py-1.5 text-sm w-full" value={esgForm.assignedGp ?? ''} onChange={e => updateEsg('assignedGp', e.target.value)} onBlur={() => esgAutosave.save()}>
                      <option value="">— Select GP —</option>
                      {GP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ESG Category</label>
                {readOnly
                  ? <p className={`text-sm ${catOpt?.color ?? ''}`}>{catOpt?.label || '—'}</p>
                  : <select className="border rounded px-2 py-1.5 text-sm w-full" value={esgForm.assignedCategory ?? ''} onChange={e => updateEsg('assignedCategory', e.target.value)} onBlur={() => esgAutosave.save()}>
                      <option value="">— Select Category —</option>
                      {CAT_OPTIONS.map(o => <option key={o.value} value={o.value} className={o.color}>{o.label}</option>)}
                    </select>}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Justification</label>
              {readOnly
                ? <p className="text-sm whitespace-pre-wrap">{esgForm.justification || '—'}</p>
                : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-28" value={esgForm.justification ?? ''} onChange={e => updateEsg('justification', e.target.value)} onBlur={() => esgAutosave.save()} placeholder="Justify the GP and category assignment…" />}
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Mitigating Factors</label>
              {readOnly
                ? <p className="text-sm whitespace-pre-wrap">{esgForm.mitigatingFactors || '—'}</p>
                : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-24" value={esgForm.mitigatingFactors ?? ''} onChange={e => updateEsg('mitigatingFactors', e.target.value)} onBlur={() => esgAutosave.save()} placeholder="Any mitigating factors that reduce ESG risk…" />}
            </div>

            {esgAutosave.saving && <p className="text-xs text-gray-400">Saving…</p>}
            {esgAutosave.error && <p className="text-xs text-red-600">{esgAutosave.error}</p>}
          </div>
        )}
      </div>

      {/* ── SICR Assessment Section ─────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setSicrOpen(!sicrOpen)}
          className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          aria-expanded={sicrOpen}
          aria-controls="sicr-section"
        >
          <div>
            <h3 className="text-sm font-bold text-gray-800">SICR Assessment — Section 16</h3>
            <p className="text-xs text-gray-500">Significant increase in credit risk triggers</p>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform" style={{ transform: sicrOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
        </button>
        {sicrOpen && (
          <div id="sicr-section" className="px-5 py-4 space-y-4">
            {TRIGGER_TYPES.map(({ key, label, description }) => {
              const row = sicrRows[key];
              return (
                <div key={key} className={`border rounded-lg p-4 ${row.hasHit === true ? 'border-red-300' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {readOnly
                        ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${row.hasHit === true ? 'bg-red-100 text-red-700' : row.hasHit === false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {row.hasHit === true ? 'HIT' : row.hasHit === false ? 'NO HIT' : 'N/A'}
                          </span>
                        : <select className="border rounded px-2 py-1 text-xs" value={row.hasHit == null ? '' : String(row.hasHit)} onChange={e => { updateSicr(key, 'hasHit', e.target.value === '' ? null : e.target.value === 'true'); }} onBlur={() => sicrAutosave.save()}>
                            <option value="">— N/A —</option>
                            <option value="false">No Hit</option>
                            <option value="true">Hit</option>
                          </select>}
                      {sicrAutosave.saving && <span className="text-xs text-gray-400">Saving…</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Triggering Event</label>
                      {readOnly
                        ? <p className="text-sm whitespace-pre-wrap">{row.triggeringEvent || '—'}</p>
                        : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={row.triggeringEvent ?? ''} onChange={e => updateSicr(key, 'triggeringEvent', e.target.value)} onBlur={() => sicrAutosave.save()} placeholder="Describe the triggering event…" />}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Rationale</label>
                      {readOnly
                        ? <p className="text-sm whitespace-pre-wrap">{row.rationale || '—'}</p>
                        : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={row.rationale ?? ''} onChange={e => updateSicr(key, 'rationale', e.target.value)} onBlur={() => sicrAutosave.save()} placeholder="Analyst rationale…" />}
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Resulting Classification</label>
                      {readOnly
                        ? <p className="text-sm">{row.resultingClassification || '—'}</p>
                        : <select className="border rounded px-2 py-1 text-sm" value={row.resultingClassification ?? ''} onChange={e => updateSicr(key, 'resultingClassification', e.target.value || null)} onBlur={() => sicrAutosave.save()}>
                            <option value="">— No change —</option>
                            {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>}
                    </div>
                  </div>
                </div>
              );
            })}
            {sicrAutosave.error && <p className="text-xs text-red-600">{sicrAutosave.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForwardLookingRiskTab;