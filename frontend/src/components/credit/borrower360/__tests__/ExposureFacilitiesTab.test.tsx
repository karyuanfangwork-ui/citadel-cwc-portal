import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ExposureFacilitiesTab from '../ExposureFacilitiesTab';
import type { BorrowerExposurePresentation } from '../../../../services/credit.service';

const baseData: BorrowerExposurePresentation = {
  contractVersion: 1,
  borrowerProfileId: 'borrower-1',
  baseCurrency: 'MYR',
  calculatedAt: '2026-08-21T00:00:00.000Z',
  includedStates: ['APPROVED', 'ACTIVE'],
  summary: {
    currentExposure: 125000,
    exposureLimit: 200000,
    availableHeadroom: 75000,
    utilizationPct: 62.5,
    status: 'WITHIN_LIMIT',
  },
  facilities: [{
    applicationId: 'app-1', applicationNumber: 'CA-2026-00001', applicationState: 'ACTIVE', facilityType: 'TERM_LOAN',
    originalAmount: 125000, approvedAmount: 125000, currency: 'MYR', baseCurrencyAmount: 125000, undrawnAmount: 0,
  }],
  projection: null,
  groupExposure: null,
};

const renderTab = (data = baseData) => render(<MemoryRouter><ExposureFacilitiesTab data={data} /></MemoryRouter>);

describe('ExposureFacilitiesTab', () => {
  it('renders summary status and source application link', () => {
    renderTab();
    expect(screen.getByTestId('exposure-summary')).toHaveTextContent(/RM\s*125,000/);
    expect(screen.getByText('Within limit')).toBeVisible();
    expect(screen.getByRole('link', { name: 'CA-2026-00001' })).toHaveAttribute('href', '/credit/applications/app-1');
  });

  it('renders a useful empty state without fabricating facility rows', () => {
    renderTab({ ...baseData, facilities: [], summary: { ...baseData.summary, currentExposure: 0, availableHeadroom: 200000, utilizationPct: 0, status: 'NO_EXPOSURE' } });
    expect(screen.getByTestId('exposure-empty')).toHaveTextContent('No active facilities');
    expect(screen.queryByTestId('exposure-facilities')).not.toBeInTheDocument();
  });
});
