import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import creditService, { BorrowerProfile, CreditApplication, exposureApi, ExposureDashboardSummary, piiRevealApi } from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import StateBadge from '../src/components/ui/StateBadge';
import EditBorrowerModal from '../src/components/credit/EditBorrowerModal';

// ── Helpers ──────────────────────────────────────────────────
const formatCurrency = (val: number | string | null) => {
  if (val == null) return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(num);
};
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  CORPORATE: { bg: '#3b82f620', text: '#2563eb' },
  INDIVIDUAL: { bg: '#a855f720', text: '#7e22ce' },
  SOLE_PROPRIETOR: { bg: '#f59e0b20', text: '#d97706' },
  JOINT: { bg: '#06b6d420', text: '#0891b2' },
};

const RATING_COLOR = (r: string | null) => {
  if (!r) return 'var(--color-text-tertiary)';
  if (['AAA', 'AA', 'A'].includes(r)) return '#16a34a';
  if (['BBB', 'BB'].includes(r)) return '#2563eb';
  if (['B', 'CCC'].includes(r)) return '#d97706';
  return '#dc2626';
};

const AML_BADGE: Record<string, { bg: string; text: string }> = {
  LOW: { bg: '#22c55e20', text: '#16a34a' },
  MEDIUM: { bg: '#f59e0b20', text: '#d97706' },
  HIGH: { bg: '#ef444420', text: '#dc2626' },
  PROHIBITED: { bg: '#7f1d1d40', text: '#991b1b' },
};

// ── NricReveal — shows masked NRIC with a "Reveal" button ────────────────────
const NricReveal: React.FC<{ maskedNric: string | null; revealFn: () => Promise<string> }> = ({ maskedNric, revealFn }) => {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!maskedNric) return null;

  const handleReveal = async () => {
    setLoading(true);
    try {
      const full = await revealFn();
      setRevealed(full);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <span className="text-xs text-text-secondary">
      NRIC/Passport: <span className="font-mono">{revealed ?? maskedNric}</span>
      {!revealed && (
        <button
          onClick={handleReveal}
          disabled={loading}
          className="ml-1 text-[10px] text-blue-500 hover:text-blue-700 underline disabled:opacity-50"
        >
          {loading ? '…' : 'Reveal'}
        </button>
      )}
    </span>
  );
};

const FACILITY_TYPE_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan', REVOLVING_CREDIT: 'Revolving Credit', OVERDRAFT: 'Overdraft',
  LETTER_OF_CREDIT: 'Letter of Credit', BANK_GUARANTEE: 'Bank Guarantee', TRADE_FINANCE: 'Trade Finance',
  BRIDGE_LOAN: 'Bridge Loan', PROJECT_FINANCE: 'Project Finance',
};

type DetailTab = 'overview' | 'directors' | 'shareholders' | 'ubos' | 'applications' | 'exposure' | 'financials';

// Derive display name from account/contact or profile.name
const displayName = (p: BorrowerProfile) => {
  if (p.account) return p.account.name;
  if (p.contact) return `${p.contact.firstName} ${p.contact.lastName}`.trim();
  if (p.name) return p.name;
  return 'Unnamed Borrower';
};

const getInitials = (p: BorrowerProfile) => {
  const name = displayName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '?') + (parts[1]?.[0] || '');
};

// ── Component ────────────────────────────────────────────────

const BorrowerProfileDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [exposure, setExposure] = useState<ExposureDashboardSummary | null>(null);
  const [loadingExposure, setLoadingExposure] = useState(false);
  const [showLinkCrm, setShowLinkCrm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canReview = hasPermission(user, 'credit:approve');

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

  useEffect(() => {
    if (activeTab === 'applications' && id) {
      (async () => {
        try {
          setLoadingApps(true);
          const res = await creditService.listApplications({ borrowerProfileId: id, limit: 50 });
          setApplications(res.applications ?? []);
        } catch (e) { console.error(e); }
        finally { setLoadingApps(false); }
      })();
    }
  }, [activeTab, id]);

  useEffect(() => {
    if (activeTab === 'exposure' && id) {
      (async () => {
        try {
          setLoadingExposure(true);
          const data = await exposureApi.getExposure(id);
          setExposure(data);
        } catch (e) { console.error(e); }
        finally { setLoadingExposure(false); }
      })();
    }
  }, [activeTab, id]);

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

  const typeBadge = TYPE_BADGE[profile.borrowerType] || { bg: '#6366f120', text: '#6366f1' };
  const ratingColor = RATING_COLOR(profile.creditRiskRating);
  const amlBadge = profile.amlRiskTier ? AML_BADGE[profile.amlRiskTier] : null;

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
          <span className="font-semibold text-text-primary">{displayName(profile)}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
              {getInitials(profile)}
            </div>
            <div>
              <h1 className="text-2xl font-black text-text-primary">{displayName(profile)}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: typeBadge.bg, color: typeBadge.text }}>
                  {profile.borrowerType.replace(/_/g, ' ')}
                </span>
                {profile.creditRiskRating && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${ratingColor}20`, color: ratingColor }}>
                    Risk: {profile.creditRiskRating}
                  </span>
                )}
                {amlBadge && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: amlBadge.bg, color: amlBadge.text }}>
                    AML: {profile.amlRiskTier}
                  </span>
                )}
                {profile.isSanctionedEntity && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    Sanctioned Entity
                  </span>
                )}
                {!profile.isActive && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
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
              <button
                type="button"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors font-bold cursor-pointer bg-none"
                style={{ border: '1.5px solid' }}
              >
                <span className="material-symbols-outlined text-base">edit</span> Edit
              </button>
            )}
            {canWrite && (
              <Link to={`/credit/applications?create=1&borrowerId=${profile.id}`}
                className="flex items-center gap-2 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-base">add</span> New Application
              </Link>
            )}
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { label: 'Exposure Limit', value: formatCurrency(profile.exposureLimit), icon: 'account_balance_wallet' },
            { label: 'Total Exposure', value: formatCurrency(profile.totalExposure), icon: 'payments' },
            { label: 'Annual Income', value: formatCurrency(profile.annualIncome), icon: 'trending_up' },
            { label: 'Net Worth', value: formatCurrency(profile.netWorth), icon: 'savings' },
            { label: 'Directors', value: profile.directors?.length ?? 0, icon: 'groups' },
            { label: 'Applications', value: profile.applications?.length ?? 0, icon: 'description' },
          ].filter(s => s.value !== '—' || s.label === 'Directors' || s.label === 'Applications').map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
              <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
              <span className="font-bold text-text-primary">{s.value}</span>
              <span className="text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
          {(['overview', 'directors', 'shareholders', 'ubos', 'applications', 'exposure', ...(profile.borrowerType === 'CORPORATE' ? ['financials'] : [])] as DetailTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              {tab === 'ubos' ? 'UBOs' : tab}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unlinked CRM nudge */}
            {!profile.accountId && !profile.contactId && (
              <div className="md:col-span-2 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl mb-2">
                <span className="material-symbols-outlined text-amber-600 text-xl mt-0.5 shrink-0">link_off</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">No CRM Account linked</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    Linking a CRM account pulls in contact details, activities, and notes — and lets you open credit applications from the CRM side.
                  </p>
                  <button
                    onClick={() => setShowLinkCrm(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors border-none cursor-pointer font-sans"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    Link CRM Account
                  </button>
                </div>
              </div>
            )}
            {showLinkCrm && (
              <div className="md:col-span-2 flex items-center gap-2 text-xs text-text-secondary px-4 py-2">
                <span className="material-symbols-outlined text-sm">info</span>
                CRM linking UI coming soon — use the Edit button to set Account ID or Contact ID directly for now.
                <button onClick={() => setShowLinkCrm(false)} className="ml-auto text-xs text-text-tertiary hover:text-text-primary border-none bg-none cursor-pointer">Dismiss</button>
              </div>
            )}
            {/* Credit Risk Card */}
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Credit Risk</h3>
              {[
                { label: 'Risk Rating', value: profile.creditRiskRating ?? '—', icon: 'speed' },
                { label: 'AML Tier', value: profile.amlRiskTier ?? '—', icon: 'shield' },
                { label: 'Sanctioned Entity', value: profile.isSanctionedEntity ? 'Yes' : 'No', icon: 'gavel' },
                { label: 'Exposure Limit', value: formatCurrency(profile.exposureLimit), icon: 'account_balance_wallet' },
                { label: 'Total Exposure', value: formatCurrency(profile.totalExposure), icon: 'payments' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                  <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
                  <span className={`text-sm ${f.label === 'Sanctioned Entity' && profile.isSanctionedEntity ? 'text-red-600 font-bold' : 'text-text-primary'}`}>{f.value}</span>
                </div>
              ))}
            </div>

            {/* Business Info Card */}
            <div className="bg-bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Business Information</h3>
              {[
                { label: 'Borrower Type', value: profile.borrowerType?.replace(/_/g, ' ') ?? '—', icon: 'category' },
                { label: 'Occupation', value: profile.occupation ?? '—', icon: 'work' },
                { label: 'Employer', value: profile.employer ?? '—', icon: 'business' },
                { label: 'Annual Income', value: formatCurrency(profile.annualIncome), icon: 'trending_up' },
                { label: 'Net Worth', value: formatCurrency(profile.netWorth), icon: 'savings' },
                { label: 'Source of Wealth', value: profile.sourceOfWealth ?? '—', icon: 'diamond' },
                { label: 'Purpose of Account', value: profile.purposeOfAccount ?? '—', icon: 'flag' },
              ].filter(f => f.value !== '—' || ['Borrower Type', 'Occupation', 'Employer'].includes(f.label)).map(f => (
                <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                  <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
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
                      </div>
                    </div>
                  </Link>
                </div>
              )}
              {profile.contact && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Contact Details</h3>
                  {[
                    { label: 'Full Name', value: `${profile.contact.firstName} ${profile.contact.lastName}`.trim(), icon: 'person' },
                    { label: 'Job Title', value: profile.contact.jobTitle ?? '—', icon: 'work' },
                    { label: 'Email', value: profile.contact.email ?? '—', icon: 'mail' },
                    { label: 'Phone', value: profile.contact.phone ?? '—', icon: 'call' },
                    { label: 'Mobile', value: profile.contact.mobile ?? '—', icon: 'smartphone' },
                    { label: 'Date of Birth', value: profile.contact.dateOfBirth ? new Date(profile.contact.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', icon: 'cake' },
                    { label: 'NRIC / Passport', value: profile.contact.nricPassport ?? '—', icon: 'badge' },
                  ].filter(f => f.value !== '—' || ['Full Name', 'Email'].includes(f.label)).map(f => (
                    <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                      <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
                      <span className="text-sm text-text-primary">{f.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 md:col-span-2">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Record Info</h3>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-text-secondary">calendar_today</span>
                  <span className="text-xs text-text-secondary">Created</span>
                  <span className="text-sm text-text-primary">{formatDate(profile.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-text-secondary">update</span>
                  <span className="text-xs text-text-secondary">Updated</span>
                  <span className="text-sm text-text-primary">{formatDate(profile.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-text-secondary">toggle_on</span>
                  <span className="text-xs text-text-secondary">Active</span>
                  <span className={`text-sm font-semibold ${profile.isActive ? 'text-green-600' : 'text-red-600'}`}>{profile.isActive ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Directors tab */}
        {activeTab === 'directors' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Directors</h3>
              {canWrite && (
                <button className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">add</span> Add Director
                </button>
              )}
            </div>
            {(profile.directors ?? []).length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">groups</span>
                <p className="font-semibold text-sm">No directors recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(profile.directors ?? []).map((d: any) => (
                  <div key={d.id} className="flex items-center gap-4 bg-bg-subtle border border-border rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-indigo-600 text-lg">person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-text-primary text-sm">{d.name}</p>
                        {d.isKeyManagement && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">Key Mgmt</span>}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {d.position && <span>{d.position} · </span>}
                        {d.appointmentDate && <span>Appointed {formatDate(d.appointmentDate)}</span>}
                        {d.isExecutive && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Executive</span>}
                      </p>
                      {(d.dateOfBirth || d.nationality) && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          {d.dateOfBirth && <span>DOB: {formatDate(d.dateOfBirth)} · </span>}
                          {d.nationality && <span>{d.nationality}</span>}
                        </p>
                      )}
                      {d.nricPassport && (
                        <p className="mt-0.5"><NricReveal maskedNric={d.nricPassport} revealFn={() => piiRevealApi.director(d.id)} /></p>
                      )}
                      {d.experienceQualification && (
                        <p className="text-xs text-text-secondary mt-0.5 truncate">{d.experienceQualification}</p>
                      )}
                    </div>
                    {d.resignationDate && (
                      <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Resigned {formatDate(d.resignationDate)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shareholders tab */}
        {activeTab === 'shareholders' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Shareholders</h3>
              {canWrite && (
                <button className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">add</span> Add Shareholder
                </button>
              )}
            </div>
            {(profile.shareholders ?? []).length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">pie_chart</span>
                <p className="font-semibold text-sm">No shareholders recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(profile.shareholders ?? []).map((s: any) => (
                  <div key={s.id} className="flex items-center gap-4 bg-bg-subtle border border-border rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">pie_chart</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary text-sm">{s.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {s.shareholdingPct != null && <span>{s.shareholdingPct}% holding</span>}
                        {s.shareClass && <span> · Class {s.shareClass}</span>}
                        {s.numberOfShares && <span> · {s.numberOfShares.toLocaleString()} shares</span>}
                      </p>
                      {(s.dateOfBirthOrIncorporation || s.nationality || s.businessRegNo) && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          {s.dateOfBirthOrIncorporation && <span>DOB/Incorp: {formatDate(s.dateOfBirthOrIncorporation)} · </span>}
                          {s.nationality && <span>{s.nationality}</span>}
                          {s.businessRegNo && <span> · Reg: {s.businessRegNo}</span>}
                        </p>
                      )}
                      {s.nricPassport && (
                        <p className="mt-0.5"><NricReveal maskedNric={s.nricPassport} revealFn={() => piiRevealApi.shareholder(s.id)} /></p>
                      )}
                    </div>
                    {s.shareholdingPct != null && (
                      <div className="w-16 text-right">
                        <p className="text-sm font-bold text-text-primary">{s.shareholdingPct}%</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UBOs tab */}
        {activeTab === 'ubos' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Ultimate Beneficial Owners</h3>
              {canWrite && (
                <button className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  <span className="material-symbols-outlined text-base">add</span> Add UBO
                </button>
              )}
            </div>
            {(profile.beneficialOwners ?? []).length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">visibility</span>
                <p className="font-semibold text-sm">No UBOs recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(profile.beneficialOwners ?? []).map((ubo: any) => (
                  <div key={ubo.id} className="flex items-center gap-4 bg-bg-subtle border border-border rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-violet-600 text-lg">visibility</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary text-sm">{ubo.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {ubo.ownershipPct != null && <span>{ubo.ownershipPct}% ownership</span>}
                        {ubo.countryOfResidence && <span> · {ubo.countryOfResidence}</span>}
                      </p>
                      {ubo.nricPassport && (
                        <p className="mt-0.5"><NricReveal maskedNric={ubo.nricPassport} revealFn={() => piiRevealApi.ubo(ubo.id)} /></p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ubo.isPep && (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">PEP</span>
                      )}
                      <span className="text-sm font-bold text-text-primary">{ubo.ownershipPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Applications tab */}
        {activeTab === 'applications' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Credit Applications</h3>
              {canWrite && (
                <Link to={`/credit/applications?create=1&borrowerId=${profile.id}`}
                  className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                  style={{ textDecoration: 'none' }}>
                  <span className="material-symbols-outlined text-base">add</span> New Application
                </Link>
              )}
            </div>
            {loadingApps ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-8 text-text-secondary bg-bg-surface border border-border rounded-xl">
                <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">description</span>
                <p className="font-semibold text-sm">No applications yet</p>
                {canWrite && <p className="text-xs mt-1">Create a new credit application for this borrower</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(app => {
                  const state = (app.state || app.status) as string;
                  return (
                    <div key={app.id} className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4 hover:border-brand-300 transition-colors cursor-pointer"
                      onClick={() => navigate(`/credit/applications/${app.id}`)}>
                      <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-brand-700 text-lg">description</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-text-primary text-sm">{app.applicationNo || 'Application'}</p>
                          <StateBadge state={state} size="sm" />
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {(app as any).productType?.replace(/_/g, ' ') || 'Application'} · {formatCurrency(app.requestedAmount)} · {formatDate(app.createdAt)}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-base text-text-secondary">chevron_right</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Exposure tab */}
        {activeTab === 'exposure' && (
          <div>
            {loadingExposure ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : !exposure ? (
              <div className="bg-bg-surface border border-border rounded-xl p-12 text-center text-text-secondary">
                <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">account_balance</span>
                <p className="font-semibold">No exposure data available</p>
                <p className="text-sm mt-1">Exposure is calculated from approved facilities</p>
              </div>
            ) : (
              <div>
                {/* Total Exposure Card */}
                <div className="bg-bg-surface border border-border rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-700">
                      <span className="material-symbols-outlined text-2xl">account_balance</span>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Total Exposure</h3>
                      <p className="text-3xl font-black text-text-primary">{formatCurrency(exposure.totalExposure)}</p>
                      <p className="text-xs text-text-secondary">MYR</p>
                    </div>
                  </div>
                  {exposure.limits.utilizationPct != null && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-text-secondary">Overall Utilization</span>
                        <span className="text-sm font-bold text-text-primary">{exposure.limits.utilizationPct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="h-2.5 rounded-full transition-all" style={{
                          width: `${Math.min(exposure.limits.utilizationPct, 100)}%`,
                          background: exposure.limits.utilizationPct > 80 ? '#ef4444' : exposure.limits.utilizationPct > 60 ? '#f59e0b' : '#22c55e',
                        }} />
                      </div>
                    </div>
                  )}
                  {exposure.limits.exposureLimit != null && (
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-text-secondary">Exposure Limit</span>
                      <span className="font-bold text-text-primary">{formatCurrency(exposure.limits.exposureLimit)}</span>
                    </div>
                  )}
                </div>

                {/* Facilities List */}
                {exposure.facilities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Facilities</h3>
                    <div className="space-y-3">
                      {exposure.facilities.map((fac, i) => {
                        const effectiveAmount = fac.approvedAmount ?? fac.amount;
                        return (
                          <div key={i} className="bg-bg-surface border border-border rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-brand-700 text-base">account_balance</span>
                                <span className="text-sm font-bold text-text-primary">{FACILITY_TYPE_LABELS[fac.facilityType] || fac.facilityType.replace(/_/g, ' ')}</span>
                              </div>
                              <span className="text-[10px] font-bold bg-bg-subtle text-text-secondary px-2 py-0.5 rounded-full">{fac.currency}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div>
                                <p className="text-[10px] text-text-secondary uppercase">Approved Amount</p>
                                <p className="text-sm font-bold text-text-primary">{formatCurrency(effectiveAmount)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-text-secondary uppercase">Applied Amount</p>
                                <p className="text-sm font-bold text-text-secondary">{formatCurrency(fac.amount)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exposure.facilities.length === 0 && exposure.totalExposure === 0 && (
                  <div className="bg-bg-surface border border-border rounded-xl p-8 text-center text-text-secondary">
                    <span className="material-symbols-outlined text-3xl block mb-2 opacity-30">info</span>
                    <p className="font-semibold text-sm">No active or disbursed facilities</p>
                    <p className="text-xs mt-1">Exposure is calculated from approved and active facilities</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Financials tab */}
        {activeTab === 'financials' && id && (
          <div className="bg-bg-surface border border-border rounded-xl p-10 text-center">
            <span className="material-symbols-outlined text-5xl block mb-3 text-brand-300">table_chart</span>
            <h3 className="text-lg font-bold text-text-primary mb-2">Financial Spreading</h3>
            <p className="text-text-secondary text-sm mb-5">View and manage balance sheets, profit & loss, and cash flow statements for this borrower.</p>
            <Link to={`/credit/financials?borrowerProfileId=${id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-base">open_in_new</span>
              Open Financial Spreading
            </Link>
          </div>
        )}

        {/* Edit Profile Modal */}
        {profile && (
          <EditBorrowerModal
            profile={profile}
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSaved={(updated) => { setProfile(updated); setShowEditModal(false); }}
          />
        )}
      </div>
    </>
  );
};

export default BorrowerProfileDetail;