import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPolicyEvaluationsMock, getPolicyEvaluationMock } = vi.hoisted(() => ({
  getPolicyEvaluationsMock: vi.fn(),
  getPolicyEvaluationMock: vi.fn(),
}));

vi.mock('../../../services/credit.service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/credit.service')>('../../../services/credit.service');
  return {
    ...actual,
    default: {
      ...actual.default,
      getPolicyEvaluations: getPolicyEvaluationsMock,
      getPolicyEvaluation: getPolicyEvaluationMock,
    },
  };
});

import PolicyResultsPanel from '../PolicyResultsPanel';

const summary = (over: Record<string, unknown> = {}) => ({
  evaluationId: 'eval-1',
  evaluatedAt: '2026-06-15T10:00:00.000Z',
  triggerAction: 'approve',
  summary: { total: 3, passed: 1, warned: 1, failed: 1, overall: 'FAIL' as const },
  ...over,
});

const detail = {
  ...summary(),
  policySetVersion: 'sha256:abcdef123456',
  results: [
    { id: 'r1', ruleCode: 'LIMIT.SECTOR.abc', verdict: 'FAIL' as const, source: 'POLICY_LIMIT', actual: '6000000', threshold: '5000000', message: 'Exceeds sector cap.' },
    { id: 'r2', ruleCode: 'BUREAU.FRESHNESS', verdict: 'WARN' as const, source: 'BUREAU', actual: 'CTOS', threshold: null, message: 'Stale bureau reports: CTOS.' },
    { id: 'r3', ruleCode: 'READINESS.signoff', verdict: 'PASS' as const, source: 'READINESS', actual: null, threshold: null, message: 'Signoff complete.' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getPolicyEvaluationsMock.mockResolvedValue([summary()]);
  getPolicyEvaluationMock.mockResolvedValue(detail);
});

describe('PolicyResultsPanel', () => {
  it('lists each evaluation with its trigger, date and verdict counts', async () => {
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    expect(screen.getByText(/15 Jun 2026/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument();
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByText(/1 passed/i)).toBeInTheDocument();
  });

  it('does not fetch any detail until an evaluation is expanded', async () => {
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(getPolicyEvaluationsMock).toHaveBeenCalled());
    expect(getPolicyEvaluationMock).not.toHaveBeenCalled();
  });

  it('fetches and shows the rules when expanded, failures first', async () => {
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approved/i }));
    await waitFor(() => expect(screen.getByText('LIMIT.SECTOR.abc')).toBeInTheDocument());
    expect(getPolicyEvaluationMock).toHaveBeenCalledWith('app-1', 'eval-1');
    const codes = screen.getAllByTestId('policy-rule-code').map((el) => el.textContent);
    expect(codes).toEqual(['LIMIT.SECTOR.abc', 'BUREAU.FRESHNESS', 'READINESS.signoff']);
  });

  it('shows actual against threshold for a threshold rule', async () => {
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approved/i }));
    await waitFor(() => expect(screen.getByText(/6000000/)).toBeInTheDocument());
    expect(screen.getByText(/5000000/)).toBeInTheDocument();
  });

  it('shows the policy set version only inside the expanded evaluation', async () => {
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    expect(screen.queryByText(/sha256:abcdef123456/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /approved/i }));
    await waitFor(() => expect(screen.getByText(/sha256:abcdef123456/)).toBeInTheDocument());
  });

  it('says plainly when no policy version was recorded', async () => {
    getPolicyEvaluationMock.mockResolvedValue({ ...detail, policySetVersion: null });
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approved/i }));
    await waitFor(() => expect(screen.getByText(/not recorded/i)).toBeInTheDocument());
  });

  it('caches the detail — re-expanding does not refetch', async () => {
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    const toggle = screen.getByRole('button', { name: /approved/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(getPolicyEvaluationMock).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByText('LIMIT.SECTOR.abc')).toBeInTheDocument());
    expect(getPolicyEvaluationMock).toHaveBeenCalledTimes(1);
  });

  it('marks an evaluator failure as "could not be evaluated", not as a failed rule', async () => {
    getPolicyEvaluationMock.mockResolvedValue({
      ...summary(),
      results: [{ id: 'e1', ruleCode: 'POLICY_LIMIT.EVALUATION_ERROR', verdict: 'FAIL' as const, source: 'POLICY_LIMIT', actual: null, threshold: null, message: 'Policy evaluation failed for POLICY_LIMIT: fx rate missing' }],
    });
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approved/i }));
    await waitFor(() => expect(screen.getByText(/could not be evaluated/i)).toBeInTheDocument());
  });

  it('says plainly when no evaluation has been recorded', async () => {
    getPolicyEvaluationsMock.mockResolvedValue([]);
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText(/No policy evaluations/i)).toBeInTheDocument());
  });

  it('reports a load failure instead of rendering an empty list', async () => {
    getPolicyEvaluationsMock.mockRejectedValue(new Error('nope'));
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument());
  });

  it('reports a detail load failure without collapsing the row', async () => {
    getPolicyEvaluationMock.mockRejectedValue(new Error('detail down'));
    render(<PolicyResultsPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approved/i }));
    await waitFor(() => expect(screen.getByText(/detail down/i)).toBeInTheDocument());
  });
});
