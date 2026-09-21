import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    mockListPipelines.mockResolvedValue([
      {
        id: 'pipeline-1', name: 'Sales A', stages: [
          { id: 'stage-a-prospecting', name: 'Prospecting', probability: 20 },
          { id: 'stage-a-negotiation', name: 'Negotiation', probability: 75 },
          { id: 'stage-a-unique', name: 'Credit Review', probability: 50 },
        ],
      },
      {
        id: 'pipeline-2', name: 'Sales B', stages: [
          { id: 'stage-b-prospecting', name: ' prospecting ', probability: 20 },
          { id: 'stage-b-negotiation', name: 'Negotiation', probability: 75 },
        ],
      },
    ]);
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
      // Page heading is "Opportunity Pipeline" — not a plain "Opportunities"
      expect(screen.getByRole('heading', { name: /opportunity/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /create opportunity/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/filter opportunities/i)).toBeInTheDocument();
    expect(screen.getByTestId('opportunities-table')).toBeInTheDocument();
  });

  it('shows unique logical stages globally and sends stageName for all-pipeline filtering', async () => {
    renderPage();

    await waitFor(() => expect(document.querySelectorAll('select')).toHaveLength(3));
    const [, stageSelect] = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];

    expect(Array.from(stageSelect.options).map(option => option.text)).toEqual([
      'All Stages', 'Prospecting', 'Negotiation', 'Credit Review',
    ]);

    fireEvent.change(stageSelect, { target: { value: 'negotiation' } });
    await waitFor(() => expect(mockListOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({
      stageName: 'negotiation',
      stageId: undefined,
      pipelineId: undefined,
    })));
  });

  it('uses a pipeline-specific stage ID and retains the logical stage when switching pipelines', async () => {
    renderPage();

    await waitFor(() => expect(document.querySelectorAll('select')).toHaveLength(3));
    const [pipelineSelect, stageSelect] = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[];

    fireEvent.change(pipelineSelect, { target: { value: 'pipeline-1' } });
    await waitFor(() => expect(Array.from(stageSelect.options).map(option => option.text)).toEqual([
      'All Stages', 'Prospecting', 'Negotiation', 'Credit Review',
    ]));
    fireEvent.change(stageSelect, { target: { value: 'stage-a-negotiation' } });
    await waitFor(() => expect(mockListOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({
      pipelineId: 'pipeline-1',
      stageId: 'stage-a-negotiation',
      stageName: undefined,
    })));

    fireEvent.change(pipelineSelect, { target: { value: 'pipeline-2' } });
    await waitFor(() => expect(mockListOpportunities).toHaveBeenLastCalledWith(expect.objectContaining({
      pipelineId: 'pipeline-2',
      stageId: 'stage-b-negotiation',
      stageName: undefined,
    })));
  });
});
