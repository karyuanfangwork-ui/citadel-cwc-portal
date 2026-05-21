import React, { useEffect, useRef, useState } from 'react';
import {
  CreditApplication,
  IndustryAssessment,
  industryAssessmentApi,
} from '../../../src/services/credit.service';

type Props = { application: CreditApplication; onUpdated: (next: CreditApplication) => void };

const IndustryOutlookTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const [form, setForm] = useState<Partial<IndustryAssessment>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirty = useRef<Set<string>>(new Set());

  useEffect(() => {
    industryAssessmentApi.get(application.id).then(data => { if (data) setForm(data); }).catch(() => {});
  }, [application.id]);

  const update = (key: keyof IndustryAssessment, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    dirty.current.add(key);
  };

  const flush = async () => {
    if (dirty.current.size === 0) return;
    setSaving(true);
    const payload: any = {};
    dirty.current.forEach(k => { payload[k] = (form as any)[k] || null; });
    try {
      const saved = await industryAssessmentApi.upsert(application.id, payload);
      setForm(saved);
      setSavedAt(new Date());
      dirty.current.clear();
    } finally { setSaving(false); }
  };

  const textareaProps = (key: keyof IndustryAssessment, placeholder: string) => ({
    className: 'w-full border rounded px-3 py-2 text-sm resize-none h-32',
    value: (form[key] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => update(key, e.target.value),
    onBlur: flush,
    readOnly,
    placeholder,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Industry Outlook — Section 15</h3>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
        {!saving && savedAt && <span className="text-xs text-green-600">Saved {savedAt.toLocaleTimeString()}</span>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sector</label>
          {readOnly
            ? <p className="text-sm">{form.sectorName || '—'}</p>
            : <input className="border rounded px-2 py-1 text-sm w-full" placeholder="e.g. Manufacturing" value={form.sectorName ?? ''} onChange={e => update('sectorName', e.target.value)} onBlur={flush} />}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Sub-sector</label>
          {readOnly
            ? <p className="text-sm">{form.subsectorName || '—'}</p>
            : <input className="border rounded px-2 py-1 text-sm w-full" placeholder="e.g. Food Processing" value={form.subsectorName ?? ''} onChange={e => update('subsectorName', e.target.value)} onBlur={flush} />}
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
    </div>
  );
};

export default IndustryOutlookTab;
