import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NotificationProvider, useNotifications } from './NotificationContext';
import notificationService from '../services/notification.service';

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ accessToken: 'test-token' }),
}));

vi.mock('../services/notification.service', () => ({
  default: {
    getUnreadCount: vi.fn(),
    replayAfter: vi.fn(),
  },
}));

type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Listener>();
  url: string;
  withCredentials?: boolean;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, listener: Listener) {
    this.listeners.set(event, listener);
  }

  emit(event: string, data: unknown) {
    const listener = this.listeners.get(event);
    listener?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function Probe() {
  const { unreadCount, recentNotification, toast } = useNotifications();
  return (
    <div>
      <div data-testid="count">{unreadCount}</div>
      <div data-testid="recent">{recentNotification?.id ?? 'none'}</div>
      <div data-testid="toast">{toast?.subject ?? 'none'}</div>
    </div>
  );
}

describe('NotificationContext cursor replay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource;
    vi.mocked(notificationService.getUnreadCount)
      .mockResolvedValueOnce(0)
      .mockResolvedValue(2);
    vi.mocked(notificationService.replayAfter).mockResolvedValue({ notifications: [], cursor: null });
  });

  it('uses cookie-authenticated SSE as a wake-up and fetches persisted inbox rows after the cursor', async () => {
    vi.mocked(notificationService.replayAfter)
      .mockResolvedValueOnce({
        notifications: [{
          id: 'n-1',
          subject: 'Recovered notification',
          body: 'Persisted body',
          channel: 'IN_APP',
          status: 'SENT',
          readAt: null,
          relatedRequestId: null,
          createdAt: '2026-07-23T00:00:00.000Z',
        }],
        cursor: 'n-1',
      })
      .mockResolvedValueOnce({
        notifications: [{
          id: 'n-2',
          subject: 'Replay after wake-up',
          body: 'Second persisted body',
          channel: 'IN_APP',
          status: 'SENT',
          readAt: null,
          relatedRequestId: null,
          createdAt: '2026-07-23T00:01:00.000Z',
        }],
        cursor: 'n-2',
      });

    render(
      <NotificationProvider userId="user-1">
        <Probe />
      </NotificationProvider>,
    );

    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    expect(MockEventSource.instances[0].withCredentials).toBe(true);
    await waitFor(() => expect(screen.getByTestId('recent').textContent).toBe('n-1'));

    MockEventSource.instances[0].emit('notification', { cursor: 'n-2' });

    await waitFor(() => expect(screen.getByTestId('recent').textContent).toBe('n-2'));
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByTestId('toast').textContent).toBe('Replay after wake-up');
    expect(notificationService.replayAfter).toHaveBeenNthCalledWith(1, null);
    expect(notificationService.replayAfter).toHaveBeenNthCalledWith(2, 'n-1');
  });
});
