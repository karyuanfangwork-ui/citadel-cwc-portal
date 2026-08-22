import React from 'react';
import { CreditApplication } from '../../../services/credit.service';
import FinancialsTab from '../../../../pages/credit/tabs/FinancialsTab';
import SmeFinancialsTab from '../../../../pages/credit/tabs/sections/SmeFinancialsTab';
import PaymentCapabilityTab from '../../../../pages/credit/tabs/sections/PaymentCapabilityTab';
import RetailIncomeTab from '../../../../pages/credit/tabs/sections/RetailIncomeTab';

export interface FinancialsWorkspaceProps {
  application: CreditApplication;
  activeTab: string;
  lane?: string | null;
  onUpdated: (application: CreditApplication) => void;
  onDirtyChange: (dirty: boolean) => void;
}

const FinancialsWorkspace: React.FC<FinancialsWorkspaceProps> = ({ application, activeTab, lane, onUpdated, onDirtyChange }) => {
  const borrowerType = application.borrowerProfile?.borrowerType;
  const isRetail = borrowerType === 'INDIVIDUAL' || borrowerType === 'JOINT' || lane === 'PERSONAL_FAST';
  const isSme = borrowerType === 'SOLE_PROPRIETOR' || lane === 'SME';
  const tab = ['income', 'statements', 'spreading', 'ratios-trends', 'repayment-capacity'].includes(activeTab)
    ? activeTab
    : isRetail ? 'income' : 'statements';

  if (tab === 'income' && isRetail) {
    return <section aria-labelledby="financials-income-heading"><h2 id="financials-income-heading" className="text-lg font-bold text-slate-900 mb-4">Income</h2><RetailIncomeTab applicationId={application.id} readOnly={application.state !== 'DRAFT'} /></section>;
  }
  if (tab === 'spreading' || tab === 'ratios-trends') {
    if (!isSme && borrowerType !== 'CORPORATE') return <section><h2 className="text-lg font-bold text-slate-900 mb-4">{tab === 'spreading' ? 'Spreading' : 'Ratios & Trends'}</h2><p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Not applicable for this borrower type.</p></section>;
    return <section><h2 className="text-lg font-bold text-slate-900 mb-4">{tab === 'spreading' ? 'Spreading' : 'Ratios & Trends'}</h2><SmeFinancialsTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} /></section>;
  }
  if (tab === 'repayment-capacity') {
    return <section aria-labelledby="financials-repayment-heading"><h2 id="financials-repayment-heading" className="text-lg font-bold text-slate-900 mb-4">Repayment Capacity</h2><PaymentCapabilityTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} /></section>;
  }
  if (isRetail) {
    return <section><h2 className="text-lg font-bold text-slate-900 mb-4">Income</h2><RetailIncomeTab applicationId={application.id} readOnly={application.state !== 'DRAFT'} /></section>;
  }
  return <section aria-labelledby="financials-statements-heading"><h2 id="financials-statements-heading" className="text-lg font-bold text-slate-900 mb-4">Statements</h2><FinancialsTab application={application} onUpdated={onUpdated} onDirtyChange={onDirtyChange} readOnly={application.state !== 'DRAFT'} /></section>;
};

export default FinancialsWorkspace;
