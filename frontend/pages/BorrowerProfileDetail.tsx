import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, { BorrowerOnboardingPersistenceFailure, BorrowerProfile, Borrower360Activity, Borrower360Summary, BorrowerOnboardingResult, CreditApplication, exposureApi, BorrowerExposurePresentation, piiRevealApi } from '../src/services/credit.service';
import BureauUploadModal from '../src/components/credit/borrower360/BureauUploadModal';
import IncomeEditModal from '../src/components/credit/borrower360/IncomeEditModal';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import EditBorrowerModal from '../src/components/credit/EditBorrowerModal';
import PartyFormModal, { PartyRole } from '../src/components/credit/PartyFormModal';
import toast from 'react-hot-toast';
import { getBorrowerDisplayName } from '../src/components/credit/BorrowerSummaryCard';
import BorrowerWorkspaceHeader from '../src/components/credit/borrower360/BorrowerWorkspaceHeader';
import BorrowerOverview from '../src/components/credit/borrower360/BorrowerOverview';
import BorrowerApplicationSummary from '../src/components/credit/borrower360/BorrowerApplicationSummary';
import BorrowerProfileTab from '../src/components/credit/borrower360/BorrowerProfileTab';
import { calculateBorrowerReadiness, getPrimaryApplicationAction, type BorrowerNextAction } from '../src/components/credit/borrower360/borrowerReadiness';
import RiskAssessmentResultCard from '../src/components/credit/borrower360/RiskAssessmentResultCard';
import AssessmentReadinessChecklist from '../src/components/credit/borrower360/AssessmentReadinessChecklist';
import ExposureFacilitiesTab from '../src/components/credit/borrower360/ExposureFacilitiesTab';
import type { BorrowerRiskAssessmentTarget } from '../src/services/credit.service';

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
    } catch {
      toast.error('Failed to reveal NRIC. You may not have permission or the record was not found.');
    } finally { setLoading(false); }
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

type DetailTab = 'overview' | 'applications' | 'profile' | 'financials' | 'exposure' | 'risk' | 'bureau' | 'documents';
const DETAIL_TABS: DetailTab[] = ['overview', 'applications', 'profile', 'financials', 'exposure', 'risk', 'bureau', 'documents'];

type BorrowerDetailLocationState = {
  onboardingPersistenceFailure?: BorrowerOnboardingPersistenceFailure;
};

// Derive display name from the independent borrower profile
const displayName = (p: BorrowerProfile) => getBorrowerDisplayName(p);

const getInitials = (p: BorrowerProfile) => {
  const name = displayName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || '?') + (parts[1]?.[0] || '');
};

// ── Component ────────────────────────────────────────────────

const BorrowerProfileDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [borrower360Summary, setBorrower360Summary] = useState<Borrower360Summary | null>(null);
  const [borrower360Activity, setBorrower360Activity] = useState<Borrower360Activity[]>([]);
  const [applications, setApplications] = useState<CreditApplication[]>([]);
  const [onboarding, setOnboarding] = useState<BorrowerOnboardingResult | null>(null);
  const [onboardingPersistenceFailure, setOnboardingPersistenceFailure] = useState<BorrowerOnboardingPersistenceFailure | null>(
    () => (location.state as BorrowerDetailLocationState | null)?.onboardingPersistenceFailure ?? null,
  );
  const [retryingOnboardingPersistence, setRetryingOnboardingPersistence] = useState(false);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestedTab = searchParams.get('tab') as DetailTab | null;
  const [activeTab, setActiveTab] = useState<DetailTab>(requestedTab && DETAIL_TABS.includes(requestedTab) ? requestedTab : 'overview');
  const [exposure, setExposure] = useState<BorrowerExposurePresentation | null>(null);
  const [loadingExposure, setLoadingExposure] = useState(false);
  const [exposureError, setExposureError] = useState<string | null>(null);
  const [showLinkCrm, setShowLinkCrm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBureauModal, setShowBureauModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [riskCalculationError, setRiskCalculationError] = useState<string | null>(null);
  const [partyModal, setPartyModal] = useState<{ open: boolean; role: PartyRole }>({ open: false, role: 'director' });

  const canWrite = hasPermission(user, 'credit:write');
  const canCreate = hasPermission(user, 'credit:create');


  const fetchProfile = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [profileData, summaryData, activityData, onboardingData] = await Promise.all([
        creditService.getBorrowerProfile(id),
        creditService.getBorrower360Summary(id),
        creditService.getBorrower360Activity(id, 6),
        creditService.getBorrowerOnboarding(id),
      ]);
      setProfile(profileData);
      setBorrower360Summary(summaryData);
      setBorrower360Activity(activityData ?? []);
      setOnboarding(onboardingData);
      try {
        const applicationData = await creditService.listApplications({ borrowerProfileId: id, page: 1, limit: 20, sortBy: 'createdAt', sortDir: 'desc' });
        setApplications(applicationData.applications ?? []);
        setApplicationError(null);
      } catch (applicationLoadError) {
        console.error(applicationLoadError);
        setApplicationError('Applications could not be loaded.');
      }
    } catch (e) {
      console.error(e);
      navigate('/credit/borrowers');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const handleRunKyc = useCallback(async () => {
    if (!profile) return;
    try {
      const updated = await creditService.markBorrowerKycVerified(profile.id);
      setProfile(updated);
      toast.success('KYC verification recorded');
      await fetchProfile();
    } catch (error) {
      console.error(error);
      toast.error('Failed to verify KYC');
    }
  }, [fetchProfile, profile]);

  const retryOnboardingPersistence = useCallback(async () => {
    if (!onboardingPersistenceFailure) return;
    setRetryingOnboardingPersistence(true);
    try {
      const updated = await creditService.updateBorrowerOnboarding(
        onboardingPersistenceFailure.borrowerId,
        onboardingPersistenceFailure.idempotencyKey,
        onboardingPersistenceFailure.stages,
      );
      setOnboarding(updated);
      setOnboardingPersistenceFailure(null);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      toast.success('Onboarding status saved');
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Onboarding status is still not saved. Retry when the service is available.';
      setOnboardingPersistenceFailure(current => current ? { ...current, message } : current);
      toast.error(message);
    } finally {
      setRetryingOnboardingPersistence(false);
    }
  }, [location.pathname, location.search, navigate, onboardingPersistenceFailure]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    const nextTab = requestedTab && DETAIL_TABS.includes(requestedTab) ? requestedTab : 'overview';
    if (nextTab !== activeTab) setActiveTab(nextTab);
  }, [activeTab, requestedTab]);

  const selectTab = useCallback((tab: DetailTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handleWorkspaceAction = useCallback((action: BorrowerNextAction) => {
    if (action.target === 'profile') selectTab('profile');
    if (action.target === 'income') setShowIncomeModal(true);
    if (action.target === 'bureau') setShowBureauModal(true);
    if (action.target === 'documents') selectTab('documents');
    if (action.target === 'risk') selectTab('risk');
    if (action.target === 'application') {
      navigate(action.id ? `/credit/applications/${action.id}` : `/credit/applications/new?borrowerId=${profile?.id ?? id}`);
    }
  }, [id, navigate, profile?.id, selectTab]);

  const handleRecalculateRisk = useCallback(async () => {
    if (!profile || recalculating) return;
    setRiskCalculationError(null);
    setRecalculating(true);
    try {
      await creditService.calculateBorrowerRiskScore(profile.id);
      toast.success('Risk rating recalculated');
      selectTab('risk');
      await fetchProfile();
    } catch (e) {
      console.error(e);
      const message = (e as any)?.response?.data?.message || (e as any)?.message || 'The risk rating service returned an error.';
      setRiskCalculationError(message);
      toast.error('Failed to recalculate risk rating');
    } finally {
      setRecalculating(false);
    }
  }, [fetchProfile, profile, recalculating, selectTab]);

  const handleRiskAction = useCallback((target: BorrowerRiskAssessmentTarget) => {
    if (target === 'profile') selectTab('profile');
    if (target === 'income') setShowIncomeModal(true);
    if (target === 'bureau') setShowBureauModal(true);
    if (target === 'documents') selectTab('documents');
    if (target === 'financials') selectTab('financials');
    if (target === 'kyc') handleRunKyc();
    if (target === 'risk') handleRecalculateRisk();
  }, [handleRecalculateRisk, handleRunKyc, selectTab]);

  const fetchExposure = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingExposure(true);
      const data = await exposureApi.getPresentation(id);
      setExposure(data);
      setExposureError(null);
    } catch (e) {
      console.error(e);
      setExposureError('Exposure data could not be loaded.');
    } finally {
      setLoadingExposure(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'exposure') void fetchExposure();
  }, [activeTab, fetchExposure]);

  if (loading) return (
    <div className="w-full px-4 py-8 sm:px-8" style={{ paddingBottom: '2rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ height: 20, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  );

  if (!profile) return null;

  const typeBadge = TYPE_BADGE[profile.borrowerType] || { bg: '#6366f120', text: '#6366f1' };
  const ratingColor = RATING_COLOR(profile.creditRiskRating);
  const amlBadge = profile.amlRiskTier ? AML_BADGE[profile.amlRiskTier] : null;
  const applicationsAvailable = applicationError === null;
  const readiness = calculateBorrowerReadiness({ profile, summary: borrower360Summary, applications });
  const profileComplete = Boolean(
    profile.name?.trim()
      && (profile.borrowerType === 'INDIVIDUAL' || profile.borrowerType === 'JOINT'
        ? profile.nricPassport && profile.dateOfBirth && profile.nationality
        : profile.registrationNumber && profile.dateOfIncorporation && profile.businessNature)
      && (profile.phone || profile.email),
  );
  const applicationReady = borrower360Summary?.applicationReadiness?.ready ?? readiness.status !== 'BLOCKED';
  const milestone = (ready: boolean) => ready ? 'READY' : 'BLOCKED';

  return (
    <>
      <div className="w-full px-4 py-4 sm:px-8 sm:py-8" style={{ paddingBottom: 'var(--space-16)' }}>
        {onboardingPersistenceFailure && (
          <section role="alert" aria-labelledby="onboarding-persistence-heading" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <h1 id="onboarding-persistence-heading" className="text-base font-bold">Onboarding status needs to be saved</h1>
            <p className="mt-1 text-sm">{onboardingPersistenceFailure.message}</p>
            <p className="mt-2 text-xs">The borrower was created. The stage results below are retained; retry saving them so Borrower 360 keeps the follow-up record.</p>
            <ul className="mt-2 list-disc pl-5 text-xs">{onboardingPersistenceFailure.stages.map(stage => <li key={stage.name}>{stage.name}: {stage.status}{stage.message ? ` — ${stage.message}` : ''}</li>)}</ul>
            <button type="button" onClick={retryOnboardingPersistence} disabled={retryingOnboardingPersistence} className="mt-3 rounded bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {retryingOnboardingPersistence ? 'Saving onboarding…' : 'Retry saving onboarding'}
            </button>
          </section>
        )}
        {onboarding && (
          <section role="status" aria-labelledby="borrower-created-heading" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">Borrower created</p>
                <h1 id="borrower-created-heading" className="mt-1 text-lg font-bold">{displayName(profile)}</h1>
                <p className="mt-1 text-sm">Borrower number {onboarding.borrowerNumber || '—'} · {profile.isActive ? 'Active' : 'Inactive'}</p>
                {onboarding.status === 'REQUIRES_FOLLOW_UP' && <p className="mt-2 text-sm font-semibold text-amber-800">Some onboarding actions require follow-up. Review the stages below and use the relevant Borrower 360 action.</p>}
              </div>
              <Link to={applicationReady ? `/credit/applications/new?borrowerId=${profile.id}` : '#borrower-readiness-heading'} className="rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-bold text-white no-underline">
                {applicationReady ? 'Create credit application' : 'Complete required information'}
              </Link>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Created', true],
                ['Profile complete', profileComplete],
                ['Application ready', applicationReady],
                ['Assessment ready', readiness.status === 'READY'],
              ].map(([label, ready]) => <div key={String(label)} className="rounded-lg border border-emerald-200 bg-white/70 p-3"><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-xs font-bold">{milestone(Boolean(ready))}</p></div>)}
            </div>
            {onboarding.stages.some(stage => stage.status === 'FAILED') && <ul className="mt-3 list-disc pl-5 text-xs text-amber-800">{onboarding.stages.filter(stage => stage.status === 'FAILED').map(stage => <li key={stage.name}>{stage.name}: {stage.message || 'Follow-up action failed.'}</li>)}</ul>}
          </section>
        )}
        <BorrowerWorkspaceHeader
          profile={profile}
          summary={borrower360Summary}
          primaryAction={getPrimaryApplicationAction(applications)}
          applicationsAvailable={applicationsAvailable}
          applicationReady={applicationReady}
          canWrite={canWrite}
          canCreate={canCreate}
          onPrimaryAction={() => {
            const primary = getPrimaryApplicationAction(applications);
            if (primary.applicationId) navigate(`/credit/applications/${primary.applicationId}`);
            else navigate(`/credit/applications/new?borrowerId=${profile.id}`);
          }}
          onEdit={() => setShowEditModal(true)}
          onUploadBureau={() => setShowBureauModal(true)}
          onRunKyc={handleRunKyc}
          onRecalculateRisk={handleRecalculateRisk}
        />

        {/* Tabs — 'financials' tab (Financial Spreading) only applies to non-INDIVIDUAL borrowers */}
        <div role="tablist" aria-label="Borrower detail sections" className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
          {(['overview', 'applications', 'profile', 'financials', 'exposure', 'risk', 'bureau', 'documents'] as DetailTab[])
            .filter(tab => tab !== 'financials' || profile.borrowerType !== 'INDIVIDUAL')
            .map(tab => (
            <button key={tab} onClick={() => selectTab(tab)} role="tab" aria-selected={activeTab === tab}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textTransform: 'capitalize' }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-brand-700 text-brand-700' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
              {tab === 'risk' ? 'Risk & Compliance' : tab === 'bureau' ? 'Bureau' : tab === 'documents' ? 'Documents' : tab === 'applications' ? 'Applications' : tab === 'exposure' ? 'Exposure & Facilities' : tab}
            </button>
          ))}
        </div>

        {activeTab === 'applications' && (
          <div role="tabpanel" aria-label="Applications" className="mb-6">
            {applicationError ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800"><p>{applicationError}</p><button type="button" onClick={fetchProfile} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white">Retry applications</button></div> : <BorrowerApplicationSummary applications={applications} {...(canCreate ? { onStartApplication: () => navigate(`/credit/applications/new?borrowerId=${profile.id}`) } : {})} />}
          </div>
        )}

        {/* Borrower workspace overview */}
        {activeTab === 'overview' && (
          <div role="tabpanel" aria-label="Overview" className="mb-6">
            {applicationError ? <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"><p>{applicationError}</p><button type="button" onClick={fetchProfile} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white">Retry applications</button></div> : null}
            <BorrowerOverview
              profile={profile}
              summary={borrower360Summary}
              applications={applications}
              applicationsAvailable={applicationsAvailable}
              exposurePresentation={exposure}
              readiness={readiness}
              activity={borrower360Activity}
              canWrite={canWrite}
              onAction={handleWorkspaceAction}
              onEditIncome={() => setShowIncomeModal(true)}
              onViewExposure={() => selectTab('exposure')}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <BorrowerProfileTab
            profile={profile}
            canWrite={canWrite}
            onEdit={() => setShowEditModal(true)}
            onEditIncome={() => setShowIncomeModal(true)}
            onOpenRisk={() => selectTab('risk')}
          />
        )}

        {false && activeTab === 'profile' && (
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
                // Type-specific fields
                ...(profile.borrowerType === 'INDIVIDUAL' ? [
                  { label: 'Preferred Name', value: profile.preferredName ?? '—', icon: 'person' },
                  { label: 'Date of Birth', value: formatDate(profile.dateOfBirth ?? null), icon: 'cake' },
                  { label: 'Marital Status', value: profile.maritalStatus ?? '—', icon: 'favorite' },
                  { label: 'Education Level', value: profile.educationLevel ?? '—', icon: 'school' },
                  { label: 'Tax ID Number', value: profile.taxNumber ?? '—', icon: 'receipt' },
                ] : []),
                ...(profile.borrowerType !== 'INDIVIDUAL' ? [
                  { label: 'Business Type', value: profile.businessType ?? '—', icon: 'apartment' },
                  { label: 'Date of Incorporation', value: formatDate(profile.dateOfIncorporation ?? null), icon: 'event' },
                  { label: 'Business Nature', value: profile.businessNature ?? '—', icon: 'description' },
                  { label: 'Authorized Rep', value: profile.authorizedRepresentative ?? '—', icon: 'badge' },
                  { label: 'Tax Number', value: profile.taxNumber ?? '—', icon: 'receipt' },
                ] : []),
                { label: 'Office Phone', value: profile.officePhone ?? '—', icon: 'call' },
                { label: 'Preferred Contact', value: profile.preferredContactMethod ?? '—', icon: 'contact_page' },
                { label: 'Mailing Address', value: profile.mailingAddress ?? '—', icon: 'mail' },
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
                  ].filter(f => f.value !== '—' || ['Full Name', 'Email'].includes(f.label)).map(f => (
                    <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">{f.icon}</span>
                      <span className="text-xs text-text-secondary w-28 shrink-0">{f.label}</span>
                      <span className="text-sm text-text-primary">{f.value}</span>
                    </div>
                  ))}
                  {profile.contact.nricPassport && (
                    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <span className="material-symbols-outlined text-base text-text-secondary w-5">badge</span>
                      <span className="text-xs text-text-secondary w-28 shrink-0">NRIC / Passport</span>
                      <span className="text-sm text-text-primary">
                        <NricReveal maskedNric={profile.contact.nricPassport} revealFn={() => piiRevealApi.borrowerContactNric(profile.id)} />
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Related Party Groups */}
            {(profile.relatedPartyMembers ?? []).length > 0 && (
              <div className="bg-bg-surface border border-border rounded-xl p-5 md:col-span-2">
                <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Related Party Groups</h3>
                <div className="flex flex-col gap-2">
                  {(profile.relatedPartyMembers as any[]).map((m: any) => (
                    <Link
                      key={m.group.id}
                      to={`/credit/group-exposure?groupId=${m.group.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div className="flex items-center gap-3 p-3 bg-bg-subtle border border-border rounded-lg hover:border-brand-300 transition-colors">
                        <span className="material-symbols-outlined text-brand-700">account_tree</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary">{m.group.name}</p>
                          {m.group.relationshipType && (
                            <p className="text-xs text-text-secondary">{m.group.relationshipType}{m.role ? ` · ${m.role}` : ''}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-brand-700 flex items-center gap-0.5">
                          View Group Exposure
                          <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

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

        {activeTab === 'risk' && (
          <div role="tabpanel" aria-label="Risk & Compliance" className="space-y-4">
            <RiskAssessmentResultCard
              assessment={borrower360Summary?.riskAssessment ?? null}
              canWrite={canWrite}
              recalculating={recalculating}
              recalculationError={riskCalculationError}
              onRecalculate={handleRecalculateRisk}
              onAction={handleRiskAction}
            />
            <AssessmentReadinessChecklist
              profile={profile}
              summary={borrower360Summary}
              assessment={borrower360Summary?.riskAssessment ?? null}
              onAction={handleRiskAction}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-fc border border-fc-outline bg-fc-surface p-4">
                <h4 className="text-label-md font-bold uppercase tracking-wide text-fc-on-variant">Compliance evidence</h4>
                <div className="mt-3 space-y-2 text-sm"><p><span className="text-fc-on-variant">AML tier:</span> <strong>{profile.amlRiskTier ?? 'Not assessed'}</strong></p><p><span className="text-fc-on-variant">Sanctioned entity:</span> <strong>{profile.isSanctionedEntity ? 'Yes — escalate' : 'No'}</strong></p><p><span className="text-fc-on-variant">Exposure limit:</span> <strong>{formatCurrency(profile.exposureLimit)}</strong></p><p><span className="text-fc-on-variant">Total exposure:</span> <strong>{formatCurrency(profile.totalExposure)}</strong></p></div>
              </div>
              <div className="rounded-fc border border-fc-outline bg-fc-surface p-4">
                <h4 className="text-label-md font-bold uppercase tracking-wide text-fc-on-variant">Bureau freshness</h4>
                <p className="mt-3 text-sm text-fc-primary">{borrower360Summary?.bureau.uploadedAt ? `Uploaded ${new Date(borrower360Summary.bureau.uploadedAt).toLocaleDateString()}` : 'Not available'}</p>
                <p className="mt-1 text-xs text-fc-on-variant">{borrower360Summary?.bureau.stale ? 'Refresh required before decisioning.' : borrower360Summary?.bureau.uploadedAt ? 'Current within the configured freshness window.' : 'Upload a current bureau report to assess this borrower.'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bureau' && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Bureau Report</h3>
            {(borrower360Summary?.bureauFacilities ?? []).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-bg-subtle text-[10px] uppercase tracking-wide text-text-secondary">
                      <th className="px-3 py-2">Facility</th>
                      <th className="px-3 py-2">Lender</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2 text-right">Installment</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borrower360Summary!.bureauFacilities.map((facility) => (
                      <tr key={facility.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-semibold text-text-primary">{FACILITY_TYPE_LABELS[facility.facilityType] ?? facility.facilityType}</td>
                        <td className="px-3 py-2 text-text-secondary">{facility.lender ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(facility.balance)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(facility.installment)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                            {facility.conductStatus ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-secondary italic">No bureau report on file yet.</p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div role="tabpanel" aria-label="Documents" className="bg-bg-surface border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Documents</h3>
            {(profile.documents ?? []).length > 0 ? (
              <div className="space-y-3">
                {(profile.documents ?? []).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-bg-subtle px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{doc.fileName}</p>
                      <p className="text-xs text-text-secondary">{doc.documentType} · {doc.status}</p>
                    </div>
                    <span className="text-xs text-text-secondary tabular-nums">{doc.fileSize?.toLocaleString?.() ?? doc.fileSize} bytes</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary italic">No borrower documents recorded yet.</p>
            )}
          </div>
        )}

        {/* Directors tab */}
        {false && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Directors</h3>
              {canWrite && (
                <button onClick={() => setPartyModal({ open: true, role: 'director' })} className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
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
        {false && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Shareholders</h3>
              {canWrite && (
                <button onClick={() => setPartyModal({ open: true, role: 'shareholder' })} className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
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
        {false && (
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Ultimate Beneficial Owners</h3>
              {canWrite && (
                <button onClick={() => setPartyModal({ open: true, role: 'ubo' })} className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
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

        {/* Exposure tab */}
        {activeTab === 'exposure' && (
          <div role="region" aria-label="Exposure & Facilities workspace">
            {loadingExposure ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
                ))}
              </div>
            ) : exposureError ? (
              <div role="alert" className="rounded-fc border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
                <p className="font-semibold">{exposureError}</p>
                <button type="button" onClick={fetchExposure} className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white">Retry</button>
              </div>
            ) : !exposure ? (
              <div className="rounded-fc border border-fc-outline bg-fc-surface p-8 text-center text-fc-on-variant">
                <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">account_balance</span>
                <p className="font-semibold">No exposure data available</p>
                <p className="text-sm mt-1">Exposure is calculated from approved facilities</p>
              </div>
            ) : (
              <ExposureFacilitiesTab data={exposure} onRetry={fetchExposure} />
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
            onSaved={(updated) => { setProfile(updated); setShowEditModal(false); fetchProfile(); }}
          />
        )}

        {profile && (
          <BureauUploadModal
            borrowerId={profile.id}
            open={showBureauModal}
            onClose={() => setShowBureauModal(false)}
            onSaved={() => {
              setShowBureauModal(false);
              fetchProfile();
            }}
          />
        )}

        {profile && (
          <IncomeEditModal
            borrowerId={profile.id}
            income={borrower360Summary?.income?.details ?? null}
            open={showIncomeModal}
            onClose={() => setShowIncomeModal(false)}
            onSaved={() => {
              setShowIncomeModal(false);
              fetchProfile();
            }}
          />
        )}

        {/* Add Director / Shareholder / UBO Modal */}
        {profile && (
          <PartyFormModal
            borrowerProfileId={profile.id}
            role={partyModal.role}
            open={partyModal.open}
            onClose={() => setPartyModal({ open: false, role: 'director' })}
            onCreated={() => {
              setPartyModal({ open: false, role: 'director' });
              fetchProfile(); // refresh to show new party
            }}
          />
        )}
      </div>
    </>
  );
};

export default BorrowerProfileDetail;
