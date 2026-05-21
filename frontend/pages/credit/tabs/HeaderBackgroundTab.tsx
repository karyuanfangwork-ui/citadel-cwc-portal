import React, { useEffect, useMemo, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  ApplicationType,
  AccountClassification,
  AccountStrategy,
} from '../../../src/services/credit.service';
import {
  APPLICATION_TYPE_OPTIONS,
  ACCOUNT_CLASSIFICATION_OPTIONS,
  ACCOUNT_STRATEGY_OPTIONS,
} from '../../../src/constants/creditEnums';
import AutosaveTextField from '../../../src/components/credit/AutosaveTextField';

// CA Memo Phase 1 — Sections 1 (Header), 2 (Preamble), 4 (Matters to Highlight),
// 6 (Transaction Details). Renders editable fields with debounced autosave on
// blur. Read-only when application is no longer in DRAFT.

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

const isoToInput = (v: string | null | undefined): string =>
  v ? v.slice(0, 10) : '';

const HeaderBackgroundTab: React.FC<Props> = ({ application, onUpdated }) => {
  const readOnly = application.state !== 'DRAFT';
  const isIndividual = application.borrowerProfile?.borrowerType === 'INDIVIDUAL';

  // Local working copy — synced on prop change.
  const [form, setForm] = useState<Partial<CreditApplication>>(application);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dirtyKeys = useRef<Set<keyof CreditApplication>>(new Set());

  useEffect(() => { setForm(application); }, [application.id, application.updatedAt]);

  const update = <K extends keyof CreditApplication>(key: K, value: CreditApplication[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    dirtyKeys.current.add(key);
  };

  const flush = async () => {
    if (readOnly || dirtyKeys.current.size === 0) return;
    const payload: Partial<CreditApplication> = {};
    dirtyKeys.current.forEach((k) => {
      (payload as any)[k] = (form as any)[k] ?? null;
    });
    dirtyKeys.current.clear();
    setSaving(true);
    setError(null);
    try {
      const updated = await creditService.updateApplication(application.id, payload);
      setSavedAt(new Date());
      onUpdated(updated);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const completion = useMemo(() => {
    const required: (keyof CreditApplication)[] = ['applicationType', 'accountClassification'];
    return required.every((k) => form[k] != null && form[k] !== '');
  }, [form.applicationType, form.accountClassification]);

  return (
    <div className="space-y-6">
      {/* Save status bar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2 text-xs">
        <div className="flex items-center gap-3">
          <span className={`inline-block w-2 h-2 rounded-full ${completion ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-text-secondary">
            {completion ? 'Required header fields complete' : 'Application Type & Classification required to submit'}
          </span>
        </div>
        <div className="text-text-secondary">
          {readOnly && <span className="text-amber-700">Read-only — application not in DRAFT</span>}
          {saving && <span>Saving…</span>}
          {!saving && savedAt && <span>Saved {savedAt.toLocaleTimeString()}</span>}
          {error && <span className="text-red-600">{error}</span>}
        </div>
      </div>

      {/* Section 1 — Header */}
      <section className="bg-white border border-gray-200 rounded">
        <header className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-text-primary">Section 1 — Credit Application Header</h3>
        </header>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Customer Name</label>
            <input className="w-full rounded border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-text-secondary" disabled value={application.borrowerProfile?.account?.name ?? (application.borrowerProfile?.contact ? `${application.borrowerProfile.contact.firstName} ${application.borrowerProfile.contact.lastName}` : '—')} />
          </div>
          {!isIndividual && (
            <AutosaveTextField label="Customer Group" value={form.customerGroupName} onChange={(v) => update('customerGroupName', v)} onSave={flush} disabled={readOnly} />
          )}
          <AutosaveTextField label="CIF No" value={form.cifNo} onChange={(v) => update('cifNo', v)} onSave={flush} disabled={readOnly} />
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Application Type <span className="text-red-500">*</span></label>
            <select className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-gray-50 disabled:text-text-secondary" disabled={readOnly}
              value={form.applicationType ?? ''}
              onChange={(e) => { update('applicationType', (e.target.value || null) as ApplicationType | null); }}
              onBlur={flush}
            >
              <option value="">— Select —</option>
              {APPLICATION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <AutosaveTextField label="Originating Department" value={form.originatingDepartment} onChange={(v) => update('originatingDepartment', v)} onSave={flush} disabled={readOnly} />
          <AutosaveTextField label="Team Lead Name" value={form.teamLeadName} onChange={(v) => update('teamLeadName', v)} onSave={flush} disabled={readOnly} />
          <AutosaveTextField label="Referred By" value={form.referredBy} onChange={(v) => update('referredBy', v)} onSave={flush} disabled={readOnly} />
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Account Classification <span className="text-red-500">*</span></label>
            <select className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-gray-50 disabled:text-text-secondary" disabled={readOnly}
              value={form.accountClassification ?? ''}
              onChange={(e) => update('accountClassification', (e.target.value || null) as AccountClassification | null)}
              onBlur={flush}
            >
              <option value="">— Select —</option>
              {ACCOUNT_CLASSIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Account Strategy</label>
            <select className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:bg-gray-50 disabled:text-text-secondary" disabled={readOnly}
              value={form.accountStrategy ?? ''}
              onChange={(e) => update('accountStrategy', (e.target.value || null) as AccountStrategy | null)}
              onBlur={flush}
            >
              <option value="">— Select —</option>
              {ACCOUNT_STRATEGY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={readOnly}
                checked={!!form.connectedPartyFlag}
                onChange={(e) => { update('connectedPartyFlag', e.target.checked); }}
                onBlur={flush}
              />
              <span className="font-semibold text-text-primary">Connected Party</span>
              <span className="text-text-secondary text-xs">(Borrower connected to bank staff or director)</span>
            </label>
            {form.connectedPartyFlag && (
              <AutosaveTextField label="Staff / Connected Person Name" value={form.connectedPartyStaffName} onChange={(v) => update('connectedPartyStaffName', v)} onSave={flush} disabled={readOnly} className="mt-2" />
            )}
          </div>

          {/* Dates row */}
          <AutosaveTextField label="Complete Docs Received" type="date" value={form.completeDocsDate} onChange={(v) => update('completeDocsDate', v)} onSave={flush} disabled={readOnly} />
          <AutosaveTextField label="Last Review Date" type="date" value={form.lastReviewDate} onChange={(v) => update('lastReviewDate', v)} onSave={flush} disabled={readOnly} />
          <AutosaveTextField label="Next Review Date" type="date" value={form.nextReviewDate} onChange={(v) => update('nextReviewDate', v)} onSave={flush} disabled={readOnly} />
          <AutosaveTextField label="Relationship Since" type="date" value={form.relationshipSince} onChange={(v) => update('relationshipSince', v)} onSave={flush} disabled={readOnly} />
          <AutosaveTextField label="Last Site Visit" type="date" value={form.lastSiteVisitDate} onChange={(v) => update('lastSiteVisitDate', v)} onSave={flush} disabled={readOnly} />
        </div>
      </section>

      {/* Section 2 — Preamble */}
      <section className="bg-white border border-gray-200 rounded">
        <header className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-text-primary">Section 2 — Preamble / Background</h3>
        </header>
        <div className="p-4">
          <AutosaveTextField label="Preamble / Background" value={form.preambleText} onChange={(v) => update('preambleText', v)} onSave={flush} disabled={readOnly} multiline minRows={5} placeholder="Provide background context, history of the relationship, and overall narrative for this application." />
        </div>
      </section>

      {/* Section 4 — Matters to Highlight */}
      <section className="bg-white border border-gray-200 rounded">
        <header className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-text-primary">Section 4 — Matters to Highlight</h3>
        </header>
        <div className="p-4">
          <AutosaveTextField label="Matters to Highlight" value={form.mattersToHighlight} onChange={(v) => update('mattersToHighlight', v)} onSave={flush} disabled={readOnly} multiline minRows={4} placeholder="Key matters reviewers need to be aware of (covenants, exceptions, deviations, escalations)." />
        </div>
      </section>

      {/* Section 6 — Transaction Details */}
      <section className="bg-white border border-gray-200 rounded">
        <header className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-text-primary">Section 6 — Details of Transaction(s) / Updates</h3>
        </header>
        <div className="p-4">
          <AutosaveTextField label="Details of Transaction(s)" value={form.transactionDetailsText} onChange={(v) => update('transactionDetailsText', v)} onSave={flush} disabled={readOnly} multiline minRows={5} placeholder="Describe the transactions / updates being requested in this memo." />
        </div>
      </section>
    </div>
  );
};

export default HeaderBackgroundTab;