import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RiskComplianceWorkspace from '../RiskComplianceWorkspace';
import { CreditApplication } from '../../../../services/credit.service';

vi.mock('../../../../../pages/credit/tabs/CreditBureauComplianceTab', () => ({ default: () => <div>Bureau and KYC evidence</div> }));
vi.mock('../../../../../pages/credit/tabs/RiskAssessmentTab', () => ({ default: () => <div>Risk score and rating evidence</div> }));
vi.mock('../../../../../pages/credit/tabs/CollateralGuaranteesTab', () => ({ default: () => <div>Collateral and guarantees evidence</div> }));

const app = { id: 'app-1', state: 'DRAFT', borrowerProfile: { id: 'borrower-1', borrowerType: 'CORPORATE' } } as CreditApplication;
const renderWorkspace = (activeTab: string) => render(<RiskComplianceWorkspace application={app} activeTab={activeTab} integrations={null} isFeatureEnabled={() => true} onUpdated={vi.fn()} onDirtyChange={vi.fn()} onRefresh={vi.fn()} />);

describe('RiskComplianceWorkspace', () => {
  it.each([
    ['bureau-kyc', 'Bureau & KYC', 'Bureau and KYC evidence'],
    ['risk-rating', 'Risk Rating', 'Risk score and rating evidence'],
    ['collateral-guarantees', 'Collateral & Guarantees', 'Collateral and guarantees evidence'],
    ['compliance', 'Compliance / Exceptions', 'Bureau and KYC evidence'],
  ])('maps %s to its evidence surface', (tab, heading, content) => { renderWorkspace(tab); expect(screen.getByText(heading)).toBeInTheDocument(); expect(screen.getByText(content)).toBeInTheDocument(); });
  it('falls back to Bureau & KYC for an unknown local tab', () => { renderWorkspace('unknown'); expect(screen.getByText('Bureau & KYC')).toBeInTheDocument(); });
});
