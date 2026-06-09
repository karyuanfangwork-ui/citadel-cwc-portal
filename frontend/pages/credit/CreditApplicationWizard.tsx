import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  WizardStep, WIZARD_STEPS, WIZARD_GROUPS, SECTIONS,
  getSectionsForStep, getGroupsForStep, getStepForTab, LEGACY_TAB_MAP,
} from './tabRegistry';
import type { DetailTab } from './creditUtils';
import type { CreditApplication } from '../../src/services/credit.service';

type CompletionStatus = 'complete' | 'partial' | 'empty';

const STATUS_ICON: Record<CompletionStatus, { icon: string; color: string }> = {
  complete: { icon: 'check_circle', color: 'text-green-500' },
  partial: { icon: 'pending', color: 'text-amber-500' },
  empty: { icon: 'radio_button_unchecked', color: 'text-gray-300' },
};

interface CreditApplicationWizardProps {
  app: CreditApplication;
  onRefresh: () => void;
  /** Render the active tab content — receives the tab ID and should return JSX */
  renderTab: (tabId: DetailTab) => React.ReactNode;
  /** Get completion status for a section. Returns 'empty' if unknown. */
  getCompletionStatus?: (tabId: DetailTab) => CompletionStatus;
  /** Whether the form is dirty (unsaved changes) */
  dirty?: boolean;
}

const CreditApplicationWizard: React.FC<CreditApplicationWizardProps> = ({
  app,
  onRefresh,
  renderTab,
  getCompletionStatus,
  dirty,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolve current section from URL params
  const urlStep = Number(searchParams.get('step')) as WizardStep;
  const urlSection = searchParams.get('section') as DetailTab | null;

  const [currentStep, setCurrentStep] = useState<WizardStep>(
    (urlStep >= 1 && urlStep <= 3) ? urlStep : getStepForTab(urlSection ?? 'header')
  );
  const [activeSection, setActiveSection] = useState<DetailTab>(
    SECTIONS.find(s => s.id === urlSection) ? urlSection! : 'header'
  );

  // Sync URL params — preserve mode=wizard so wizard mode survives refresh/re-render
  useEffect(() => {
    setSearchParams(prev => {
      prev.set('step', String(currentStep));
      prev.set('section', activeSection);
      return prev;
    }, { replace: true });
  }, [currentStep, activeSection, setSearchParams]);

  const stepSections = useMemo(() => getSectionsForStep(currentStep), [currentStep]);
  const stepGroups = useMemo(() => getGroupsForStep(currentStep), [currentStep]);

  const getCompletion = useCallback((sectionId: DetailTab): CompletionStatus => {
    if (getCompletionStatus) return getCompletionStatus(sectionId);
    return 'empty';
  }, [getCompletionStatus]);

  const getGroupCompletion = useCallback((sectionIds: DetailTab[]): CompletionStatus => {
    const statuses = sectionIds.map(getCompletion);
    if (statuses.every(s => s === 'complete')) return 'complete';
    if (statuses.some(s => s === 'complete' || s === 'partial')) return 'partial';
    return 'empty';
  }, [getCompletion]);

  const getStepCompletion = useCallback((step: WizardStep): CompletionStatus => {
    const sections = getSectionsForStep(step);
    const statuses = sections.map(s => getCompletion(s.id));
    if (statuses.every(s => s === 'complete')) return 'complete';
    if (statuses.some(s => s !== 'empty')) return 'partial';
    return 'empty';
  }, [getCompletion]);

  const goToSection = useCallback((section: DetailTab) => {
    setCurrentStep(getStepForTab(section));
    setActiveSection(section);
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
    const first = getSectionsForStep(step)[0];
    if (first) setActiveSection(first.id);
  }, []);

  const goNext = useCallback(() => {
    const idx = stepSections.findIndex(s => s.id === activeSection);
    if (idx < stepSections.length - 1) {
      setActiveSection(stepSections[idx + 1].id);
    } else if (currentStep < 3) {
      const next = getSectionsForStep((currentStep + 1) as WizardStep);
      if (next.length > 0) {
        setCurrentStep((currentStep + 1) as WizardStep);
        setActiveSection(next[0].id);
      }
    }
  }, [currentStep, activeSection, stepSections]);

  const goPrev = useCallback(() => {
    const idx = stepSections.findIndex(s => s.id === activeSection);
    if (idx > 0) {
      setActiveSection(stepSections[idx - 1].id);
    } else if (currentStep > 1) {
      const prev = getSectionsForStep((currentStep - 1) as WizardStep);
      if (prev.length > 0) {
        setCurrentStep((currentStep - 1) as WizardStep);
        setActiveSection(prev[prev.length - 1].id);
      }
    }
  }, [currentStep, activeSection, stepSections]);

  return (
    <div className="flex h-[calc(100vh-4rem)]" role="main" aria-label="Application wizard">
      {/* ── Left Sidebar ────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-gray-200 bg-gray-50 overflow-y-auto shrink-0">
        {/* Step nav */}
        <div className="px-3 py-4 border-b border-gray-200">
          {WIZARD_STEPS.map(ws => {
            const comp = getStepCompletion(ws.step);
            return (
              <button
                key={ws.step}
                onClick={() => goToStep(ws.step)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors mb-1 ${
                  currentStep === ws.step ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
                aria-current={currentStep === ws.step ? 'step' : undefined}
              >
                <span className={`material-symbols-outlined text-base ${STATUS_ICON[comp].color}`}>
                  {STATUS_ICON[comp].icon}
                </span>
                <span className="truncate">{ws.step}. {ws.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section groups for current step */}
        <div className="flex-1 px-3 py-3 space-y-4">
          {stepGroups.map(group => {
            const groupComp = getGroupCompletion(group.sections);
            return (
              <div key={group.id}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`material-symbols-outlined text-sm ${STATUS_ICON[groupComp].color}`}>
                    {STATUS_ICON[groupComp].icon}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
                </div>
                <div className="space-y-0.5">
                  {group.sections.map(sec => {
                    const isActive = activeSection === sec;
                    const secDef = SECTIONS.find(s => s.id === sec);
                    const comp = getCompletion(sec);
                    return (
                      <button
                        key={sec}
                        onClick={() => goToSection(sec)}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isActive ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className={`material-symbols-outlined text-[14px] ${STATUS_ICON[comp].color}`}>
                          {STATUS_ICON[comp].icon}
                        </span>
                        <span className="truncate">{secDef?.shortLabel ?? secDef?.label ?? sec}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top step progress bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {WIZARD_STEPS.map((ws, i) => (
                <React.Fragment key={ws.step}>
                  <button
                    onClick={() => goToStep(ws.step)}
                    className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                      currentStep === ws.step ? 'text-blue-600' : currentStep > ws.step ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      currentStep === ws.step ? 'bg-blue-600 text-white' :
                      currentStep > ws.step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {currentStep > ws.step ? '✓' : ws.step}
                    </span>
                    <span className="hidden sm:inline">{ws.label}</span>
                  </button>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`w-8 h-0.5 ${currentStep > ws.step ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            {/* Mobile section dropdown */}
            <div className="lg:hidden">
              <select
                value={activeSection}
                onChange={e => goToSection(e.target.value as DetailTab)}
                className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                aria-label="Jump to section"
              >
                {stepSections.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTab(activeSection)}
        </div>

        {/* Bottom bar */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentStep === 1 && activeSection === stepSections[0]?.id}
            className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
            aria-label="Previous section"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
            Previous
          </button>
          <button
            onClick={goNext}
            disabled={currentStep === 3 && activeSection === stepSections[stepSections.length - 1]?.id}
            className="flex items-center gap-1 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
            aria-label="Next section"
          >
            Next
            <span className="material-symbols-outlined text-xl">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditApplicationWizard;