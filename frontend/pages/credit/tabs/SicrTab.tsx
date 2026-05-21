import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  SicrAssessment,
  SicrTriggerType,
  sicrApi,
} from '../../../src/services/credit.service';

type Props = { application: CreditApplication; onUpdated: (next: CreditApplication) => void };

const TRIGGER_TYPES: { key: SicrTriggerType; label: string; description: string }[] = [
  { key: 'OBLIGATORY_WATCHLIST',   label: 'Obligatory — Watchlist',        description: 'Borrower placed on internal/regulatory watchlist' },
  { key: 'OBLIGATORY_IMPAIRED',    label: 'Obligatory — Impaired',         description: 'Borrower classified as impaired / NPL' },
  { key: 'OBJECTIVE_JUDGMENTAL',   label: 'Objective Judgemental',         description: 'Days-past-due threshold breached (e.g. >30 DPD)' },
  { key: 'SUBJECTIVE_JUDGMENTAL',  label: 'Subjective Judgemental',        description: 'Qualitative deterioration without DPD breach' },
];

const CLASSIFICATION_OPTIONS = ['PERFORMING', 'WATCHLIST', 'SUBSTANDARD', 'DOUBTFUL', 'LOSS'];

type SicrMap = Record<SicrTriggerType, Partial<SicrAssessment>>;

const SicrTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const [rows, setRows] = useState<SicrMap>(() =>
    Object.fromEntries(TRIGGER_TYPES.map(t => [t.key, { triggerType: t.key }])) as SicrMap
  );
  const [saving, setSaving] = useState<SicrTriggerType | null>(null);

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
  };

  const flush = async (type: SicrTriggerType) => {
    setSaving(type);
    try {
      await sicrApi.bulkUpsert(application.id, [rows[type]]);
    } finally { setSaving(null); }
  };

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">SICR Assessment — Section 18 (MFRS 9)</h3>
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
                    : <select className="border rounded px-2 py-1 text-xs" value={row.hasHit == null ? '' : String(row.hasHit)} onChange={e => { update(key, 'hasHit', e.target.value === '' ? null : e.target.value === 'true'); }} onBlur={() => flush(key)}>
                        <option value="">— N/A —</option>
                        <option value="false">No Hit</option>
                        <option value="true">Hit</option>
                      </select>}
                  {saving === key && <span className="text-xs text-gray-400">Saving…</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Triggering Event</label>
                  {readOnly
                    ? <p className="text-sm whitespace-pre-wrap">{row.triggeringEvent || '—'}</p>
                    : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={row.triggeringEvent ?? ''} onChange={e => update(key, 'triggeringEvent', e.target.value)} onBlur={() => flush(key)} placeholder="Describe the triggering event…" />}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Rationale</label>
                  {readOnly
                    ? <p className="text-sm whitespace-pre-wrap">{row.rationale || '—'}</p>
                    : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-20" value={row.rationale ?? ''} onChange={e => update(key, 'rationale', e.target.value)} onBlur={() => flush(key)} placeholder="Analyst rationale…" />}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Resulting Classification</label>
                  {readOnly
                    ? <p className="text-sm">{row.resultingClassification || '—'}</p>
                    : <select className="border rounded px-2 py-1 text-sm" value={row.resultingClassification ?? ''} onChange={e => update(key, 'resultingClassification', e.target.value || null)} onBlur={() => flush(key)}>
                        <option value="">— No change —</option>
                        {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SicrTab;
