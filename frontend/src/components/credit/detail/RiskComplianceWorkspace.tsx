import React from 'react';
import { CreditApplication, CreditIntegrationsStatus } from '../../../services/credit.service';
import CreditBureauComplianceTab from '../../../../pages/credit/tabs/CreditBureauComplianceTab';
import RiskAssessmentTab from '../../../../pages/credit/tabs/RiskAssessmentTab';
import CollateralGuaranteesTab from '../../../../pages/credit/tabs/CollateralGuaranteesTab';

export interface RiskComplianceWorkspaceProps {
  application: CreditApplication;
  activeTab: string;
  integrations: CreditIntegrationsStatus | null;
  isFeatureEnabled: (flag: string) => boolean;
  onUpdated: (application: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
  onRefresh: () => void;
}

const RiskComplianceWorkspace: React.FC<RiskComplianceWorkspaceProps> = ({ application, activeTab, integrations, isFeatureEnabled, onUpdated, onDirtyChange, onRefresh }) => {
  const tab = ['bureau-kyc', 'risk-rating', 'collateral-guarantees', 'compliance'].includes(activeTab) ? activeTab : 'bureau-kyc';
  if (tab === 'risk-rating') {
    return <section aria-labelledby="risk-rating-heading"><h2 id="risk-rating-heading" className="text-lg font-bold text-slate-900 mb-4">Risk Rating</h2><RiskAssessmentTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} onRefresh={onRefresh} isFeatureEnabled={isFeatureEnabled} /></section>;
  }
  if (tab === 'collateral-guarantees') {
    return <section aria-labelledby="collateral-heading"><h2 id="collateral-heading" className="text-lg font-bold text-slate-900 mb-4">Collateral &amp; Guarantees</h2><CollateralGuaranteesTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} /></section>;
  }
  if (tab === 'compliance') {
    return <section aria-labelledby="compliance-heading"><h2 id="compliance-heading" className="text-lg font-bold text-slate-900 mb-4">Compliance / Exceptions</h2><CreditBureauComplianceTab application={application} onUpdated={onUpdated} integrations={integrations} /></section>;
  }
  return <section aria-labelledby="bureau-heading"><h2 id="bureau-heading" className="text-lg font-bold text-slate-900 mb-4">Bureau &amp; KYC</h2><CreditBureauComplianceTab application={application} onUpdated={onUpdated} integrations={integrations} /></section>;
};

export default RiskComplianceWorkspace;
