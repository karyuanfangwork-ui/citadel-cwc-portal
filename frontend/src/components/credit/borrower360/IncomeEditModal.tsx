import React, { useEffect, useState } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import creditService from '../../../services/credit.service';
import type { Borrower360Summary } from '../../../services/credit.service';
import toast from 'react-hot-toast';

export interface IncomeEditModalProps {
  borrowerId: string;
  income: NonNullable<Borrower360Summary['income']>['details'] | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type FormState = {
  employmentType: string;
  employerName: string;
  monthlyGrossIncome: string;
  epfMonthlyAmount: string;
  monthlyTaxDeduction: string;
  monthlySocsoDeduction: string;
  hirePurchaseCommitment: string;
  creditCardCommitment: string;
  existingLoanCommitment: string;
  otherCommitments: string;
};

const emptyState: FormState = {
  employmentType: '',
  employerName: '',
  monthlyGrossIncome: '',
  epfMonthlyAmount: '',
  monthlyTaxDeduction: '',
  monthlySocsoDeduction: '',
  hirePurchaseCommitment: '',
  creditCardCommitment: '',
  existingLoanCommitment: '',
  otherCommitments: '',
};

const toNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
};

const displayValue = (value: number | null | undefined) => value == null ? '' : String(value);

const IncomeEditModal: React.FC<IncomeEditModalProps> = ({ borrowerId, income, open, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(income ? {
      employmentType: income.employmentType ?? '',
      employerName: income.employerName ?? '',
      monthlyGrossIncome: displayValue(income.monthlyGrossIncome),
      epfMonthlyAmount: displayValue(income.epfMonthlyAmount),
      monthlyTaxDeduction: displayValue(income.monthlyTaxDeduction),
      monthlySocsoDeduction: displayValue(income.monthlySocsoDeduction),
      hirePurchaseCommitment: displayValue(income.hirePurchaseCommitment),
      creditCardCommitment: displayValue(income.creditCardCommitment),
      existingLoanCommitment: displayValue(income.existingLoanCommitment),
      otherCommitments: displayValue(income.otherCommitments),
    } : emptyState);
    setSaving(false);
    setError(null);
  }, [income, open]);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.monthlyGrossIncome.trim() || toNumber(form.monthlyGrossIncome) == null) {
      setError('Monthly gross income is required.');
      return;
    }
    setSaving(true);
    try {
      const incomeResult = await creditService.updateBorrowerIncome(borrowerId, {
        employmentType: form.employmentType.trim() || null,
        employerName: form.employerName.trim() || null,
        monthlyGrossIncome: Number(form.monthlyGrossIncome || 0),
        epfMonthlyAmount: toNumber(form.epfMonthlyAmount),
        monthlyTaxDeduction: toNumber(form.monthlyTaxDeduction),
        monthlySocsoDeduction: toNumber(form.monthlySocsoDeduction),
        hirePurchaseCommitment: toNumber(form.hirePurchaseCommitment),
        creditCardCommitment: toNumber(form.creditCardCommitment),
        existingLoanCommitment: toNumber(form.existingLoanCommitment),
        otherCommitments: toNumber(form.otherCommitments),
      });

      onSaved();
      const dsrText = [
        incomeResult.dsrPercent != null ? `DSR ${Number(incomeResult.dsrPercent).toFixed(1)}%` : null,
        incomeResult.netDsrPercent != null ? `Net DSR ${Number(incomeResult.netDsrPercent).toFixed(1)}%` : null,
      ].filter(Boolean).join(' · ');
      toast.success(dsrText ? `Saved income profile · ${dsrText}` : 'Saved income profile');
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Failed to save income profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Edit income profile"
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon="save" loading={saving} onClick={handleSubmit}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-fc border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-fc border border-fc-outline bg-fc-surface p-4">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-fc-primary">Income</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Employment Type</span>
              <select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm">
                <option value="">Select employment type</option>
                <option value="SALARIED">Salaried</option>
                <option value="SELF_EMPLOYED">Self-employed</option>
                <option value="COMMISSION_BASED">Commission-based</option>
                <option value="PENSIONER">Pensioner</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Employer Name</span>
              <input value={form.employerName} onChange={(e) => set('employerName', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Monthly Gross Income</span>
              <input type="number" min="0" step="0.01" value={form.monthlyGrossIncome} onChange={(e) => set('monthlyGrossIncome', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
          </div>
        </div>

        <details className="rounded-fc border border-fc-outline bg-fc-surface p-4">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-fc-primary">Deductions &amp; commitments</summary>
          <p className="mt-2 text-xs text-fc-on-variant">Optional details used to calculate gross and net DSR.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">EPF monthly amount (MYR)</span>
              <input type="number" min="0" step="0.01" value={form.epfMonthlyAmount} onChange={(e) => set('epfMonthlyAmount', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Monthly tax deduction (MYR)</span>
              <input type="number" min="0" step="0.01" value={form.monthlyTaxDeduction} onChange={(e) => set('monthlyTaxDeduction', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1"><span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Monthly SOCSO deduction (MYR)</span><input type="number" min="0" step="0.01" value={form.monthlySocsoDeduction} onChange={(e) => set('monthlySocsoDeduction', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Hire purchase commitment (MYR)</span><input type="number" min="0" step="0.01" value={form.hirePurchaseCommitment} onChange={(e) => set('hirePurchaseCommitment', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Credit card commitment (MYR)</span><input type="number" min="0" step="0.01" value={form.creditCardCommitment} onChange={(e) => set('creditCardCommitment', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Existing loan commitment (MYR)</span><input type="number" min="0" step="0.01" value={form.existingLoanCommitment} onChange={(e) => set('existingLoanCommitment', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" /></label>
            <label className="space-y-1"><span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Other commitments (MYR)</span><input type="number" min="0" step="0.01" value={form.otherCommitments} onChange={(e) => set('otherCommitments', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" /></label>
          </div>
        </details>
      </div>
    </Modal>
  );
};

export default IncomeEditModal;
