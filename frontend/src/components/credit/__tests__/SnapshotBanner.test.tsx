import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SnapshotBanner from '../SnapshotBanner';

const snapshot = {
  id: 'snap-1', snapshotType: 'FINAL_DECISION' as const, takenAt: '2026-06-15T10:00:00.000Z',
  triggerAction: 'approve', hash: 'abcdef0123456789'.repeat(4),
  takenBy: { id: 'u-1', firstName: 'Ada', lastName: 'Lim' },
};
const base = {
  mode: 'snapshot' as const, effectiveMode: 'snapshot' as const, snapshot, error: null,
  viewingLive: false, onToggleLive: vi.fn(),
};

describe('SnapshotBanner', () => {
  it('renders nothing for a live application', () => {
    const { container } = render(<SnapshotBanner {...base} mode="live" effectiveMode="live" snapshot={null} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('states that frozen context is being shown, with the decision date', () => {
    render(<SnapshotBanner {...base} />);
    expect(screen.getByText(/frozen at the decision/i)).toBeInTheDocument();
    expect(screen.getByText(/15 Jun 2026/i)).toBeInTheDocument();
  });
  it('offers a way to see current data, and calls back', () => {
    const onToggleLive = vi.fn();
    render(<SnapshotBanner {...base} onToggleLive={onToggleLive} />);
    fireEvent.click(screen.getByRole('button', { name: /current data/i }));
    expect(onToggleLive).toHaveBeenCalledWith(true);
  });
  it('warns when a snapshot exists but live data is being shown, and offers the way back', () => {
    const onToggleLive = vi.fn();
    render(<SnapshotBanner {...base} effectiveMode="live" viewingLive onToggleLive={onToggleLive} />);
    expect(screen.getByText(/may differ from what was decided/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /decision context/i }));
    expect(onToggleLive).toHaveBeenCalledWith(false);
  });
  it('states plainly when a decided application predates snapshots, without a toggle', () => {
    render(<SnapshotBanner {...base} mode="decided-without-snapshot" effectiveMode="decided-without-snapshot" snapshot={null} />);
    expect(screen.getByText(/decided before context snapshots were introduced/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('surfaces a load failure', () => {
    render(<SnapshotBanner {...base} mode="decided-without-snapshot" effectiveMode="decided-without-snapshot" snapshot={null} error="network down" />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
  });
  it('names who took the snapshot', () => {
    render(<SnapshotBanner {...base} />);
    expect(screen.getByText(/Ada Lim/)).toBeInTheDocument();
  });
});
