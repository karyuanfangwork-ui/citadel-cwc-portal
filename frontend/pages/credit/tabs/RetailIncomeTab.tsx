import React, { useEffect, useState } from 'react';
import { retailIncomeApi } from '../../../src/services/credit.service';

interface Props {
  applicationId: string;
  readOnly?: boolean;
  onSaved?: () => void;
}

const EMPLOYMENT_TYPES = [
  { value: 'SALARIED', label: 'Salaried (Employed)' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
  { value: 'COMMISSION_BASED', label: 'Commission-Based' },
  { value: 'PENSIONER', label: 'Pensioner' },
];

function DsrBadge({ dsr }: { dsr: number }) {
  const status = dsr <= 60 ? 'pass' : dsr <= 70 ? 'warning' : 'fail';
  const styles = {
    pass: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    fail: 'bg-red-100 text-red-700',
  };
  const labels = {
    pass: `DSR ${dsr.toFixed(1)}% — Pass`,
    warning: `DSR ${dsr.toFixed(1)}% — Warning (>60%)`,
    fail: `DSR ${dsr.toFixed(1)}% — Exceeds 70% limit`,
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

type FormState = {
  employmentType: string;
  employerName: string;
  monthlyGrossIncome: string;
  epfMonthlyAmount: string;
  hirePurchaseCommitment: string;
  creditCardCommitment: string;
  existingLoanCommitment: string;
  otherCommitments: string;
  proposedInstalment: string;
};

export default function RetailIncomeTab({ applicationId, readOnly, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({
    employmentType: 'SALARIED',
    employerName: '',
    monthlyGrossIncome: '',
    epfMonthlyAmount: '',
    hirePurchaseCommitment: '',
    creditCardCommitment: '',
    existingLoanCommitment: '',
    otherCommitments: '',
    proposedInstalment: '',
  });
  const [dsr, setDsr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    retailIncomeApi.get(applicationId).then((data) => {
      if (data) {
        setForm({
          employmentType: data.employmentType,
          employerName: data.employerName ?? '',
          monthlyGrossIncome: data.monthlyGrossIncome,
          epfMonthlyAmount: data.epfMonthlyAmount ?? '',
          hirePurchaseCommitment: data.hirePurchaseCommitment,
          creditCardCommitment: data.creditCardCommitment,
          existingLoanCommitment: data.existingLoanCommitment,
          otherCommitments: data.otherCommitments,
          proposedInstalment: data.proposedInstalment ?? '',
        });
        if (data.dsrPercent) setDsr(Number(data.dsrPercent));
      }
      setLoading(false);
    });
  }, [applicationId]);

  // Live DSR computation
  useEffect(() => {
    const gross = Number(form.monthlyGrossIncome) || 0;
    if (gross <= 0) { setDsr(null); return; }
    const total =
      (Number(form.hirePurchaseCommitment) || 0) +
      (Number(form.creditCardCommitment) || 0) +
      (Number(form.existingLoanCommitment) || 0) +
      (Number(form.otherCommitments) || 0) +
      (Number(form.proposedInstalment) || 0);
    setDsr(Math.round((total / gross) * 1000) / 10);
  }, [
    form.monthlyGrossIncome,
    form.hirePurchaseCommitment,
    form.creditCardCommitment,
    form.existingLoanCommitment,
    form.otherCommitments,
    form.proposedInstalment,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await retailIncomeApi.upsert(applicationId, {
        employmentType: form.employmentType,
        employerName: form.employerName || undefined,
        monthlyGrossIncome: Number(form.monthlyGrossIncome),
        epfMonthlyAmount: form.epfMonthlyAmount ? Number(form.epfMonthlyAmount) : undefined,
        hirePurchaseCommitment: Number(form.hirePurchaseCommitment) || 0,
        creditCardCommitment: Number(form.creditCardCommitment) || 0,
        existingLoanCommitment: Number(form.existingLoanCommitment) || 0,
        otherCommitments: Number(form.otherCommitments) || 0,
        proposedInstalment: form.proposedInstalment ? Number(form.proposedInstalment) : undefined,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof FormState, type = 'number', prefix?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-2 text-sm text-gray-400">{prefix}</span>}
        <input
          type={type}
          value={form[key]}
          disabled={readOnly}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
          className={`w-full border rounded-md px-3 py-2 text-sm ${prefix ? 'pl-8' : ''} disabled:bg-gray-50`}
          min={0}
        />
      </div>
    </div>
  );

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-6 p-1 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">Individual borrower income and commitment assessment</p>
        </div>
        {dsr !== null && <DsrBadge dsr={dsr} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Employment Type</label>
          <select
            value={form.employmentType}
            disabled={readOnly}
            onChange={(e) => setForm((prev) => ({ ...prev, employmentType: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {field('Employer Name', 'employerName', 'text')}
        {field('Monthly Gross Income', 'monthlyGrossIncome', 'number', 'RM')}
        {field('EPF Monthly Contribution', 'epfMonthlyAmount', 'number', 'RM')}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Commitments</h4>
        <div className="grid grid-cols-2 gap-4">
          {field('Hire Purchase / Car Loans', 'hirePurchaseCommitment', 'number', 'RM')}
          {field('Credit Card (min. payment)', 'creditCardCommitment', 'number', 'RM')}
          {field('Existing Personal Loans', 'existingLoanCommitment', 'number', 'RM')}
          {field('Other Obligations', 'otherCommitments', 'number', 'RM')}
          {field('Proposed Monthly Instalment', 'proposedInstalment', 'number', 'RM')}
        </div>
      </div>

      {dsr !== null && dsr > 60 && (
        <div className={`rounded-md p-3 text-sm ${dsr > 70 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {dsr > 70
            ? 'DSR exceeds 70% — submission is blocked. Reduce commitments or increase income, or obtain credit manager override.'
            : 'DSR is between 60–70% — submission requires a documented exception reason.'}
        </div>
      )}

      {!readOnly && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Income Assessment'}
        </button>
      )}
    </div>
  );
}
