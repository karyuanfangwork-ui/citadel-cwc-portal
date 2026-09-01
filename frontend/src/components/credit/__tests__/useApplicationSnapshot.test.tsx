import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { getApplicationSnapshotsMock, getApplicationSnapshotMock } = vi.hoisted(() => ({
  getApplicationSnapshotsMock: vi.fn(),
  getApplicationSnapshotMock: vi.fn(),
}));
vi.mock('../../../services/credit.service', async () => {
  const actual = await vi.importActual<any>('../../../services/credit.service');
  return {
    ...actual,
    default: {
      ...actual.default,
      getApplicationSnapshots: getApplicationSnapshotsMock,
      getApplicationSnapshot: getApplicationSnapshotMock,
    },
  };
});

import { useApplicationSnapshot } from '../../../hooks/useApplicationSnapshot';

const live = { id: 'app-1', applicationNo: 'CA-0001', rm: { id: 'u-9' } } as any;
const summary = {
  id: 'snap-1', snapshotType: 'FINAL_DECISION' as const, takenAt: '2026-06-15T10:00:00.000Z',
  triggerAction: 'approve', hash: 'a'.repeat(64), takenBy: { id: 'u-1', firstName: 'Ada', lastName: 'Lim' },
};
const detail = {
  ...summary, applicationId: 'app-1', payload: { id: 'app-1', applicationNo: 'CA-0001', assignedRm: { id: 'u-1' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  getApplicationSnapshotsMock.mockResolvedValue([summary]);
  getApplicationSnapshotMock.mockResolvedValue(detail);
});

describe('useApplicationSnapshot', () => {
  it('does not fetch anything for a live application', async () => {
    const { result } = renderHook(() => useApplicationSnapshot('app-1', 'CREDIT_ASSESSMENT', live));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getApplicationSnapshotsMock).not.toHaveBeenCalled();
    expect(result.current.mode).toBe('live');
    expect(result.current.resolvedApplication).toBe(live);
  });

  it('fetches the payload and resolves to it for a decided application', async () => {
    const { result } = renderHook(() => useApplicationSnapshot('app-1', 'APPROVED', live));
    await waitFor(() => expect(result.current.mode).toBe('snapshot'));
    expect(getApplicationSnapshotsMock).toHaveBeenCalledWith('app-1');
    expect(getApplicationSnapshotMock).toHaveBeenCalledWith('app-1', 'snap-1');
    expect(result.current.resolvedApplication).not.toBe(live);
    expect(result.current.resolvedApplication.applicationNo).toBe('CA-0001');
  });

  it('normalises the payload so tabs still find rm and analyst', async () => {
    const { result } = renderHook(() => useApplicationSnapshot('app-1', 'APPROVED', live));
    await waitFor(() => expect(result.current.mode).toBe('snapshot'));
    expect(result.current.resolvedApplication.rm).toEqual({ id: 'u-1' });
    expect((result.current.resolvedApplication as any).assignedRm).toBeUndefined();
  });

  it('reports decided-without-snapshot and keeps live data', async () => {
    getApplicationSnapshotsMock.mockResolvedValue([]);
    const { result } = renderHook(() => useApplicationSnapshot('app-1', 'APPROVED', live));
    await waitFor(() => expect(result.current.mode).toBe('decided-without-snapshot'));
    expect(getApplicationSnapshotMock).not.toHaveBeenCalled();
    expect(result.current.resolvedApplication).toBe(live);
  });

  it('toggling to live keeps mode but changes effectiveMode and the data', async () => {
    const { result } = renderHook(() => useApplicationSnapshot('app-1', 'APPROVED', live));
    await waitFor(() => expect(result.current.mode).toBe('snapshot'));
    act(() => result.current.setViewingLive(true));
    expect(result.current.mode).toBe('snapshot');
    expect(result.current.effectiveMode).toBe('live');
    expect(result.current.resolvedApplication).toBe(live);
    act(() => result.current.setViewingLive(false));
    expect(result.current.effectiveMode).toBe('snapshot');
  });

  it('falls back to live data and records the error when the fetch fails', async () => {
    getApplicationSnapshotsMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useApplicationSnapshot('app-1', 'APPROVED', live));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
    expect(result.current.resolvedApplication).toBe(live);
  });

  it('does nothing without an application id', async () => {
    const { result } = renderHook(() => useApplicationSnapshot('', 'APPROVED', live));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getApplicationSnapshotsMock).not.toHaveBeenCalled();
  });
});
