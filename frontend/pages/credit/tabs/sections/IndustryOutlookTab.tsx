import React, { useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  IndustryAssessment,
  industryAssessmentApi,
} from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../../src/hooks/useAutosave';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const IndustryOutlookTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const [form, setForm] = useState<Partial<IndustryAssessment>>({});
  const dirtyKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    industryAssessmentApi.get(application.id).then(data => { if (data) setForm(data); }).catch(() => {});
  }, [application.id]);

  // ── Autosave ────────────────────────────────────────────────────────────
  const autosave = useAutosave<IndustryAssessment>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return form as IndustryAssessment;
      const payload: any = {};
      dirtyKeys.current.forEach(k => { payload[k] = (form as any)[k] || null; });
      dirtyKeys.current.clear();
      const saved = await industryAssessmentApi.upsert(application.id, payload);
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

  const update = (key: keyof IndustryAssessment, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    dirtyKeys.current.add(key);
    autosave.markDirty();
  };

  const textareaProps = (key: keyof IndustryAssessment, placeholder: string) => ({
    className: 'w-full border rounded px-3 py-2 text-sm resize-none h-32',
    value: (form[key] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => update(key, e.target.value),
    onBlur: () => autosave.save(),
    readOnly,
    placeholder,
  });

  return (
    <CaMemoSection title="Industry Outlook — Section 15" phase="Phase 5" readOnly={readOnly} saving={autosave.saving} savedAt={autosave.savedAt} error={autosave.error}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sector</label>
          {readOnly
            ? <p className="text-sm">{form.sectorName || '—'}</p>
            : <input className="border rounded px-2 py-1 text-sm w-full" placeholder="e.g. Manufacturing" value={form.sectorName ?? ''} onChange={e => update('sectorName', e.target.value)} onBlur={() => autosave.save()} />}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sub-sector</label>
          {readOnly
            ? <p className="text-sm">{form.subsectorName || '—'}</p>
            : <input className="border rounded px-2 py-1 text-sm w-full" placeholder="e.g. Food Processing" value={form.subsectorName ?? ''} onChange={e => update('subsectorName', e.target.value)} onBlur={() => autosave.save()} />}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Sector Outlook</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{form.sectorOutlook || '—'}</p>
          : <textarea {...textareaProps('sectorOutlook', 'Describe the sector outlook and macro trends…')} />}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Sub-sector Outlook</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{form.subsectorOutlook || '—'}</p>
          : <textarea {...textareaProps('subsectorOutlook', 'Describe the sub-sector outlook and competitive dynamics…')} />}
      </div>
    </CaMemoSection>
  );
};

export default IndustryOutlookTab;