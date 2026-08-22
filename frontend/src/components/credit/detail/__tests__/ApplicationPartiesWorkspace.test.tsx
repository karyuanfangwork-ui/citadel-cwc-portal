import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ApplicationPartiesWorkspace from '../ApplicationPartiesWorkspace';
import { CreditApplication } from '../../../../services/credit.service';

vi.mock('../../../../../pages/credit/tabs/ApplicationDetailsTab', () => ({ default: () => <div>Application editor</div> }));
vi.mock('../../../../../pages/credit/tabs/sections/PartiesTab', () => ({ default: () => <div>Related parties editor</div> }));
vi.mock('../../BorrowerSummaryCard', () => ({ getBorrowerDisplayName: () => 'Acme Borrower' }));

const app = { id: 'app-1', state: 'DRAFT', borrowerProfile: { id: 'borrower-1', borrowerType: 'CORPORATE' } } as CreditApplication;
const renderWorkspace = (activeTab: string) => render(<MemoryRouter><ApplicationPartiesWorkspace application={app} activeTab={activeTab} onUpdated={vi.fn()} onDirtyChange={vi.fn()} /></MemoryRouter>);

describe('ApplicationPartiesWorkspace', () => {
  it('renders Application without internal phase labels', () => { renderWorkspace('application'); expect(screen.getByText('Application')).toBeInTheDocument(); expect(screen.getByText('Application editor')).toBeInTheDocument(); expect(screen.queryByText(/S[1-7]/)).not.toBeInTheDocument(); });
  it('renders Facilities through the existing application editor', () => { renderWorkspace('facilities'); expect(screen.getByText('Facilities')).toBeInTheDocument(); expect(screen.getByText('Application editor')).toBeInTheDocument(); });
  it('renders borrower context with Borrower 360 link', () => { renderWorkspace('borrower'); expect(screen.getByText('Acme Borrower')).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'View Borrower 360' })).toHaveAttribute('href', '/credit/borrowers/borrower-1'); });
  it('renders related parties only for applicable borrower types', () => { renderWorkspace('related-parties'); expect(screen.getByText('Related parties editor')).toBeInTheDocument(); });
  it('falls back to Application for an unknown local tab', () => { renderWorkspace('unknown'); expect(screen.getByText('Application editor')).toBeInTheDocument(); });
});
