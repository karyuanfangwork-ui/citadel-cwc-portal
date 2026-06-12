import React, { useState } from 'react';
import { CreditApplication } from '../../../src/services/credit.service';
import CreditChecksTab from './CreditChecksTab';
import IndustryOutlookTab from './IndustryOutlookTab';
import RiskMitigatorsTab from './RiskMitigatorsTab';
import {
  AiDuplicateAlert,
  AiRedFlagPanel,
  AiCompliancePanel,
  AiAutoExceptionPanel,
  AiNarrativePanel,
} from '../../../src/components/credit-ai';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

type SectionId = 'bureau-checks' | 'industry-outlook' | 'risk-mitigators' | 'ai-insights';

const SECTIONS: { id: SectionId; number: number; title: string }[] = [
  { id: 'bureau-checks', number: 1, title: 'Bureau Checks' },
  { id: 'industry-outlook', number: 2, title: 'Industry Outlook' },
  { id: 'risk-mitigators', number: 3, title: 'Risk & Mitigators' },
  { id: 'ai-insights', number: 4, title: 'AI Insights' },
];

const CreditChecksRiskTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['bureau-checks']));

  const toggle = (id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {SECTIONS.map(section => {
        const isOpen = openSections.has(section.id);
        return (
          <div
            key={section.id}
            className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
          >
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isOpen}
              aria-controls={`accordion-content-${section.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0">
                  {section.number}
                </span>
                <span className="text-sm font-semibold text-gray-800">{section.title}</span>
              </div>
              <span
                className={`material-symbols-outlined text-lg text-gray-400 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>

            {/* Accordion content with smooth height transition */}
            <div
              id={`accordion-content-${section.id}`}
              className={`transition-all duration-200 ease-in-out ${
                isOpen ? 'max-h-[8000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                {section.id === 'bureau-checks' && (
                  <CreditChecksTab application={application} onUpdated={onUpdated} />
                )}
                {section.id === 'industry-outlook' && (
                  <IndustryOutlookTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
                )}
                {section.id === 'risk-mitigators' && (
                  <RiskMitigatorsTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} />
                )}
                {section.id === 'ai-insights' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
                      <span className="material-icons text-base">smart_toy</span>
                      AI proposes, humans dispose. All AI outputs are advisory — officers must exercise independent judgement.
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <AiDuplicateAlert applicationId={application.id} />
                      <AiRedFlagPanel applicationId={application.id} />
                      <AiCompliancePanel applicationId={application.id} />
                      <AiAutoExceptionPanel applicationId={application.id} />
                    </div>
                    <AiNarrativePanel applicationId={application.id} />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CreditChecksRiskTab;