import React, { useEffect, useState, useRef } from 'react';
import { retailIncomeApi } from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import CalculationBreakdownPanel, { RatioBreakdown } from '../../../src/components/credit/CalculationBreakdownPanel';

interface Props {
  applicationId: string;
  readOnly?: boolean;
  onSaved?: () => void;
}

const EMPLOYMENT_TYPES = [
  { value: 'SALARIED', label: 'Salaried (Employed)', icon: 'badge' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed', icon: 'store' },
  { value: 'COMMISSION_BASED', label: 'Commission-Based', icon: 'trending_up' },
  { value: 'PENSIONER', label: 'Pensioner', icon: 'elderly' },
];

const EMPLOYMENT_STATUS = [
  'PERMANENT',
  'PROBATION',
  'CONTRACT',
  'RETIRED',
] as const;

function DsrBadge({ dsr }: { dsr: number }) {
  const status = dsr <= 60 ? 'pass' : dsr <= 70 ? 'warning' : 'fail';
  const styles = {
    pass: 'bg-green-100 text-green-700 border-green-200',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    fail: 'bg-red-100 text-red-700 border-red-200',
  };
  const labels = {
    pass: `DSR ${dsr.toFixed(1)}% — Within limit (≤60%)`,
    warning: `DSR ${dsr.toFixed(1)}% — Caution (>60%)`,
    fail: `DSR ${dsr.toFixed(1)}% — Exceeds 70% limit`,
  };
  const icons = { pass: 'check_circle', warning: 'warning', fail: 'error' };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${styles[status]}`}>
      <span className="material-symbols-outlined text-base">{icons[status]}</span>
      {labels[status]}
    </span>
  );
}

// ── Form state now includes Phase 2 fields ──────────────────────────────────────
type FormState = {
  // Existing backend-persisted fields
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
  proposedInstalment: string;
  // Phase 2 frontend-only placeholder fields (not yet persisted)
  jobTitle: string;
  employmentStatus: string;
  lengthOfService: string;
  fixedAllowances: string;
  variableIncome: string;
  otherRecurringIncome: string;
  housingRentCommitment: string;
  livingExpenses: string;
  dependents: string;
  assetsSavings: string;
  analystRemarks: string;
};

const DEFAULT_FORM: FormState = {
  employmentType: 'SALARIED',
  employerName: '',
  monthlyGrossIncome: '',
  epfMonthlyAmount: '',
  monthlyTaxDeduction: '',
  monthlySocsoDeduction: '',
  hirePurchaseCommitment: '',
  creditCardCommitment: '',
  existingLoanCommitment: '',
  otherCommitments: '',
  proposedInstalment: '',
  jobTitle: '',
  employmentStatus: 'PERMANENT',
  lengthOfService: '',
  fixedAllowances: '',
  variableIncome: '',
  otherRecurringIncome: '',
  housingRentCommitment: '',
  livingExpenses: '',
  dependents: '',
  assetsSavings: '',
  analystRemarks: '',
};

// ── Individual commitment row for verification ────────────────────────────────
function CommitmentRow({ label, amount, includesInDsr }: { label: string; amount: number; includesInDsr?: boolean }) {
  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (amount === 0) return null;
  return (
    <tr className="text-gray-600">
      <td className="px-3 py-1.5 pl-6 text-xs">
        {label}
        {includesInDsr && <span className="ml-1 text-[9px] text-blue-500 font-medium">incl. DSR</span>}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(amount)}</td>
    </tr>
  );
}

// ── Placeholder field badge ──────────────────────────────────────────────────────
function PlaceholderBadge() {
  return (
    <span className="ml-1 text-[9px] text-gray-400 font-medium italic" title="This field is not yet persisted to the backend">
      (preview)
    </span>
  );
}

// ── Affordability Result Panel ──────────────────────────────────────────────────
function AffordabilityResult({ dsr, netDsr, disposableIncome, gross, totalCommitments }: {
  dsr: number | null;
  netDsr: number | null;
  disposableIncome: number;
  gross: number;
  totalCommitments: number;
}) {
  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const affordable = dsr !== null && dsr <= 60 && disposableIncome > 0;
  const borderline = dsr !== null && dsr > 60 && dsr <= 70;
  const notAffordable = dsr !== null && dsr > 70;

  const bgColor = affordable ? 'bg-green-50 border-green-200'
    : borderline ? 'bg-yellow-50 border-yellow-200'
    : notAffordable ? 'bg-red-50 border-red-200'
    : 'bg-gray-50 border-gray-200';

  const textColor = affordable ? 'text-green-700'
    : borderline ? 'text-yellow-700'
    : notAffordable ? 'text-red-700'
    : 'text-gray-600';

  const statusIcon = affordable ? 'check_circle' : borderline ? 'warning' : notAffordable ? 'error' : 'info';
  const statusLabel = affordable ? 'Affordable' : borderline ? 'Borderline — Exception Required' : notAffordable ? 'Not Affordable' : 'Awaiting Data';

  return (
    <div className={`rounded-lg p-4 border ${bgColor}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`material-symbols-outlined text-lg ${textColor}`}>{statusIcon}</span>
        <h4 className={`text-sm font-semibold ${textColor}`}>Affordability Result: {statusLabel}</h4>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Gross DSR</p>
          <p className={`text-lg font-bold tabular-nums ${textColor}`}>{dsr !== null ? `${dsr.toFixed(1)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Net DSR</p>
          <p className={`text-lg font-bold tabular-nums ${textColor}`}>{netDsr !== null ? `${netDsr.toFixed(1)}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Disposable Income</p>
          <p className={`text-lg font-bold tabular-nums ${disposableIncome > 0 ? 'text-gray-800' : 'text-red-600'}`}>
            {gross > 0 ? `RM ${fmt(disposableIncome)}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Total Commitments</p>
          <p className="text-lg font-bold tabular-nums text-gray-800">{gross > 0 ? `RM ${fmt(totalCommitments)}` : '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function RetailIncomeTab({ applicationId, readOnly, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [dsr, setDsr] = useState<number | null>(null);
  const [netDsr, setNetDsr] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [verified, setVerified] = useState(false);
  const originalRef = useRef<FormState | null>(null);
  const savedAtRef = useRef<string | null>(null);

  useEffect(() => {
    retailIncomeApi.get(applicationId).then((data) => {
      if (data) {
        const loaded: FormState = {
          ...DEFAULT_FORM,
          employmentType: data.employmentType,
          employerName: data.employerName ?? '',
          monthlyGrossIncome: data.monthlyGrossIncome,
          epfMonthlyAmount: data.epfMonthlyAmount ?? '',
          monthlyTaxDeduction: (data as any).monthlyTaxDeduction ?? '',
          monthlySocsoDeduction: (data as any).monthlySocsoDeduction ?? '',
          hirePurchaseCommitment: data.hirePurchaseCommitment,
          creditCardCommitment: data.creditCardCommitment,
          existingLoanCommitment: data.existingLoanCommitment,
          otherCommitments: data.otherCommitments,
          proposedInstalment: data.proposedInstalment ?? '',
        };
        setForm(loaded);
        originalRef.current = loaded;
        if (data.dsrPercent) setDsr(Number(data.dsrPercent));
        if ((data as any).netDsrPercent) setNetDsr(Number((data as any).netDsrPercent));
        if (data.financialsVerified) setVerified(true);
        savedAtRef.current = (data as any).updatedAt ?? (data as any).createdAt ?? new Date().toISOString();
        setLastSaved(savedAtRef.current);
      } else {
        originalRef.current = { ...DEFAULT_FORM };
      }
      setLoading(false);
    });
  }, [applicationId]);

  // Live DSR computation (gross)
  useEffect(() => {
    const gross = Number(form.monthlyGrossIncome) || 0;
    if (gross <= 0) { setDsr(null); setNetDsr(null); return; }
    const totalCommitments =
      (Number(form.hirePurchaseCommitment) || 0) +
      (Number(form.creditCardCommitment) || 0) +
      (Number(form.existingLoanCommitment) || 0) +
      (Number(form.otherCommitments) || 0) +
      (Number(form.proposedInstalment) || 0);
    setDsr(Math.round((totalCommitments / gross) * 1000) / 10);

    // Net DSR computation
    const epf = Number(form.epfMonthlyAmount) || 0;
    const tax = Number(form.monthlyTaxDeduction) || 0;
    const socso = Number(form.monthlySocsoDeduction) || 0;
    const netIncome = gross - epf - tax - socso;
    if (netIncome > 0) {
      setNetDsr(Math.round((totalCommitments / netIncome) * 1000) / 10);
    } else {
      setNetDsr(null);
    }
  }, [
    form.monthlyGrossIncome,
    form.epfMonthlyAmount,
    form.monthlyTaxDeduction,
    form.monthlySocsoDeduction,
    form.hirePurchaseCommitment,
    form.creditCardCommitment,
    form.existingLoanCommitment,
    form.otherCommitments,
    form.proposedInstalment,
  ]);

  // Track dirty state
  useEffect(() => {
    if (!originalRef.current) { setDirty(false); return; }
    const o = originalRef.current;
    const isDirty = Object.keys(form).some(k => (form as any)[k] !== (o as any)[k]);
    setDirty(isDirty);
    if (isDirty) setVerified(false);
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await retailIncomeApi.upsert(applicationId, {
        employmentType: form.employmentType,
        employerName: form.employerName || undefined,
        monthlyGrossIncome: Number(form.monthlyGrossIncome),
        epfMonthlyAmount: form.epfMonthlyAmount ? Number(form.epfMonthlyAmount) : undefined,
        monthlyTaxDeduction: form.monthlyTaxDeduction ? Number(form.monthlyTaxDeduction) : undefined,
        monthlySocsoDeduction: form.monthlySocsoDeduction ? Number(form.monthlySocsoDeduction) : undefined,
        hirePurchaseCommitment: Number(form.hirePurchaseCommitment) || 0,
        creditCardCommitment: Number(form.creditCardCommitment) || 0,
        existingLoanCommitment: Number(form.existingLoanCommitment) || 0,
        otherCommitments: Number(form.otherCommitments) || 0,
        proposedInstalment: form.proposedInstalment ? Number(form.proposedInstalment) : undefined,
      });
      originalRef.current = { ...form };
      setDirty(false);
      const now = new Date().toISOString();
      savedAtRef.current = now;
      setLastSaved(now);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSaved?.();
    } catch (e: any) {
      alert('Failed to save: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: string) => {
    const num = Number(n);
    if (!n || isNaN(num)) return '';
    return num.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // ── Field renderer for persisted numeric fields ──
  const field = (label: string, key: keyof FormState, type = 'number', prefix?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-2 text-sm text-gray-400 font-medium">{prefix}</span>}
        <input
          type={type}
          value={form[key]}
          disabled={readOnly}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
          className={`w-full border rounded-md px-3 py-2 text-sm tabular-nums ${prefix ? 'pl-8' : ''} ${dirty && form[key] !== originalRef.current?.[key] ? 'border-amber-300 bg-amber-50/30' : ''} disabled:bg-gray-50`}
          min={0}
        />
      </div>
    </div>
  );

  // ── Field renderer for placeholder (non-persisted) fields ──
  const placeholderField = (label: string, key: keyof FormState, type = 'number', prefix?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} <PlaceholderBadge />
      </label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-2 text-sm text-gray-400 font-medium">{prefix}</span>}
        <input
          type={type}
          value={form[key] as any}
          disabled={readOnly}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
          className={`w-full border rounded-md px-3 py-2 text-sm tabular-nums border-dashed border-gray-300 bg-gray-50/50 ${prefix ? 'pl-8' : ''} disabled:bg-gray-50`}
          min={0}
        />
      </div>
    </div>
  );

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>;

  // Computed summary for verification
  const gross = Number(form.monthlyGrossIncome) || 0;
  const epf = Number(form.epfMonthlyAmount) || 0;
  const tax = Number(form.monthlyTaxDeduction) || 0;
  const socso = Number(form.monthlySocsoDeduction) || 0;
  const totalCommitments =
    (Number(form.hirePurchaseCommitment) || 0) +
    (Number(form.creditCardCommitment) || 0) +
    (Number(form.existingLoanCommitment) || 0) +
    (Number(form.otherCommitments) || 0);
  const proposed = Number(form.proposedInstalment) || 0;
  const netIncome = gross - epf - tax - socso;
  const disposableIncome = netIncome - totalCommitments - proposed;
  const hasData = gross > 0;

  const hasAnyData = gross > 0 || totalCommitments > 0 || epf > 0;
  const isSaved = !dirty && hasAnyData;
  const s3Complete = isSaved && hasAnyData && verified;

  // Build ratio breakdowns for calculation panel
  const ratioBreakdowns: RatioBreakdown[] = [];
  if (dsr !== null && gross > 0) {
    ratioBreakdowns.push({
      name: 'Debt Service Ratio (Gross)',
      code: 'DSR',
      formula: '(Total Commitments + Proposed Instalment) / Gross Monthly Income × 100',
      inputs: [
        { label: 'Gross Income', value: `RM ${fmt(form.monthlyGrossIncome)}` },
        { label: 'HP / Car Loans', value: `RM ${fmt(form.hirePurchaseCommitment)}` },
        { label: 'Credit Card', value: `RM ${fmt(form.creditCardCommitment)}` },
        { label: 'Existing Loans', value: `RM ${fmt(form.existingLoanCommitment)}` },
        { label: 'Other Obligations', value: `RM ${fmt(form.otherCommitments)}` },
        { label: 'Proposed Instalment', value: `RM ${fmt(form.proposedInstalment)}` },
      ],
      result: `${dsr.toFixed(1)}%`,
      threshold: 'Pass: ≤ 60% | Watch: 60–70% | Fail: > 70%',
      status: dsr <= 60 ? 'pass' : dsr <= 70 ? 'watch' : 'fail',
      sources: ['retail-income-api', 'payslip', 'CCRIS'],
    });
  }
  if (netDsr !== null && netIncome > 0) {
    ratioBreakdowns.push({
      name: 'Debt Service Ratio (Net Income)',
      code: 'Net DSR',
      formula: '(Total Commitments + Proposed Instalment) / (Gross - EPF - Tax - SOCSO) × 100',
      inputs: [
        { label: 'Gross Income', value: `RM ${fmt(form.monthlyGrossIncome)}` },
        { label: 'EPF', value: `RM ${fmt(form.epfMonthlyAmount)}` },
        { label: 'Tax', value: `RM ${fmt(form.monthlyTaxDeduction)}` },
        { label: 'SOCSO', value: `RM ${fmt(form.monthlySocsoDeduction)}` },
        { label: 'Net Income', value: `RM ${netIncome.toFixed(2)}` },
        { label: 'Total Commitments', value: `RM ${(totalCommitments + proposed).toFixed(2)}` },
      ],
      result: `${netDsr.toFixed(1)}%`,
      threshold: 'Pass: ≤ 50% | Watch: 50–60% | Fail: > 60%',
      status: netDsr <= 50 ? 'pass' : netDsr <= 60 ? 'watch' : 'fail',
      sources: ['retail-income-api'],
    });
  }

  return (
    <div className="space-y-5 p-1">
      {/* ── S3 Status Bar ──────────────────────── */}
      <div className={`rounded-lg p-3 flex items-center justify-between border ${
        s3Complete
          ? 'bg-green-50 border-green-200'
          : isSaved && !verified
            ? 'bg-amber-50 border-amber-200'
            : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-lg ${
            s3Complete ? 'text-green-600' : isSaved && !verified ? 'text-amber-500' : 'text-gray-400'
          }`}>
            {s3Complete ? 'check_circle' : isSaved && !verified ? 'pending' : 'radio_button_unchecked'}
          </span>
          <div>
            <p className={`text-xs font-semibold ${
              s3Complete ? 'text-green-800' : isSaved && !verified ? 'text-amber-800' : 'text-gray-600'
            }`}>
              S3 Financials — {s3Complete ? 'Complete' : isSaved && !verified ? 'Saved, pending verification' : 'Data entry required'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {s3Complete
                ? 'All income data captured and verified against supporting documents'
                : isSaved && !verified
                  ? 'Data saved. Mark as verified once you have cross-checked against payslip / bank statement / CCRIS.'
                  : 'Enter borrower income and commitment details below'}
            </p>
          </div>
        </div>
        {dsr !== null && <DsrBadge dsr={dsr} />}
      </div>

      {/* ── Affordability Result Panel ── */}
      {hasData && (
        <AffordabilityResult
          dsr={dsr}
          netDsr={netDsr}
          disposableIncome={disposableIncome}
          gross={gross}
          totalCommitments={totalCommitments + proposed}
        />
      )}

      {/* ── Section 1: Employment Details ──────── */}
      <CaMemoSection title="Employment Details" phase="S3">
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Employment Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {EMPLOYMENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setForm((prev) => ({ ...prev, employmentType: t.value }))}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors
                        ${form.employmentType === t.value
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <span className="material-symbols-outlined text-sm">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {field('Employer Name', 'employerName', 'text')}
              {placeholderField('Job Title', 'jobTitle', 'text')}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Employment Status <PlaceholderBadge />
                </label>
                <select
                  value={form.employmentStatus}
                  disabled={readOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, employmentStatus: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm border-dashed border-gray-300 bg-gray-50/50 disabled:bg-gray-50"
                >
                  {EMPLOYMENT_STATUS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              {placeholderField('Length of Service (years)', 'lengthOfService')}
            </div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── Section 2: Monthly Income ──────── */}
      <CaMemoSection title="Monthly Income" phase="S3">
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              {field('Monthly Gross Income', 'monthlyGrossIncome', 'number', 'RM')}
              {field('EPF Monthly Contribution', 'epfMonthlyAmount', 'number', 'RM')}
              {field('Monthly Tax Deduction', 'monthlyTaxDeduction', 'number', 'RM')}
              {field('Monthly SOCSO Deduction', 'monthlySocsoDeduction', 'number', 'RM')}
              {placeholderField('Fixed Allowances', 'fixedAllowances', 'number', 'RM')}
              {placeholderField('Variable Income (avg)', 'variableIncome', 'number', 'RM')}
              {placeholderField('Other Recurring Income', 'otherRecurringIncome', 'number', 'RM')}
            </div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── Section 3: Monthly Commitments ──────── */}
      <CaMemoSection title="Monthly Commitments" phase="S3">
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              {field('Hire Purchase / Car Loans', 'hirePurchaseCommitment', 'number', 'RM')}
              {field('Credit Card (min. payment)', 'creditCardCommitment', 'number', 'RM')}
              {field('Existing Personal Loans', 'existingLoanCommitment', 'number', 'RM')}
              {field('Other Obligations', 'otherCommitments', 'number', 'RM')}
              {placeholderField('Housing / Rent Commitment', 'housingRentCommitment', 'number', 'RM')}
              {field('Proposed Monthly Instalment', 'proposedInstalment', 'number', 'RM')}
            </div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── Section 4: Living Expenses & Assets ──────── */}
      <CaMemoSection title="Living Expenses & Assets" phase="S3">
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white border rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              {placeholderField('Monthly Living Expenses', 'livingExpenses', 'number', 'RM')}
              {placeholderField('Dependents (count)', 'dependents', 'number')}
              {placeholderField('Assets / Savings', 'assetsSavings', 'number', 'RM')}
            </div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── Section 5: Calculation Breakdown ──────── */}
      {ratioBreakdowns.length > 0 && (
        <CaMemoSection title="Calculation Breakdown" phase="S3">
          <CalculationBreakdownPanel ratios={ratioBreakdowns} />
        </CaMemoSection>
      )}

      {/* ── Section 6: Financial Assessment Remarks ──────── */}
      <CaMemoSection title="Financial Assessment Remarks" phase="S3">
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white border rounded-lg p-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Analyst Remarks <PlaceholderBadge />
            </label>
            <textarea
              value={form.analystRemarks}
              disabled={readOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, analystRemarks: e.target.value }))}
              className="w-full border border-dashed border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50/50 disabled:bg-gray-50 resize-none h-24"
              placeholder="Document any exceptions, observations, or justification for DSR override…"
            />
          </div>
        </div>
      </CaMemoSection>

      {/* ── Save button ──────── */}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div>
            {dirty && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">edit</span>
                Unsaved changes
              </span>
            )}
            {saveSuccess && !dirty && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Saved successfully
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Saving…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">save</span>
                Save Income Assessment
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Section 7: Data Verification ──────── */}
      {hasAnyData && (
        <CaMemoSection title="Captured Data Verification" phase="S3">
          <CapturedDataReview
            form={form}
            gross={gross}
            epf={epf}
            tax={tax}
            socso={socso}
            netIncome={netIncome}
            totalCommitments={totalCommitments}
            proposed={proposed}
            dsr={dsr}
            netDsr={netDsr}
            disposableIncome={disposableIncome}
            hirePurchase={Number(form.hirePurchaseCommitment) || 0}
            creditCard={Number(form.creditCardCommitment) || 0}
            existingLoan={Number(form.existingLoanCommitment) || 0}
            otherCommitments={Number(form.otherCommitments) || 0}
            verified={verified}
            onVerify={async (v: boolean) => {
              try {
                await retailIncomeApi.verify(applicationId, v);
                setVerified(v);
              } catch {
                // silent
              }
            }}
            isSaved={isSaved}
          />
        </CaMemoSection>
      )}
    </div>
  );
}

// ── Captured Data Review Panel ────────────────────────────────────────────────
function CapturedDataReview({
  form,
  gross,
  epf,
  tax,
  socso,
  netIncome,
  totalCommitments,
  proposed,
  dsr,
  netDsr,
  disposableIncome,
  hirePurchase,
  creditCard,
  existingLoan,
  otherCommitments,
  verified,
  onVerify,
  isSaved,
}: {
  form: FormState;
  gross: number;
  epf: number;
  tax: number;
  socso: number;
  netIncome: number;
  totalCommitments: number;
  proposed: number;
  dsr: number | null;
  netDsr: number | null;
  disposableIncome: number;
  hirePurchase: number;
  creditCard: number;
  existingLoan: number;
  otherCommitments: number;
  verified: boolean;
  onVerify: (verified: boolean) => void;
  isSaved: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dsrBase = totalCommitments + proposed;
  const empLabel = EMPLOYMENT_TYPES.find(t => t.value === form.employmentType)?.label ?? form.employmentType;

  return (
    <div className="space-y-4">
      {/* Verification instruction */}
      <div className={`rounded-lg p-3 flex items-start gap-2 border ${
        verified ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <span className={`material-symbols-outlined text-base mt-0.5 ${verified ? 'text-green-600' : 'text-amber-600'}`}>
          {verified ? 'verified' : 'info'}
        </span>
        <div className="flex-1">
          <p className={`text-xs font-medium ${verified ? 'text-green-800' : 'text-amber-800'}`}>
            {verified ? 'Verified — figures confirmed against supporting documents' : 'Verify captured information'}
          </p>
          <p className={`text-[10px] mt-0.5 ${verified ? 'text-green-700' : 'text-amber-700'}`}>
            {verified
              ? 'The RM has confirmed these figures match the borrower\'s payslip, bank statements, and CCRIS.'
              : 'Cross-check the figures below against the borrower\'s supporting documents (payslip, bank statements, CCRIS) before marking as verified.'}
          </p>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">work</span> Employment
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="Type" value={empLabel} />
            <ReviewField label="Employer" value={form.employerName || '—'} />
          </div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">payments</span> Income
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="Gross" value={`RM ${fmt(gross)}`} highlight={gross > 0} color="green" />
            <ReviewField label="EPF" value={epf > 0 ? `RM ${fmt(epf)}` : '—'} />
            <ReviewField label="Tax" value={tax > 0 ? `RM ${fmt(tax)}` : '—'} />
            <ReviewField label="SOCSO" value={socso > 0 ? `RM ${fmt(socso)}` : '—'} />
          </div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">calculate</span> Computed
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="Net Income" value={`RM ${fmt(netIncome)}`} highlight color={netIncome > 0 ? 'blue' : 'red'} />
            <ReviewField label="DSR (Gross)" value={dsr !== null ? `${dsr.toFixed(1)}%` : '—'} highlight color={dsr !== null && dsr <= 60 ? 'green' : dsr !== null && dsr <= 70 ? 'yellow' : 'red'} />
            <ReviewField label="DSR (Net)" value={netDsr !== null ? `${netDsr.toFixed(1)}%` : '—'} highlight color={netDsr !== null && netDsr <= 50 ? 'green' : netDsr !== null && netDsr <= 60 ? 'yellow' : 'red'} />
            <ReviewField label="Disposable" value={`RM ${fmt(disposableIncome)}`} highlight color={disposableIncome > 0 ? 'green' : 'red'} />
          </div>
        </div>
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">account_balance_wallet</span> Commitments
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="HP / Car" value={hirePurchase > 0 ? `RM ${fmt(hirePurchase)}` : '—'} />
            <ReviewField label="Credit Card" value={creditCard > 0 ? `RM ${fmt(creditCard)}` : '—'} />
            <ReviewField label="Existing Loans" value={existingLoan > 0 ? `RM ${fmt(existingLoan)}` : '—'} />
            <ReviewField label="Other" value={otherCommitments > 0 ? `RM ${fmt(otherCommitments)}` : '—'} />
            <ReviewField label="Proposed" value={proposed > 0 ? `RM ${fmt(proposed)}` : '—'} />
          </div>
        </div>
      </div>

      {/* ── Commitment breakdown table ── */}
      <div className="bg-white border rounded-lg overflow-hidden text-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Item</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Amount (RM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-green-50/30 font-medium">
              <td className="px-3 py-1.5 text-gray-700 text-xs">Monthly Gross Income</td>
              <td className="px-3 py-1.5 text-right text-gray-900 tabular-nums text-xs">{fmt(gross)}</td>
            </tr>
            {epf > 0 && (
              <tr className="text-gray-500">
                <td className="px-3 py-1.5 text-xs">EPF Contribution</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs">({fmt(epf)})</td>
              </tr>
            )}
            {tax > 0 && (
              <tr className="text-gray-500">
                <td className="px-3 py-1.5 text-xs">Tax Deduction</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs">({fmt(tax)})</td>
              </tr>
            )}
            {socso > 0 && (
              <tr className="text-gray-500">
                <td className="px-3 py-1.5 text-xs">SOCSO Deduction</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-xs">({fmt(socso)})</td>
              </tr>
            )}
            {netIncome !== gross && (
              <tr className="bg-blue-50/30 font-medium">
                <td className="px-3 py-1.5 text-gray-700 text-xs">Net Income</td>
                <td className="px-3 py-1.5 text-right text-gray-900 tabular-nums text-xs">{fmt(netIncome)}</td>
              </tr>
            )}

            <tr className="border-t-2 border-gray-200">
              <td className="px-3 py-1.5 text-gray-500 text-xs font-medium" colSpan={2}>
                Monthly Commitments (DSR components)
              </td>
            </tr>
            <CommitmentRow label="Hire Purchase / Car Loans" amount={hirePurchase} includesInDsr />
            <CommitmentRow label="Credit Card (min. payment)" amount={creditCard} includesInDsr />
            <CommitmentRow label="Existing Personal Loans" amount={existingLoan} includesInDsr />
            <CommitmentRow label="Other Obligations" amount={otherCommitments} includesInDsr />
            <CommitmentRow label="Proposed Monthly Instalment" amount={proposed} includesInDsr />

            {(totalCommitments > 0 || proposed > 0) && (
              <>
                <tr className="bg-amber-50/30">
                  <td className="px-3 py-1.5 text-gray-600 text-xs font-medium">Existing Commitments Subtotal</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(totalCommitments)}</td>
                </tr>
                {proposed > 0 && (
                  <tr className="text-gray-600">
                    <td className="px-3 py-1.5 pl-6 text-xs">+ Proposed Instalment</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-xs">{fmt(proposed)}</td>
                  </tr>
                )}
                <tr className="bg-red-50/30 font-semibold">
                  <td className="px-3 py-1.5 text-gray-700 text-xs">DSR Base (total commitments)</td>
                  <td className="px-3 py-1.5 text-right text-gray-900 tabular-nums text-xs">{fmt(dsrBase)}</td>
                </tr>
                <tr className="bg-blue-50/30">
                  <td className="px-3 py-1.5 text-gray-700 text-xs font-semibold">Disposable Income</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums text-xs font-semibold ${disposableIncome > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(disposableIncome)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── DSR highlight ── */}
      {dsr !== null && (
        <div className={`rounded-lg p-3 text-center ${
          dsr <= 60 ? 'bg-green-50 border border-green-200'
          : dsr <= 70 ? 'bg-yellow-50 border border-yellow-200'
          : 'bg-red-50 border border-red-200'
        }`}>
          <div className="text-2xl font-black tabular-nums">{dsr.toFixed(1)}%</div>
          <div className={`text-xs font-medium ${
            dsr <= 60 ? 'text-green-700' : dsr <= 70 ? 'text-yellow-700' : 'text-red-700'
          }`}>
            Debt Service Ratio (Gross)
          </div>
          {netDsr !== null && (
            <div className="text-[10px] text-gray-500 mt-1">
              Net DSR: {netDsr.toFixed(1)}% | RM {fmt(dsrBase)} commitments / RM {fmt(gross)} gross
            </div>
          )}
        </div>
      )}

      {/* ── Verification checkbox ── */}
      <div className={`rounded-lg p-4 border ${verified ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={verified}
            onChange={e => { if (isSaved) onVerify(e.target.checked); }}
            disabled={!isSaved}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <div>
            <p className={`text-xs font-semibold ${verified ? 'text-green-800' : 'text-gray-700'}`}>
              I have verified these figures against supporting documents
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {isSaved
                ? 'Confirms that the income, EPF, tax, SOCSO, and commitment figures above match the borrower\'s payslip, bank statements, and CCRIS report.'
                : 'Save the income assessment first before verifying.'}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── Review field display ──────────────────────────────────────────────────────
function ReviewField({ label, value, highlight, color }: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: 'green' | 'red' | 'blue' | 'yellow';
}) {
  const valueColor = highlight
    ? color === 'green' ? 'text-green-700'
    : color === 'red' ? 'text-red-700'
    : color === 'blue' ? 'text-blue-700'
    : color === 'yellow' ? 'text-yellow-700'
    : 'text-gray-900'
    : 'text-gray-700';
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}