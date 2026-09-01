import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { getApplicationSnapshotsMock } = vi.hoisted(() => ({ getApplicationSnapshotsMock: vi.fn() }));
vi.mock('../../../services/credit.service', async () => {
  const actual = await vi.importActual<any>('../../../services/credit.service');
  return { ...actual, default: { ...actual.default, getApplicationSnapshots: getApplicationSnapshotsMock } };
});

import SnapshotHistoryPanel from '../SnapshotHistoryPanel';

const snap = (over: Record<string, unknown> = {}) => ({
  id: 'snap-1', snapshotType: 'FINAL_DECISION', takenAt: '2026-06-15T10:00:00.000Z', triggerAction: 'approve',
  hash: 'abc123def456abc123def456abc123def456abc123def456abc123def4560000',
  takenBy: { id: 'u-1', firstName: 'Ada', lastName: 'Lim' }, ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('SnapshotHistoryPanel', () => {
  it('lists each snapshot with its type, trigger and who took it', async () => {
    getApplicationSnapshotsMock.mockResolvedValue([
      snap(), snap({ id: 'snap-0', snapshotType: 'COMMITTEE_SUBMISSION', triggerAction: 'submit_to_committee', takenAt: '2026-05-01T09:00:00.000Z' }),
    ]);
    render(<SnapshotHistoryPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText(/Final decision/i)).toBeInTheDocument());
    expect(screen.getByText(/Committee submission/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ada Lim/)).toHaveLength(2);
    expect(screen.getByText('approve')).toBeInTheDocument();
  });
  it('shows a truncated hash as tamper evidence', async () => {
    getApplicationSnapshotsMock.mockResolvedValue([snap()]);
    render(<SnapshotHistoryPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText(/abc123def456/)).toBeInTheDocument());
  });
  it('states plainly when nothing was captured', async () => {
    getApplicationSnapshotsMock.mockResolvedValue([]);
    render(<SnapshotHistoryPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText(/No context snapshots/i)).toBeInTheDocument());
  });
  it('reports a load failure instead of rendering an empty list', async () => {
    getApplicationSnapshotsMock.mockRejectedValue(new Error('nope'));
    render(<SnapshotHistoryPanel applicationId="app-1" />);
    await waitFor(() => expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument());
  });
});
