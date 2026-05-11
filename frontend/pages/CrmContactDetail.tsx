import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, {
  CrmContact, CrmOpportunity, CrmKycRecord,
  CrmBeneficiary, CrmTrustProduct, CrmNote,
} from '../src/services/crm.service';
import CrmNav from '../src/components/CrmNav';

// ── Formatters ────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 });
const formatCurrency = (val: number | null | undefined) => (val != null ? fmt.format(val) : '—');
const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: '#6366f1', QUALIFICATION: '#f59e0b', PROPOSAL: '#3b82f6',
  NEGOTIATION: '#8b5cf6', CLOSED_WON: '#22c55e', CLOSED_LOST: '#ef4444',
};

const KYC_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:     { bg: '#f1f5f9', color: '#64748b' },
  IN_PROGRESS: { bg: '#eff6ff', color: '#3b82f6' },
  APPROVED:    { bg: '#f0fdf4', color: '#22c55e' },
  EXPIRED:     { bg: '#fef2f2', color: '#ef4444' },
  REJECTED:    { bg: '#fef2f2', color: '#ef4444' },
};

const TRUST_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:    { bg: '#f0fdf4', color: '#22c55e' },
  PENDING:   { bg: '#fffbeb', color: '#f59e0b' },
  MATURED:   { bg: '#f1f5f9', color: '#64748b' },
  CANCELLED: { bg: '#fef2f2', color: '#ef4444' },
};

const SkeletonLine = ({ mb = 12 }: { mb?: number }) => (
  <div style={{ height: 18, marginBottom: mb, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
);

// ── Tab types ─────────────────────────────────────────────────────
type Tab = 'overview' | 'kyc' | 'trust' | 'beneficiaries' | 'deals' | 'notes';

// ── KYC Tab ───────────────────────────────────────────────────────
const KycTab = ({ contactId }: { contactId: string }) => {
  const [kyc, setKyc] = useState<CrmKycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nricVerified: false, addressVerified: false, incomeVerified: false,
    sourceOfFundsVerified: false, riskProfileDone: false,
    riskLevel: 'LOW', isPep: false, notes: '',
  });

  useEffect(() => {
    setLoading(true);
    crmService.getKycRecord(contactId)
      .then(rec => {
        setKyc(rec);
        setForm({
          nricVerified: rec.nricVerified,
          addressVerified: rec.addressVerified,
          incomeVerified: rec.incomeVerified,
          sourceOfFundsVerified: rec.sourceOfFundsVerified,
          riskProfileDone: rec.riskProfileDone,
          riskLevel: rec.riskLevel ?? 'LOW',
          isPep: rec.isPep,
          notes: rec.notes ?? '',
        });
      })
      .catch(() => setKyc(null))
      .finally(() => setLoading(false));
  }, [contactId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rec = await crmService.upsertKycRecord(contactId, form);
      setKyc(rec);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const rec = await crmService.approveKyc(contactId);
      setKyc(rec);
      setForm(f => ({ ...f, ...rec }));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof typeof form) =>
    setForm(f => ({ ...f, [key]: !f[key as keyof typeof form] }));

  if (loading) return <div className="space-y-3 py-4">{[...Array(5)].map((_, i) => <SkeletonLine key={i} />)}</div>;

  const statusStyle = kyc ? (KYC_STATUS_STYLE[kyc.status] ?? KYC_STATUS_STYLE.PENDING) : KYC_STATUS_STYLE.PENDING;

  const checkItems: { key: keyof typeof form; label: string }[] = [
    { key: 'nricVerified', label: 'NRIC / Passport Verified' },
    { key: 'addressVerified', label: 'Address Verified' },
    { key: 'incomeVerified', label: 'Income Verified' },
    { key: 'sourceOfFundsVerified', label: 'Source of Funds Verified' },
    { key: 'riskProfileDone', label: 'Risk Profile Completed' },
  ];

  return (
    <div className="space-y-5">
      {/* Status header */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">KYC Status</h3>
          {kyc ? (
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {kyc.status}
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>
              NO RECORD
            </span>
          )}
        </div>
        {!kyc && (
          <p className="text-sm text-text-secondary mb-4">No KYC record — fill in the form below and click Save to create one.</p>
        )}
        {kyc?.approvedAt && (
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-text-secondary">Approved:</span> <span className="font-medium text-text-primary">{formatDate(kyc.approvedAt)}</span></div>
            {kyc.expiresAt && <div><span className="text-text-secondary">Expires:</span> <span className="font-medium text-text-primary">{formatDate(kyc.expiresAt)}</span></div>}
          </div>
        )}
        {kyc?.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
            <span className="font-semibold">Rejection reason:</span> {kyc.rejectionReason}
          </div>
        )}
      </div>

      {/* Checklist + fields */}
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">KYC Checklist</h3>
        <div className="space-y-3 mb-5">
          {checkItems.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key] as boolean}
                onChange={() => toggle(key)}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm text-text-primary">{label}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Risk Level</label>
            <select
              value={form.riskLevel}
              onChange={e => setForm(f => ({ ...f, riskLevel: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary"
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={form.isPep}
                onChange={() => toggle('isPep')}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm text-text-primary font-medium">PEP (Politically Exposed Person)</span>
            </label>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1">Internal Notes</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none"
            placeholder="Additional KYC notes…"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save KYC'}
          </button>
          {kyc && kyc.status !== 'APPROVED' && (
            <button
              onClick={handleApprove}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-green-500 text-green-600 hover:bg-green-50 disabled:opacity-50"
            >
              Approve KYC
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Trust Products Tab ────────────────────────────────────────────
const TRUST_TYPES = ['CASH_TRUST', 'LIVING_TRUST', 'TESTAMENTARY_TRUST', 'CHARITABLE_TRUST'];

interface TrustForm {
  trustType: string; accountId: string; assetValue: string; assetDescription: string;
  trusteeName: string; trusteeContact: string; settlementDate: string;
  maturityDate: string; nextReviewDate: string; deedRefNumber: string;
}

const TrustTab = ({ contactId, accountId }: { contactId: string; accountId: string }) => {
  const [products, setProducts] = useState<CrmTrustProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<TrustForm>({
    trustType: 'CASH_TRUST', accountId, assetValue: '', assetDescription: '',
    trusteeName: '', trusteeContact: '', settlementDate: '',
    maturityDate: '', nextReviewDate: '', deedRefNumber: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    crmService.listTrustProducts({ contactId })
      .then(res => setProducts(res.trustProducts))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await crmService.createTrustProduct({
        ...form,
        contactId,
        assetValue: form.assetValue ? parseFloat(form.assetValue) : undefined,
      });
      setShowModal(false);
      setForm(f => ({ ...f, trustType: 'CASH_TRUST', assetValue: '', assetDescription: '', trusteeName: '', trusteeContact: '', settlementDate: '', maturityDate: '', nextReviewDate: '', deedRefNumber: '' }));
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: keyof TrustForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (loading) return <div className="space-y-3 py-4">{[...Array(3)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700">
          <span className="material-symbols-outlined text-base">add</span>
          New Trust Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-text-secondary text-sm">No trust products found for this contact.</div>
      ) : (
        <div className="space-y-4">
          {products.map(tp => {
            const s = TRUST_STATUS_STYLE[tp.status] ?? { bg: '#f1f5f9', color: '#64748b' };
            return (
              <div key={tp.id} className="bg-bg-surface border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-text-primary">{tp.trustType.replace(/_/g, ' ')}</p>
                    {tp.deedRefNumber && <p className="text-xs text-text-secondary mt-0.5">Deed Ref: {tp.deedRefNumber}</p>}
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{tp.status}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
                  <div><span className="text-text-secondary text-xs">Asset Value</span><p className="font-medium text-text-primary">{formatCurrency(tp.assetValue ?? null)}</p></div>
                  <div><span className="text-text-secondary text-xs">Next Review</span><p className="font-medium text-text-primary">{formatDate(tp.nextReviewDate)}</p></div>
                  {tp.trusteeName && <div><span className="text-text-secondary text-xs">Trustee</span><p className="font-medium text-text-primary">{tp.trusteeName}</p></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">New Trust Product</h2>
              <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Trust Type *</label>
                <select value={form.trustType} onChange={set('trustType')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" required>
                  {TRUST_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Account ID</label>
                <input value={form.accountId} readOnly className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-secondary opacity-60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Asset Value (MYR)</label>
                  <input type="number" value={form.assetValue} onChange={set('assetValue')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Deed Ref Number</label>
                  <input value={form.deedRefNumber} onChange={set('deedRefNumber')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Asset Description</label>
                <input value={form.assetDescription} onChange={set('assetDescription')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Trustee Name</label>
                  <input value={form.trusteeName} onChange={set('trusteeName')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Trustee Contact</label>
                  <input value={form.trusteeContact} onChange={set('trusteeContact')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'settlementDate' as keyof TrustForm, label: 'Settlement Date' },
                  { key: 'maturityDate' as keyof TrustForm, label: 'Maturity Date' },
                  { key: 'nextReviewDate' as keyof TrustForm, label: 'Next Review' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">{label}</label>
                    <input type="date" value={form[key]} onChange={set(key)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text-primary">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Beneficiaries Tab ─────────────────────────────────────────────
const RELATIONSHIPS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'];

interface BeneficiaryForm {
  firstName: string; lastName: string; relationship: string; allocationPct: string;
  email: string; phone: string; nricPassport: string; dateOfBirth: string;
  isMinor: boolean; guardianName: string; notes: string;
}

const emptyBenForm = (): BeneficiaryForm => ({
  firstName: '', lastName: '', relationship: 'SPOUSE', allocationPct: '',
  email: '', phone: '', nricPassport: '', dateOfBirth: '',
  isMinor: false, guardianName: '', notes: '',
});

const BeneficiariesTab = ({ contactId }: { contactId: string }) => {
  const [bens, setBens] = useState<CrmBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<BeneficiaryForm>(emptyBenForm());

  const load = useCallback(() => {
    setLoading(true);
    crmService.listBeneficiaries(contactId)
      .then(setBens).catch(() => setBens([]))
      .finally(() => setLoading(false));
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await crmService.createBeneficiary(contactId, {
        ...form,
        allocationPct: parseFloat(form.allocationPct) || 0,
      });
      setShowModal(false);
      setForm(emptyBenForm());
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this beneficiary?')) return;
    await crmService.deleteBeneficiary(id);
    load();
  };

  const set = (key: keyof BeneficiaryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const totalPct = bens.reduce((sum, b) => sum + b.allocationPct, 0);

  if (loading) return <div className="space-y-3 py-4">{[...Array(3)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700">
          <span className="material-symbols-outlined text-base">add</span>
          Add Beneficiary
        </button>
      </div>

      {bens.length === 0 ? (
        <div className="text-center py-12 text-text-secondary text-sm">No beneficiaries added yet.</div>
      ) : (
        <>
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle">
                  <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase">Relationship</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-text-secondary uppercase">Alloc %</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase">NRIC</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-text-secondary uppercase">Minor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {bens.map(b => (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">{b.firstName} {b.lastName}</td>
                    <td className="px-4 py-3 text-text-secondary">{b.relationship}</td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">{b.allocationPct}%</td>
                    <td className="px-4 py-3 text-text-secondary">{b.nricPassport ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {b.isMinor ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Minor</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(b.id)} className="text-text-secondary hover:text-red-500 transition-colors">
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`text-sm font-semibold ${totalPct === 100 ? 'text-green-600' : 'text-red-500'}`}>
            Total Allocation: {totalPct}%
            {totalPct !== 100 && ' — Must equal 100%'}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-bold text-text-primary">Add Beneficiary</h2>
              <button onClick={() => setShowModal(false)} className="text-text-secondary hover:text-text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label>
                  <input value={form.firstName} onChange={set('firstName')} required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name *</label>
                  <input value={form.lastName} onChange={set('lastName')} required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Relationship</label>
                  <select value={form.relationship} onChange={set('relationship')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary">
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Allocation %</label>
                  <input type="number" min="0" max="100" value={form.allocationPct} onChange={set('allocationPct')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Email</label>
                  <input type="email" value={form.email} onChange={set('email')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label>
                  <input value={form.phone} onChange={set('phone')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">NRIC / Passport</label>
                  <input value={form.nricPassport} onChange={set('nricPassport')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.isMinor} onChange={e => setForm(f => ({ ...f, isMinor: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
                  <span className="text-sm text-text-primary font-medium">Is Minor</span>
                </label>
              </div>
              {form.isMinor && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Guardian Name</label>
                  <input value={form.guardianName} onChange={set('guardianName')} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-border text-text-secondary hover:text-text-primary">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? 'Adding…' : 'Add Beneficiary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Notes Tab ─────────────────────────────────────────────────────
const NotesTab = ({ contactId }: { contactId: string }) => {
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    crmService.listActivities({ contactId, activityType: 'NOTE' })
      .then(() => {}) // activities, not notes — use note list via listActivities
      .catch(() => {});
    // Notes are included in contact; we fetch separately via a note create/list pattern
    // Since there's no listNotes endpoint, initialize empty and populate on create
    setLoading(false);
  }, [contactId]);

  const handleAdd = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const note = await crmService.createNote({ content: content.trim(), contactId });
      setNotes(prev => [note, ...prev]);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Add Note</h3>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          placeholder="Write a note…"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none mb-3"
        />
        <button
          onClick={handleAdd}
          disabled={submitting || !content.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add Note'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-8 text-text-secondary text-sm">No notes yet — add one above.</div>
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="bg-bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-secondary">
                  {n.author ? `${n.author.firstName} ${n.author.lastName}` : 'Unknown'}
                </span>
                <span className="text-xs text-text-secondary">{formatDate(n.createdAt)}</span>
              </div>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{n.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────
const CrmContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contact, setContact] = useState<CrmContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set(['overview']));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    crmService.getContact(id)
      .then(setContact)
      .catch(() => navigate('/crm/contacts'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setLoadedTabs(prev => new Set([...prev, tab]));
  };

  if (loading) return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      {[...Array(4)].map((_, i) => <SkeletonLine key={i} />)}
    </div>
  );
  if (!contact) return null;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',      label: 'Overview',       icon: 'person' },
    { key: 'kyc',           label: 'KYC',            icon: 'verified_user' },
    { key: 'trust',         label: 'Trust Products', icon: 'account_balance' },
    { key: 'beneficiaries', label: 'Beneficiaries',  icon: 'group' },
    { key: 'deals',         label: 'Linked Deals',   icon: 'handshake' },
    { key: 'notes',         label: 'Notes',          icon: 'notes' },
  ];

  return (
    <>
      <CrmNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
        <Link to="/crm" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">CRM</Link>
        <span>/</span>
        <Link to="/crm/contacts" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Contacts</Link>
        <span>/</span>
        <span className="font-semibold text-text-primary">{contact.firstName} {contact.lastName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-black text-xl shrink-0">
          {contact.firstName[0]}{contact.lastName[0]}
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-text-primary">{contact.firstName} {contact.lastName}</h1>
            {contact.isPrimary && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">Primary Contact</span>
            )}
          </div>
          <p className="text-text-secondary text-sm mt-1">
            {contact.jobTitle || ''}
            {contact.jobTitle && contact.account ? ' · ' : ''}
            {contact.account ? (
              <Link to={`/crm/accounts/${contact.account.id}`} className="text-brand-700 hover:underline" style={{ textDecoration: 'none' }}>
                {contact.account.name}
              </Link>
            ) : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === t.key
                ? 'bg-brand-600 text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="bg-bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Contact Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {[
              { label: 'Email',       value: contact.email,            icon: 'mail' },
              { label: 'Phone',       value: contact.phone,            icon: 'call' },
              { label: 'Mobile',      value: contact.mobile,           icon: 'smartphone' },
              { label: 'Department',  value: contact.department,       icon: 'corporate_fare' },
              { label: 'Account',     value: contact.account?.name,    icon: 'business' },
              { label: 'Created',     value: formatDate(contact.createdAt), icon: 'calendar_today' },
            ].map(f => f.value && (
              <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                <span className="text-xs text-text-secondary w-24 shrink-0">{f.label}</span>
                <span className="text-sm text-text-primary">{f.value}</span>
              </div>
            ))}
          </div>
          {contact.description && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-text-secondary mb-1">Description</p>
              <p className="text-sm text-text-primary leading-relaxed">{contact.description}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'kyc' && loadedTabs.has('kyc') && id && (
        <KycTab contactId={id} />
      )}

      {activeTab === 'trust' && loadedTabs.has('trust') && id && (
        <TrustTab contactId={id} accountId={contact.accountId} />
      )}

      {activeTab === 'beneficiaries' && loadedTabs.has('beneficiaries') && id && (
        <BeneficiariesTab contactId={id} />
      )}

      {activeTab === 'deals' && (
        <div>
          {(contact.opportunities ?? []).length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">No linked deals.</div>
          ) : (
            <div className="space-y-3">
              {(contact.opportunities ?? []).map((o: CrmOpportunity) => (
                <Link key={o.id} to={`/crm/opportunities/${o.id}`} style={{ textDecoration: 'none' }}>
                  <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary text-sm">{o.name}</p>
                    </div>
                    {o.stage && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: `${STAGE_COLORS[o.stage.name] ?? '#6366f1'}20`, color: STAGE_COLORS[o.stage.name] ?? '#6366f1' }}>
                        {o.stage.name}
                      </span>
                    )}
                    <span className="text-sm font-bold text-text-primary">{formatCurrency(o.value)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && loadedTabs.has('notes') && id && (
        <NotesTab contactId={id} />
      )}
    </div>
    </>
  );
};

export default CrmContactDetail;
