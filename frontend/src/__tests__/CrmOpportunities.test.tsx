import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmOpportunities from '../../pages/CrmOpportunities';

const mockListOpportunities = vi.fn();
const mockListAccounts = vi.fn();
const mockListPipelines = vi.fn();
const mockListCrmUsers = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    listOpportunities: (...args: unknown[]) => mockListOpportunities(...args),
    listAccounts: (...args: unknown[]) => mockListAccounts(...args),
    listPipelines: (...args: unknown[]) => mockListPipelines(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
    updateOpportunity: vi.fn(),
    deleteOpportunity: vi.fn(),
    createOpportunity: vi.fn(),
    moveStage: vi.fn(),
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

vi.mock('../components/crm/OpportunitiesTable', () => ({
  default: () => <div data-testid="opportunities-table">Opportunities Table</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/crm/opportunities']}>
      <CrmOpportunities />
    </MemoryRouter>
  );

describe('CrmOpportunities', () => {
  beforeEach(() => {
    mockListCrmUsers.mockResolvedValue([]);
    mockListAccounts.mockResolvedValue({ accounts: [] });
    mockListPipelines.mockResolvedValue([{ id: 'pipeline-1', name: 'Sales', stages: [{ id: 'stage-1', name: 'Prospecting', probability: 20 }] }]);
    mockListOpportunities.mockResolvedValue({
      opportunities: [
        {
          id: 'opp-1',
          name: 'ACME Expansion',
          createdAt: '2026-06-14T00:00:00.000Z',
          probability: 20,
          pipelineId: 'pipeline-1',
          stageId: 'stage-1',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('renders the kinetic list-page header grammar', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /opportunities/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /create opportunity/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new opportunity/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search opportunities/i)).toBeInTheDocument();
    expect(screen.getByTestId('opportunities-table')).toBeInTheDocument();
  });
});
