import React, { useEffect, useRef, useState } from 'react';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';
import {
  CreditApplication,
  SicrAssessment,
  SicrTriggerType,
  sicrApi,
} from '../../../src/services/credit.service';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const TRIGGER_TYPES: { key: SicrTriggerType; label: string; description: string }[] = [
  { key: 'OBLIGATORY_WATCHLIST',   label: 'Obligatory — Watchlist',        description: 'Borrower placed on internal/regulatory watchlist' },
  { key: 'OBLIGATORY_IMPAIRED',    label: 'Obligatory — Impaired',         description: 'Borrower classified as impaired / NPL' },
  { key: 'OBJECTIVE_JUDGMENTAL',   label: 'Objective Judgemental',         description: 'Days-past-due threshold breached (e.g. >30 DPD)' },
  { key: 'SUBJECTIVE_JUDGMENTAL',  label: 'Subjective Judgemental',        description: 'Qualitative deterioration without DPD breach' },
];

const CLASSIFICATION_OPTIONS = ['PERFORMING', 'WATCHLIST', 'SUBSTANDARD', 'DOUBTFUL', 'LOSS'];

type SicrMap = Record<SicrTriggerType, Partial<SicrAssessment>>;

const SicrTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const [rows, setRows] = useState<SicrMap>(() =>
    Object.fromEntries(TRIGGER_TYPES.map(t => [t.key, { triggerType: t.key }])) as SicrMap
  );
  const dirtyKeys = useRef<Set<SicrTriggerType>>(new Set());
  const rowsRef = useRef<SicrMap>(rows);

  // Keep ref in sync with state for use in saveFn closure
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  useEffect(() => {
    sicrApi.list(application.id).then(items => {
      setRows(prev => {
        const next = { ...prev };
        items.forEach(item => { next[item.triggerType] = item; });
        return next;
      });
    }).catch(() => {});
  }, [application.id]);

  const update = (type: SicrTriggerType, key: keyof SicrAssessment, value: any) => {
    setRows(r => ({ ...r, [type]: { ...r[type], [key]: value } }));
    dirtyKeys.current.add(type);
    autosave.markDirty();
  };

  // ── Autosave ────────────────────────────────────────────────────────────
  const autosave = useAutosave<SicrAssessment[]>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return [];
      const items = Array.from(dirtyKeys.current).map(type => rowsRef.current[type]);
      dirtyKeys.current.clear();
      const saved = await sicrApi.bulkUpsert(application.id, items);
      // Sync local state with server response
      setRows(prev => {
        const next = { ...prev };
        saved.forEach(item => { next[item.triggerType] = item; });
        return next;
      });
      return saved;
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  return (
    <CaMemoSection
      title="SICR Assessment — Section 16"
      phase="Phase 5"
      readOnly={readOnly}
      saving={autosave.saving}
      savedAt={autosave.savedAt}
      error={autosave.error}
    >
      <div className="space-y-4">
        {TRIGGER_TYPES.map(({ key, label, description }) => {
          const row = rows[key];
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
                    : <select className="border rounded px-2 py-1 text-xs" value={row.hasHit == null ? '' : String(row.hasHit)} onChange={e => { update(key, 'hasHit', e.target.value === '' ? null : e.target.value === 'true'); }} onBlur={() => autosave.save()}>
                        <option value="">— N/A —</option>
                        <option value="false">No Hit</option>
                        <option value="true">Hit</option>
                      </select>}
                  {autosave.saving && <span className="text-xs text-gray-400">Saving…</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Triggering Event</label>
                  {readOnly
                    ? <p className="text-sm whitespace-pre-wrap">{row.triggeringEvent || '—'}</p>
                    : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={row.triggeringEvent ?? ''} onChange={e => update(key, 'triggeringEvent', e.target.value)} onBlur={() => autosave.save()} placeholder="Describe the triggering event…" />}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rationale</label>
                  {readOnly
                    ? <p className="text-sm whitespace-pre-wrap">{row.rationale || '—'}</p>
                    : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={row.rationale ?? ''} onChange={e => update(key, 'rationale', e.target.value)} onBlur={() => autosave.save()} placeholder="Analyst rationale…" />}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Resulting Classification</label>
                  {readOnly
                    ? <p className="text-sm">{row.resultingClassification || '—'}</p>
                    : <select className="border rounded px-2 py-1 text-sm" value={row.resultingClassification ?? ''} onChange={e => update(key, 'resultingClassification', e.target.value || null)} onBlur={() => autosave.save()}>
                        <option value="">— No change —</option>
                        {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </CaMemoSection>
  );
};

export default SicrTab;