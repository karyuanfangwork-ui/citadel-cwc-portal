import React, { useEffect, useState, useCallback } from 'react';
import { bureauChecklistApi } from '../../../src/services/credit.service';
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
import { useAuth } from '../../../src/context/AuthContext';
import { hasPermission } from '../../../src/utils/permissions';

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

/** Map checklist item key → required bureau provider for uploaded doc */
const CHECKLIST_DOC_PROVIDER: Record<string, BureauProvider> = {
  ccrisUploaded: 'CCRIS_BORROWER_UPLOAD',
  ctosUploaded: 'CTOS',
};

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
  const [structuredData, setStructuredData] = useState<Record<string, unknown>>({});
  const [savingStructured, setSavingStructured] = useState(false);

  const isCcris = check.provider.startsWith('CCRIS');
  const isCtos = check.provider.startsWith('CTOS');

  const handleSaveStructured = async () => {
    setSavingStructured(true);
    try {
      await bureauChecklistApi.updateCheckStructured(appId, check.id, structuredData);
      toast.success('Bureau check updated');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to save structured data'));
    } finally {
      setSavingStructured(false);
    }
  };

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

  // Show doc verification badge
  const docVerified = check.attachedDoc?.verificationStatus === 'VERIFIED';
  const docPending = check.attachedDoc && check.attachedDoc.verificationStatus !== 'VERIFIED';

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
          {docVerified && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">DOC VERIFIED</span>}
          {docPending && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">DOC UNVERIFIED</span>}
        </div>
        <div className="flex items-center gap-2">
          {check.subjectName && <span className="text-xs text-gray-500">{check.subjectName}</span>}
          {check.runDate && <span className="text-xs text-gray-400">{new Date(check.runDate).toLocaleDateString('en-GB')}</span>}
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-gray-400 hover:text-gray-600">{expanded ? '▲' : '▼'}</button>
          {!readOnly && <button onClick={handleRemove} className="text-red-400 hover:text-red-600 text-xs">✕</button>}
        </div>
      </div>
      {expanded && (
        <div className="mt-3 space-y-3">
          {check.findings && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap border-t pt-2">{check.findings}</p>
          )}
          {check.attachedDoc && (
            <div className="border-t pt-2 text-xs text-gray-500">
              Attached doc: <span className="font-medium">{check.attachedDoc.fileName}</span>
              {' '}&middot; Status: <span className={docVerified ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>{check.attachedDoc.verificationStatus ?? 'PENDING'}</span>
            </div>
          )}
          {(isCcris || isCtos) && !readOnly && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Structured Data</p>
              {isCcris && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2 col-span-2">
                    <input type="checkbox" checked={Boolean(structuredData.ccrisSaaFlag)} onChange={e => setStructuredData(p => ({ ...p, ccrisSaaFlag: e.target.checked }))} />
                    SAA Account Present
                  </label>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">Missed Payments (12mo)</span>
                    <input type="number" min={0} max={12} value={(structuredData.ccrisMissedPayments12Months as number) ?? ''} onChange={e => setStructuredData(p => ({ ...p, ccrisMissedPayments12Months: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">CCRIS Report Date</span>
                    <input type="date" value={(structuredData.ccrisReportDate as string) ?? ''} onChange={e => setStructuredData(p => ({ ...p, ccrisReportDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(structuredData.ccrisBankruptcyFlag)} onChange={e => setStructuredData(p => ({ ...p, ccrisBankruptcyFlag: e.target.checked }))} />
                    Bankruptcy Flag
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(structuredData.ccrisLegalActionFlag)} onChange={e => setStructuredData(p => ({ ...p, ccrisLegalActionFlag: e.target.checked }))} />
                    Legal Action Flag
                  </label>
                </div>
              )}
              {isCtos && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">CTOS Score (0–1000)</span>
                    <input type="number" min={0} max={1000} value={(structuredData.ctosScore as number) ?? ''} onChange={e => setStructuredData(p => ({ ...p, ctosScore: Number(e.target.value) }))} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">CTOS Report Date</span>
                    <input type="date" value={(structuredData.ctosReportDate as string) ?? ''} onChange={e => setStructuredData(p => ({ ...p, ctosReportDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(structuredData.ctosAdverseFlag)} onChange={e => setStructuredData(p => ({ ...p, ctosAdverseFlag: e.target.checked }))} />
                    Adverse Record
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={Boolean(structuredData.ctosBankruptcyFlag)} onChange={e => setStructuredData(p => ({ ...p, ctosBankruptcyFlag: e.target.checked }))} />
                    Bankruptcy Flag
                  </label>
                </div>
              )}
              <button onClick={handleSaveStructured} disabled={savingStructured} className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {savingStructured ? 'Saving…' : 'Save Structured Data'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CHECKLIST_ITEMS = [
  { key: 'ccrisUploaded', label: 'CCRIS report uploaded (dated within 90 days)' },
  { key: 'ctosUploaded', label: 'CTOS report uploaded (dated within 90 days)' },
  { key: 'amlScreeningDone', label: 'AML / sanctions name-screening completed' },
  { key: 'noAdverseRecord', label: 'No unresolved adverse records (or exception documented below)' },
] as const;

type ChecklistData = {
  ccrisUploaded: boolean;
  ctosUploaded: boolean;
  noAdverseRecord: boolean;
  adverseExceptionReason: string;
  amlScreeningDone: boolean;
  tickedById: string | null;
  tickedAt: string | null;
  tickedBy: { id: string; firstName: string; lastName: string } | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  verifiedBy: { id: string; firstName: string; lastName: string } | null;
};

const BureauChecklistPanel: React.FC<{ appId: string; readOnly: boolean; checks: CreditBureauCheck[] }> = ({ appId, readOnly, checks }) => {
  const { user } = useAuth();
  const [checklist, setChecklist] = useState<ChecklistData>({
    ccrisUploaded: false, ctosUploaded: false, noAdverseRecord: false,
    adverseExceptionReason: '', amlScreeningDone: false,
    tickedById: null, tickedAt: null, tickedBy: null,
    verifiedById: null, verifiedAt: null, verifiedBy: null,
  });
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadChecklist = useCallback(async () => {
    const data = await bureauChecklistApi.get(appId);
    if (data) {
      setChecklist({
        ccrisUploaded: data.ccrisUploaded,
        ctosUploaded: data.ctosUploaded,
        noAdverseRecord: data.noAdverseRecord,
        adverseExceptionReason: data.adverseExceptionReason ?? '',
        amlScreeningDone: data.amlScreeningDone,
        tickedById: data.tickedById ?? null,
        tickedAt: data.tickedAt ?? null,
        tickedBy: data.tickedBy ?? null,
        verifiedById: data.verifiedById ?? null,
        verifiedAt: data.verifiedAt ?? null,
        verifiedBy: data.verifiedBy ?? null,
      });
    }
    setLoading(false);
  }, [appId]);

  useEffect(() => { loadChecklist(); }, [loadChecklist]);

  /** Check whether a specific bureau provider has a verified attached doc */
  const hasVerifiedDoc = (providerKey: string): boolean => {
    const provider = CHECKLIST_DOC_PROVIDER[providerKey];
    if (!provider) return true; // amlScreeningDone / noAdverseRecord don't need doc
    const match = checks.find(c => c.provider === provider);
    if (!match) return false;
    if (!match.attachedDocId) return false;
    return match.attachedDoc?.verificationStatus === 'VERIFIED';
  };

  /** Save checklist with error handling for tick enforcement */
  const save = async (updated: ChecklistData) => {
    if (readOnly) return;
    setSaving(true);
    try {
      await bureauChecklistApi.upsert(appId, updated);
      // Re-fetch to get updated verifiedById (cleared on tick change)
      await loadChecklist();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to save checklist';
      toast.error(msg);
      // Revert to server state
      await loadChecklist();
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await bureauChecklistApi.verify(appId);
      toast.success('Bureau checklist verified');
      await loadChecklist();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to verify checklist';
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const isComplete = CHECKLIST_ITEMS.every(i => {
    if (i.key === 'noAdverseRecord') return checklist.noAdverseRecord || Boolean(checklist.adverseExceptionReason);
    return checklist[i.key];
  });
  const isVerified = checklist.verifiedById !== null;
  const canApprove = hasPermission(user, 'credit:approve');
  const isSelfTicked = checklist.tickedById && user?.id === checklist.tickedById;

  if (loading) return null;

  return (
    <CaMemoSection title="S5 Completion Checklist" phase="S5">
      <div className="space-y-2">
        {/* Unverified warning banner */}
        {isComplete && !isVerified && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-800 text-xs">
            <span className="font-semibold">Checklist complete but not verified.</span>
            A supervisor (credit:approve) must verify before committee submission.
          </div>
        )}

        {/* Verified success banner */}
        {isVerified && checklist.verifiedBy && checklist.verifiedAt && (
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-green-300 bg-green-50 text-green-800 text-xs">
            <span className="font-semibold">Verified</span> by {checklist.verifiedBy.firstName} {checklist.verifiedBy.lastName}
            {' '}on {new Date(checklist.verifiedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        )}

        {CHECKLIST_ITEMS.map(item => {
          const needsDoc = CHECKLIST_DOC_PROVIDER[item.key];
          const docReady = hasVerifiedDoc(item.key);
          const isChecked = item.key === 'noAdverseRecord'
            ? checklist.noAdverseRecord || Boolean(checklist.adverseExceptionReason)
            : (checklist as any)[item.key];
          const disabled = readOnly || (needsDoc && !docReady);

          return (
            <label key={item.key} className={`flex items-start gap-2 text-sm ${disabled && !readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={isChecked as boolean}
                disabled={disabled}
                onChange={e => {
                  const updated = { ...checklist, [item.key]: e.target.checked };
                  setChecklist(updated);
                  save(updated);
                }}
                className="mt-0.5"
              />
              <span className={isChecked ? 'text-gray-700' : 'text-gray-500'}>
                {item.label}
                {needsDoc && !docReady && (
                  <span className="ml-1 text-[10px] text-amber-600 font-medium">
                    (upload & verify {bureauProviderLabel(needsDoc)} PDF first)
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {!checklist.noAdverseRecord && (
          <div className="mt-2 pl-5">
            <label className="block text-xs text-gray-500 mb-1">Exception reason (required if adverse record present)</label>
            <textarea
              value={checklist.adverseExceptionReason}
              disabled={readOnly}
              onChange={e => setChecklist(prev => ({ ...prev, adverseExceptionReason: e.target.value }))}
              onBlur={() => save(checklist)}
              rows={2}
              className="w-full border rounded px-3 py-1.5 text-sm"
              placeholder="Document the exception and approver details…"
            />
          </div>
        )}

        {/* Verify button — visible to credit:approve users when complete and not yet verified */}
        {isComplete && !isVerified && canApprove && !readOnly && (
          <div className="mt-3 pt-3 border-t">
            <button
              onClick={handleVerify}
              disabled={verifying || isSelfTicked}
              className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isSelfTicked ? 'You ticked the checklist — a different officer must verify' : undefined}
            >
              {verifying ? 'Verifying…' : 'Verify Checklist (Second Officer)'}
            </button>
            {isSelfTicked && (
              <p className="text-xs text-amber-600 mt-1">
                You ticked the checklist items — a different officer must verify.
              </p>
            )}
          </div>
        )}

        {isComplete && !isVerified && !canApprove && !readOnly && (
          <p className="text-xs text-gray-500 mt-2">
            A supervisor with verification authority must approve this checklist before committee submission.
          </p>
        )}

        {saving && <p className="text-xs text-gray-400 mt-1">Saving…</p>}
      </div>
    </CaMemoSection>
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
      <BureauChecklistPanel appId={application.id} readOnly={readOnly} checks={checks} />
    </>
  );
};

export default CreditChecksTab;