import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import creditService, { BorrowerProfile, CreditDocument, CreditApplication, BorrowerProfileStatus } from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import DocumentUpload from '../src/components/credit/DocumentUpload';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const STATUS_BADGE: Record<BorrowerProfileStatus, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  PENDING_REVIEW: { bg: '#f59e0b20', text: '#d97706' },
  UNDER_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  SUSPENDED: { bg: '#6b728020', text: '#6b7280' },
};

const APP_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: '#6366f120', text: '#6366f1' },
  SUBMITTED: { bg: '#f59e0b20', text: '#d97706' },
  KYC_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  KYC_APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  KYC_REJECTED: { bg: '#ef444420', text: '#dc2626' },
  UNDER_REVIEW: { bg: '#3b82f620', text: '#2563eb' },
  UNDERWRITING: { bg: '#8b5cf620', text: '#7c3aed' },
  CREDIT_ASSESSMENT: { bg: '#a78bfa20', text: '#7c3aed' },
  COMMITTEE_REVIEW: { bg: '#f9731620', text: '#ea580c' },
  APPROVED: { bg: '#22c55e20', text: '#16a34a' },
  REJECTED: { bg: '#ef444420', text: '#dc2626' },
  OFFER: { bg: '#06b6d420', text: '#0891b2' },
  ACCEPTED: { bg: '#14b8a620', text: '#0d9488' },
  DISBURSED: { bg: '#06b6d420', text: '#0891b2' },
  ACTIVE: { bg: '#22c55e20', text: '#16a34a' },
  CLOSED: { bg: '#6b728020', text: '#6b7280' },
  WITHDRAWN: { bg: '#6b728020', text: '#6b7280' },
};

type DetailTab = 'overview' | 'documents' | 'applications' | 'financials' | 'notes';

const BorrowerProfileDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showNewApp, setShowNewApp] = useState(false);
  const [appForm, setAppForm] = useState<Partial<CreditApplication>>({ currency: 'MYR' });
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canReview = hasPermission(user, 'credit:review');

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await creditService.getBorrowerProfile(id);
      setProfile(data);
    } catch (e) {
      console.error(e);
      navigate('/credit/borrowers');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleCreateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(appForm)) {
      if (v === '' || v === undefined || v === null) continue;
      if (['requestedAmount', 'approvedAmount', 'interestRate', 'tenureMonths'].includes(k)) {
        payload[k] = Number(v);
        if (isNaN(payload[k])) delete payload[k];
      } else {
        payload[k] = v;
      }
    }
    payload.borrowerProfileId = id;
    try {
      setSaving(true);
      await creditService.createApplication(payload);
      setShowNewApp(false);
      setAppForm({ currency: 'MYR' });
      fetchProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDocument = async (docId: string) => {
    try {
      await creditService.verifyDocument(docId);
      fetchProfile();
    } catch (e) { console.error(e); }
  };

  const handleRejectDocument = async (docId: string, reason: string) => {
    try {
      await creditService.rejectDocument(docId, reason);
      fetchProfile();
    } catch (e) { console.error(e); }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await creditService.deleteDocument(docId);
      fetchProfile();
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 20, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    </>
  );

  if (!profile) return null;

  const badge = STATUS_BADGE[profile.status];

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <Link to="/credit/borrowers" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Borrowers</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">{profile.firstName} {profile.lastName}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-black text-text-primary">{profile.firstName} {profile.lastName}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                  {profile.status.replace(/_/g, ' ')}
                </span>
                {profile.nricPassport && <span className="text-sm text-text-secondary">NRIC: {profile.nricPassport}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {profile.account && (
              <Link to={`/crm/accounts/${profile.account.id}`}
                className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
                style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-base">business</span> View Account
              </Link>
            )}
            {canWrite && (
              <button onClick={() => setShowNewApp(true)}
                className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <span className="material-symbols-outlined text-base">add</span> New Application
              </button>
            )}
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { label: 'Monthly Income', value: formatCurrency(profile.monthlyIncome), icon: 'payments' },
            { label: 'Credit Score', value: profile.creditScore ?? '—', icon: 'score' },
            { label: 'Risk Rating', value: profile.riskRating ?? '—', icon: 'speed' },
            { label: 'Documents', value: profile._count?.documents ?? 0, icon: 'folder' },
            { label: 'Applications', value: profile._count?.applications ?? 0, icon: 'description' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
              <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
              <span className="font-bold text-text-primary">{s.value}</span>
              <span className="text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {(['overview', 'documents', 'applications', 'financials', 'notes'] as DetailTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Personal Information</h3>
              {[
                { label: 'Email', value: profile.email, icon: 'mail' },
                { label: 'Phone', value: profile.phone, icon: 'call' },
                { label: 'NRIC/Passport', value: profile.nricPassport, icon: 'badge' },
                { label: 'Date of Birth', value: formatDate(profile.dateOfBirth), icon: 'cake' },
                { label: 'Nationality', value: profile.nationality, icon: 'flag' },
                { label: 'Occupation', value: profile.occupation, icon: 'work' },
                { label: 'Employer', value: profile.employerName, icon: 'business' },
              ].filter(f => f.value && f.value !== '—').map(f => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                  <span className="text-xs text-text-secondary w-24 shrink-0">{f.label}</span>
                  <span className="text-sm text-text-primary">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Address</h3>
              {[
                { label: 'Address', value: profile.address, icon: 'home' },
                { label: 'City', value: profile.city, icon: 'location_city' },
                { label: 'State', value: profile.state, icon: 'map' },
                { label: 'Postcode', value: profile.postalCode, icon: 'markunread_mailbox' },
                { label: 'Country', value: profile.country, icon: 'public' },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                  <span className="text-xs text-text-secondary w-24 shrink-0">{f.label}</span>
                  <span className="text-sm text-text-primary">{f.value}</span>
                </div>
              ))}
              {profile.account && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Linked Account</h3>
                  <Link to={`/crm/accounts/${profile.account.id}`} style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-3 p-3 bg-bg-subtle border border-border rounded-lg hover:border-brand-300 transition-colors">
                      <span className="material-symbols-outlined text-brand-700">business</span>
                      <div>
                        <p className="text-sm font-bold text-text-primary">{profile.account.name}</p>
                        {profile.account.industry && <p className="text-xs text-text-secondary">{profile.account.industry}</p>}
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Documents</h3>
            <DocumentUpload
              borrowerProfileId={profile.id}
              documents={profile.documents ?? []}
              onUploaded={fetchProfile}
              onVerify={canReview ? handleVerifyDocument : undefined}
              onReject={canReview ? handleRejectDocument : undefined}
              onDelete={canWrite ? handleDeleteDocument : undefined}
              canUpload={canWrite}
              canVerify={canReview}
            />
          </div>
        )}

        {/* Applications tab */}
        {activeTab === 'applications' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Credit Applications</h3>
              {canWrite && (
                <button onClick={() => setShowNewApp(true)}
                  className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">add</span> New Credit Application
                </button>
              )}
            </div>
            {(profile.applications ?? []).length === 0 && (
              <div className="text-center py-8 text-text-secondary bg-bg-surface border border-border rounded-xl">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">description</span>
                <p className="font-semibold text-sm">No applications yet</p>
                {canWrite && <p className="text-xs mt-1">Create a new credit application for this borrower</p>}
              </div>
            )}
            <div className="space-y-3">
              {(profile.applications ?? []).map(app => {
                const state = (app.state || app.status) as string;
                const appBadge = APP_STATUS_COLORS[state] || { bg: '#6366f120', text: '#6366f1' };
                return (
                  <div key={app.id} className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors cursor-pointer"
                    onClick={() => navigate(`/credit/applications/${app.id}`)}>
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-brand-700 text-lg">description</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-text-primary text-sm">{app.productName || (app as any).productType?.replace(/_/g, ' ') || 'Application'}</p>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: appBadge.bg, color: appBadge.text }}>
                          {state.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {formatCurrency(app.requestedAmount)} · {app.tenureMonths} months · {formatDate(app.createdAt)}
                      </p>
                      {app.rejectionReason && <p className="text-xs text-red-600 mt-0.5">Rejected: {app.rejectionReason}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-text-primary">{formatCurrency(app.approvedAmount ?? app.requestedAmount)}</p>
                      {app.interestRate && <p className="text-xs text-text-secondary">{app.interestRate}% p.a.</p>}
                    </div>
                    <span className="material-symbols-outlined text-base text-text-secondary">chevron_right</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Financials tab */}
        {activeTab === 'financials' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <span className="material-symbols-outlined text-green-600 text-2xl mb-2 block">trending_up</span>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Monthly Income</h3>
              <p className="text-2xl font-black text-text-primary">{formatCurrency(profile.monthlyIncome)}</p>
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <span className="material-symbols-outlined text-blue-600 text-2xl mb-2 block">account_balance</span>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Total Assets</h3>
              <p className="text-2xl font-black text-text-primary">{formatCurrency(profile.totalAssets)}</p>
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <span className="material-symbols-outlined text-red-600 text-2xl mb-2 block">trending_down</span>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Total Liabilities</h3>
              <p className="text-2xl font-black text-text-primary">{formatCurrency(profile.totalLiabilities)}</p>
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <span className="material-symbols-outlined text-indigo-600 text-2xl mb-2 block">score</span>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Credit Score</h3>
              <p className={`text-2xl font-black ${(profile.creditScore ?? 0) >= 700 ? 'text-green-600' : (profile.creditScore ?? 0) < 500 ? 'text-red-600' : 'text-text-primary'}`}>
                {profile.creditScore ?? '—'}
              </p>
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <span className="material-symbols-outlined text-amber-600 text-2xl mb-2 block">speed</span>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Risk Rating</h3>
              <p className="text-2xl font-black text-text-primary">{profile.riskRating ?? '—'}</p>
            </div>
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <span className="material-symbols-outlined text-purple-600 text-2xl mb-2 block">balance</span>
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Net Worth</h3>
              <p className="text-2xl font-black text-text-primary">
                {profile.totalAssets != null && profile.totalLiabilities != null
                  ? formatCurrency(profile.totalAssets - profile.totalLiabilities)
                  : '—'}
              </p>
            </div>
          </div>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Notes</h3>
            {profile.notes ? (
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{profile.notes}</p>
            ) : (
              <p className="text-sm text-text-secondary">No notes yet.</p>
            )}
          </div>
        )}

        {/* New Application modal */}
        {showNewApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => { setShowNewApp(false); setAppForm({ currency: 'MYR' }); }}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-black text-text-primary mb-4">New Credit Application</h2>
              <form onSubmit={handleCreateApplication} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Product Type *</label>
                  <select required value={(appForm as any).productType ?? ''} onChange={e => setAppForm(f => ({ ...f, productType: e.target.value } as any))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}>
                    <option value="">Select product...</option>
                    {['TERM_LOAN','REVOLVING_CREDIT','TRADE_FINANCE','PROJECT_FINANCE','SYNDICATED','BRIDGE_LOAN','OVERDRAFT','LETTER_OF_CREDIT','BANK_GUARANTEE'].map(p => (
                      <option key={p} value={p}>{p.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Requested Amount (MYR) *</label>
                    <input required type="number" min="0" value={appForm.requestedAmount ?? ''} onChange={e => setAppForm(f => ({ ...f, requestedAmount: Number(e.target.value) }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">Tenure (months) *</label>
                    <input required type="number" min="1" value={appForm.tenureMonths ?? ''} onChange={e => setAppForm(f => ({ ...f, tenureMonths: Number(e.target.value) }))}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Purpose</label>
                  <textarea rows={3} value={appForm.purpose ?? ''} onChange={e => setAppForm(f => ({ ...f, purpose: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => { setShowNewApp(false); setAppForm({ currency: 'MYR' }); }}
                    className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                    style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {saving ? 'Creating...' : 'Create Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default BorrowerProfileDetail;