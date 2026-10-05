import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../src/context/AuthContext';
import {
  CreditRuleConfigSet,
  RequiredFieldRuleInput,
  creditRuleConfigSetApi,
} from '../src/services/creditRuleConfigSet.service';
import { friendlyMessage } from '../src/utils/errorMessages';

const PRODUCT_TYPES = [
  'TERM_LOAN', 'REVOLVING_FACILITY', 'TRADE_FINANCE', 'OVERDRAFT',
  'PROJECT_FINANCE', 'SYNDICATED', 'BRIDGING', 'HIRE_PURCHASE',
];
const LANES = ['PERSONAL_FAST', 'SME', 'CORPORATE'];
const BORROWER_TYPES = ['INDIVIDUAL', 'SOLE_PROPRIETOR', 'JOINT', 'CORPORATE'];

const BASELINE_RULES: RequiredFieldRuleInput[] = [
  { fieldPath: 'productType', fieldLabel: 'Credit product', isMandatory: true, sortOrder: 10 },
  { fieldPath: 'requestedAmount', fieldLabel: 'Requested amount', isMandatory: true, sortOrder: 20 },
  { fieldPath: 'currency', fieldLabel: 'Currency', isMandatory: true, sortOrder: 30 },
  { fieldPath: 'purpose', fieldLabel: 'Loan purpose', isMandatory: true, sortOrder: 40 },
];

const CreditRequiredFieldAdmin: React.FC = () => {
  const { user } = useAuth();
  const [sets, setSets] = useState<CreditRuleConfigSet[]>([]);
  const [rules, setRules] = useState<RequiredFieldRuleInput[]>(BASELINE_RULES);
  const [reason, setReason] = useState('');
  const [approvalReferences, setApprovalReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setSets(await creditRuleConfigSetApi.list());
    } catch (error) {
      toast.error(friendlyMessage(error, 'Failed to load required-field rule sets'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const updateRule = (index: number, patch: Partial<RequiredFieldRuleInput>) => {
    setRules((current) => current.map((rule, i) => i === index ? { ...rule, ...patch } : rule));
  };

  const createDraft = async () => {
    try {
      setSaving(true);
      await creditRuleConfigSetApi.create({ reason: reason.trim(), rules });
      setReason('');
      toast.success('Draft rule set created. It is inactive and does not affect validation.');
      await refresh();
    } catch (error) {
      toast.error(friendlyMessage(error, 'Failed to create draft rule set'));
    } finally {
      setSaving(false);
    }
  };

  const transition = async (
    operation: (id: string) => Promise<CreditRuleConfigSet>,
    id: string,
    message: string,
  ) => {
    try {
      setSaving(true);
      await operation(id);
      toast.success(message);
      await refresh();
    } catch (error) {
      toast.error(friendlyMessage(error, 'Rule-set transition failed'));
    } finally {
      setSaving(false);
    }
  };

  const activate = async (set: CreditRuleConfigSet) => {
    const reference = (approvalReferences[set.id] ?? '').trim();
    if (reference.length < 5) {
      toast.error('Enter the credit-policy approval reference before activation.');
      return;
    }
    if (!window.confirm(`Activate approved required-field rule set v${set.version}? This changes live application validation.`)) return;
    try {
      setSaving(true);
      await creditRuleConfigSetApi.activate(set.id, reference);
      toast.success('Rule set activated.');
      await refresh();
    } catch (error) {
      toast.error(friendlyMessage(error, 'Rule-set activation failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Required-field Rules</h1>
        <p className="mt-1 text-sm text-gray-600">
          Versioned rules activate only after maker/checker review. Draft and submitted sets do not affect application validation.
        </p>
      </header>

      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Confirm policy-owner sign-off for the required fields and scopes before approval or activation. Activation records the approval reference and affects live validation.
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Create a draft version</h2>
            <p className="text-xs text-gray-500">The canonical fields are prefilled as a reviewable starting point; they are not approved policy.</p>
          </div>
          <button
            type="button"
            onClick={() => setRules((current) => [...current, { fieldPath: '', fieldLabel: '', isMandatory: true, sortOrder: current.length * 10 + 10 }])}
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Add field
          </button>
        </div>

        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div key={`${index}-${rule.fieldPath}`} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 md:grid-cols-6">
              <input aria-label={`Field path ${index + 1}`} value={rule.fieldPath} onChange={(event) => updateRule(index, { fieldPath: event.target.value })} placeholder="Payload field path" className="rounded border border-gray-300 px-2 py-2 text-sm md:col-span-2" />
              <input aria-label={`Field label ${index + 1}`} value={rule.fieldLabel} onChange={(event) => updateRule(index, { fieldLabel: event.target.value })} placeholder="Display label" className="rounded border border-gray-300 px-2 py-2 text-sm md:col-span-2" />
              <select aria-label={`Product scope ${index + 1}`} value={rule.productType ?? ''} onChange={(event) => updateRule(index, { productType: event.target.value || null })} className="rounded border border-gray-300 px-2 py-2 text-sm">
                <option value="">All products</option>
                {PRODUCT_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label={`Lane scope ${index + 1}`} value={rule.lane ?? ''} onChange={(event) => updateRule(index, { lane: event.target.value || null })} className="rounded border border-gray-300 px-2 py-2 text-sm">
                <option value="">All lanes</option>
                {LANES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label={`Borrower scope ${index + 1}`} value={rule.borrowerType ?? ''} onChange={(event) => updateRule(index, { borrowerType: event.target.value || null })} className="rounded border border-gray-300 px-2 py-2 text-sm">
                <option value="">All borrower types</option>
                {BORROWER_TYPES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input type="checkbox" checked={rule.isMandatory} onChange={(event) => updateRule(index, { isMandatory: event.target.checked })} />
                Mandatory
              </label>
              <input aria-label={`Sort order ${index + 1}`} type="number" min={0} value={rule.sortOrder} onChange={(event) => updateRule(index, { sortOrder: Number(event.target.value) })} className="rounded border border-gray-300 px-2 py-2 text-sm" />
              <button type="button" onClick={() => setRules((current) => current.filter((_, i) => i !== index))} className="text-left text-sm text-red-700 hover:underline">Remove field</button>
            </div>
          ))}
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Change reason
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Explain the requested policy change and review scope." />
        </label>
        <button type="button" disabled={saving || reason.trim().length < 5 || rules.length === 0} onClick={createDraft} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Create inactive draft
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Rule-set lifecycle</h2>
          <button type="button" onClick={() => void refresh()} disabled={loading || saving} className="text-sm text-brand-700 hover:underline">Refresh</button>
        </div>
        {loading ? <p className="text-sm text-gray-500">Loading rule sets…</p> : sets.length === 0 ? (
          <p className="text-sm text-gray-500">No governed rule sets yet. Existing rules are not modified by this page.</p>
        ) : (
          <div className="space-y-4">
            {sets.map((set) => {
              const isMaker = user?.id === set.createdById;
              const isChecker = user?.id === set.approvedById;
              const canSubmit = set.status === 'DRAFT' && isMaker;
              const canApprove = set.status === 'SUBMITTED' && !isMaker && user?.id !== set.submittedById;
              const canActivate = set.status === 'APPROVED' && !isMaker && !isChecker && user?.id !== set.submittedById;
              return (
                <article key={set.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{set.name} v{set.version}</h3>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${set.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : set.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>{set.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600">{set.rules.length} rules · Maker {set.createdById} · {set.reason}</p>
                      {set.approvedById && <p className="mt-1 text-xs text-gray-500">Checker {set.approvedById}{set.policyApprovalReference ? ` · Approval ref ${set.policyApprovalReference}` : ''}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canSubmit && <button disabled={saving} onClick={() => void transition(creditRuleConfigSetApi.submit, set.id, 'Rule set submitted for independent review.')} className="rounded bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit</button>}
                      {canApprove && <button disabled={saving} onClick={() => void transition(creditRuleConfigSetApi.approve, set.id, 'Rule set approved. Activation remains a separate step.')} className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button>}
                    </div>
                  </div>
                  {canActivate && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                      <label className="min-w-64 flex-1 text-xs font-medium text-gray-700">
                        Policy-owner approval reference
                        <input value={approvalReferences[set.id] ?? ''} onChange={(event) => setApprovalReferences((current) => ({ ...current, [set.id]: event.target.value }))} maxLength={200} className="mt-1 block w-full rounded border border-gray-300 px-2 py-2 text-sm" placeholder="Approval record or signed decision reference" />
                      </label>
                      <button disabled={saving || (approvalReferences[set.id] ?? '').trim().length < 5} onClick={() => void activate(set)} className="rounded bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Activate</button>
                    </div>
                  )}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead><tr className="border-b border-gray-100 text-gray-500"><th className="py-2 pr-3">Field</th><th className="py-2 pr-3">Scope</th><th className="py-2 pr-3">Required</th><th className="py-2">Runtime</th></tr></thead>
                      <tbody>{set.rules.map((rule) => (
                        <tr key={rule.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3"><span className="font-mono">{rule.fieldPath}</span><span className="ml-2 text-gray-500">{rule.fieldLabel}</span></td>
                          <td className="py-2 pr-3">{[rule.productType, rule.lane, rule.borrowerType].filter(Boolean).join(' · ') || 'Global'}</td>
                          <td className="py-2 pr-3">{rule.isMandatory ? 'Yes' : 'No'}</td>
                          <td className="py-2">{rule.isActive ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default CreditRequiredFieldAdmin;
