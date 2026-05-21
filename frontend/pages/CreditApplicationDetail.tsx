import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import creditService, {
  CreditApplication, CreditFacility, ApplicationTransition, ApplicationState, dashboardApi,
} from '../src/services/credit.service';
import CreditNav from '../src/components/CreditNav';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';
import HeaderBackgroundTab from './credit/tabs/HeaderBackgroundTab';
import FacilitiesTab from './credit/tabs/FacilitiesTab';
import RiskRatingEclTab from './credit/tabs/RiskRatingEclTab';
import PaymentCapabilityTab from './credit/tabs/PaymentCapabilityTab';
import SecurityGuaranteesTab from './credit/tabs/SecurityGuaranteesTab';
import ProfitabilityWalletTab from './credit/tabs/ProfitabilityWalletTab';
import CounterpartiesTab from './credit/tabs/CounterpartiesTab';
import AccountConductTab from './credit/tabs/AccountConductTab';
import CreditChecksTab from './credit/tabs/CreditChecksTab';
import IndustryOutlookTab from './credit/tabs/IndustryOutlookTab';
import RiskMitigatorsTab from './credit/tabs/RiskMitigatorsTab';
import EsgTab from './credit/tabs/EsgTab';
import SicrTab from './credit/tabs/SicrTab';
import SignoffTab from './credit/tabs/SignoffTab';
import SummaryTab from './credit/tabs/SummaryTab';
import PartiesTab from './credit/tabs/PartiesTab';
import DocumentsTab from './credit/tabs/DocumentsTab';
import ApprovalsTab from './credit/tabs/ApprovalsTab';
import CollateralTab from './credit/tabs/CollateralTab';
import ConditionsTab from './credit/tabs/ConditionsTab';
import AuditTab from './credit/tabs/AuditTab';

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
} from './credit/creditUtils';

const CreditApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [app, setApp] = useState<CreditApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('header');
  const [transitions, setTransitions] = useState<ApplicationTransition[]>([]);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
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
  useEffect(() => { if (activeTab === 'facilities') fetchFacilities(); }, [activeTab, fetchFacilities]);

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
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to transition application')); }
    finally { setTransitioning(false); }
  };

  const handleDownloadCaMemo = async () => {
    if (!app) return;
    try {
      const response = await creditService.downloadCaMemo(app.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `CA-Memo-${app.applicationNo || app.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CA Memo downloaded');
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to download CA Memo'));
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, tab: DetailTab) => {
    const idx = ALL_TABS.indexOf(tab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = ALL_TABS[(idx + 1) % ALL_TABS.length];
      setActiveTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = ALL_TABS[(idx - 1 + ALL_TABS.length) % ALL_TABS.length];
      setActiveTab(prev);
      document.getElementById(`tab-${prev}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(ALL_TABS[0]);
      document.getElementById(`tab-${ALL_TABS[0]}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(ALL_TABS[ALL_TABS.length - 1]);
      document.getElementById(`tab-${ALL_TABS[ALL_TABS.length - 1]}`)?.focus();
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
    applicationType: app.applicationType,
    accountClassification: app.accountClassification,
    preambleText: app.preambleText,
    riskRating: app.riskRating,
    firstWayOut: app.firstWayOut,
    purpose: app.purpose,
    preparedAt: app.preparedAt,
    facilities: facilities,
    parties: app.parties,
  });
  const incompleteCount = getIncompletePhaseCount(phaseCompletion);

  // Stepper logic
  const currentStageIdx = STEPPER_STAGES.findIndex(s => s.states.includes(currentState));
  const isPastStage = (idx: number) => idx < currentStageIdx;
  const isCurrentStage = (idx: number) => idx === currentStageIdx;

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <Link to="/credit/applications" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Applications</Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">{app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : 'Unnamed Borrower')) : app.id.slice(0, 8)}</span>
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
                    {incompleteCount} phase{incompleteCount !== 1 ? 's' : ''} incomplete
                  </span>
                )}
                {incompleteCount === 0 && (
                  <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    All phases complete
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
            { label: 'RM', value: app.rm ? `${app.rm.firstName} ${app.rm.lastName}` : '—', icon: 'person' },
            { label: 'Analyst', value: app.analyst ? `${app.analyst.firstName} ${app.analyst.lastName}` : '—', icon: 'analytics' },
            { label: 'Risk', value: app.riskRating || '—', icon: 'speed' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm">
              <span className="material-symbols-outlined text-base text-brand-700">{s.icon}</span>
              <span className="font-bold text-text-primary">{s.value}</span>
              <span className="text-text-secondary">{s.label}</span>
            </div>
          ))}
        </div>

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
          const activeGroup = TAB_GROUPS.find(g => g.tabs.some(t => t.id === activeTab));
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
                  {TAB_GROUPS.map((group) => {
                    const gStatus = phaseCompletion[group.id];
                    return (
                      <div key={group.id}>
                        <div className="relative px-4 py-2 bg-gray-50 text-[10px] font-black text-text-secondary uppercase tracking-wide border-b border-border">
                          <span className="leading-snug pr-5">{group.label}</span>
                          <span className={`material-symbols-outlined text-[14px] absolute right-3 top-1/2 -translate-y-1/2 ${gStatus === 'complete' ? 'text-green-500' : gStatus === 'optional' ? 'text-gray-400' : 'text-amber-500'}`}>
                            {gStatus === 'complete' ? 'check_circle' : gStatus === 'optional' ? 'radio_button_unchecked' : 'error'}
                          </span>
                        </div>
                        {group.tabs.map((tab) => {
                          const isActive = activeTab === tab.id;
                          return (
                            <button key={tab.id}
                              onClick={() => { setActiveTab(tab.id); setShowMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
          <div className="hidden md:flex md:w-64 shrink-0 flex-col gap-3 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden pr-1 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
            {TAB_GROUPS.map((group) => {
              const groupStatus = phaseCompletion[group.id];
              const isGroupComplete = groupStatus === 'complete';
              const isOptional = groupStatus === 'optional';
              return (
                <div key={group.id} className="bg-bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="relative px-4 py-2.5 bg-gray-50/80 border-b border-border text-[10px] font-black text-text-secondary uppercase tracking-wide">
                    <span className="leading-snug pr-6">{group.label}</span>
                    <span className={`material-symbols-outlined text-[16px] absolute right-3 top-1/2 -translate-y-1/2 ${isGroupComplete ? 'text-green-500' : isOptional ? 'text-gray-400' : 'text-amber-500'}`}>
                      {isGroupComplete ? 'check_circle' : isOptional ? 'radio_button_unchecked' : 'error'}
                    </span>
                  </div>
                  <div className="flex flex-col py-1" role="tablist" aria-label={group.label}>
                    {group.tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                          role="tab"
                          aria-selected={isActive}
                          aria-controls={`panel-${tab.id}`}
                          id={`tab-${tab.id}`}
                          tabIndex={isActive ? 0 : -1}
                          onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
                          className={`text-left px-4 py-2 text-sm font-semibold transition-all flex items-center justify-between group ${
                            isActive ? 'bg-brand-50 text-brand-700 border-l-4 border-brand-700' : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary border-l-4 border-transparent'
                          }`}
                          style={{ cursor: 'pointer', outline: 'none', background: isActive ? 'var(--brand-50)' : 'transparent', borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}>
                          {tab.label}
                          {isActive && <span className="material-symbols-outlined text-[18px]">chevron_right</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0 bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 flex-1">

        {/* Header Tab (CA Memo Phase 1) */}
        {activeTab === 'header' && (
          <div role="tabpanel" id="panel-header" aria-labelledby="tab-header" tabIndex={0}>
            <HeaderBackgroundTab
              application={app}
              onUpdated={(updated) => setApp(updated)}
            />
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" tabIndex={0}>
            <SummaryTab
              app={app}
              facilities={facilities}
              transitions={transitions}
              canWrite={canWrite}
              canApprove={canApprove}
              onTransition={handleTransition}
              onRefresh={fetchApp}
            />
          </div>
        )}

        {/* Facilities Tab — CA Memo Phase 2 */}
        {activeTab === 'facilities' && (
          <div role="tabpanel" id="panel-facilities" aria-labelledby="tab-facilities" tabIndex={0}>
            <FacilitiesTab application={app} />
          </div>
        )}

        {/* Risk Rating & ECL Tab — CA Memo Phase 3 */}
        {activeTab === 'risk-rating' && (
          <div role="tabpanel" id="panel-risk-rating" aria-labelledby="tab-risk-rating" tabIndex={0}>
            <RiskRatingEclTab application={app} />
          </div>
        )}

        {/* Payment Capability Tab — CA Memo Phase 3 */}
        {activeTab === 'payment-capability' && (
          <div role="tabpanel" id="panel-payment-capability" aria-labelledby="tab-payment-capability" tabIndex={0}>
            <PaymentCapabilityTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Security & Guarantees Tab — CA Memo Phase 4 */}
        {activeTab === 'security' && (
          <div role="tabpanel" id="panel-security" aria-labelledby="tab-security" tabIndex={0}>
            <SecurityGuaranteesTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Profitability & Wallet Share Tab — CA Memo Phase 4 */}
        {activeTab === 'profitability' && (
          <div role="tabpanel" id="panel-profitability" aria-labelledby="tab-profitability" tabIndex={0}>
            <ProfitabilityWalletTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Counterparties Tab — CA Memo Phase 4 */}
        {activeTab === 'counterparties' && (
          <div role="tabpanel" id="panel-counterparties" aria-labelledby="tab-counterparties" tabIndex={0}>
            <CounterpartiesTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Account Conduct Tab — CA Memo Phase 4 */}
        {activeTab === 'conduct' && (
          <div role="tabpanel" id="panel-conduct" aria-labelledby="tab-conduct" tabIndex={0}>
            <AccountConductTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Credit Bureau Checks Tab — CA Memo Phase 5 */}
        {activeTab === 'credit-checks' && (
          <div role="tabpanel" id="panel-credit-checks" aria-labelledby="tab-credit-checks" tabIndex={0}>
            <CreditChecksTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Industry Outlook Tab — CA Memo Phase 5 */}
        {activeTab === 'industry' && (
          <div role="tabpanel" id="panel-industry" aria-labelledby="tab-industry" tabIndex={0}>
            <IndustryOutlookTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Risk & Mitigators Tab — CA Memo Phase 5 */}
        {activeTab === 'risk' && (
          <div role="tabpanel" id="panel-risk" aria-labelledby="tab-risk" tabIndex={0}>
            <RiskMitigatorsTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* ESG Tab — CA Memo Phase 5 */}
        {activeTab === 'esg' && (
          <div role="tabpanel" id="panel-esg" aria-labelledby="tab-esg" tabIndex={0}>
            <EsgTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* SICR Tab — CA Memo Phase 5 */}
        {activeTab === 'sicr' && (
          <div role="tabpanel" id="panel-sicr" aria-labelledby="tab-sicr" tabIndex={0}>
            <SicrTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Sign-off Tab — CA Memo Phase 5 */}
        {activeTab === 'signoff' && (
          <div role="tabpanel" id="panel-signoff" aria-labelledby="tab-signoff" tabIndex={0}>
            <SignoffTab application={app} onUpdated={setApp} />
          </div>
        )}

        {/* Parties Tab */}
        {activeTab === 'parties' && (
          <div role="tabpanel" id="panel-parties" aria-labelledby="tab-parties" tabIndex={0}>
            <PartiesTab app={app} />
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents" tabIndex={0}>
            <DocumentsTab app={app} />
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div role="tabpanel" id="panel-approvals" aria-labelledby="tab-approvals" tabIndex={0}>
            <ApprovalsTab app={app} onRefresh={fetchApp} />
          </div>
        )}

        {/* Collateral Tab */}
        {activeTab === 'collateral' && (
          <div role="tabpanel" id="panel-collateral" aria-labelledby="tab-collateral" tabIndex={0}>
            <CollateralTab />
          </div>
        )}

        {/* Conditions Tab */}
        {activeTab === 'conditions' && (
          <div role="tabpanel" id="panel-conditions" aria-labelledby="tab-conditions" tabIndex={0}>
            <ConditionsTab />
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" tabIndex={0}>
            <AuditTab />
          </div>
        )}
            </div>
          </div>
        </div>

        {/* Floating Action Button — jump to next incomplete phase */}
        {(() => {
          const nextTab = getNextIncompleteTab(phaseCompletion);
          if (!nextTab || nextTab === activeTab) return null;
          const nextGroup = TAB_GROUPS.find(g => g.tabs.some(t => t.id === nextTab));
          return (
            <div className="fixed bottom-8 right-8 z-50">
              <button
                onClick={() => {
                  setActiveTab(nextTab);
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
    </>
  );
};

export default CreditApplicationDetail;