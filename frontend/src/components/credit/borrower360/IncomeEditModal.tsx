import React, { useEffect, useState } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import creditService from '../../../services/credit.service';
import toast from 'react-hot-toast';

export interface IncomeEditModalProps {
  borrowerId: string;
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
  creditScore: string;
  scoreSource: 'CTOS' | 'MANUAL' | '';
  scoreAsOf: string;
  riskGrade: string;
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
  creditScore: '',
  scoreSource: '',
  scoreAsOf: '',
  riskGrade: '',
};

const toNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
};

const IncomeEditModal: React.FC<IncomeEditModalProps> = ({ borrowerId, open, onClose, onSaved }) => {
  const [form, setForm] = useState<FormState>(emptyState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(emptyState);
    setSaving(false);
    setError(null);
  }, [open]);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
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

      const scoreAsOf = form.scoreAsOf ? new Date(form.scoreAsOf).toISOString() : null;
      const creditResult = await creditService.updateBorrowerCreditProfile(borrowerId, {
        creditScore: form.creditScore.trim() ? Number(form.creditScore) : null,
        scoreSource: form.scoreSource || null,
        scoreAsOf,
        riskGrade: form.riskGrade.trim() || null,
      });

      onSaved();
      const dsrText = [
        incomeResult.dsrPercent != null ? `DSR ${Number(incomeResult.dsrPercent).toFixed(1)}%` : null,
        incomeResult.netDsrPercent != null ? `Net DSR ${Number(incomeResult.netDsrPercent).toFixed(1)}%` : null,
        creditResult.creditScore != null ? `Score ${creditResult.creditScore}` : null,
      ].filter(Boolean).join(' · ');
      toast.success(dsrText ? `Saved borrower income and credit profile · ${dsrText}` : 'Saved borrower income and credit profile');
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Failed to save income / credit profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Edit Income & Credit Profile"
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
              <input value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Employer Name</span>
              <input value={form.employerName} onChange={(e) => set('employerName', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Monthly Gross Income</span>
              <input type="number" min="0" step="0.01" value={form.monthlyGrossIncome} onChange={(e) => set('monthlyGrossIncome', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">EPF Monthly Amount</span>
              <input type="number" min="0" step="0.01" value={form.epfMonthlyAmount} onChange={(e) => set('epfMonthlyAmount', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Monthly Tax Deduction</span>
              <input type="number" min="0" step="0.01" value={form.monthlyTaxDeduction} onChange={(e) => set('monthlyTaxDeduction', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Monthly SOCSO Deduction</span>
              <input type="number" min="0" step="0.01" value={form.monthlySocsoDeduction} onChange={(e) => set('monthlySocsoDeduction', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Hire Purchase Commitment</span>
              <input type="number" min="0" step="0.01" value={form.hirePurchaseCommitment} onChange={(e) => set('hirePurchaseCommitment', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Credit Card Commitment</span>
              <input type="number" min="0" step="0.01" value={form.creditCardCommitment} onChange={(e) => set('creditCardCommitment', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Existing Loan Commitment</span>
              <input type="number" min="0" step="0.01" value={form.existingLoanCommitment} onChange={(e) => set('existingLoanCommitment', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Other Commitments</span>
              <input type="number" min="0" step="0.01" value={form.otherCommitments} onChange={(e) => set('otherCommitments', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
          </div>
        </div>

        <div className="rounded-fc border border-fc-outline bg-fc-surface p-4">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-fc-primary">Credit Profile</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Credit Score</span>
              <input type="number" min="0" max="999" step="1" value={form.creditScore} onChange={(e) => set('creditScore', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Score Source</span>
              <select value={form.scoreSource} onChange={(e) => set('scoreSource', e.target.value as FormState['scoreSource'])} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm">
                <option value="">Unset</option>
                <option value="CTOS">CTOS</option>
                <option value="MANUAL">Manual</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Score As Of</span>
              <input type="date" value={form.scoreAsOf} onChange={(e) => set('scoreAsOf', e.target.value)} className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Risk Grade</span>
              <input type="text" value={form.riskGrade} onChange={(e) => set('riskGrade', e.target.value)} placeholder="A / BBB / watch" className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default IncomeEditModal;
