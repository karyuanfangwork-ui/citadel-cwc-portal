import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  CreditBureauCheck,
  BureauProvider,
  bureauCheckApi,
} from '../../../src/services/credit.service';
import { BUREAU_PROVIDER_OPTIONS, bureauProviderLabel } from '../../../src/constants/creditEnums';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import ProgressOverlay from '../../../src/components/credit/ProgressOverlay';
import { useProgressOverlay } from '../../../src/hooks/useProgressOverlay';

type Props = { application: CreditApplication; onUpdated: (next: CreditApplication) => void };

/* Selectable providers for new manual entries — CCRIS excluded (historical only) */
const PROVIDERS: BureauProvider[] = [
  'CCRIS_BORROWER_UPLOAD',
  'CTOS',
  'EXPERIAN',
  'CBM',
  'SSM_EINFO',
  'BANK_STATEMENT_ANALYSIS',
  'PEP_WATCHLIST',
  'IF_ACTIVA',
  'PUBLIC_DOMAIN',
];

const AddCheckForm: React.FC<{ appId: string; onAdded: (c: CreditBureauCheck) => void }> = ({ appId, onAdded }) => {
  const [form, setForm] = useState({ provider: 'CCRIS_BORROWER_UPLOAD' as BureauProvider, subjectName: '', runDate: '', hasHits: '', findings: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await bureauCheckApi.create(appId, {
        ...form,
        hasHits: form.hasHits === 'true' ? true : form.hasHits === 'false' ? false : null,
        subjectName: form.subjectName || null,
        runDate: form.runDate || null,
        findings: form.findings || null,
      });
      toast.success('Bureau check added');
      onAdded(saved);
      setForm({ provider: 'CCRIS_BORROWER_UPLOAD', subjectName: '', runDate: '', hasHits: '', findings: '' });
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to add bureau check'));
    } finally { setSaving(false); }
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Add Bureau Check</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Provider</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value as BureauProvider }))}>
            {PROVIDERS.map(p => <option key={p} value={p}>{bureauProviderLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Subject Name</label>
          <input className="border rounded px-2 py-1 text-sm w-full" value={form.subjectName} onChange={e => setForm(f => ({ ...f, subjectName: e.target.value }))} placeholder="Entity or person name" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Run Date</label>
          <input type="date" className="border rounded px-2 py-1 text-sm w-full" value={form.runDate} onChange={e => setForm(f => ({ ...f, runDate: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Has Hits?</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={form.hasHits} onChange={e => setForm(f => ({ ...f, hasHits: e.target.value }))}>
            <option value="">— Unknown —</option>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Findings</label>
          <textarea className="border rounded px-2 py-1 text-sm w-full resize-none h-20" value={form.findings} onChange={e => setForm(f => ({ ...f, findings: e.target.value }))} placeholder="Summary of findings…" />
        </div>
        {form.provider === 'CCRIS_BORROWER_UPLOAD' && (
          <p className="text-xs text-amber-600 col-span-2">
            Borrower must upload their eCCRIS PDF as a <code>CREDIT_BUREAU_REPORT</code> document
            before this check can be relied upon. See the Documents tab.
          </p>
        )}
      </div>
      <button onClick={submit} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saving…' : 'Add Check'}
      </button>
    </div>
  );
};

const CheckCard: React.FC<{ check: CreditBureauCheck; appId: string; readOnly: boolean; onRemoved: () => void }> = ({ check, appId, readOnly, onRemoved }) => {
  const [expanded, setExpanded] = useState(false);

  const handleRemove = async () => {
    try {
      await bureauCheckApi.remove(appId, check.id);
      toast.success('Bureau check removed');
      onRemoved();
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to remove bureau check'));
    }
  };

  const isLegacy = check.provider === 'CCRIS';

  return (
    <div className={`border rounded-lg p-4 ${check.hasHits === true ? 'border-red-300 bg-red-50' : check.hasHits === false ? 'border-green-300 bg-green-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">
            {bureauProviderLabel(check.provider)}
            {isLegacy && <span className="ml-1 text-[10px] text-amber-600 font-normal">(legacy)</span>}
          </span>
          {check.hasHits === true && <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">HITS FOUND</span>}
          {check.hasHits === false && <span className="text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">CLEAR</span>}
          {check.hasHits == null && <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">PENDING</span>}
        </div>
        <div className="flex items-center gap-2">
          {check.subjectName && <span className="text-xs text-gray-500">{check.subjectName}</span>}
          {check.runDate && <span className="text-xs text-gray-400">{new Date(check.runDate).toLocaleDateString('en-GB')}</span>}
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-gray-400 hover:text-gray-600">{expanded ? '▲' : '▼'}</button>
          {!readOnly && <button onClick={handleRemove} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
        </div>
      </div>
      {expanded && check.findings && (
        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{check.findings}</p>
      )}
    </div>
  );
};

const CreditChecksTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const [checks, setChecks] = useState<CreditBureauCheck[]>([]);
  const [loadingChecks, setLoadingChecks] = useState(true);
  const progress = useProgressOverlay();

  useEffect(() => {
    setLoadingChecks(true);
    bureauCheckApi.list(application.id)
      .then(setChecks)
      .catch((e) => { console.error(e); toast.error(friendlyMessage(e, 'Failed to load bureau checks')); })
      .finally(() => setLoadingChecks(false));
  }, [application.id]);

  const handleAddCheck = async (c: CreditBureauCheck) => {
    // Bureau check creation may hit external API for real providers
    const saved = await progress.wrap(
      () => bureauCheckApi.create(application.id, {
        provider: c.provider,
        subjectName: c.subjectName,
        runDate: c.runDate,
        hasHits: c.hasHits,
        findings: c.findings,
      }),
      'Running bureau check…',
      'This may take a few seconds for external providers'
    );
    setChecks(cs => [saved, ...cs]);
    toast.success('Bureau check added');
    return saved;
  };

  return (
    <>
      {progress.visible && <ProgressOverlay message={progress.message} subMessage={progress.subMessage} />}
      <CaMemoSection title="Credit Bureau Checks — Section 14" readOnly={readOnly}>
        {loadingChecks ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
            Loading bureau checks…
          </div>
        ) : (
          <>
            {checks.map(c => (
              <CheckCard key={c.id} check={c} appId={application.id} readOnly={readOnly} onRemoved={() => setChecks(cs => cs.filter(x => x.id !== c.id))} />
            ))}
            {checks.length === 0 && <p className="text-sm text-gray-400 italic">No bureau checks recorded.</p>}
          </>
        )}
        {!readOnly && <AddCheckForm appId={application.id} onAdded={c => setChecks(cs => [c, ...cs])} />}
      </CaMemoSection>
    </>
  );
};

export default CreditChecksTab;