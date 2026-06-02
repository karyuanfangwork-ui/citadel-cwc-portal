import React, { useEffect, useState, useRef } from 'react';
import { retailIncomeApi } from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

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
  const icons = {
    pass: 'check_circle',
    warning: 'warning',
    fail: 'error',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${styles[status]}`}>
      <span className="material-symbols-outlined text-base">{icons[status]}</span>
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
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savedBy, setSavedBy] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [verified, setVerified] = useState(false);
  const originalRef = useRef<FormState | null>(null);
  const savedAtRef = useRef<string | null>(null);

  useEffect(() => {
    retailIncomeApi.get(applicationId).then((data) => {
      if (data) {
        const loaded: FormState = {
          employmentType: data.employmentType,
          employerName: data.employerName ?? '',
          monthlyGrossIncome: data.monthlyGrossIncome,
          epfMonthlyAmount: data.epfMonthlyAmount ?? '',
          hirePurchaseCommitment: data.hirePurchaseCommitment,
          creditCardCommitment: data.creditCardCommitment,
          existingLoanCommitment: data.existingLoanCommitment,
          otherCommitments: data.otherCommitments,
          proposedInstalment: data.proposedInstalment ?? '',
        };
        setForm(loaded);
        originalRef.current = loaded;
        if (data.dsrPercent) setDsr(Number(data.dsrPercent));
        if (data.financialsVerified) setVerified(true);
        savedAtRef.current = (data as any).updatedAt ?? (data as any).createdAt ?? new Date().toISOString();
        setLastSaved(savedAtRef.current);
      } else {
        // No existing record — set baseline so dirty detection works when user types
        originalRef.current = {
          employmentType: 'SALARIED',
          employerName: '',
          monthlyGrossIncome: '',
          epfMonthlyAmount: '',
          hirePurchaseCommitment: '',
          creditCardCommitment: '',
          existingLoanCommitment: '',
          otherCommitments: '',
          proposedInstalment: '',
        };
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

  // Track dirty state — reset verification if form changes
  useEffect(() => {
    if (!originalRef.current) { setDirty(false); return; }
    const o = originalRef.current;
    const isDirty = Object.keys(form).some(k => (form as any)[k] !== (o as any)[k]);
    setDirty(isDirty);
    if (isDirty) setVerified(false); // un-verify when data changes
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const result = await retailIncomeApi.upsert(applicationId, {
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

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>;

  // Computed summary for verification
  const gross = Number(form.monthlyGrossIncome) || 0;
  const totalCommitments =
    (Number(form.hirePurchaseCommitment) || 0) +
    (Number(form.creditCardCommitment) || 0) +
    (Number(form.existingLoanCommitment) || 0) +
    (Number(form.otherCommitments) || 0);
  const netIncome = gross - totalCommitments - (Number(form.epfMonthlyAmount) || 0);
  const hasData = gross > 0;

  // Check if there's any meaningful data entered
  const hasAnyData = gross > 0 || totalCommitments > 0 || Number(form.epfMonthlyAmount) > 0;
  const isSaved = !dirty && hasAnyData; // data has been persisted

  // S3 Completion state
  const s3Complete = isSaved && hasAnyData && verified;

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
            <p className={`text-xs font-semibold ${s3Complete ? 'text-green-800' : isSaved && !verified ? 'text-amber-800' : 'text-gray-600'}`}>
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

      {/* ── Section 1: Income Entry Form ──────── */}
      <CaMemoSection title="Retail Income Assessment" phase="S3">
        <div className="space-y-4 max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Individual borrower income and commitment assessment</p>
              {lastSaved && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Last saved: {new Date(lastSaved).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>
          </div>

          {/* DSR Warning Banner */}
          {dsr !== null && dsr > 60 && (
            <div className={`rounded-lg p-4 ${dsr > 70 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-xl mt-0.5">{dsr > 70 ? 'error' : 'warning'}</span>
                <div>
                  <h4 className={`text-sm font-semibold ${dsr > 70 ? 'text-red-800' : 'text-yellow-800'}`}>
                    {dsr > 70 ? 'DSR exceeds 70% — Submission blocked' : 'DSR between 60–70% — Exception required'}
                  </h4>
                  <p className={`text-xs mt-1 ${dsr > 70 ? 'text-red-700' : 'text-yellow-700'}`}>
                    {dsr > 70
                      ? 'The debt-to-income ratio exceeds the regulatory threshold. Reduce commitments, increase income, or obtain a credit manager override before proceeding.'
                      : 'The DSR is above the standard 60% threshold. Submission requires a documented exception reason from the credit manager.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Employment Details */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-gray-400">work</span>
              Employment Details
            </h4>
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
            </div>
          </div>

          {/* Monthly Income */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-gray-400">payments</span>
              Monthly Income
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {field('Monthly Gross Income', 'monthlyGrossIncome', 'number', 'RM')}
              {field('EPF Monthly Contribution', 'epfMonthlyAmount', 'number', 'RM')}
            </div>
          </div>

          {/* Monthly Commitments */}
          <div className="bg-white border rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-gray-400">account_balance_wallet</span>
              Monthly Commitments
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {field('Hire Purchase / Car Loans', 'hirePurchaseCommitment', 'number', 'RM')}
              {field('Credit Card (min. payment)', 'creditCardCommitment', 'number', 'RM')}
              {field('Existing Personal Loans', 'existingLoanCommitment', 'number', 'RM')}
              {field('Other Obligations', 'otherCommitments', 'number', 'RM')}
              {field('Proposed Monthly Instalment', 'proposedInstalment', 'number', 'RM')}
            </div>
          </div>

          {/* Save button */}
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
        </div>
      </CaMemoSection>

      {/* ── Section 2: Data Verification ──────── */}
      {hasAnyData && (
        <CaMemoSection title="Captured Data Verification" phase="S3">
          <CapturedDataReview
            form={form}
            gross={gross}
            totalCommitments={totalCommitments}
            netIncome={netIncome}
            dsr={dsr}
            epf={Number(form.epfMonthlyAmount) || 0}
            proposed={Number(form.proposedInstalment) || 0}
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
                // silent — keep local state
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
  totalCommitments,
  netIncome,
  dsr,
  epf,
  proposed,
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
  totalCommitments: number;
  netIncome: number;
  dsr: number | null;
  epf: number;
  proposed: number;
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

      {/* ── All captured fields in review format ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Employment Info Card */}
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">work</span>
            Employment
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="Employment Type" value={empLabel} />
            <ReviewField label="Employer Name" value={form.employerName || '—'} />
          </div>
        </div>

        {/* Income Card */}
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">payments</span>
            Income
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="Gross Income" value={`RM ${fmt(gross)}`} highlight={gross > 0} color="green" />
            <ReviewField label="EPF Contribution" value={epf > 0 ? `RM ${fmt(epf)}` : '—'} />
          </div>
        </div>

        {/* Computed Card */}
        <div className="bg-white border rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">calculate</span>
            Computed
          </h5>
          <div className="space-y-1.5">
            <ReviewField label="Net Income" value={`RM ${fmt(netIncome)}`} highlight color={netIncome > 0 ? 'blue' : 'red'} />
            <ReviewField label="DSR" value={dsr !== null ? `${dsr.toFixed(1)}%` : '—'} highlight color={dsr !== null && dsr <= 60 ? 'green' : dsr !== null && dsr <= 70 ? 'yellow' : 'red'} />
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
            {/* Income section */}
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

            {/* Commitment section */}
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
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ── DSR highlight ── */}
      {dsr !== null && (
        <div className={`rounded-lg p-3 text-center ${dsr <= 60 ? 'bg-green-50 border border-green-200' : dsr <= 70 ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="text-2xl font-black tabular-nums">{dsr.toFixed(1)}%</div>
          <div className={`text-xs font-medium ${dsr <= 60 ? 'text-green-700' : dsr <= 70 ? 'text-yellow-700' : 'text-red-700'}`}>
            Debt Service Ratio
          </div>
          <div className="text-[10px] text-gray-500 mt-1">
            RM {fmt(dsrBase)} commitments / RM {fmt(gross)} gross income
          </div>
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
                ? 'Confirms that the income, EPF, and commitment figures above match the borrower\'s payslip, bank statements, and CCRIS report.'
                : 'Save the income assessment first before verifying.'}
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── Review field display (read-only, for verification) ────────────────────────
function ReviewField({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: 'green' | 'red' | 'blue' | 'yellow' }) {
  const valueColor = highlight
    ? color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-700' : color === 'blue' ? 'text-blue-700' : color === 'yellow' ? 'text-yellow-700' : 'text-gray-900'
    : 'text-gray-700';
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded bg-gray-50">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${valueColor}`}>{value}</span>
    </div>
  );
}