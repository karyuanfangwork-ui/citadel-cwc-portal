import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmCustomers from '../../pages/CrmCustomers';

const mockGet = vi.fn();

vi.mock('../services/api', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('../services/crm.service', () => ({
  default: {
    deleteAccount: vi.fn(),
    deleteContact: vi.fn(),
    createAccount: vi.fn(),
    createContact: vi.fn(),
  },
}));

const customer = {
  id: 'account-1',
  name: 'Acme Berhad',
  segment: 'CORPORATE' as const,
  segmentLabel: 'Enterprise',
  contactInfo: { phone: '+60-3-1234-5678', email: 'hello@acme.test' },
  contacts: [
    { id: 'contact-primary', firstName: 'Zara', lastName: 'Primary', email: 'zara@acme.test', phone: null, mobile: null, jobTitle: 'Director', isPrimary: true, followUpDate: null },
    { id: 'contact-other', firstName: 'Adam', lastName: 'Other', email: 'adam@acme.test', phone: null, mobile: null, jobTitle: null, isPrimary: false, followUpDate: null },
  ],
  relationshipMgr: null,
  opptyCount: 2,
  pipelineValue: 250000,
  lastActivity: null,
  nextFollowUp: { label: '—', overdue: false },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('CrmCustomers', () => {
  beforeEach(() => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/crm/customers/stats') {
        return Promise.resolve({ data: { data: { total: 2, retail: 0, sme: 0, corporate: 2, active: 2, followUpRequired: 0 } } });
      }
      return Promise.resolve({
        data: { data: { customers: [customer, { ...customer, id: 'account-2', name: 'No Contacts Ltd', contacts: [] }], pagination: { page: 1, limit: 25, total: 2, totalPages: 1 } } },
      });
    });
  });

  it('renders one account row with primary, remaining, and zero-contact states', async () => {
    render(<MemoryRouter><CrmCustomers /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('Acme Berhad')).toBeInTheDocument());

    expect(screen.getByText('Zara Primary')).toBeInTheDocument();
    expect(screen.getByText('Adam Other')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('No active contacts')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Showing 1-2 of 2 clients')).toBeInTheDocument();
  });
});
