import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FinancialsWorkspace from '../FinancialsWorkspace';
import { CreditApplication } from '../../../../services/credit.service';

vi.mock('../../../../../pages/credit/tabs/FinancialsTab', () => ({ default: ({ readOnly }: { readOnly?: boolean }) => <div>Statements editor{readOnly ? ' (read-only)' : ''}</div> }));
vi.mock('../../../../../pages/credit/tabs/sections/SmeFinancialsTab', () => ({ default: () => <div>SME ratios editor</div> }));
vi.mock('../../../../../pages/credit/tabs/sections/PaymentCapabilityTab', () => ({ default: () => <div>Repayment editor</div> }));
vi.mock('../../../../../pages/credit/tabs/sections/RetailIncomeTab', () => ({ default: () => <div>Retail income editor</div> }));

const makeApp = (borrowerType: string, state = 'DRAFT') => ({ id: 'app-1', state, borrowerProfile: { id: 'borrower-1', borrowerType } } as CreditApplication);
const renderWorkspace = (application: CreditApplication, activeTab: string, lane?: string) => render(<FinancialsWorkspace application={application} activeTab={activeTab} lane={lane} onUpdated={vi.fn()} onDirtyChange={vi.fn()} />);

describe('FinancialsWorkspace', () => {
  it('uses Retail Income for an individual retail lane', () => { renderWorkspace(makeApp('INDIVIDUAL'), 'income', 'PERSONAL_FAST'); expect(screen.getByText('Income')).toBeInTheDocument(); expect(screen.getByText('Retail income editor')).toBeInTheDocument(); });
  it('uses statements and ratios surfaces for SME', () => { renderWorkspace(makeApp('SOLE_PROPRIETOR'), 'statements', 'SME'); expect(screen.getByText('Statements editor')).toBeInTheDocument(); renderWorkspace(makeApp('SOLE_PROPRIETOR'), 'ratios-trends', 'SME'); expect(screen.getByText('Ratios & Trends')).toBeInTheDocument(); expect(screen.getByText('SME ratios editor')).toBeInTheDocument(); });
  it('uses the corporate-capable statements surface without retail income editing', () => { renderWorkspace(makeApp('CORPORATE'), 'statements', 'CORPORATE'); expect(screen.getByText('Statements editor')).toBeInTheDocument(); expect(screen.queryByText('Retail income editor')).not.toBeInTheDocument(); });
  it('passes read-only state to the statements editor after DRAFT', () => { renderWorkspace(makeApp('CORPORATE', 'APPROVED'), 'statements', 'CORPORATE'); expect(screen.getByText('Statements editor (read-only)')).toBeInTheDocument(); });
  it('keeps repayment capacity in the authoritative payment editor', () => { renderWorkspace(makeApp('CORPORATE'), 'repayment-capacity', 'CORPORATE'); expect(screen.getByText('Repayment editor')).toBeInTheDocument(); expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); });
});
