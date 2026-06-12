import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditFacility, CreditApproval, ApplicationTransition, ApplicationState, ApplicationSignoff, signoffApi, dashboardApi,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import UserAssignChip from '../src/components/credit/UserAssignChip';
import S7ProcessBanner from '../src/components/credit/S7ProcessBanner';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';
import { useDirtyFormGuard } from '../src/hooks/useDirtyFormGuard';
import { useCreditFeatureFlags } from '../src/hooks/useCreditFeatureFlags';
import { useApplicationLane } from '../src/hooks/useApplicationLane';
import ReadinessChecklistModal from '../src/components/credit/ReadinessChecklistModal';

// ── New 7-Section Tabs ───────────────────────────────────
import LoanRequestTab from './credit/tabs/LoanRequestTab';
import BorrowerProfileTab from './credit/tabs/BorrowerProfileTab';
import FinancialsTab from './credit/tabs/FinancialsTab';
import RiskScoreTab from './credit/tabs/RiskScoreTab';
import PaymentCapabilityTab from './credit/tabs/PaymentCapabilityTab';
import CreditChecksTab from './credit/tabs/CreditChecksTab';
import IndustryOutlookTab from './credit/tabs/IndustryOutlookTab';
import RiskMitigatorsTab from './credit/tabs/RiskMitigatorsTab';
import CollateralTab from './credit/tabs/CollateralTab';
import SecurityGuaranteesTab from './credit/tabs/SecurityGuaranteesTab';
import GuarantorFinancialAssessmentTab from './credit/tabs/GuarantorFinancialAssessmentTab';
import StateBadge from '../src/components/credit/StateBadge';
import ApprovalsTab from './credit/tabs/ApprovalsTab';
import SignoffTab from './credit/tabs/SignoffTab';
import ConditionsTab from './credit/tabs/ConditionsTab';
import DisbursementTab from './credit/tabs/DisbursementTab';
import SummaryTab from './credit/tabs/SummaryTab';
import DocumentsTab from './credit/tabs/DocumentsTab';
import AuditTab from './credit/tabs/AuditTab';
import PartiesTab from './credit/tabs/PartiesTab';

// ── Legacy tabs (bank-grade, behind feature flags) ──
import RiskRatingEclTab from './credit/tabs/RiskRatingEclTab';
import ProfitabilityWalletTab from './credit/tabs/ProfitabilityWalletTab';
import CounterpartiesTab from './credit/tabs/CounterpartiesTab';
import AccountConductTab from './credit/tabs/AccountConductTab';
import ForwardLookingRiskTab from './credit/tabs/ForwardLookingRiskTab';
import HeaderBackgroundTab from './credit/tabs/HeaderBackgroundTab';
import FacilitiesTab from './credit/tabs/FacilitiesTab';
import RequestsFacilitiesTab from './credit/tabs/RequestsFacilitiesTab';

// ── AI Insights panels (A4/A5/A6/A13/A15) ──
import { AiDuplicateAlert, AiRedFlagPanel, AiNarrativePanel, AiCompliancePanel, AiAutoExceptionPanel } from '../src/components/credit-ai';

import {
  formatCurrency,
  STATE_COLORS,
  STATE_LABELS,
  STATE_ICONS,
  STEPPER_STAGES,
  PRODUCT_LABELS,
  SECURED_PRODUCTS,
  DetailTab,
  TabGroup,
  TAB_GROUPS,
  ALL_TABS,
  getPhaseCompletion,
  getIncompletePhaseCount,
  getNextIncompleteTab,
  getVisibleTabGroups,
  TAB_TO_PHASE_MAP,
  FATCA_CRS_FLAG,
  LANE_LABELS,
  LANE_DESCRIPTIONS,
  ProcessingLane as ProcessingLaneType,
} from './credit/creditUtils';
import RejectionBanner from './credit/RejectionBanner';
import ApplicationTimeline from '../src/components/credit/ApplicationTimeline';

// §3.5b — Application progress ring (required-section completion)
const ProgressRing: React.FC<{ pct: number; color: string; size?: number }> = ({ pct, color, size = 40 }) => {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${pct}% of required sections complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
};

const CreditApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // §3.4 — Tab state persisted in URL search params (survives navigation away/back)
  const [searchParams, setSearchParams] = useSearchParams();

  // Dirty form guard — warns on tab change / navigation if any tab has unsaved changes
  const { isDirty, setDirty, confirmTabSwitch, DirtyGuardDialog } = useDirtyFormGuard();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);

  // P2-1: Feature flags from backend (controls bank-grade tab visibility)
  const { flags: featureFlags, isFeatureEnabled } = useCreditFeatureFlags();

  // P2-2: Processing lane (determines tab set and approval depth)
  const { lane, reason: laneReason } = useApplicationLane(id);

  // P2-1: Redirect ?mode=wizard to classic view (Wizard mode removed)
  // This runs once on mount if the URL has ?mode=wizard
  useEffect(() => {
    if (searchParams.get('mode') === 'wizard') {
      const clean = new URLSearchParams(searchParams);
      clean.delete('mode');
      setSearchParams(clean, { replace: true });
      toast('Redirected to Classic View — Wizard mode has been retired.', { icon: 'ℹ️' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isNewApplication = searchParams.get('new') === '1';

  const getDefaultTab = (state: string): DetailTab => {
    // Later-stage applications default to S7 (Decision)
    if (['COMMITTEE_REVIEW', 'REFERRED_BACK', 'ACCEPTED', 'REJECTED'].includes(state)) return 'approvals';
    return 'loan-request';
  };

  const activeTab = (searchParams.get('tab') as DetailTab) || (app ? getDefaultTab(app.state || app.status || 'DRAFT') : 'loan-request');
  const setActiveTab = useCallback((tab: DetailTab) => {
    setSearchParams(prev => {
      prev.set('tab', tab);
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  // P2-1: Advanced Memo is now driven by feature flags instead of a separate toggle.
  // The credit:advanced_memo flag gates the advanced tab groups.
  const advancedMemo = isFeatureEnabled('credit:advanced_memo');
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(isNewApplication);

  // State-dependent tab visibility — computed after currentState
  // (visibleTabGroups is set in useEffect below after app loads)
  const [visibleTabGroups, setVisibleTabGroups] = useState<TabGroup[]>([]);
  const visibleTabs = visibleTabGroups.flatMap(g => g.tabs.map(t => t.id));

  // Guarded tab switch — prompts if there are unsaved changes
  const handleTabChange = useCallback((tab: DetailTab) => {
    if (isDirty && !confirmTabSwitch()) return;
    setActiveTab(tab);
  }, [isDirty, confirmTabSwitch, setActiveTab]);
  const [transitions, setTransitions] = useState<ApplicationTransition[]>([]);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    errors: { field: string; message: string; severity: string }[];
    warnings: { field: string; message: string; severity: string }[];
    satisfied: { field: string; message: string; severity: string }[];
  } | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [esignReady, setEsignReady] = useState<{ ready: boolean; signedLoo: { id: string; fileName: string; verificationStatus: string } | null } | null>(null);
  const [esignLoading, setEsignLoading] = useState(false);
  const [signoffs, setSignoffs] = useState<ApplicationSignoff[]>([]);
  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionReason, setTransitionReason] = useState('');
  const [showTransitionDialog, setShowTransitionDialog] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const pendingTransitionRef = useRef<string | null>(null);
  const transitionDialogCancelRef = useRef<HTMLButtonElement>(null);
  const transitionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [showMobileNav, setShowMobileNav] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canApprove = hasPermission(user, 'credit:approve');
  const canAdmin = hasPermission(user, 'credit:admin');

const IS_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isIdPlaceholder = id === 'new';

  const fetchApp = useCallback(async () => {
    if (!id || !IS_UUID.test(id)) return;
    try {
      setLoading(true);
      const data = await creditService.getApplication(id);
      setApp(data);
    } catch (e) {
      console.error(e);
      toast.error(friendlyMessage(e, 'Failed to load application'));
      navigate('/credit/applications');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchTransitions = useCallback(async () => {
    if (!id || !IS_UUID.test(id)) return;
    try {
      const data = await creditService.getApplicationTransitions(id);
      setTransitions(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load available actions')); }
  }, [id]);

  const fetchFacilities = useCallback(async () => {
    if (!id || !IS_UUID.test(id)) return;
    try {
      const data = await creditService.listFacilities(id);
      setFacilities(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load facilities')); }
  }, [id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);
  useEffect(() => { if (id) fetchTransitions(); }, [fetchTransitions]);
  useEffect(() => { if (id) fetchFacilities(); }, [fetchFacilities]); // Load facilities on mount for section completion

  // When id is a placeholder like "new", skip server fetches and clear loading state
  useEffect(() => {
    if (isIdPlaceholder) setLoading(false);
  }, [isIdPlaceholder]);

  // Recalculate visible tab groups when app state or feature flags change
  useEffect(() => {
    if (!app) return;
    const st = (app.state || app.status) as ApplicationState;
    setVisibleTabGroups(getVisibleTabGroups(advancedMemo, app.borrowerProfile?.borrowerType ?? null, st, featureFlags, lane as ProcessingLaneType | null));
  }, [app, advancedMemo, featureFlags, lane]);

  // Fetch sign-offs for committee review gate
  useEffect(() => {
    if (!id || !app) return;
    const st = (app.state || app.status) as ApplicationState;
    if (!['CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW', 'APPROVED', 'UNDERWRITING'].includes(st)) return;
    signoffApi.list(id).then(setSignoffs).catch(() => {});
    creditService.listApprovals(id).then(setApprovals).catch(() => {});
  }, [id, app]);

  // Derive sign-off completion status
  const REQUIRED_SIGNOFF_ROLES = ['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as string[];
  const allSigned = REQUIRED_SIGNOFF_ROLES.every(
    (role) => signoffs.some((s) => s.role === role && s.signedAt),
  );

  // Fetch readiness check when application is in DRAFT state
  useEffect(() => {
    if (!id || !app) return;
    if ((app.state || app.status) !== 'DRAFT') return;
    setReadinessLoading(true);
    creditService.checkReadiness(id)
      .then(r => setReadiness(r))
      .catch(() => { /* non-critical — panel stays hidden */ })
      .finally(() => setReadinessLoading(false));
  }, [id, app]);

  // §1.3 — Fetch e-sign readiness when application is in OFFER state
  useEffect(() => {
    if (!id || !app) return;
    if ((app.state || app.status) !== 'OFFER') return;
    setEsignLoading(true);
    creditService.checkEsignReadiness(id)
      .then(r => setEsignReady(r))
      .catch(() => { /* non-critical — panel stays hidden */ })
      .finally(() => setEsignLoading(false));
  }, [id, app]);

  // Auto-focus cancel button when dialog opens
  useEffect(() => {
    if (showTransitionDialog && transitionDialogCancelRef.current) {
      transitionDialogCancelRef.current.focus();
    }
  }, [showTransitionDialog]);

  // §T9 — Completion status callback (must be before early returns — Rules of Hooks)
  // Reads phaseCompletion via ref so hook identity is stable while data stays current.
  const phaseCompletionRef = useRef<Record<string, string>>({});
  const getCompletionStatus = useCallback((tabId: DetailTab): 'complete' | 'partial' | 'empty' => {
    const phaseKey = TAB_TO_PHASE_MAP[tabId];
    if (!phaseKey) return 'empty';
    const status = phaseCompletionRef.current[phaseKey];
    if (status === 'complete') return 'complete';
    if (status === 'incomplete') return 'partial';
    return 'empty';
  }, []);

  const handleTransition = async (action: string) => {
    if (!id) return;
    const t = transitions.find(tr => tr.action === showTransitionDialog);
    if (t?.requiresComment && !transitionReason.trim()) {
      setReasonError(true);
      return;
    }
    try {
      setTransitioning(true);
      await creditService.transitionApplication(id, { action, reason: transitionReason || undefined });
      toast.success('Application transitioned successfully');
      setTransitionReason('');
      setReasonError(false);
      setShowTransitionDialog(null);
      // Return focus to trigger button
      transitionTriggerRef.current?.focus();
      fetchApp();
      fetchTransitions();
      // Re-check readiness if we returned to DRAFT (e.g. after KYC rejection)
      setReadiness(null);
      setEsignReady(null);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to transition application')); }
    finally { setTransitioning(false); }
  };

  const handleDownloadCaMemo = async () => {
    if (!app) return;
    try {
      const response = await creditService.downloadCaMemo(app.id);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CA-Memo-${app.applicationNo || app.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CA Memo downloaded');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to export CA Memo'));
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: DetailTab) => {
    const idx = visibleTabs.indexOf(tab);
    if (idx === -1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = visibleTabs[(idx + 1) % visibleTabs.length];
      handleTabChange(next);
      document.getElementById(`tab-${next}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = visibleTabs[(idx - 1 + visibleTabs.length) % visibleTabs.length];
      handleTabChange(prev);
      document.getElementById(`tab-${prev}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleTabChange(visibleTabs[0]);
      document.getElementById(`tab-${visibleTabs[0]}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      handleTabChange(visibleTabs[visibleTabs.length - 1]);
      document.getElementById(`tab-${visibleTabs[visibleTabs.length - 1]}`)?.focus();
    }
  };

  // When id is "new" (placeholder), show a redirect to the creation flow
  // This handles /credit/applications/new which is not a valid UUID
  if (isIdPlaceholder) {
    return (
      <>
        <CreditNav />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }} className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">New Credit Application</h2>
          <p className="text-gray-600 mb-6">
            You&#39;ll be redirected to the application list to create a new application.
          </p>
          <button
            type="button"
            onClick={() => navigate('/credit/applications')}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Go to Applications
          </button>
        </div>
      </>
    );
  }

  if (loading) return (
    <>
      <CreditNav />
      <div aria-busy="true" style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: 20, marginBottom: 12, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    </>
  );

  if (!app) return null;

  const currentState = (app.state || app.status) as ApplicationState;
  const badge = STATE_COLORS[currentState] || STATE_COLORS.DRAFT;

  const phaseCompletion = getPhaseCompletion({
    requestedAmount: app.requestedAmount,
    requestedTenor: app.requestedTenor,
    productType: app.productType as string | null,
    purpose: app.purpose,
    borrowerType: app.borrowerProfile?.borrowerType ?? null,
    registrationNumber: null,
    riskRating: app.riskRating,
    firstWayOut: app.firstWayOut,
    preparedAt: app.preparedAt,
    decisionedAt: app.decisionedAt,
    facilities: facilities,
    parties: app.parties,
    financialStatements: app.borrowerProfile?.financialStatements ?? [],
    creditBureauChecks: (app as any).creditBureauChecks ?? [],
    retailIncome: (app as any).retailIncome ?? null,
    bureauChecklist: (app as any).bureauChecklist ?? null,
    isSecured: ((app as any).collateralItems?.length ?? 0) > 0 || SECURED_PRODUCTS.includes(app.productType as string),
  });
  phaseCompletionRef.current = phaseCompletion; // keep ref in sync for getCompletionStatus
  const incompleteCount = getIncompletePhaseCount(phaseCompletion);
  // §3.5b — Application progress ring (required sections only; 'optional' excluded)
  const requiredPhases = Object.values(phaseCompletion).filter(s => s !== 'optional');
  const completedPhases = requiredPhases.filter(s => s === 'complete').length;
  const progressPct = requiredPhases.length > 0 ? Math.round((completedPhases / requiredPhases.length) * 100) : 0;
  const progressColor = progressPct > 80 ? '#16a34a' : progressPct >= 50 ? '#d97706' : '#dc2626';

  // Stepper logic
  const currentStageIdx = STEPPER_STAGES.findIndex(s => s.states.includes(currentState));
  const isPastStage = (idx: number) => idx < currentStageIdx;
  const isCurrentStage = (idx: number) => idx === currentStageIdx;

  // ── Render tab by ID (7-section + advanced) ───────────────────
  const renderTab = (tabId: DetailTab): React.ReactNode => {
    switch (tabId) {
      // S1 — Loan Request
      case 'loan-request': return <LoanRequestTab application={app!} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} />;

      // S2 — Borrower Profile
      case 'borrower-profile': return <BorrowerProfileTab application={app!} fatcaCrsEnabled={isFeatureEnabled(FATCA_CRS_FLAG)} />;
      case 'parties': return <PartiesTab app={app!} borrowerType={app?.borrowerProfile?.borrowerType} />;

      // S3 — Financials
      case 'financials': return <FinancialsTab application={app!} />;

      // S4 — Risk Score
      case 'risk-score': return <RiskScoreTab application={app!} onUpdated={setApp} onRefresh={fetchApp} />;
      case 'payment-capability': return <PaymentCapabilityTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;

      // S5 — Bureau & Compliance
      case 'credit-checks': return <CreditChecksTab application={app!} onUpdated={setApp} />;
      case 'industry': return <IndustryOutlookTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;
      case 'risk': return <RiskMitigatorsTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;

      // AI Insights (A4/A5/A6/A13/A15)
      case 'ai-insights': return (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
            <span className="material-icons text-base">smart_toy</span>
            AI proposes, humans dispose. All AI outputs are advisory — officers must exercise independent judgement.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AiDuplicateAlert applicationId={app!.id} />
            <AiRedFlagPanel applicationId={app!.id} />
            <AiCompliancePanel applicationId={app!.id} />
            <AiAutoExceptionPanel applicationId={app!.id} />
          </div>
          <AiNarrativePanel applicationId={app!.id} />
        </div>
      );

      // S6 — Collateral & Guarantees
      case 'collateral': return <CollateralTab />;
      case 'security': return <SecurityGuaranteesTab application={app!} onUpdated={setApp} />;
      case 'guarantor-assessment': return <GuarantorFinancialAssessmentTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;

      // S7 — Decision
      case 'approvals': return <ApprovalsTab app={app!} onRefresh={fetchApp} />;
      case 'signoff': return <SignoffTab application={app!} onUpdated={setApp} />;
      case 'conditions': return <ConditionsTab />;
      case 'disbursement': return <DisbursementTab application={app!} onUpdated={(updated) => setApp(updated)} />;
      case 'summary': return <SummaryTab app={app!} facilities={facilities} onRefresh={fetchApp} />;

      // META — Operations
      case 'documents': return <DocumentsTab app={app!} canApprove={canApprove} />;
      case 'audit': return <AuditTab />;

      // Bank-only tabs (P2-1: gated by feature flags — only rendered if tab is in visibleTabs)
      case 'risk-rating': return isFeatureEnabled('credit:ecl') ? <RiskRatingEclTab application={app!} onDirtyChange={setDirty} /> : null;
      case 'profitability': return isFeatureEnabled('credit:profitability') ? <ProfitabilityWalletTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} /> : null;
      case 'counterparties': return isFeatureEnabled('credit:counterparties') ? <CounterpartiesTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} /> : null;
      case 'conduct': return isFeatureEnabled('credit:account_conduct') ? <AccountConductTab application={app!} onUpdated={setApp} /> : null;
      case 'forward-looking-risk': return isFeatureEnabled('credit:esg') ? <ForwardLookingRiskTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} /> : null;
      case 'header': return advancedMemo ? <HeaderBackgroundTab application={app!} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} /> : null;
      case 'facilities': return advancedMemo ? <RequestsFacilitiesTab application={app!} onDirtyChange={setDirty} /> : null;

      default: return null;
    }
  };

  return (
    <>
      {/* §3.7 — Skip-to-content link for keyboard users */}
      <a href="#credit-detail-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-3 focus:py-1 focus:bg-blue-600 focus:text-white focus:rounded focus:text-sm focus:font-bold">
        Skip to content
      </a>
      <CreditNav />
      <div id="credit-detail-content" style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
            <span>/</span>
            <Link to="/credit/applications" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Applications</Link>
            <span>/</span>
            <span className="font-semibold text-text-primary">{app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : app.borrowerProfile.name) || 'Unnamed Borrower') : app.id.slice(0, 8)}</span>
            {/* P2-2: Processing lane badge */}
            {lane && lane !== 'CORPORATE' && (
              <span
                className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  lane === 'PERSONAL_FAST' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}
                title={laneReason || LANE_DESCRIPTIONS[lane as ProcessingLaneType]}
              >
                {LANE_LABELS[lane as ProcessingLaneType] || lane}
              </span>
            )}
          </div>
        </div>

        {/* Header — sticky on scroll */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-border/50 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ProgressRing pct={progressPct} color={progressColor} />
                <span className="text-[11px] text-text-secondary leading-tight">
                  {completedPhases}/{requiredPhases.length}<br />complete
                </span>
              </div>
              <div>
                <h1 className="text-lg font-black text-text-primary leading-tight">
                  {app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : app.borrowerProfile.name) || 'Unnamed Borrower') : 'Application'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <StateBadge state={currentState} size="md" />
                  {app.riskRating && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary bg-bg-subtle px-1.5 py-0.5 rounded-full border border-border" title="Risk rating">
                      <span className="material-symbols-outlined text-[12px]">speed</span>
                      {app.riskRating}
                    </span>
                  )}
                  {['SUBMITTED','KYC_REVIEW','UNDERWRITING','CREDIT_ASSESSMENT','COMMITTEE_REVIEW'].includes(currentState) && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                      Pending approval
                    </span>
                  )}
                  {currentState === 'REFERRED_BACK' && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-300">
                      Referred Back
                    </span>
                  )}
                  <span className="text-sm text-text-secondary">{PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName}</span>
                  {incompleteCount > 0 && (
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      {incompleteCount} section{incompleteCount !== 1 ? 's' : ''} incomplete
                    </span>
                  )}
                  {incompleteCount === 0 && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      All sections complete
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* §6.1 — Clone / Renew buttons */}
              {['APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED'].includes(currentState) && hasPermission(user, 'credit:create') && (
                <>
                  <button
                    onClick={async () => {
                      if (!app) return;
                      try {
                        const newId = await creditService.cloneApplication(app.id);
                        toast.success('Application cloned successfully');
                        navigate(`/credit/applications/${newId}?new=1`);
                      } catch (e) {
                        toast.error(friendlyMessage(e, 'Failed to clone application'));
                      }
                    }}
                    className="flex items-center gap-1 text-sm text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined text-base">content_copy</span> Clone
                  </button>
                  <button
                    onClick={async () => {
                      if (!app) return;
                      try {
                        const newId = await creditService.cloneApplication(app.id, { asRenewal: true });
                        toast.success('Renewal application created');
                        navigate(`/credit/applications/${newId}?new=1`);
                      } catch (e) {
                        toast.error(friendlyMessage(e, 'Failed to create renewal'));
                      }
                    }}
                    className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined text-base">autorenew</span> Renew
                  </button>
                </>
              )}
              {app.borrowerProfile && (
                <Link to={`/credit/borrowers/${app.borrowerProfileId}`}
                  className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
                  style={{ textDecoration: 'none' }}>
                  <span className="material-symbols-outlined text-base">person</span> Borrower
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* §2.7 — Rejection Banner */}
        <RejectionBanner
          applicationId={app.id}
          state={currentState}
          rejectionReasonCode={(app as any).rejectionReasonCode}
          rejectionReason={app.rejectionReason}
          applicationNo={app.applicationNo ?? undefined}
        />

        {/* §3.5d — Application Timeline */}
        <ApplicationTimeline applicationId={app.id} currentState={currentState} />

        {/* Stepper */}
        <div className="bg-bg-surface border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            {STEPPER_STAGES.map((stage, idx) => (
              <React.Fragment key={stage.key}>
                <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1.5 ${
                    isCurrentStage(idx) ? 'bg-brand-700 text-white ring-4 ring-brand-100' :
                    isPastStage(idx) ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {isPastStage(idx) ? <span className="material-symbols-outlined text-base">check</span> : idx + 1}
                  </div>
                  <span className={`text-xs font-bold text-center ${isCurrentStage(idx) ? 'text-brand-700' : isPastStage(idx) ? 'text-green-600' : 'text-text-secondary'}`}>
                    {stage.label}
                  </span>
                </div>
                {idx < STEPPER_STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mt-[-16px] ${isPastStage(idx + 1) || isCurrentStage(idx + 1) ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minWidth: 20 }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Key Info Chips — read-only facts vs. editable assignments are visually distinguished */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Amount', value: formatCurrency(app.requestedAmount, app.currency), icon: 'payments' },
              { label: 'Tenor', value: app.requestedTenor != null ? `${app.requestedTenor} mo` : '—', icon: 'schedule' },
              ...(['APPROVED', 'ACCEPTED', 'OFFER', 'ACTIVE', 'DISBURSED', 'CLOSED'].includes(app.state) && facilities.some(f => f.approvedAmount != null)
                ? [{ label: 'Approved', value: formatCurrency(Number(facilities.reduce((s, f) => s + Number(f.approvedAmount || 0), 0)), app.currency), icon: 'check_circle' }]
                : []),
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
                <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
                <span className="font-bold text-text-primary">{s.value}</span>
                <span className="text-text-secondary">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="w-px self-stretch bg-border hidden sm:block" />
          <div className="flex flex-wrap gap-3">
            <UserAssignChip
              label="RM"
              value={app.rm ?? null}
              applicationId={app.id}
              field="assignedRmId"
              roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']}
              disabled={['CLOSED', 'WITHDRAWN', 'ACTIVE', 'DISBURSED'].includes(app.state)}
              onUpdated={setApp}
            />
            <UserAssignChip
              label="Analyst"
              value={app.analyst ?? null}
              applicationId={app.id}
              field="assignedAnalystId"
              roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']}
              disabled={['CLOSED', 'WITHDRAWN', 'ACTIVE', 'DISBURSED'].includes(app.state)}
              onUpdated={setApp}
            />
          </div>
        </div>

        {/* Onboarding banner — shown once for newly created applications */}
        {showOnboardingBanner && currentState === 'DRAFT' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-indigo-500 text-xl mt-0.5">info</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-indigo-800 mb-1">Application created — complete all 7 sections to submit</p>
              <p className="text-xs text-indigo-700">
                Start with <strong>S1 Loan Request</strong> (already pre-filled), then work through S2–S7.
                When all sections are green, use <strong>Submit for KYC Review</strong> below.
              </p>
            </div>
            <button
              onClick={() => setShowOnboardingBanner(false)}
              aria-label="Dismiss"
              className="text-indigo-400 hover:text-indigo-600 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )}

        {/* Status explanation banner — ACTIVE / CLOSED context */}
        {currentState === 'ACTIVE' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5">info</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-blue-800 mb-1">This loan is currently active</p>
              <p className="text-xs text-blue-700">
                The borrower has received funds and the facility is in use. The bank is actively exposed.
                Close this application only when the loan has been <strong>fully repaid, written off, or formally terminated</strong>.
                Closing is irreversible and will stop all monitoring.
              </p>
            </div>
          </div>
        )}
        {currentState === 'CLOSED' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-gray-500 text-xl mt-0.5">lock</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800 mb-1">This loan has been closed</p>
              <p className="text-xs text-gray-600">
                The loan lifecycle is complete. No further actions can be taken on this application.
                {app.closedAt && <> Closed on <strong>{new Date(app.closedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.</>}
              </p>
            </div>
          </div>
        )}

        {/* Readiness pre-flight panel — DRAFT only */}
        {currentState === 'DRAFT' && (readiness || readinessLoading) && (
          <div className="bg-bg-surface border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-base text-text-secondary">checklist</span>
              <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Submission Readiness</h3>
              {readinessLoading && <span className="text-xs text-text-secondary ml-auto">Checking…</span>}
              {!readinessLoading && readiness && (
                <span className={`text-xs font-bold ml-auto px-2 py-0.5 rounded-full ${readiness.ready ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {readiness.ready ? 'Ready to submit' : `${readiness.errors.length} issue${readiness.errors.length !== 1 ? 's' : ''} blocking`}
                </span>
              )}
            </div>
            {readiness && (
              <ul className="space-y-1.5">
                {readiness.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">cancel</span>
                    {e.message}
                  </li>
                ))}
                {readiness.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">warning</span>
                    {w.message}
                  </li>
                ))}
                {readiness.satisfied?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">verified</span>
                    {s.message}
                  </li>
                ))}
                {readiness.ready && readiness.warnings.length === 0 && (readiness.satisfied?.length ?? 0) === 0 && (
                  <li className="flex items-center gap-2 text-xs text-green-700">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    All checks passed — application is ready to submit.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {/* CA Memo Export */}
        <div className="flex justify-end mb-2">
          <button
            onClick={handleDownloadCaMemo}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">description</span>
            Export CA Memo
          </button>
        </div>

        {/* Transition Action Buttons */}
        {transitions.length > 0 && canWrite && (
          <div className="bg-bg-surface border border-border rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-3">Available Actions</h3>

            {/* §1.1c — Sign-off gate warning banner (CREDIT_ASSESSMENT only) */}
            {currentState === 'CREDIT_ASSESSMENT' && !allSigned && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0">warning</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">CA Memo sign-off must be completed before submitting to committee</p>
                  {/* §1.1d — Sign-off status checkmarks */}
                  <div className="flex gap-3 mt-1.5">
                    {(['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as string[]).map(role => {
                      const isSigned = signoffs.some(s => s.role === role && s.signedAt);
                      const label = role === 'PREPARED_BY' ? 'Prepared By' : role === 'REVIEWED_BY' ? 'Reviewed By' : 'Concurred By';
                      return (
                        <span key={role} className={`text-xs font-semibold flex items-center gap-1 ${isSigned ? 'text-green-700' : 'text-amber-700'}`}>
                          <span className="material-symbols-outlined text-sm">{isSigned ? 'check_circle' : 'cancel'}</span>
                          {isSigned ? '✓' : '✗'} {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* §1.3 — E-sign gate banner (OFFER state only) */}
            {currentState === 'OFFER' && esignReady && !esignReady.ready && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5 shrink-0">lock</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">Signed Letter of Offer required before acceptance</p>
                  <p className="text-xs text-amber-700 mt-1">
                    To accept this offer, upload the signed Letter of Offer as a <strong>Letter of Offer</strong> document and have it verified by a credit officer.
                  </p>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className="mt-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">upload_file</span>
                    Go to Documents tab to upload
                  </button>
                </div>
              </div>
            )}
            {currentState === 'OFFER' && esignReady && esignReady.ready && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <span className="material-symbols-outlined text-green-600 text-base mt-0.5 shrink-0">verified</span>
                <div>
                  <p className="text-xs font-bold text-green-800">Signed Letter of Offer verified</p>
                  {esignReady.signedLoo && (
                    <p className="text-xs text-green-700 mt-0.5">
                      Document: {esignReady.signedLoo.fileName} — ready to accept offer.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {transitions.map(t => {
                const isReject = t.toState === 'REJECTED' || t.toState === 'KYC_REJECTED' || t.toState === 'WITHDRAWN';
                const isApprove = t.toState === 'APPROVED' || t.toState === 'KYC_APPROVED' || t.toState === 'ACCEPTED';
                const isTerminal = t.toState === 'CLOSED' || t.toState === 'WITHDRAWN' || t.toState === 'REJECTED' || t.toState === 'KYC_REJECTED';
                const isSignoffBlocked = t.action === 'submit_to_committee' && !allSigned;
                const isEsignBlocked = t.action === 'accept_offer' && esignReady !== null && !esignReady.ready;
                const isAdminAction = t.action === 'close';
                const isAdminBlocked = isAdminAction && !canAdmin;
                // §3.1 — Submission readiness check: show readiness modal if sections are incomplete
                const isSubmitAction = currentState === 'DRAFT' || currentState === 'REFERRED_BACK' || t.action === 'submit_to_committee';
                const handleTransitionClick = () => {
                  if (isSignoffBlocked || isEsignBlocked || isAdminBlocked) return;
                  if (isSubmitAction && incompleteCount > 0) {
                    pendingTransitionRef.current = t.action;
                    setReadinessModalOpen(true);
                    return;
                  }
                  setShowTransitionDialog(t.action);
                };
                return (
                  <button key={t.action} ref={el => { if (t.action === showTransitionDialog) transitionTriggerRef.current = el; }}
                    onClick={handleTransitionClick}
                    disabled={isSignoffBlocked || isEsignBlocked || isAdminBlocked}
                    title={isSignoffBlocked ? 'Blocked: Complete all CA Memo sign-offs (Prepared By, Reviewed By, Concurred By) first' :
                      isEsignBlocked ? 'Blocked: Upload and verify a signed Letter of Offer before accepting the offer.' :
                      isAdminBlocked ? 'Admin permission required: Only credit administrators can close a loan' :
                      t.toState === 'CLOSED' ? 'Irreversible: This will permanently close the loan and stop all monitoring.' : undefined}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      isSignoffBlocked || isEsignBlocked || isAdminBlocked ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60' :
                      t.toState === 'CLOSED' ? 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100' :
                      isReject ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' :
                      isApprove ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' :
                      'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                    }`} style={{ fontFamily: 'var(--font-sans)', cursor: isSignoffBlocked || isEsignBlocked || isAdminBlocked ? 'not-allowed' : 'pointer' }}>
                    <span className="material-symbols-outlined text-base">{
                      t.toState === 'CLOSED' ? 'lock' :
                      isReject ? 'block' : isApprove ? 'check_circle' : 'arrow_forward'
                    }</span>
                    {t.label || t.action.replace(/_/g, ' ')}
                    <span className="text-xs opacity-70 ml-1">→ {STATE_LABELS[t.toState] || t.toState}</span>
                  </button>
                );
              })}
            </div>

            {/* §1.1d — Sign-off checkmarks beside buttons when in CREDIT_ASSESSMENT */}
            {currentState === 'CREDIT_ASSESSMENT' && allSigned && transitions.some(t => t.action === 'submit_to_committee') && (
              <div className="mt-2 flex gap-3">
                {(['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as string[]).map(role => {
                  const label = role === 'PREPARED_BY' ? 'Prepared By' : role === 'REVIEWED_BY' ? 'Reviewed By' : 'Concurred By';
                  return (
                    <span key={role} className="text-xs font-semibold text-green-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      ✓ {label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mobile sticky nav bar — visible only on small screens */}
        {(() => {
          const activeGroup = visibleTabGroups.find(g => g.tabs.some(t => t.id === activeTab));
          const activeTabDef = activeGroup?.tabs.find(t => t.id === activeTab);
          const groupStatus = activeGroup ? phaseCompletion[activeGroup.id] : 'optional';
          return (
            <div className="md:hidden sticky top-0 z-40 bg-white border border-border rounded-xl shadow-sm mb-4 overflow-hidden">
              <button
                onClick={() => setShowMobileNav(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                aria-expanded={showMobileNav}
                aria-controls="mobile-nav-drawer"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`material-symbols-outlined text-[18px] shrink-0 ${groupStatus === 'complete' ? 'text-green-500' : groupStatus === 'optional' ? 'text-gray-400' : 'text-amber-500'}`}>
                    {groupStatus === 'complete' ? 'check_circle' : groupStatus === 'optional' ? 'radio_button_unchecked' : 'error'}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-text-secondary uppercase tracking-wider truncate">{activeGroup?.label}</div>
                    <div className="text-sm font-bold text-text-primary truncate">{activeTabDef?.label}</div>
                  </div>
                </div>
                <span className={`material-symbols-outlined text-xl text-text-secondary transition-transform ${showMobileNav ? 'rotate-180' : ''}`}>expand_more</span>
              </button>

              {showMobileNav && (
                <div id="mobile-nav-drawer" className="border-t border-border max-h-[60vh] overflow-y-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
                  {visibleTabGroups.map((group) => {
                    const gStatus = phaseCompletion[group.id];
                    return (
                      <div key={group.id}>
                        <div className="relative px-3 py-2 bg-gray-50 border-b border-border">
                          <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wide pr-6 leading-normal">{group.label}</span>
                          <span className={`material-symbols-outlined text-[14px] absolute right-2.5 top-1/2 -translate-y-1/2 ${gStatus === 'complete' ? 'text-green-500' : gStatus === 'optional' ? 'text-gray-400' : 'text-amber-500'}`}>
                            {gStatus === 'complete' ? 'check_circle' : gStatus === 'optional' ? 'radio_button_unchecked' : 'error'}
                          </span>
                        </div>
                        {group.tabs.map((tab) => {
                          const isActive = activeTab === tab.id;
                          return (
                            <button key={tab.id}
                              onClick={() => { handleTabChange(tab.id); setShowMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                              className={`w-full text-left px-6 py-2.5 text-sm font-semibold flex items-center justify-between ${isActive ? 'bg-brand-50 text-brand-700' : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'}`}
                              style={{ background: isActive ? 'var(--brand-50)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', borderLeft: isActive ? '3px solid var(--brand-700)' : '3px solid transparent' }}
                            >
                              {tab.label}
                              {isActive && <span className="material-symbols-outlined text-[16px]">chevron_right</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Layout Wrapper */}
        <div className="flex flex-col md:flex-row gap-6 mb-6 relative">
          {/* Sidebar Tabs — desktop only */}
          <nav aria-label="Application sections" className="hidden md:flex md:w-72 shrink-0 flex-col sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden pr-1 pb-4 bg-bg-surface border border-border rounded-xl shadow-sm" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
            {visibleTabGroups.map((group, groupIdx) => {
              const groupStatus = phaseCompletion[group.id];
              const isGroupComplete = groupStatus === 'complete';
              const isOptional = groupStatus === 'optional';
              // Show section label (S1, S2, etc.) or "ADV" for bank-only
              const sectionMatch = /^s(\d+)$/.exec(group.id);
              const sectionLabel = sectionMatch ? `S${sectionMatch[1]}` : group.advancedOnly ? 'ADV' : null;
              const dotClass = isGroupComplete ? 'bg-green-500' : isOptional ? 'bg-gray-300' : 'bg-amber-500';
              const dotTitle = isGroupComplete ? 'Complete' : isOptional ? 'Optional' : 'Incomplete';
              return (
                <div key={group.id} className={groupIdx === 0 ? 'pt-2' : 'pt-3'}>
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    {sectionLabel && (
                      <span className="text-[10px] font-semibold text-text-tertiary bg-gray-100 border border-border rounded px-1.5 py-0.5 shrink-0">{sectionLabel}</span>
                    )}
                    <span className="text-[11px] font-semibold text-text-tertiary uppercase truncate min-w-0 flex-1" title={group.label}>{group.label}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} title={dotTitle} aria-label={dotTitle} />
                  </div>
                  <div className="flex flex-col" role="tablist" aria-label={group.label}>
                    {group.tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={`panel-${tab.id}`}
                          id={`tab-${tab.id}`}
                          tabIndex={isActive ? 0 : -1}
                          onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                          title={tab.label}
                          className={`relative text-left pl-6 pr-3 py-1.5 text-sm transition-colors flex items-center min-w-0 ${
                            isActive
                              ? 'bg-brand-50 text-brand-700 font-semibold'
                              : 'text-text-primary font-medium hover:bg-gray-50'
                          }`}
                          style={{ cursor: 'pointer', outline: 'none', border: 'none', background: isActive ? 'var(--brand-50)' : 'transparent' }}>
                          {isActive && <span aria-hidden="true" className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-brand-700" />}
                          <span className="truncate min-w-0">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 flex-1">

        {/* S1 — Loan Request */}
        {activeTab === 'loan-request' && (
          <div role="tabpanel" id="panel-loan-request" aria-labelledby="tab-loan-request" tabIndex={0}>
            <LoanRequestTab application={app} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} />
          </div>
        )}

        {/* S2 — Borrower Profile */}
        {activeTab === 'borrower-profile' && (
          <div role="tabpanel" id="panel-borrower-profile" aria-labelledby="tab-borrower-profile" tabIndex={0}>
            <BorrowerProfileTab application={app} />
          </div>
        )}

        {/* S2 — Parties (Directors & UBOs) */}
        {activeTab === 'parties' && (
          <div role="tabpanel" id="panel-parties" aria-labelledby="tab-parties" tabIndex={0}>
            <PartiesTab app={app} />
          </div>
        )}

        {/* S3 — Financials */}
        {activeTab === 'financials' && (
          <div role="tabpanel" id="panel-financials" aria-labelledby="tab-financials" tabIndex={0}>
            <FinancialsTab application={app} />
          </div>
        )}

        {/* S4 — Risk Score */}
        {activeTab === 'risk-score' && (
          <div role="tabpanel" id="panel-risk-score" aria-labelledby="tab-risk-score" tabIndex={0}>
            <RiskScoreTab application={app} onUpdated={setApp} onRefresh={fetchApp} />
          </div>
        )}

        {/* S4 — Payment Capability */}
        {activeTab === 'payment-capability' && (
          <div role="tabpanel" id="panel-payment-capability" aria-labelledby="tab-payment-capability" tabIndex={0}>
            <PaymentCapabilityTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {/* S5 — Bureau Checks */}
        {activeTab === 'credit-checks' && (
          <div role="tabpanel" id="panel-credit-checks" aria-labelledby="tab-credit-checks" tabIndex={0}>
            <CreditChecksTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* S5 — Industry Outlook */}
        {activeTab === 'industry' && (
          <div role="tabpanel" id="panel-industry" aria-labelledby="tab-industry" tabIndex={0}>
            <IndustryOutlookTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {/* S5 — Risk & Mitigators */}
        {activeTab === 'risk' && (
          <div role="tabpanel" id="panel-risk" aria-labelledby="tab-risk" tabIndex={0}>
            <RiskMitigatorsTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {/* AI Insights (A4/A5/A6/A13/A15) */}
        {activeTab === 'ai-insights' && (
          <div role="tabpanel" id="panel-ai-insights" aria-labelledby="tab-ai-insights" tabIndex={0}>
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
                <span className="material-icons text-base">smart_toy</span>
                AI proposes, humans dispose. All AI outputs are advisory — officers must exercise independent judgement.
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AiDuplicateAlert applicationId={app.id} />
                <AiRedFlagPanel applicationId={app.id} />
                <AiCompliancePanel applicationId={app.id} />
                <AiAutoExceptionPanel applicationId={app.id} />
              </div>
              <AiNarrativePanel applicationId={app.id} />
            </div>
          </div>
        )}

        {/* S6 — Collateral */}
        {activeTab === 'collateral' && (
          <div role="tabpanel" id="panel-collateral" aria-labelledby="tab-collateral" tabIndex={0}>
            <CollateralTab />
          </div>
        )}

        {/* S6 — Security & Guarantees */}
        {activeTab === 'security' && (
          <div role="tabpanel" id="panel-security" aria-labelledby="tab-security" tabIndex={0}>
            <SecurityGuaranteesTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* S7 — Guarantor Financial Assessment */}
        {activeTab === 'guarantor-assessment' && (
          <div role="tabpanel" id="panel-guarantor-assessment" aria-labelledby="tab-guarantor-assessment" tabIndex={0}>
            <GuarantorFinancialAssessmentTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {/* S7 — Decision Process Banner */}
        {['signoff', 'approvals', 'guarantor-assessment', 'conditions', 'summary'].includes(activeTab) && (
          <S7ProcessBanner
            app={app}
            signoffs={signoffs}
            allSigned={allSigned}
            approvals={approvals}
            onNavigate={(tab) => handleTabChange(tab as DetailTab)}
          />
        )}

        {/* S7 — Approval Chain */}
        {activeTab === 'approvals' && (
          <div role="tabpanel" id="panel-approvals" aria-labelledby="tab-approvals" tabIndex={0}>
            <ApprovalsTab app={app} onRefresh={fetchApp} />
          </div>
        )}

        {/* S7 — Sign-off */}
        {activeTab === 'signoff' && (
          <div role="tabpanel" id="panel-signoff" aria-labelledby="tab-signoff" tabIndex={0}>
            <SignoffTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* S7 — Conditions */}
        {activeTab === 'conditions' && (
          <div role="tabpanel" id="panel-conditions" aria-labelledby="tab-conditions" tabIndex={0}>
            <ConditionsTab />
          </div>
        )}

        {/* S7 — Summary */}
        {activeTab === 'summary' && (
          <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" tabIndex={0}>
            <SummaryTab app={app} facilities={facilities} onRefresh={fetchApp} />
          </div>
        )}

        {/* META — Documents */}
        {activeTab === 'documents' && (
          <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents" tabIndex={0}>
            <DocumentsTab app={app} canApprove={canApprove} />
          </div>
        )}

        {/* META — Audit Trail */}
        {activeTab === 'audit' && (
          <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" tabIndex={0}>
            <AuditTab />
          </div>
        )}

        {/* ── Bank-only tabs (rendered when advancedMemo is true) ── */}

        {activeTab === 'risk-rating' && (
          <div role="tabpanel" id="panel-risk-rating" aria-labelledby="tab-risk-rating" tabIndex={0}>
            <RiskRatingEclTab application={app} onDirtyChange={setDirty} />
          </div>
        )}

        {activeTab === 'profitability' && (
          <div role="tabpanel" id="panel-profitability" aria-labelledby="tab-profitability" tabIndex={0}>
            <ProfitabilityWalletTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {activeTab === 'counterparties' && (
          <div role="tabpanel" id="panel-counterparties" aria-labelledby="tab-counterparties" tabIndex={0}>
            <CounterpartiesTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {activeTab === 'conduct' && (
          <div role="tabpanel" id="panel-conduct" aria-labelledby="tab-conduct" tabIndex={0}>
            <AccountConductTab application={app} onUpdated={setApp} />
          </div>
        )}

        {activeTab === 'forward-looking-risk' && (
          <div role="tabpanel" id="panel-forward-looking-risk" aria-labelledby="tab-forward-looking-risk" tabIndex={0}>
            <ForwardLookingRiskTab application={app} onUpdated={setApp} onDirtyChange={setDirty} />
          </div>
        )}

        {activeTab === 'header' && (
          <div role="tabpanel" id="panel-header" aria-labelledby="tab-header" tabIndex={0}>
            <HeaderBackgroundTab application={app} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} />
          </div>
        )}

        {activeTab === 'facilities' && (
          <div role="tabpanel" id="panel-facilities" aria-labelledby="tab-facilities" tabIndex={0}>
            <RequestsFacilitiesTab application={app} onDirtyChange={setDirty} />
          </div>
        )}

            </div>
          </div>
        </div>

        {/* Floating Action Button — jump to next incomplete section */}
        {(() => {
          const nextTab = getNextIncompleteTab(phaseCompletion, currentState);
          if (!nextTab || nextTab === activeTab) return null;
          const nextGroup = visibleTabGroups.find(g => g.tabs.some(t => t.id === nextTab));
          return (
            <div className="fixed bottom-8 right-8 z-50">
              <button
                onClick={() => {
                  handleTabChange(nextTab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white px-5 py-3 rounded-full shadow-lg transition-transform hover:scale-105"
                style={{ cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)' }}
                aria-label={`Go to next incomplete section: ${nextGroup?.label}`}
              >
                <span className="font-bold text-sm hidden sm:inline">Next Incomplete Section</span>
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </div>
          );
        })()}

        {/* Transition Dialog */}
        {showTransitionDialog && (() => {
          const t = transitions.find(tr => tr.action === showTransitionDialog);
          const isReject = t?.toState === 'REJECTED' || t?.toState === 'KYC_REJECTED' || t?.toState === 'WITHDRAWN';
          const label = t?.label || showTransitionDialog.replace(/_/g, ' ');
          return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => { setShowTransitionDialog(null); transitionTriggerRef.current?.focus(); }}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transition-dialog-title"
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Escape') { setShowTransitionDialog(null); setTransitionReason(''); setReasonError(false); transitionTriggerRef.current?.focus(); } }}>
              <h2 id="transition-dialog-title" className="text-lg font-black text-text-primary mb-2">
                {showTransitionDialog === 'close' ? 'Close This Loan?' : 'Confirm Action'}
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                {showTransitionDialog === 'close' ? (
                  <>You are about to permanently close this loan application. This <strong>cannot be undone</strong>.</>
                ) : (
                  <>
                    Are you sure you want to <span className="font-bold text-text-primary">{label}</span>?
                    {t && <span className="block mt-1 text-xs text-text-secondary">This will change the application status to <span className="font-semibold">{STATE_LABELS[t.toState] || t.toState}</span>.</span>}
                  </>
                )}
              </p>

              {/* §4 — Sign-off status in transition dialog */}
              {showTransitionDialog === 'submit_to_committee' && (
                <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">CA Memo Sign-off Status</p>
                  <div className="space-y-1.5">
                    {(['PREPARED_BY', 'REVIEWED_BY', 'CONCURRED_BY'] as string[]).map(role => {
                      const label = role === 'PREPARED_BY' ? 'Prepared By' : role === 'REVIEWED_BY' ? 'Reviewed By' : 'Concurred By';
                      const s = signoffs.find(sf => sf.role === role);
                      const signed = !!s?.signedAt;
                      return (
                        <div key={role} className="flex items-center gap-2 text-xs">
                          <span className={`material-symbols-outlined text-sm ${signed ? 'text-green-600' : 'text-gray-300'}`}>
                            {signed ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span className={signed ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                            {label}
                          </span>
                          {signed && s && (
                            <span className="text-gray-400">
                              — {s.signedBy ? `${s.signedBy.firstName} ${s.signedBy.lastName}` : 'Signed'}
                            </span>
                          )}
                          {!signed && (
                            <span className="text-gray-400 italic">(pending)</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {!allSigned && (
                    <p className="mt-2 text-xs text-red-600 font-medium">
                      ⛔ All sign-offs must be complete before submitting to Committee Review.
                    </p>
                  )}
                </div>
              )}

              {/* Close-action impact summary */}
              {showTransitionDialog === 'close' && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">This action is irreversible</p>
                  <p className="text-xs text-amber-700 mb-2">Closing this loan will:</p>
                  <ul className="space-y-1 text-xs text-amber-800">
                    <li className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                      Mark the loan lifecycle as complete
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                      Remove this facility from active exposure tracking
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                      Stop all monitoring (collateral, insurance, covenants)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                      Set the application to read-only — no further actions possible
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-sm mt-0.5">check</span>
                      Record the closure date (today)
                    </li>
                  </ul>
                  <p className="mt-2 text-xs text-amber-700">
                    Only close when the loan has been <strong>fully repaid, written off, or formally terminated</strong>.
                  </p>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Reason {t?.requiresComment ? <span className="text-red-500">* (required)</span> : <span className="text-text-tertiary">(optional)</span>}
                </label>
                <textarea rows={2} value={transitionReason} onChange={e => { setTransitionReason(e.target.value); setReasonError(false); }}
                  placeholder={t?.requiresComment
                    ? (showTransitionDialog === 'close' ? 'e.g. Fully repaid, Written off, Early settlement...' : 'A reason is required for this action...')
                    : 'Add a reason or note...'}
                  className={`w-full border rounded-lg px-3 py-2 text-sm resize-none ${t?.requiresComment && !transitionReason.trim() ? 'border-red-300' : 'border-border'}`} style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                {t?.requiresComment && reasonError && !transitionReason.trim() && (
                  <p className="text-xs text-red-600 mt-1 font-medium">Reason is required for this action</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button ref={transitionDialogCancelRef} onClick={() => { setShowTransitionDialog(null); setTransitionReason(''); setReasonError(false); transitionTriggerRef.current?.focus(); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={() => handleTransition(showTransitionDialog)} disabled={transitioning || (t?.requiresComment && !transitionReason.trim()) || (showTransitionDialog === 'submit_to_committee' && !allSigned)}
                  className={`px-4 py-2 text-sm font-bold rounded-lg text-white transition-colors disabled:opacity-50 ${
                    showTransitionDialog === 'close' ? 'bg-amber-600 hover:bg-amber-700' :
                    isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-700 hover:bg-brand-800'
                  }`}
                  title={showTransitionDialog === 'submit_to_committee' && !allSigned ? 'Complete all CA Memo sign-offs first' : undefined}
                  style={{ border: 'none', cursor: showTransitionDialog === 'submit_to_committee' && !allSigned ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {transitioning ? 'Processing...' : showTransitionDialog === 'close' ? 'Close Loan →' : label}
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
      {/* §3.1 — Readiness Checklist Modal */}
      <ReadinessChecklistModal
        open={readinessModalOpen}
        onClose={() => { setReadinessModalOpen(false); pendingTransitionRef.current = null; }}
        phaseCompletion={phaseCompletion}
        onSubmitAnyway={() => {
          const action = pendingTransitionRef.current;
          setReadinessModalOpen(false);
          pendingTransitionRef.current = null;
          if (action) {
            setShowTransitionDialog(action);
          }
        }}
        onNavigateToSection={(tabId) => {
          handleTabChange(tabId as DetailTab);
        }}
      />
      {DirtyGuardDialog}
    </>
  );
};

export default CreditApplicationDetail;