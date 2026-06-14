import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmOpportunityDetail from '../../pages/CrmOpportunityDetail';

const mockGetOpportunity = vi.fn();
const mockListCrmUsers = vi.fn();
const mockUseNextBestAction = vi.fn();
const mockUseWinProbability = vi.fn();
const mockUseAnalyzeNote = vi.fn();
const mockUseWinLossDebrief = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getOpportunity: (...args: unknown[]) => mockGetOpportunity(...args),
    listCrmUsers: (...args: unknown[]) => mockListCrmUsers(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'admin@test.local', permissions: ['crm:read', 'crm:write', 'crm:admin'] },
  }),
}));

vi.mock('../hooks/useCrmAi', () => ({
  useNextBestAction: () => mockUseNextBestAction(),
  useWinProbability: () => mockUseWinProbability(),
  useAnalyzeNote: () => mockUseAnalyzeNote(),
  useWinLossDebrief: () => mockUseWinLossDebrief(),
}));

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/crm/opportunities/opp-1']}>
        <Routes>
          <Route path="/crm/opportunities/:id" element={<CrmOpportunityDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
};

describe('CrmOpportunityDetail', () => {
  beforeEach(() => {
    mockListCrmUsers.mockResolvedValue([]);
    mockUseNextBestAction.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockUseWinProbability.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockUseAnalyzeNote.mockReturnValue({ analyze: vi.fn(), loading: false, error: null, analysis: null });
    mockUseWinLossDebrief.mockReturnValue({ fetch: vi.fn(), loading: false, error: null, data: null });
    mockGetOpportunity.mockResolvedValue({
      id: 'opp-1',
      name: 'ACME Expansion Deal',
      createdAt: '2026-06-14T00:00:00.000Z',
      value: 250000,
      probability: 40,
      account: { id: 'account-1', name: 'ACME Berhad' },
      contact: { id: 'contact-1', firstName: 'Aisha', lastName: 'Rahman' },
      activities: [],
      stageHistory: [],
      pipeline: { id: 'pipeline-1', name: 'Sales' },
      stage: { id: 'stage-1', name: 'Prospecting', displayOrder: 1, probability: 20 },
    });
  });

  it('renders breadcrumb header and kinetic overview section naming', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ACME Expansion Deal' })).toBeInTheDocument();
    });

    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Opportunity Information')).toBeInTheDocument();
  });
});
