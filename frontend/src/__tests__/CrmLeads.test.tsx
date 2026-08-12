import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmLeads from '../../pages/CrmLeads';

const mockListLeads = vi.fn();
const mockListCrmUsers = vi.fn();
const mockRequestExport = vi.fn();
const mockDownloadExport = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    listLeads: (...args: unknown[]) => mockListLeads(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    updateLead: vi.fn(),
    deleteLead: vi.fn(),
    createLead: vi.fn(),
    requestExport: (...args: unknown[]) => mockRequestExport(...args),
    downloadExport: (...args: unknown[]) => mockDownloadExport(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@test.local',
      permissions: ['crm:read', 'crm:write', 'crm:delete', 'crm:admin'],
    },
  }),
}));

vi.mock('../hooks/useCrmUpdate', () => ({
  useCrmUpdate: vi.fn(),
}));

vi.mock('../components/crm/LeadsTable', () => ({
  default: () => <div data-testid="leads-table">Leads Table</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/crm/leads']}>
      <CrmLeads />
    </MemoryRouter>
  );

describe('CrmLeads', () => {
  beforeEach(() => {
    mockListCrmUsers.mockResolvedValue([]);
    mockRequestExport.mockResolvedValue({ jobId: 'export-1' });
    mockDownloadExport.mockResolvedValue(undefined);
    mockListLeads.mockResolvedValue({
      leads: [
        {
          id: 'lead-1',
          title: 'ACME Expansion',
          status: 'NEW',
          source: 'REFERRAL',
          createdAt: '2026-06-14T00:00:00.000Z',
          updatedAt: '2026-06-14T00:00:00.000Z',
          followUpDate: null,
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('renders the list-page header grammar with page-owned create action', async () => {
    renderPage();

    await waitFor(() => {
      // Page heading is "My Leads"
      expect(screen.getByRole('heading', { name: /my leads/i })).toBeInTheDocument();
    });

    expect(screen.getByText('CRM')).toBeInTheDocument();
    // Create action is labeled "New Lead" on this page
    expect(screen.getByRole('button', { name: /new lead/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search lead name, company or id/i)).toBeInTheDocument();
    expect(screen.getByTestId('leads-table')).toBeInTheDocument();
  });

  it('uses the filtered total for the My Leads metric instead of the current page length', async () => {
    mockListLeads.mockResolvedValueOnce({
      leads: [
        {
          id: 'lead-1',
          title: 'ACME Expansion',
          status: 'NEW',
          source: 'REFERRAL',
          createdAt: '2026-06-14T00:00:00.000Z',
          updatedAt: '2026-06-14T00:00:00.000Z',
          followUpDate: null,
        },
      ],
      pagination: { page: 1, limit: 20, total: 20, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      const metricLabel = screen.getAllByText('My Leads', { exact: true })[1];
      const metricCard = metricLabel.parentElement;
      expect(metricCard).not.toBeNull();
      expect(within(metricCard as HTMLElement).getByText('20')).toBeInTheDocument();
    });
  });

  it('requests and downloads a lead export using the active filters', async () => {
    renderPage();

    const exportButton = await screen.findByRole('button', { name: /export leads/i });
    exportButton.click();

    await waitFor(() => {
      expect(mockRequestExport).toHaveBeenCalledWith('LEAD', expect.objectContaining({
        search: undefined,
        status: undefined,
        source: undefined,
        ownerId: undefined,
        filter: undefined,
      }));
      expect(mockDownloadExport).toHaveBeenCalledWith('export-1');
    });
  });
});
