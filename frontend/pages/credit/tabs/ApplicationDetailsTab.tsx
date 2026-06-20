import React, { useCallback, useEffect, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditFacility,
  RequestItem,
} from '../../../src/services/credit.service';
import {
  formatCurrency,
  PRODUCT_LABELS,
  VISIBLE_SECURED_PRODUCTS,
  REPAYMENT_TYPE_OPTIONS,
  REPAYMENT_FREQUENCY_OPTIONS,
} from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';
import LoanRequestTab from './LoanRequestTab';
import RequestsFacilitiesTab from './sections/RequestsFacilitiesTab';
import RetailFacilitiesTab from './sections/RetailFacilitiesTab';

interface ApplicationDetailsTabProps {
  application: CreditApplication;
  onUpdated: (app: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  advancedMemo?: boolean;
}

// ── FieldRow: reusable label/value row with empty-state ──────────────────────

const FieldRow: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
}> = ({ label, value, hint }) => {
  const isEmpty = value === null || value === undefined || value === '' || value === '—';
  return (
    <div className="flex flex-col py-1.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className={`text-sm mt-0.5 ${isEmpty ? 'text-gray-300' : 'text-gray-900 font-medium'}`}>
        {isEmpty ? '—' : value}
      </span>
      {hint && <span className="text-[10px] text-gray-400 mt-0.5">{hint}</span>}
    </div>
  );
};

// ── Facility Structuring Card ────────────────────────────────────────────────
// Renders pricing + structuring fields for a single facility.
// Editable in DRAFT, read-only otherwise. Autosaves per-field.

type FacilityCardProps = {
  facility: CreditFacility;
  readOnly: boolean;
  index: number;
  currency: string;
  onSave: (id: string, patch: Partial<CreditFacility>) => Promise<void>;
};

const FacilityStructuringCard: React.FC<FacilityCardProps> = ({ facility, readOnly, index, currency, onSave }) => {
  const [form, setForm] = useState<Partial<CreditFacility>>(facility);
  const [showStructuring, setShowStructuring] = useState(false);
  const dirtyKeys = useRef<Set<keyof CreditFacility>>(new Set());

  useEffect(() => { setForm(facility); }, [facility.id, facility.updatedAt]);

  const update = <K extends keyof CreditFacility>(key: K, value: CreditFacility[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    dirtyKeys.current.add(key);
    autosave.markDirty();
  };

  const autosave = useAutosave<CreditFacility>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return facility;
      const patch: Partial<CreditFacility> = {};
      dirtyKeys.current.forEach(k => { (patch as any)[k] = (form as any)[k] ?? null; });
      dirtyKeys.current.clear();
      await onSave(facility.id, patch);
      return { ...facility, ...form };
    },
    readOnly,
    debounceMs: 1500,
  });

  const isSecured = VISIBLE_SECURED_PRODUCTS.includes(facility.facilityType);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Card header — facility type + pricing summary */}
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-400">F{index + 1}</span>
          <span className="text-sm font-bold text-gray-900">
            {PRODUCT_LABELS[facility.facilityType] ?? facility.facilityType}
          </span>
          {facility.pricingLabel && (
            <span className="text-xs text-gray-500">{facility.pricingLabel}</span>
          )}
        </div>
        <button
          onClick={() => setShowStructuring(s => !s)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showStructuring ? '▾ Hide Structuring' : '▸ Show Structuring'}
        </button>
      </div>

      {/* Always-visible pricing row */}
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 border-b border-gray-100">
        <FieldRow label="Pricing" value={facility.pricingLabel ?? '—'} />
        <FieldRow label="Rate (%)" value={facility.ratePct != null ? `${Number(facility.ratePct).toFixed(2)}%` : '—'} />
        <FieldRow label="Approved Rate" value={facility.approvedRate != null ? `${Number(facility.approvedRate).toFixed(2)}%` : '—'} />
        <FieldRow label="Tenor" value={facility.tenorMonths ? `${facility.tenorMonths} months` : '—'} />
      </div>

      {/* Expandable structuring section */}
      {showStructuring && (
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
            {/* Repayment Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Repayment Type</label>
              <select
                value={form.repaymentType ?? ''}
                onChange={e => update('repaymentType', e.target.value || null)}
                disabled={readOnly}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">—</option>
                {REPAYMENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* Repayment Frequency */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Repayment Frequency</label>
              <select
                value={form.repaymentFrequency ?? ''}
                onChange={e => update('repaymentFrequency', e.target.value || null)}
                disabled={readOnly}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">—</option>
                {REPAYMENT_FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* Source of Repayment */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Source of Repayment</label>
              <input
                type="text"
                value={form.sourceOfRepayment ?? ''}
                onChange={e => update('sourceOfRepayment', e.target.value || null)}
                disabled={readOnly}
                placeholder="e.g. Business cashflow, rental income"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            {/* Security Requirement */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Security Requirement</label>
              <input
                type="text"
                value={form.securityRequirement ?? ''}
                onChange={e => update('securityRequirement', e.target.value || null)}
                disabled={readOnly}
                placeholder={isSecured ? 'e.g. Property, FD charge' : 'Unsecured'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
          {/* Recommended Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Recommended Amount</label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currency}</span>
              <input
                type="number"
                value={form.recommendedAmount ?? ''}
                onChange={e => update('recommendedAmount', e.target.value ? Number(e.target.value) : null)}
                disabled={readOnly}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg pl-14 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main tab component ──────────────────────────────────────────────────────

const ApplicationDetailsTab: React.FC<ApplicationDetailsTabProps> = ({
  application,
  onUpdated,
  onDirtyChange,
  advancedMemo,
}) => {
  const LOCKED_STATES = new Set(['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED', 'CONDITION_FULFILMENT', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN']);
  const readOnly = LOCKED_STATES.has(application.state ?? '');
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [facs, items] = await Promise.all([
        creditService.listFacilities(application.id),
        creditService.listRequestItems(application.id),
      ]);
      setFacilities(facs);
      setRequestItems(items);
    } finally {
      setLoading(false);
    }
  }, [application.id]);

  useEffect(() => { load(); }, [load]);

  const handleFacilitySave = async (id: string, patch: Partial<CreditFacility>) => {
    const updated = await creditService.updateFacility(id, patch);
    setFacilities(fs => fs.map(f => f.id === id ? { ...f, ...updated } : f));
  };

  // Compute recommendation summary from first facility + first request item
  const firstFacility = facilities[0];
  const firstRequestItem = requestItems[0];
  const recommendedAmount = firstFacility?.recommendedAmount ?? firstFacility?.approvedAmount ?? null;
  const officerJustification = firstRequestItem?.rationale ?? null;

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Core Request ─────────────────────────────────────── */}
      <CaMemoSection title="Core Request" phase="S1">
        <LoanRequestTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
      </CaMemoSection>

      {/* ── Section 2: Facilities ───────────────────────────────────────── */}
      <CaMemoSection title="Facilities" phase="S1">
        <RetailFacilitiesTab application={application} onDirtyChange={onDirtyChange} />
      </CaMemoSection>

      {/* ── Section 3: Structuring & Pricing (only when facilities exist) ── */}
      {facilities.length > 0 && (
        <CaMemoSection title="Structuring & Pricing" phase="S1">
          <div className="space-y-3">
            {facilities.map((f, i) => (
              <FacilityStructuringCard
                key={f.id}
                facility={f}
                readOnly={readOnly}
                index={i}
                currency={application.currency ?? 'MYR'}
                onSave={handleFacilitySave}
              />
            ))}
          </div>
        </CaMemoSection>
      )}

      {/* ── Section 3: Recommendation & Justification ────────────────────── */}
      <CaMemoSection title="Recommendation & Justification" phase="S1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          <FieldRow
            label="Recommended Amount"
            value={recommendedAmount != null
              ? formatCurrency(recommendedAmount, application.currency ?? 'MYR')
              : '—'}
            hint={firstFacility?.recommendedAmount != null
              ? 'From facility recommended amount'
              : firstFacility?.approvedAmount != null
                ? 'From facility approved amount'
                : undefined}
          />
          <FieldRow
            label="Approving Level"
            value={firstFacility?.approvingLevel ?? firstRequestItem?.approvingLevel ?? '—'}
          />
        </div>
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-1.5">Officer Justification</div>
          <div className={`text-sm leading-relaxed p-3 rounded-lg bg-gray-50 border border-gray-100 ${
            officerJustification ? 'text-gray-700' : 'text-gray-300 italic'
          }`}>
            {officerJustification || '— No officer justification recorded. Add a request item rationale to populate this field. —'}
          </div>
        </div>
      </CaMemoSection>

      {/* ── Advanced: Facilities & CA Memo (existing, feature-flagged) ──── */}
      {advancedMemo && (
        <CaMemoSection title="Facilities & CA Memo" phase="Phase 2">
          <RequestsFacilitiesTab application={application} onDirtyChange={onDirtyChange} />
        </CaMemoSection>
      )}
    </div>
  );
};

export default ApplicationDetailsTab;