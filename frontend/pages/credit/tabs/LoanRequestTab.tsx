import React, { useEffect, useMemo, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  FacilityType,
} from '../../../src/services/credit.service';
import {
  formatCurrency,
  getFacilityTypes,
  CURRENCIES,
  PRODUCT_LABELS,
  VISIBLE_FACILITY_TYPES,
} from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import useAutosave from '../../../src/hooks/useAutosave';

// S1 · Loan Request — Core loan structuring fields.
// Extracted from the bank-grade Header & Background + Facilities tabs,
// keeping only: amount, tenor, product type, purpose, currency.

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const LoanRequestTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';

  const [form, setForm] = useState<Partial<CreditApplication>>(application);
  const dirtyKeys = useRef<Set<keyof CreditApplication>>(new Set());

  useEffect(() => { setForm(application); }, [application.id, application.updatedAt]);

  const update = <K extends keyof CreditApplication>(key: K, value: CreditApplication[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    dirtyKeys.current.add(key);
    autosave.markDirty();
  };

  const autosave = useAutosave<CreditApplication>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return application;
      // §F25 — Include version for mandatory OCC
      const payload: Partial<CreditApplication> = { version: application.version };
      dirtyKeys.current.forEach((k) => {
        (payload as any)[k] = (form as any)[k] ?? null;
      });
      dirtyKeys.current.clear();
      const updated = await creditService.updateApplication(application.id, payload);
      onUpdated(updated);
      return updated;
    },
    readOnly,
    debounceMs: 1500,
  });

  useEffect(() => { onDirtyChange?.(autosave.dirty); }, [autosave.dirty, onDirtyChange]);

  return (
    <div className="space-y-6">
      {/* ── Loan Request ──────────────────────────── */}
      <CaMemoSection title="Loan Request" phase="S1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Product Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Product Type *</label>
            <select
              value={form.productType ?? ''}
              onChange={e => update('productType', e.target.value as any)}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Select product type</option>
              {VISIBLE_FACILITY_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Currency *</label>
            <select
              value={form.currency ?? 'MYR'}
              onChange={e => update('currency', e.target.value as any)}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {CURRENCIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Requested Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Requested Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{form.currency || 'MYR'}</span>
              <input
                type="number"
                value={form.requestedAmount ?? ''}
                onChange={e => update('requestedAmount', Number(e.target.value) || null as any)}
                disabled={readOnly}
                className="w-full border border-gray-300 rounded-lg pl-14 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="0"
              />
            </div>
          </div>

          {/* Requested Tenor */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Requested Tenor (months) *</label>
            <input
              type="number"
              value={form.requestedTenor ?? ''}
              onChange={e => update('requestedTenor', Number(e.target.value) || null as any)}
              disabled={readOnly}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="e.g. 60"
            />
          </div>
        </div>

        {/* Purpose */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Purpose *</label>
          <textarea
            value={form.purpose ?? ''}
            onChange={e => update('purpose', e.target.value as any)}
            disabled={readOnly}
            placeholder="Describe the purpose of this loan..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-50 disabled:text-gray-400 resize-none"
          />
        </div>
      </CaMemoSection>

      {/* ── Quick Summary ─────────────────────────── */}
      <CaMemoSection title="Request Summary" phase="S1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Product</div>
            <div className="text-sm font-bold text-gray-900">{PRODUCT_LABELS[form.productType ?? ''] || '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Amount</div>
            <div className="text-sm font-bold text-gray-900">{formatCurrency(form.requestedAmount, form.currency ?? 'MYR')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Tenor</div>
            <div className="text-sm font-bold text-gray-900">{form.requestedTenor ? `${form.requestedTenor} months` : '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Currency</div>
            <div className="text-sm font-bold text-gray-900">{form.currency || 'MYR'}</div>
          </div>
        </div>
      </CaMemoSection>
    </div>
  );
};

export default LoanRequestTab;