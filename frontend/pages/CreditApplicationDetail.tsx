import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditFacility, ApplicationTransition, ApplicationState, dashboardApi,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import UserAssignChip from '../src/components/credit/UserAssignChip';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';
import { useDirtyFormGuard } from '../src/hooks/useDirtyFormGuard';

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
import ApprovalsTab from './credit/tabs/ApprovalsTab';
import SignoffTab from './credit/tabs/SignoffTab';
import ConditionsTab from './credit/tabs/ConditionsTab';
import SummaryTab from './credit/tabs/SummaryTab';
import DocumentsTab from './credit/tabs/DocumentsTab';
import AuditTab from './credit/tabs/AuditTab';
import PartiesTab from './credit/tabs/PartiesTab';

// ── Legacy tabs (bank-grade, behind credit:advanced_memo flag) ──
import RiskRatingEclTab from './credit/tabs/RiskRatingEclTab';
import ProfitabilityWalletTab from './credit/tabs/ProfitabilityWalletTab';
import CounterpartiesTab from './credit/tabs/CounterpartiesTab';
import AccountConductTab from './credit/tabs/AccountConductTab';
import ForwardLookingRiskTab from './credit/tabs/ForwardLookingRiskTab';
import HeaderBackgroundTab from './credit/tabs/HeaderBackgroundTab';
import FacilitiesTab from './credit/tabs/FacilitiesTab';
import RequestsFacilitiesTab from './credit/tabs/RequestsFacilitiesTab';

import {
  formatCurrency,
  STATE_COLORS,
  STATE_LABELS,
  STEPPER_STAGES,
  PRODUCT_LABELS,
  DetailTab,
  TAB_GROUPS,
  ALL_TABS,
  getPhaseCompletion,
  getIncompletePhaseCount,
  getNextIncompleteTab,
  getVisibleTabGroups,
} from './credit/creditUtils';
import CreditApplicationWizard from './credit/CreditApplicationWizard';
import { LEGACY_TAB_MAP } from './credit/tabRegistry';

const CreditApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wizardMode = searchParams.get('mode') === 'wizard';
  const isNewApplication = searchParams.get('new') === '1';
  const { user } = useAuth();

  // Dirty form guard — warns on tab change / navigation if any tab has unsaved changes
  const { isDirty, setDirty, confirmTabSwitch, DirtyGuardDialog } = useDirtyFormGuard();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('loan-request');

  // Feature flag: credit:advanced_memo — enables bank-only sections
  // TODO (Wave E): wire to FeatureFlag API. For now, default false.
  const [advancedMemo, setAdvancedMemo] = useState(false);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(isNewApplication);

  // Feature flag: credit:advanced_memo — gate Advanced Memo toggle behind API
  const [advancedMemoFlag, setAdvancedMemoFlag] = useState(false);

  useEffect(() => {
    creditService.listFeatureFlags()
      .then(flags => {
        const flag = flags.find(f => f.key === 'credit:advanced_memo');
        if (flag?.enabled) setAdvancedMemoFlag(true);
      })
      .catch(() => { /* non-admin — stays false */ });
  }, []);

  const visibleTabGroups = getVisibleTabGroups(advancedMemo, app?.borrowerProfile?.borrowerType);
  const visibleTabs = visibleTabGroups.flatMap(g => g.tabs.map(t => t.id));

  // Guarded tab switch — prompts if there are unsaved changes
  const handleTabChange = useCallback((tab: DetailTab) => {
    if (isDirty && !confirmTabSwitch()) return;
    setActiveTab(tab);
  }, [isDirty, confirmTabSwitch]);
  const [transitions, setTransitions] = useState<ApplicationTransition[]>([]);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [readiness, setReadiness] = useState<{
    ready: boolean;
    errors: { field: string; message: string; severity: string }[];
    warnings: { field: string; message: string; severity: string }[];
    satisfied: { field: string; message: string; severity: string }[];
  } | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionReason, setTransitionReason] = useState('');
  const [showTransitionDialog, setShowTransitionDialog] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const transitionDialogCancelRef = useRef<HTMLButtonElement>(null);
  const transitionTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [showMobileNav, setShowMobileNav] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canApprove = hasPermission(user, 'credit:approve');

  const fetchApp = useCallback(async () => {
    if (!id) return;
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
    if (!id) return;
    try {
      const data = await creditService.getApplicationTransitions(id);
      setTransitions(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load available actions')); }
  }, [id]);

  const fetchFacilities = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.listFacilities(id);
      setFacilities(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load facilities')); }
  }, [id]);

  useEffect(() => { fetchApp(); }, [fetchApp]);
  useEffect(() => { if (id) fetchTransitions(); }, [fetchTransitions]);
  useEffect(() => { if (id) fetchFacilities(); }, [fetchFacilities]); // Load facilities on mount for section completion

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

  // Auto-focus cancel button when dialog opens
  useEffect(() => {
    if (showTransitionDialog && transitionDialogCancelRef.current) {
      transitionDialogCancelRef.current.focus();
    }
  }, [showTransitionDialog]);

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
    financialStatements: (app as any).financialStatements ?? [],
    creditBureauChecks: (app as any).creditBureauChecks ?? [],
    retailIncome: (app as any).retailIncome ?? null,
    bureauChecklist: (app as any).bureauChecklist ?? null,
    isSecured: false,
  });
  const incompleteCount = getIncompletePhaseCount(phaseCompletion);

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
      case 'borrower-profile': return <BorrowerProfileTab application={app!} />;
      case 'parties': return <PartiesTab app={app!} borrowerType={app?.borrowerProfile?.borrowerType} />;

      // S3 — Financials
      case 'financials': return <FinancialsTab application={app!} />;

      // S4 — Risk Score
      case 'risk-score': return <RiskScoreTab application={app!} onUpdated={setApp} />;
      case 'payment-capability': return <PaymentCapabilityTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;

      // S5 — Bureau & Compliance
      case 'credit-checks': return <CreditChecksTab application={app!} onUpdated={setApp} />;
      case 'industry': return <IndustryOutlookTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;
      case 'risk': return <RiskMitigatorsTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;

      // S6 — Collateral & Guarantees
      case 'collateral': return <CollateralTab />;
      case 'security': return <SecurityGuaranteesTab application={app!} onUpdated={setApp} />;

      // S7 — Decision
      case 'approvals': return <ApprovalsTab app={app!} onRefresh={fetchApp} />;
      case 'signoff': return <SignoffTab application={app!} onUpdated={setApp} />;
      case 'conditions': return <ConditionsTab />;
      case 'summary': return <SummaryTab app={app!} facilities={facilities} transitions={transitions} canWrite={canWrite} canApprove={canApprove} onTransition={handleTransition} onRefresh={fetchApp} />;

      // META — Operations
      case 'documents': return <DocumentsTab app={app!} canApprove={canApprove} />;
      case 'audit': return <AuditTab />;

      // Bank-only tabs (rendered when credit:advanced_memo is enabled)
      case 'risk-rating': return <RiskRatingEclTab application={app!} onDirtyChange={setDirty} />;
      case 'profitability': return <ProfitabilityWalletTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;
      case 'counterparties': return <CounterpartiesTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;
      case 'conduct': return <AccountConductTab application={app!} onUpdated={setApp} />;
      case 'forward-looking-risk': return <ForwardLookingRiskTab application={app!} onUpdated={setApp} onDirtyChange={setDirty} />;
      case 'header': return <HeaderBackgroundTab application={app!} onUpdated={(updated) => setApp(updated)} onDirtyChange={setDirty} />;
      case 'facilities': return <RequestsFacilitiesTab application={app!} onDirtyChange={setDirty} />;

      default: return null;
    }
  };

  // §3.6 — Wizard mode: uses CreditApplicationWizard shell instead of classic tab layout
  if (wizardMode) {
    return (
      <>
        <CreditNav />
        <div className="flex items-center justify-between px-4 sm:px-8 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/credit" className="hover:text-blue-600">Credit</Link>
            <span>/</span>
            <Link to="/credit/applications" className="hover:text-blue-600">Applications</Link>
            <span>/</span>
            <span className="font-semibold text-gray-900">{app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : app.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Advanced Memo toggle */}
            {advancedMemoFlag && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={advancedMemo} onChange={e => setAdvancedMemo(e.target.checked)} className="rounded border-gray-300" />
              Advanced Memo
            </label>
            )}
            <Link
              to={`/credit/applications/${id}`}
              className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
              title="Switch to classic view"
            >
              <span className="material-symbols-outlined text-lg">view_agenda</span>
              Classic View
            </Link>
          </div>
        </div>
        <CreditApplicationWizard
          app={app!}
          onRefresh={fetchApp}
          renderTab={renderTab}
        />
      </>
    );
  }

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
            <span className="font-semibold text-text-primary">{app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : app.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Advanced Memo toggle */}
            {advancedMemoFlag && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none" title="Show bank-grade ECL, ESG, SICR, Committee sections">
              <input type="checkbox" checked={advancedMemo} onChange={e => setAdvancedMemo(e.target.checked)} className="rounded border-gray-300" />
              Advanced Memo
            </label>
            )}
            {/* §3.6 — Wizard mode toggle */}
            <Link
              to={`/credit/applications/${id}?mode=wizard`}
              className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
              title="Switch to wizard view"
            >
              <span className="material-symbols-outlined text-lg">view_sidebar</span>
              Wizard View
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
              <span className="material-symbols-outlined text-2xl">description</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-text-primary">
                {app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : 'Application'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                  {currentState.replace(/_/g, ' ')}
                </span>
                {['SUBMITTED','KYC_REVIEW','UNDERWRITING','CREDIT_ASSESSMENT','COMMITTEE_REVIEW'].includes(currentState) && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                    Pending approval
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
          <div className="flex gap-2">
            {app.borrowerProfile && (
              <Link to={`/credit/borrowers/${app.borrowerProfileId}`}
                className="flex items-center gap-1 text-sm text-brand-700 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
                style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-base">person</span> View Borrower
              </Link>
            )}
          </div>
        </div>

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

        {/* Key Info Chips */}
        <div className="flex flex-wrap gap-3 mb-6">
          {[
            { label: 'Amount', value: formatCurrency(app.requestedAmount, app.currency), icon: 'payments' },
            { label: 'Approved', value: facilities.length > 0 && facilities.some(f => f.approvedAmount != null) ? formatCurrency(Number(facilities.reduce((s, f) => s + Number(f.approvedAmount || 0), 0)), app.currency) : '—', icon: 'check_circle' },
            { label: 'Tenor', value: app.requestedTenor != null ? `${app.requestedTenor} mo` : '—', icon: 'schedule' },
            { label: 'Currency', value: app.currency, icon: 'currency_exchange' },
            { label: 'Risk', value: app.riskRating || '—', icon: 'speed' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
              <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
              <span className="font-bold text-text-primary">{s.value}</span>
              <span className="text-text-secondary">{s.label}</span>
            </div>
          ))}
          <UserAssignChip
            label="RM"
            value={app.rm ?? null}
            applicationId={app.id}
            field="assignedRmId"
            roleFilters={['CREDIT_RM', 'CREDIT_MANAGER', 'ADMIN']}
            disabled={app.state !== 'DRAFT'}
            onUpdated={setApp}
          />
          <UserAssignChip
            label="Analyst"
            value={app.analyst ?? null}
            applicationId={app.id}
            field="assignedAnalystId"
            roleFilters={['CREDIT_ANALYST', 'CREDIT_MANAGER', 'ADMIN']}
            disabled={app.state !== 'DRAFT'}
            onUpdated={setApp}
          />
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
            <div className="flex flex-wrap gap-2">
              {transitions.map(t => {
                const isReject = t.toState === 'REJECTED' || t.toState === 'KYC_REJECTED' || t.toState === 'WITHDRAWN';
                const isApprove = t.toState === 'APPROVED' || t.toState === 'KYC_APPROVED' || t.toState === 'ACCEPTED';
                return (
                  <button key={t.action} ref={el => { if (t.action === showTransitionDialog) transitionTriggerRef.current = el; }} onClick={() => setShowTransitionDialog(t.action)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      isReject ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' :
                      isApprove ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' :
                      'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                    }`} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <span className="material-symbols-outlined text-base">{
                      isReject ? 'block' : isApprove ? 'check_circle' : 'arrow_forward'
                    }</span>
                    {t.label || t.action.replace(/_/g, ' ')}
                    <span className="text-xs opacity-70 ml-1">→ {STATE_LABELS[t.toState] || t.toState}</span>
                  </button>
                );
              })}
            </div>
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
            <RiskScoreTab application={app} onUpdated={setApp} />
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

        {/* S7 — Approvals */}
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
            <SummaryTab app={app} facilities={facilities} transitions={transitions} canWrite={canWrite} canApprove={canApprove} onTransition={handleTransition} onRefresh={fetchApp} />
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
          const nextTab = getNextIncompleteTab(phaseCompletion);
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
              <h2 id="transition-dialog-title" className="text-lg font-black text-text-primary mb-2">Confirm Action</h2>
              <p className="text-sm text-text-secondary mb-4">
                Are you sure you want to <span className="font-bold text-text-primary">{label}</span>?
                {t && <span className="block mt-1 text-xs text-text-secondary">This will change the application status to <span className="font-semibold">{STATE_LABELS[t.toState] || t.toState}</span>.</span>}
              </p>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Reason {t?.requiresComment ? <span className="text-red-500">* (required)</span> : <span className="text-text-tertiary">(optional)</span>}
                </label>
                <textarea rows={2} value={transitionReason} onChange={e => { setTransitionReason(e.target.value); setReasonError(false); }}
                  placeholder={t?.requiresComment ? 'A reason is required for this action...' : 'Add a reason or note...'}
                  className={`w-full border rounded-lg px-3 py-2 text-sm resize-none ${t?.requiresComment && !transitionReason.trim() ? 'border-red-300' : 'border-border'}`} style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
                {t?.requiresComment && reasonError && !transitionReason.trim() && (
                  <p className="text-xs text-red-600 mt-1 font-medium">Reason is required for this action</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button ref={transitionDialogCancelRef} onClick={() => { setShowTransitionDialog(null); setTransitionReason(''); setReasonError(false); transitionTriggerRef.current?.focus(); }}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button onClick={() => handleTransition(showTransitionDialog)} disabled={transitioning || (t?.requiresComment && !transitionReason.trim())}
                  className={`px-4 py-2 text-sm font-bold rounded-lg text-white transition-colors disabled:opacity-50 ${
                    isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-700 hover:bg-brand-800'
                  }`}
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {transitioning ? 'Processing...' : label}
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </div>
      {DirtyGuardDialog}
    </>
  );
};

export default CreditApplicationDetail;