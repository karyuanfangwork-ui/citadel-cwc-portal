// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agentDashboardService, AgentDashboardResponse, DashboardQuery } from '../../../services/agent-dashboard.service';
import { useAgentDashboard } from '../useAgentDashboard';

vi.mock('../../../services/agent-dashboard.service', () => ({ agentDashboardService: { get: vi.fn() } }));
const get = vi.mocked(agentDashboardService.get);
const query: DashboardQuery = { scope: 'mine', queue: 'open', page: 1, limit: 25, sort: 'urgency' };
const response = (asOf: string): AgentDashboardResponse => ({
  asOf, scope: 'mine', scopeLabel: 'My work', availableScopes: ['mine'],
  metrics: { open: 0, dueSoon: 0, breached: 0, avgResolutionHours: null, resolutionSampleSize: 0, resolutionWindow: { from: asOf, to: asOf } },
  queueCounts: { open: 0, closed: 0, all: 0, unassigned: 0 }, requestTypes: [], attention: { total: 0, tickets: [] }, tickets: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
});

beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe('useAgentDashboard', () => {
  it('loads the initial response and passes an abort signal', async () => {
    get.mockResolvedValue(response('loaded'));
    const { result } = renderHook(() => useAgentDashboard(query));
    await waitFor(() => expect(result.current.data?.asOf).toBe('loaded'));
    expect(get.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(result.current.initialLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('shows an initial load failure and recovers when retry is requested', async () => {
    get.mockRejectedValueOnce(new Error('initial unavailable'));
    get.mockResolvedValueOnce(response('retry-recovered'));
    const { result } = renderHook(() => useAgentDashboard(query));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeNull();
    expect(result.current.initialLoading).toBe(false);

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data?.asOf).toBe('retry-recovered'));
    expect(result.current.error).toBeNull();
  });

  it.each([401, 403])('stops polling after authorization failure %i', async (status) => {
    vi.useFakeTimers();
    get.mockRejectedValue({ response: { status } });
    const { result } = renderHook(() => useAgentDashboard(query));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.error).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('debounces search before issuing the replacement query', async () => {
    get.mockResolvedValue(response('loaded'));
    const { rerender } = renderHook(({ value }) => useAgentDashboard({ ...query, search: value }), { initialProps: { value: '' } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    rerender({ value: 'laptop' });
    expect(get).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2), { timeout: 1500 });
    expect(get.mock.calls[1][0].search).toBe('laptop');
  });

  it('aborts the prior request and ignores its late result after query changes', async () => {
    let resolveFirst!: (data: AgentDashboardResponse) => void;
    get.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    get.mockResolvedValueOnce(response('new-query'));
    const { rerender, result } = renderHook(({ page }) => useAgentDashboard({ ...query, page }), { initialProps: { page: 1 } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const oldSignal = get.mock.calls[0][1]!;
    rerender({ page: 2 });
    await waitFor(() => expect(result.current.data?.asOf).toBe('new-query'));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => { resolveFirst(response('stale-query')); });
    expect(result.current.data?.asOf).toBe('new-query');
  });

  it('retains last good data as stale on refresh failure and clears error on recovery', async () => {
    get.mockResolvedValueOnce(response('last-good'));
    get.mockRejectedValueOnce(new Error('refresh unavailable'));
    get.mockResolvedValueOnce(response('recovered'));
    const { result } = renderHook(() => useAgentDashboard(query));
    await waitFor(() => expect(result.current.data?.asOf).toBe('last-good'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.data?.asOf).toBe('last-good');
    expect(result.current.error).toBeTruthy();
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.data?.asOf).toBe('recovered'));
    expect(result.current.stale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('polls only while visible and removes timers on unmount', async () => {
    vi.useFakeTimers();
    get.mockResolvedValue(response('visible-refresh'));
    const { unmount } = renderHook(() => useAgentDashboard(query));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(get).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(get).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(get).toHaveBeenCalledTimes(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
