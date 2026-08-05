import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import crmService, {
  CrmContact, CrmOpportunity, CrmLead, CrmKycRecord, CrmNote, CrmAccount, CrmBeneficiary,
  CrmActivity, CrmActivityType, ContactAccountRole,
} from '../src/services/crm.service';
import AiInsightCard from '../src/components/crm/AiInsightCard';
import StateBadge from '../src/components/ui/StateBadge';
import ConfirmDialog from '../src/components/ConfirmDialog';
import { cleanFormPayload, NUMERIC_KEYS } from '../src/utils/crmFormHelper';
import { validateContact, validateBeneficiary, ValidationError } from '../src/utils/crmValidation';
import EmptyState from '../src/components/ui/EmptyState';
import InlineEdit from '../src/components/crm/InlineEdit';
import { hasPermission } from '../src/utils/permissions';
import { useAuth } from '../src/context/AuthContext';
import CrmAuditLog from '../src/components/crm/CrmAuditLog';
import { useNextBestAction, useDraftMessage, useKycGaps, useRiskProfile } from '../src/hooks/useCrmAi';
import Contact360Profile from '../src/components/crm/Contact360Profile';
import Contact360Insights from '../src/components/crm/Contact360Insights';
import Customer360KpiCard from '../src/components/crm/Customer360KpiCard';

// ── Design tokens (Kinetic Enterprise) ──────────────────────────────
const T = {
  teal: '#006a61',
  tealLight: '#86f2e4',
  tealDark: '#006f66',
  surface: '#f8f9ff',
  surfaceLow: '#eff4ff',
  white: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0b1c30',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  success: '#22c55e',
  error: '#ba1a1a',
  warning: '#f59e0b',
};

// ── Formatters ────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 });
const formatCurrency = (val: number | null | undefined) => (val != null ? fmt.format(val) : '—');
const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const SkeletonLine = ({ mb = 12 }: { mb?: number }) => (
  <div style={{ height: 18, marginBottom: mb, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
);

const ACTIVITY_ICONS: Record<CrmActivityType, string> = {
  CALL: 'call', EMAIL: 'mail', MEETING: 'groups', NOTE: 'sticky_note_2', TASK: 'task_alt', FOLLOW_UP: 'notifications',
  WHATSAPP: 'chat', SITE_VISIT: 'location_on',
};

// ── Tab types ─────────────────────────────────────────────────────
type Tab = 'overview' | 'activities' | 'kyc' | 'deals' | 'notes' | 'beneficiaries' | 'audit';

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
            <span className="text-xs font-bold px-3 py-1 rounded-full">
              <StateBadge state={kyc ? kyc.status : 'PENDING'} size="sm" />
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-muted text-text-tertiary">
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
          <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--color-danger)' }}>
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
              <input type="checkbox" checked={form[key] as boolean} onChange={() => toggle(key)} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-text-primary">{label}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Risk Level</label>
            <select value={form.riskLevel} onChange={e => setForm(f => ({ ...f, riskLevel: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary">
              <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-3 cursor-pointer pb-2">
              <input type="checkbox" checked={form.isPep} onChange={() => toggle('isPep')} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-text-primary font-medium">PEP (Politically Exposed Person)</span>
            </label>
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-semibold text-text-secondary mb-1">Internal Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none"
            placeholder="Additional KYC notes…" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save KYC'}
          </button>
          {kyc && kyc.status !== 'APPROVED' && (
            <button onClick={handleApprove} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-success text-success hover:bg-success/10 disabled:opacity-50">
              Approve KYC
            </button>
          )}
        </div>
      </div>
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
    crmService.listNotes({ contactId })
      .then(res => setNotes(res.notes))
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Write a note…"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none mb-3" />
        <button onClick={handleAdd} disabled={submitting || !content.trim()}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add Note'}
        </button>
      </div>
      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <SkeletonLine key={i} mb={20} />)}</div>
      ) : notes.length === 0 ? (
        <EmptyState icon="sticky_note_2" title="No notes yet" description="Add notes to keep track of important information." />
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="bg-bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-secondary">{n.author ? `${n.author.firstName} ${n.author.lastName}` : 'Unknown'}</span>
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

// ── Beneficiaries Tab ─────────────────────────────────────────────
const emptyBenForm = {
  firstName: '', lastName: '', relationship: 'CHILD', allocationPct: 0,
  email: '', phone: '', nricPassport: '', dateOfBirth: '',
  isMinor: false, guardianName: '', notes: '',
};

const BeneficiariesTab = ({ contactId }: { contactId: string }) => {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<CrmBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<CrmBeneficiary | null>(null);
  const [benForm, setBenForm] = useState({ ...emptyBenForm });
  const [submitting, setSubmitting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletingBen, setDeletingBen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CrmBeneficiary | null>(null);
  const [benFormErrors, setBenFormErrors] = useState<ValidationError[]>([]);
  const totalAllocation = beneficiaries.reduce((sum, b) => sum + (b.allocationPct ?? 0), 0);

  const loadBeneficiaries = () => {
    setLoading(true);
    crmService.listBeneficiaries(contactId)
      .then(res => setBeneficiaries(Array.isArray(res) ? res : []))
      .catch(() => setBeneficiaries([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadBeneficiaries(); }, [contactId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => { setBenForm({ ...emptyBenForm }); setBenFormErrors([]); setShowCreate(true); };
  const openEdit = (b: CrmBeneficiary) => {
    setEditingBeneficiary(b); setBenFormErrors([]);
    setBenForm({ firstName: b.firstName ?? '', lastName: b.lastName ?? '', relationship: b.relationship ?? 'OTHER', allocationPct: b.allocationPct ?? 0, email: b.email ?? '', phone: b.phone ?? '', nricPassport: b.nricPassport ?? '', dateOfBirth: b.dateOfBirth ?? '', isMinor: b.isMinor ?? false, guardianName: b.guardianName ?? '', notes: b.notes ?? '' });
    setShowEdit(true);
  };
  const confirmDelete = (b: CrmBeneficiary) => { setDeleteTarget(b); setShowDelete(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateBeneficiary(benForm);
    if (errors.length > 0) { setBenFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const payload = { ...benForm, allocationPct: Number(benForm.allocationPct) };
      const created = await crmService.createBeneficiary(contactId, payload);
      setBeneficiaries(prev => [...prev, created]); setShowCreate(false);
    } catch (err) { console.error('Failed to create beneficiary', err); }
    finally { setSubmitting(false); }
  };
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBeneficiary) return;
    const errors = validateBeneficiary(benForm);
    if (errors.length > 0) { setBenFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const payload = { ...benForm, allocationPct: Number(benForm.allocationPct) };
      const updated = await crmService.updateBeneficiary(editingBeneficiary.id, payload);
      setBeneficiaries(prev => prev.map(b => b.id === updated.id ? updated : b));
      setShowEdit(false); setEditingBeneficiary(null);
    } catch (err) { console.error('Failed to update beneficiary', err); }
    finally { setSubmitting(false); }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingBen(true);
    try {
      await crmService.deleteBeneficiary(deleteTarget.id);
      setBeneficiaries(prev => prev.filter(b => b.id !== deleteTarget.id));
      setShowDelete(false); setDeleteTarget(null);
    } catch (err) { console.error('Failed to delete beneficiary', err); }
    finally { setDeletingBen(false); }
  };

  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '—';
  const maskNric = (s?: string) => s ? s.replace(/(.{3}).+(.{2})/, '$1****$2') : '—';

  const benModal = (isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { isEdit ? setShowEdit(false) : setShowCreate(false); setBenFormErrors([]); }}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-black text-text-primary mb-4">{isEdit ? 'Edit Beneficiary' : 'Add Beneficiary'}</h2>
        <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label>
              <input required value={benForm.firstName} onChange={e => setBenForm(f => ({ ...f, firstName: e.target.value }))}
                className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${benFormErrors.some(e => e.field === 'firstName') ? ' !border-red-500' : ''}`} />
              {benFormErrors.some(e => e.field === 'firstName') && (<p className="text-xs text-red-600 mt-1">{benFormErrors.find(e => e.field === 'firstName')?.message}</p>)}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Last Name *</label>
              <input required value={benForm.lastName} onChange={e => setBenForm(f => ({ ...f, lastName: e.target.value }))}
                className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${benFormErrors.some(e => e.field === 'lastName') ? ' !border-red-500' : ''}`} />
              {benFormErrors.some(e => e.field === 'lastName') && (<p className="text-xs text-red-600 mt-1">{benFormErrors.find(e => e.field === 'lastName')?.message}</p>)}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Relationship *</label>
              <select required value={benForm.relationship} onChange={e => setBenForm(f => ({ ...f, relationship: e.target.value }))}
                className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${benFormErrors.some(e => e.field === 'relationship') ? ' !border-red-500' : ''}`}>
                <option value="SPOUSE">Spouse</option><option value="CHILD">Child</option><option value="PARENT">Parent</option><option value="SIBLING">Sibling</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Allocation % *</label>
              <input type="number" min={0} max={100} required value={benForm.allocationPct}
                onChange={e => setBenForm(f => ({ ...f, allocationPct: Number(e.target.value) }))}
                className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${benFormErrors.some(e => e.field === 'allocationPct') ? ' !border-red-500' : ''}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-text-secondary mb-1">Email</label><input type="email" value={benForm.email} onChange={e => setBenForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label><input value={benForm.phone} onChange={e => setBenForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-text-secondary mb-1">NRIC / Passport</label><input value={benForm.nricPassport} onChange={e => setBenForm(f => ({ ...f, nricPassport: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
            <div><label className="block text-xs font-semibold text-text-secondary mb-1">Date of Birth</label><input type="date" value={benForm.dateOfBirth} onChange={e => setBenForm(f => ({ ...f, dateOfBirth: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={benForm.isMinor} onChange={e => setBenForm(f => ({ ...f, isMinor: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-text-primary font-medium">Minor</span>
          </label>
          {benForm.isMinor && (<div><label className="block text-xs font-semibold text-text-secondary mb-1">Guardian Name</label><input value={benForm.guardianName} onChange={e => setBenForm(f => ({ ...f, guardianName: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>)}
          <div><label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label><textarea value={benForm.notes} onChange={e => setBenForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary resize-none" placeholder="Additional notes…" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { isEdit ? setShowEdit(false) : setShowCreate(false); setBenFormErrors([]); }}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
              style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Beneficiary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Beneficiaries</h3>
          <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50" style={{ border: 'none', cursor: 'pointer' }}>+ Add Beneficiary</button>
        </div>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <SkeletonLine key={i} />)}</div>
        ) : beneficiaries.length === 0 ? (
          <div className="text-center py-8 text-text-secondary text-sm">No beneficiaries yet. Add one.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-text-secondary text-xs font-semibold uppercase tracking-wider">
                  <th className="text-left py-3 px-2">Name</th><th className="text-left py-3 px-2">Relationship</th><th className="text-left py-3 px-2">Allocation</th><th className="text-left py-3 px-2">NRIC/Passport</th><th className="text-left py-3 px-2">DOB</th><th className="text-left py-3 px-2">Minor</th><th className="text-right py-3 px-2">Actions</th>
                </tr></thead>
                <tbody>
                  {beneficiaries.map(b => (
                    <tr key={b.id} className="border-b border-border last:border-0 hover:bg-bg-subtle transition-colors">
                      <td className="py-3 px-2 font-medium text-text-primary">{b.firstName} {b.lastName}</td>
                      <td className="py-3 px-2 text-text-secondary">{capitalize(b.relationship)}</td>
                      <td className="py-3 px-2 text-text-primary font-semibold">{b.allocationPct}%</td>
                      <td className="py-3 px-2 text-text-secondary font-mono text-xs">{maskNric(b.nricPassport)}</td>
                      <td className="py-3 px-2 text-text-secondary">{formatDate(b.dateOfBirth)}</td>
                      <td className="py-3 px-2">{b.isMinor ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning">Minor</span> : <span className="text-xs text-text-tertiary">—</span>}</td>
                      <td className="py-3 px-2 text-right">
                        <button onClick={() => openEdit(b)} className="text-xs text-brand-600 hover:underline mr-3" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Edit</button>
                        {hasPermission(user, 'crm:delete') && (<button onClick={() => confirmDelete(b)} className="text-xs text-red-600 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Delete</button>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-secondary">Total Allocation</span>
                <span className={`text-sm font-bold ${totalAllocation === 100 ? 'text-success' : totalAllocation > 100 ? 'text-danger' : 'text-warning'}`}>{totalAllocation}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${totalAllocation === 100 ? 'bg-success' : totalAllocation > 100 ? 'bg-danger' : 'bg-warning'}`} style={{ width: `${Math.min(totalAllocation, 100)}%` }} />
              </div>
              {totalAllocation !== 100 && (
                <p className={`text-xs mt-2 ${totalAllocation > 100 ? 'text-danger' : 'text-warning'}`}>
                  {totalAllocation > 100 ? 'Allocation exceeds 100%. Please adjust beneficiary allocations.' : `${100 - totalAllocation}% of allocation is unassigned.`}
                </p>
              )}
            </div>
          </>
        )}
      </div>
      {showCreate && benModal(false)}
      {showEdit && benModal(true)}
      <ConfirmDialog open={showDelete} title="Delete Beneficiary" message={`Are you sure you want to delete ${deleteTarget?.firstName} ${deleteTarget?.lastName}? This action cannot be undone.`} confirmLabel="Delete" confirmVariant="danger" onConfirm={handleDelete} onCancel={() => { setShowDelete(false); setDeleteTarget(null); }} loading={deletingBen} />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — Contact 360 Workspace (3-column layout)
// ═════════════════════════════════════════════════════════════════════
const CrmContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contact, setContact] = useState<CrmContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set(['overview']));

  // ── Edit modal state ───────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);
  const [accounts, setAccounts] = useState<CrmAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [contactRoles, setContactRoles] = useState<ContactAccountRole[]>([]);

  // ── Delete state ───────────────────────────────────────────────────
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Activity state ─────────────────────────────────────────────────
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [activityForm, setActivityForm] = useState<Partial<CrmActivity>>({ activityType: 'CALL' });
  const [editingActivity, setEditingActivity] = useState<CrmActivity | null>(null);
  const [editActivityForm, setEditActivityForm] = useState<Partial<CrmActivity>>({});
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [savingActivity, setSavingActivity] = useState(false);

  // ── Activity pagination state ──────────────────────────────────────
  const [activityPage, setActivityPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);

  // ── AI state — using hooks ───────────────────────────────────────────
  const [draftModal, setDraftModal] = useState(false);
  const [draftConfig, setDraftConfig] = useState<{ channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }>({ channel: 'whatsapp', tone: 'friendly' });
  const draftMsg = useDraftMessage();
  const kycGapsHook = useKycGaps();
  const riskProfileHook = useRiskProfile();
  const nba = useNextBestAction();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    crmService.getContact(id)
      .then(setContact)
      .catch(() => navigate('/crm/contacts'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Auto-fetch AI data when contact loads
  useEffect(() => {
    if (contact?.id) nba.fetch('contact', contact.id);
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!contact) return;
    kycGapsHook.fetch(contact.id);
    riskProfileHook.fetch(contact.id);
    crmService.getContactAccountRoles({ contactId: contact.id }).then(setContactRoles).catch(() => {});
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI handlers ─────────────────────────────────────────────────────
  const handleDraftMessage = () => {
    if (!contact) return;
    draftMsg.draftForContact(contact.id, draftConfig);
  };

  // ── Edit modal handlers ───────────────────────────────────────────────
  const openEdit = (c: CrmContact) => {
    setFormErrors([]);
    setEditForm({
      firstName: c.firstName ?? '', lastName: c.lastName ?? '', email: c.email ?? '',
      phone: c.phone ?? '', mobile: c.mobile ?? '', jobTitle: c.jobTitle ?? '',
      department: c.department ?? '', accountId: c.accountId ?? '', isPrimary: c.isPrimary ?? false,
      nricPassport: (c as any).nricPassport ?? '',
    });
    setShowEdit(true);
    if (accounts.length === 0) {
      setLoadingAccounts(true);
      crmService.listAccounts({ limit: 200 }).then(res => setAccounts(res.accounts)).catch(() => {}).finally(() => setLoadingAccounts(false));
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const errors = validateContact(editForm);
    if (errors.length > 0) { setFormErrors(errors); return; }
    setSavingEdit(true);
    try {
      const payload = cleanFormPayload(editForm, NUMERIC_KEYS.contact);
      const updated = await crmService.updateContact(id, payload);
      setContact(updated);
      setShowEdit(false);
    } catch (err) { console.error('Failed to update contact', err); }
    finally { setSavingEdit(false); }
  };

  // ── Delete handler ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await crmService.deleteContact(id);
      navigate('/crm/contacts');
    } catch (err) { console.error('Failed to delete contact', err); }
    finally { setDeleting(false); }
  };

  // ── Activity handlers ───────────────────────────────────────────────
  const reload = () => {
    if (!id) return;
    crmService.getContact(id).then(setContact).catch(() => navigate('/crm/contacts'));
  };

  useEffect(() => {
    if (contact && contact.activities) {
      setHasMoreActivities(contact.activities.length >= 10);
      setActivityPage(1);
    }
  }, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSavingActivity(true);
      await crmService.createActivity({ ...activityForm, contactId: id });
      setShowAddActivity(false);
      setActivityForm({ activityType: 'CALL' });
      reload();
    } catch (e) { console.error(e); }
    finally { setSavingActivity(false); }
  };

  const handleSetReminder = async (activityId: string) => {
    try {
      await crmService.sendActivityReminder(activityId);
      setContact(prev => prev ? { ...prev, activities: (prev.activities ?? []).map(a => a.id === activityId ? { ...a, reminderSent: true } : a) } : prev);
    } catch (e) { console.error(e); }
  };

  const openEditActivity = (a: CrmActivity) => {
    setEditingActivity(a);
    setEditActivityForm({ activityType: a.activityType, subject: a.subject, description: a.description ?? '', scheduledAt: a.scheduledAt ? a.scheduledAt.slice(0, 16) : '' });
  };

  const handleEditActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    try { setSavingActivity(true); await crmService.updateActivity(editingActivity.id, editActivityForm); setEditingActivity(null); reload(); }
    catch (e) { console.error(e); } finally { setSavingActivity(false); }
  };

  const handleDeleteActivity = async () => {
    if (!deletingActivityId) return;
    try { setSavingActivity(true); await crmService.deleteActivity(deletingActivityId); setDeletingActivityId(null); reload(); }
    catch (e) { console.error(e); } finally { setSavingActivity(false); }
  };

  const handleLoadMoreActivities = async () => {
    if (!id || loadingMoreActivities) return;
    setLoadingMoreActivities(true);
    try {
      const nextPage = activityPage + 1;
      const result = await crmService.listActivities({ contactId: id, page: nextPage, limit: 10 });
      const newActivities = result.activities ?? [];
      setContact(prev => prev ? { ...prev, activities: [...(prev.activities ?? []), ...newActivities] } : prev);
      setActivityPage(nextPage);
      setHasMoreActivities(newActivities.length >= 10);
    } catch (e) { console.error(e); } finally { setLoadingMoreActivities(false); }
  };

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setLoadedTabs(prev => new Set([...prev, tab]));
  };

  // ── Inline edit handler ─────────────────────────────────────────────
  const handleInlineSave = async (fieldName: string, value: string) => {
    if (!id) return;
    const updated = await crmService.updateContact(id, { [fieldName]: value });
    setContact(updated);
  };

  // ── Loading guard ───────────────────────────────────────────────────
  if (loading) return (
    <div className="px-4 sm:px-8 py-4 sm:py-8" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-3 space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} mb={16} />)}</div>
        <div className="col-span-6 space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} mb={16} />)}</div>
        <div className="col-span-3 space-y-4">{[...Array(4)].map((_, i) => <SkeletonLine key={i} mb={16} />)}</div>
      </div>
    </div>
  );
  if (!contact) return null;

  // Type guard for activities
  const activities = contact.activities ?? [];
  const fullName = `${contact.firstName} ${contact.lastName}`;

  // Derived: health score
  const lastActivityDate = activities.length > 0
    ? new Date(Math.max(...activities.map(a => new Date(a.createdAt).getTime())))
    : new Date(contact.updatedAt);
  const daysSince = Math.max(0, Math.floor((Date.now() - lastActivityDate.getTime()) / 86400000));
  const healthScore = Math.max(0, Math.min(100, 100 - Math.min(daysSince * 2, 60) + Math.min(activities.length * 3, 40)));

  // Tab config — 5 main tabs, KYC & Beneficiaries in "More"
  const mainTabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',   label: 'Overview',       icon: 'person' },
    { key: 'activities', label: 'Activities',     icon: 'timeline' },
    { key: 'deals',      label: 'Linked Deals',   icon: 'handshake' },
    { key: 'notes',      label: 'Notes',          icon: 'notes' },
  ];
  const moreTabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'kyc',           label: 'KYC',            icon: 'verified_user' },
    { key: 'beneficiaries', label: 'Beneficiaries',  icon: 'family_restroom' },
    { key: 'audit',         label: 'Audit Log',      icon: 'history' },
  ];
  const allTabs = [...mainTabs, ...moreTabs];

  // ══════════════════════════════════════════════════════════════════
  // RENDER — 3-column Contact 360 Workspace
  // ══════════════════════════════════════════════════════════════════
  return (
    <>
      <div className="flex min-h-[calc(100vh-48px)]" style={{ maxWidth: 1680, margin: '0 auto' }}>

        {/* ── LEFT PANEL: Contact Profile ─────────────────────────── */}
        <section className="hidden lg:flex lg:w-80 shrink-0 flex-col border-r overflow-y-auto p-4 custom-scrollbar"
          style={{ borderColor: T.border, background: T.white, position: 'sticky', top: 0, height: 'calc(100vh - 48px)' }}
        >
          <Contact360Profile contact={contact} onEdit={() => openEdit(contact)} />
        </section>

        {/* ── CENTER PANEL: Workspace ─────────────────────────────── */}
        <section className="flex-1 flex flex-col min-w-0" style={{ background: T.surface }}>

          {/* Glass header */}
          <div
            className="shrink-0 sticky top-0 z-30 border-b px-6 py-4"
            style={{ backdropFilter: 'blur(8px)', background: 'rgba(255, 255, 255, 0.9)', borderBottomColor: T.border }}
          >
            <div className="flex justify-between items-end">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  {/* Mobile: profile toggle */}
                  <button onClick={() => openEdit(contact)} className="lg:hidden p-1.5 rounded-lg mr-1"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSecondary }}>
                    <span className="material-symbols-outlined text-[20px]">account_circle</span>
                  </button>
                  <h1 className="text-[24px] font-semibold leading-8 truncate" style={{ color: T.textPrimary }}>
                    {fullName}
                  </h1>
                  {contact.isPrimary && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${T.teal}15`, color: T.teal }}>
                      Primary
                    </span>
                  )}
                  {/* Health score badge */}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: healthScore >= 70 ? `${T.success}15` : healthScore >= 40 ? `${T.warning}15` : `${T.error}15`,
                      color: healthScore >= 70 ? T.success : healthScore >= 40 ? T.warning : T.error,
                    }}>
                    {healthScore}/100
                  </span>
                </div>
                <p className="text-[13px]" style={{ color: T.textMuted }}>
                  {contact.jobTitle || ''}
                  {contact.jobTitle && contact.account ? ' · ' : ''}
                  {contact.account && (
                    <Link to={`/crm/accounts/${contact.account.id}`} style={{ color: T.teal, textDecoration: 'none' }} className="hover:underline font-semibold">
                      {contact.account.name}
                    </Link>
                  )}
                </p>
              </div>
              {/* Delete button (right) */}
              {hasPermission(user, 'crm:delete') && (
                <button onClick={() => setShowDelete(true)} className="p-2 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Delete contact">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: T.error }}>delete</span>
                </button>
              )}
            </div>

            {/* Action toolbar */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <ToolbarBtn icon="call" label="Log Call" onClick={() => { setShowAddActivity(true); setActivityForm({ activityType: 'CALL' }); }} />
              <ToolbarBtn icon="chat" label="WhatsApp" onClick={() => { setShowAddActivity(true); setActivityForm({ activityType: 'WHATSAPP' }); }} />
              <ToolbarBtn icon="mail" label="Email" onClick={() => { setShowAddActivity(true); setActivityForm({ activityType: 'EMAIL' }); }} />
              <ToolbarBtn icon="auto_awesome" label="Draft Msg" onClick={() => setDraftModal(true)} accent />
              <ToolbarBtn icon="edit_note" label="Add Note" onClick={() => switchTab('notes')} />
            </div>
          </div>

          {/* Tab navigation */}
          <div className="shrink-0 px-6 border-b" style={{ borderBottomColor: T.border }}>
            <div className="flex items-center gap-1 overflow-x-auto">
              {mainTabs.map(t => (
                <button key={t.key} onClick={() => switchTab(t.key)}
                  className="relative flex items-center gap-1.5 px-4 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: activeTab === t.key ? T.teal : T.textMuted,
                    borderBottom: activeTab === t.key ? `2px solid ${T.teal}` : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
              {/* More dropdown */}
              <div className="relative group">
                <button
                  className="flex items-center gap-1 px-3 py-3 text-[13px] font-semibold whitespace-nowrap"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: moreTabs.some(t => t.key === activeTab) ? T.teal : T.textMuted,
                    borderBottom: moreTabs.some(t => t.key === activeTab) ? `2px solid ${T.teal}` : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                  More
                </button>
                <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-40"
                  style={{ borderColor: T.border }}>
                  {moreTabs.map(t => (
                    <button key={t.key} onClick={() => switchTab(t.key)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-[13px] text-left hover:bg-gray-50 transition-colors"
                      style={{ background: activeTab === t.key ? T.surfaceLow : 'none', border: 'none', cursor: 'pointer', color: activeTab === t.key ? T.teal : T.textPrimary }}
                    >
                      <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tab content ─────────────────────────────────────────── */}
          <div className="p-6 space-y-6">

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <>
                {/* KPI Cards row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Customer360KpiCard label="Client Since" value={formatDate(contact.createdAt)} />
                  <Customer360KpiCard label="Active Deals" value={String((contact.opportunities ?? []).filter(o => o.stage && !o.stage.isWonStage && !o.stage.isLostStage).length)} />
                  <Customer360KpiCard label="KYC Status" value={(() => {
                    const kycStatus = (contact as any).kycStatus;
                    if (kycStatus === 'APPROVED') return 'Verified';
                    if (kycStatus === 'REJECTED') return 'Rejected';
                    return 'Pending';
                  })()} />
                </div>

                {/* Contact Information */}
                <div className="bg-bg-surface border border-border rounded-xl p-5">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    {[
                      { label: 'First Name', fieldName: 'firstName', value: contact.firstName, icon: 'badge' },
                      { label: 'Last Name',  fieldName: 'lastName',  value: contact.lastName,  icon: 'badge' },
                      { label: 'Email',       fieldName: 'email',     value: contact.email,      icon: 'mail' },
                      { label: 'Phone',       fieldName: 'phone',    value: contact.phone,     icon: 'call' },
                      { label: 'Mobile',      fieldName: 'mobile',   value: contact.mobile,    icon: 'smartphone' },
                      { label: 'Job Title',   fieldName: 'jobTitle', value: contact.jobTitle,  icon: 'work' },
                      { label: 'Department',  fieldName: 'department', value: contact.department, icon: 'corporate_fare' },
                    ].map(f => (
                      <div key={f.fieldName} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                        <span className="text-xs text-text-secondary w-24 shrink-0">{f.label}</span>
                        <InlineEdit value={f.value ?? ''} type="text" onSave={(val) => handleInlineSave(f.fieldName, val)} />
                      </div>
                    ))}
                    {/* NRIC */}
                    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">fingerprint</span>
                      <span className="text-xs text-text-secondary w-24 shrink-0">NRIC / Passport</span>
                      <InlineEdit value={(contact as any).nricPassport ?? ''} type="text" onSave={(val) => handleInlineSave('nricPassport', val)} />
                    </div>
                    {/* Account link */}
                    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">business</span>
                      <span className="text-xs text-text-secondary w-24 shrink-0">Account</span>
                      {contact.account ? (
                        <Link to={`/crm/accounts/${contact.account.id}`} className="text-sm text-brand-700 hover:underline">{contact.account.name}</Link>
                      ) : (<span className="text-sm text-text-secondary">—</span>)}
                    </div>
                    {/* Multi-account associations */}
                    {contactRoles.length > 0 && (
                      <div className="mt-1">
                        <span className="text-xs text-text-secondary font-semibold">Also associated with</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {contactRoles.map(r => (
                            <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              <Link to={`/crm/accounts/${r.accountId}`} className="hover:underline">{r.account?.name ?? r.accountId}</Link>
                              <span className="text-blue-400">·</span><span>{r.role}</span>
                              <button className="text-blue-400 hover:text-red-500 ml-0.5" title="Remove association"
                                onClick={async () => { await crmService.removeContactAccountRole(r.id); crmService.getContactAccountRoles({ contactId: contact!.id }).then(setContactRoles); }}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Is Primary */}
                    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">star</span>
                      <span className="text-xs text-text-secondary w-24 shrink-0">Is Primary</span>
                      <span className="text-sm text-text-primary">{contact.isPrimary ? 'Yes' : 'No'}</span>
                    </div>
                    {/* Active */}
                    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">check_circle</span>
                      <span className="text-xs text-text-secondary w-24 shrink-0">Active</span>
                      <span className="text-sm text-text-primary">{contact.isActive !== false ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  {contact.description && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-text-secondary mb-1">Description</p>
                      <p className="text-sm text-text-primary leading-relaxed">{contact.description}</p>
                    </div>
                  )}
                </div>

                {/* Recent Activities mini-timeline */}
                {activities.length > 0 && (
                  <div className="bg-bg-surface border border-border rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Recent Activity</h3>
                      <button onClick={() => switchTab('activities')} className="text-[12px] font-semibold" style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.teal }}>
                        View all →
                      </button>
                    </div>
                    <div className="space-y-3">
                      {activities.slice(0, 5).map(a => (
                        <div key={a.id} className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[16px]" style={{ color: T.teal }}>{ACTIVITY_ICONS[a.activityType] || 'event'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate" style={{ color: T.textPrimary }}>{a.subject}</p>
                            <p className="text-[11px]" style={{ color: T.textMuted }}>{formatDate(a.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Activities tab */}
            {activeTab === 'activities' && (
              <div className="space-y-3">
                {activities.length === 0 && <p className="text-text-secondary text-sm">No activities yet. Click "Log Activity" to add one.</p>}
                {activities.map((a: CrmActivity) => (
                  <div key={a.id} className="flex gap-4 bg-bg-surface border border-border rounded-xl p-4">
                    <span className="material-symbols-outlined text-brand-700 mt-0.5">{ACTIVITY_ICONS[a.activityType] || 'event'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary text-sm">{a.subject}</p>
                      {a.description && <p className="text-xs text-text-secondary mt-0.5 whitespace-pre-wrap">{a.description}</p>}
                      <p className="text-xs text-text-secondary mt-1">
                        {a.user ? `${a.user.firstName} ${a.user.lastName}` : ''} · {formatDate(a.createdAt)}
                        {a.scheduledAt && <span className="ml-2 text-brand-600">Scheduled: {formatDate(a.scheduledAt)}</span>}
                        {a.scheduledAt && !a.completedAt && new Date(a.scheduledAt) < new Date() && (
                          <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            <span className="material-symbols-outlined" style={{fontSize:11}}>warning</span>Overdue
                          </span>
                        )}
                        {a.reminderSent && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[10px]">notifications_active</span>Reminded
                          </span>
                        )}
                        {a.scheduledAt && new Date(a.scheduledAt) > new Date() && !a.reminderSent && (
                          <button onClick={() => handleSetReminder(a.id)} className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-600 hover:text-brand-700 px-1.5 py-0.5 rounded-full hover:bg-brand-50 transition-colors"
                            style={{ border: 'none', cursor: 'pointer', background: 'none' }} title="Send a reminder for this scheduled activity">
                            <span className="material-symbols-outlined text-[10px]">notifications</span>Set Reminder
                          </button>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0 ml-auto">
                      {hasPermission(user, 'crm:edit') && (
                        <button onClick={() => openEditActivity(a)} className="text-text-tertiary hover:text-brand-700 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} title="Edit activity">
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                      )}
                      {hasPermission(user, 'crm:delete') && (
                        <button onClick={() => setDeletingActivityId(a.id)} className="text-text-tertiary hover:text-danger transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} title="Delete activity">
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                      <span className="text-xs text-text-secondary">{a.activityType}</span>
                    </div>
                  </div>
                ))}
                {activities.length > 0 && hasMoreActivities && (
                  <div className="flex justify-center pt-2">
                    <button onClick={handleLoadMoreActivities} disabled={loadingMoreActivities}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-brand-700 border border-brand-200 hover:bg-brand-50 transition-colors disabled:opacity-50"
                      style={{ background: loadingMoreActivities ? 'var(--bg-subtle)' : 'var(--bg-surface)', cursor: loadingMoreActivities ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                      {loadingMoreActivities ? (<><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Loading…</>) : (<><span className="material-symbols-outlined text-base">expand_more</span>Load More</>)}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* KYC tab */}
            {activeTab === 'kyc' && loadedTabs.has('kyc') && id && (
              <div className="space-y-4">
                <KycTab contactId={id} />
                {/* AI KYC Gap Detector */}
                <AiInsightCard title="AI KYC Compliance Check" loading={kycGapsHook.loading} error={kycGapsHook.error} onRefresh={() => kycGapsHook.fetch(id)}>
                  {!kycGapsHook.data ? (
                    <button onClick={() => kycGapsHook.fetch(id)} className="text-sm text-brand-600 hover:underline"><span className="material-symbols-outlined text-sm">refresh</span>Refresh</button>
                  ) : (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 text-sm font-semibold ${kycGapsHook.data.isCompliant ? 'text-success' : 'text-danger'}`}>
                        <span className="material-symbols-outlined text-base">{kycGapsHook.data.isCompliant ? 'check_circle' : 'warning'}</span>{kycGapsHook.data.complianceSummary}
                      </div>
                      {kycGapsHook.data.gaps.length > 0 && (
                        <ul className="space-y-1">
                          {kycGapsHook.data.gaps.map((g, i) => (
                            <li key={i} className={`flex items-start gap-2 rounded-md px-2 py-1 text-xs ${g.severity === 'required' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                              <span className="material-symbols-outlined mt-0.5 text-sm">{g.severity === 'required' ? 'error' : 'info'}</span>
                              <span><span className="font-semibold">{g.field}:</span> {g.requirement}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-xs text-text-tertiary">AI-generated — verify against latest BNM guidelines.</p>
                    </div>
                  )}
                </AiInsightCard>
                {/* AI Risk Profile Classifier */}
                <AiInsightCard title="AI Risk Classification" loading={riskProfileHook.loading} error={riskProfileHook.error} onRefresh={() => riskProfileHook.fetch(id)}>
                  {!riskProfileHook.data ? (
                    <button onClick={() => riskProfileHook.fetch(id)} className="text-sm text-brand-600 hover:underline"><span className="material-symbols-outlined text-sm">refresh</span>Refresh</button>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${riskProfileHook.data.suggestedRiskTier === 'High' ? 'bg-danger/10 text-danger' : riskProfileHook.data.suggestedRiskTier === 'Medium' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                          {riskProfileHook.data.suggestedRiskTier} Risk
                        </span>
                        <span className="text-xs text-text-tertiary">(AI suggestion — agent must confirm)</span>
                      </div>
                      <p className="text-text-primary">{riskProfileHook.data.justification}</p>
                      <p className="text-xs text-text-secondary italic">{riskProfileHook.data.regulatoryBasis}</p>
                    </div>
                  )}
                </AiInsightCard>
              </div>
            )}

            {/* Deals tab */}
            {activeTab === 'deals' && (
              <div>
                {(contact.leads ?? []).length === 0 && (contact.opportunities ?? []).length === 0 ? (
                  <EmptyState icon="handshake" title="No linked deals" description="Leads and opportunities linked to this contact will appear here." />
                ) : (
                  <div className="space-y-6">
                    {(contact.leads ?? []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">Leads ({(contact.leads ?? []).length})</h4>
                        <div className="space-y-2">
                          {(contact.leads ?? []).map((l: CrmLead) => (
                            <Link key={l.id} to={`/crm/leads/${l.id}`} style={{ textDecoration: 'none' }}>
                              <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors">
                                <div className="flex-1 min-w-0"><p className="font-semibold text-text-primary text-sm">{l.title}</p>{l.contactName && <p className="text-xs text-text-secondary mt-0.5">{l.contactName}</p>}</div>
                                <StateBadge state={l.status} size="sm" />{l.estimatedValue && <span className="text-sm font-bold text-text-primary">{formatCurrency(l.estimatedValue)}</span>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {(contact.opportunities ?? []).length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3">Opportunities ({(contact.opportunities ?? []).length})</h4>
                        <div className="space-y-2">
                          {(contact.opportunities ?? []).map((o: CrmOpportunity) => (
                            <Link key={o.id} to={`/crm/opportunities/${o.id}`} style={{ textDecoration: 'none' }}>
                              <div className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors">
                                <div className="flex-1 min-w-0"><p className="font-semibold text-text-primary text-sm">{o.name}</p></div>
                                {o.stage && <StateBadge state={o.stage.name} size="sm" />}
                                <span className="text-sm font-bold text-text-primary">{formatCurrency(o.value)}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && loadedTabs.has('notes') && id && (<NotesTab contactId={id} />)}
            {activeTab === 'beneficiaries' && loadedTabs.has('beneficiaries') && id && (<BeneficiariesTab contactId={id} />)}
            {activeTab === 'audit' && loadedTabs.has('audit') && id && (<CrmAuditLog entityType="contact" entityId={id} />)}
          </div>
        </section>

        {/* ── RIGHT PANEL: Insights ───────────────────────────────── */}
        <section className="hidden xl:flex xl:w-80 shrink-0 flex-col border-l overflow-y-auto p-4 custom-scrollbar"
          style={{ borderColor: T.border, background: T.surfaceLow, position: 'sticky', top: 0, height: 'calc(100vh - 48px)' }}
        >
          <Contact360Insights contact={contact} nba={nba} kycGaps={kycGapsHook} riskProfile={riskProfileHook} onDraftMessage={() => setDraftModal(true)} />
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODALS (unchanged logic, outside the 3-col layout)
          ═══════════════════════════════════════════════════════════════ */}

      {/* Draft Message modal */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Draft Follow-Up Message</h2>
              <button onClick={() => setDraftModal(false)} className="text-text-tertiary hover:text-text-secondary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="mb-4 flex gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Channel</label>
                <select value={draftConfig.channel} onChange={(e) => setDraftConfig((p) => ({ ...p, channel: e.target.value as 'whatsapp' | 'email' }))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="whatsapp">WhatsApp</option><option value="email">Email</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Tone</label>
                <select value={draftConfig.tone} onChange={(e) => setDraftConfig((p) => ({ ...p, tone: e.target.value as 'formal' | 'friendly' }))}
                  className="rounded-md border border-border px-3 py-1.5 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                  <option value="friendly">Friendly</option><option value="formal">Formal</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleDraftMessage} disabled={draftMsg.loading}
                  className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer' }}>
                  {draftMsg.loading ? 'Drafting…' : 'Generate'}
                </button>
              </div>
            </div>
            {draftMsg.error && (<div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{draftMsg.error}</div>)}
            {draftMsg.result && (
              <div className="space-y-3">
                {draftMsg.result.subject && (<div><p className="mb-1 text-xs font-medium text-text-secondary">Subject</p><p className="rounded-md bg-surface-muted px-3 py-2 text-sm">{draftMsg.result.subject}</p></div>)}
                <div><p className="mb-1 text-xs font-medium text-text-secondary">Message</p><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={8} defaultValue={draftMsg.result.body} style={{ fontFamily: 'var(--font-sans)' }} /></div>
                <p className="text-xs text-text-tertiary">Edit as needed before sending. AI-generated — review before use.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete dialog */}
      <ConfirmDialog open={showDelete} title="Delete Contact" message={`Are you sure you want to delete ${contact?.firstName} ${contact?.lastName}? This action cannot be undone.`} confirmLabel="Delete" confirmVariant="danger" onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={deleting} />

      {/* Edit Contact modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowEdit(false); setFormErrors([]); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Edit Contact</h2>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-text-secondary mb-1">First Name *</label><input required value={editForm.firstName ?? ''} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${formErrors.some(e => e.field === 'firstName') ? ' !border-red-500' : ''}`} />{formErrors.some(e => e.field === 'firstName') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'firstName')?.message}</p>)}</div>
                <div><label className="block text-xs font-semibold text-text-secondary mb-1">Last Name *</label><input required value={editForm.lastName ?? ''} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${formErrors.some(e => e.field === 'lastName') ? ' !border-red-500' : ''}`} />{formErrors.some(e => e.field === 'lastName') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'lastName')?.message}</p>)}</div>
              </div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Email</label><input type="email" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${formErrors.some(e => e.field === 'email') ? ' !border-red-500' : ''}`} />{formErrors.some(e => e.field === 'email') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'email')?.message}</p>)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-text-secondary mb-1">Phone</label><input value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className={`w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary${formErrors.some(e => e.field === 'phone') ? ' !border-red-500' : ''}`} />{formErrors.some(e => e.field === 'phone') && (<p className="text-xs text-red-600 mt-1">{formErrors.find(e => e.field === 'phone')?.message}</p>)}</div>
                <div><label className="block text-xs font-semibold text-text-secondary mb-1">Mobile</label><input value={editForm.mobile ?? ''} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-text-secondary mb-1">Job Title</label><input value={editForm.jobTitle ?? ''} onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
                <div><label className="block text-xs font-semibold text-text-secondary mb-1">Department</label><input value={editForm.department ?? ''} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">NRIC / Passport</label><input value={(editForm as any).nricPassport ?? ''} onChange={e => setEditForm(f => ({ ...f, nricPassport: e.target.value }))} placeholder="e.g. 900101-14-5678" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary font-mono" /></div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Account</label><select value={editForm.accountId ?? ''} onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-bg-surface text-text-primary" disabled={loadingAccounts}><option value="">— None —</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={!!editForm.isPrimary} onChange={e => setEditForm(f => ({ ...f, isPrimary: e.target.checked }))} className="w-4 h-4 accent-brand-600" /><span className="text-sm text-text-primary font-medium">Primary Contact</span></label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowEdit(false); setFormErrors([]); }} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors" style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingEdit} className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Activity modal */}
      {showAddActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Log Activity</h2>
            <form onSubmit={handleAddActivity} className="space-y-4">
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Type</label><select value={activityForm.activityType} onChange={e => setActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }}>{(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Subject *</label><input required value={activityForm.subject ?? ''} onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} /></div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Description</label><textarea rows={5} value={activityForm.description ?? ''} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-vertical" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddActivity(false); setActivityForm({ activityType: 'CALL' }); }} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors" style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingActivity} className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{savingActivity ? 'Saving…' : 'Log Activity'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Activity modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditingActivity(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Edit Activity</h2>
            <form onSubmit={handleEditActivity} className="space-y-4">
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Type</label><select value={editActivityForm.activityType} onChange={e => setEditActivityForm(f => ({ ...f, activityType: e.target.value as CrmActivityType }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }}>{(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP', 'WHATSAPP', 'SITE_VISIT'] as CrmActivityType[]).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Subject *</label><input required value={editActivityForm.subject ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, subject: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} /></div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Description</label><textarea rows={5} value={editActivityForm.description ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-vertical" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} /></div>
              <div><label className="block text-xs font-semibold text-text-secondary mb-1">Scheduled At</label><input type="datetime-local" value={editActivityForm.scheduledAt ?? ''} onChange={e => setEditActivityForm(f => ({ ...f, scheduledAt: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-surface)' }} /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingActivity(null)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors" style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingActivity} className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{savingActivity ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Activity confirmation */}
      <ConfirmDialog open={!!deletingActivityId} title="Delete Activity" message="Are you sure you want to delete this activity? This action cannot be undone." confirmVariant="danger" loading={savingActivity} onConfirm={handleDeleteActivity} onCancel={() => setDeletingActivityId(null)} />
    </>
  );
};

// ── Toolbar button ────────────────────────────────────────────────
const ToolbarBtn: React.FC<{ icon: string; label: string; onClick: () => void; accent?: boolean }> = ({ icon, label, onClick, accent }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
    style={{
      background: accent ? T.teal : T.white,
      color: accent ? T.white : T.teal,
      border: accent ? 'none' : `1px solid ${T.border}`,
      cursor: 'pointer',
    }}
  >
    <span className="material-symbols-outlined text-[14px]">{icon}</span>
    {label}
  </button>
);

export default CrmContactDetail;