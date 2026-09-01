import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getStatus = vi.hoisted(() => vi.fn());
const rescore = vi.hoisted(() => vi.fn());

vi.mock('../../../services/credit.service', () => ({
  scoreStatusApi: { getStatus, rescore },
}));

import ScoreOutdatedBanner from '../ScoreOutdatedBanner';

describe('ScoreOutdatedBanner', () => {
  it('uses plain-language outdated score copy and keeps rescore accessible', async () => {
    getStatus.mockResolvedValue({
      isOutdated: true,
      staleInputSource: 'Financial information',
      lastFinancialsUpdatedAt: '2026-08-31T10:00:00.000Z',
      lastScoreRunAt: '2026-08-30T10:00:00.000Z',
    });

    render(<ScoreOutdatedBanner applicationId="app-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Risk score is out of date');
    expect(screen.getByRole('button', { name: 'Rescore risk score' })).toHaveTextContent('Rescore Now');
    expect(screen.queryByText('Risk score needs recalculation')).not.toBeInTheDocument();
  });

  it('does not render when the server says the score is current', async () => {
    getStatus.mockResolvedValue({ isOutdated: false });

    render(<ScoreOutdatedBanner applicationId="app-1" />);

    await waitFor(() => expect(getStatus).toHaveBeenCalledWith('app-1'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
