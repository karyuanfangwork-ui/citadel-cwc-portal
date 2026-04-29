import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the auth service — named export
vi.mock('@/src/services/auth.service', () => ({
  authService: {
    login: vi.fn(() => Promise.resolve()),
    register: vi.fn(() => Promise.resolve()),
    logout: vi.fn(() => Promise.resolve()),
    getCurrentUser: vi.fn(() => Promise.resolve(null)),
  },
}));

// Mock the notification service — default export
vi.mock('@/src/services/notification.service', () => ({
  default: {
    getNotifications: vi.fn(() => Promise.resolve({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } })),
    getUnreadCount: vi.fn(() => Promise.resolve(0)),
    markAsRead: vi.fn(() => Promise.resolve()),
    markAllAsRead: vi.fn(() => Promise.resolve()),
    deleteNotification: vi.fn(() => Promise.resolve()),
  },
}));

// Mock the API client so axios never fires
vi.mock('@/src/services/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    post: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { data: {} } })),
    delete: vi.fn(() => Promise.resolve({ data: { data: {} } })),
  },
}));

import App from '@/App';

describe('App', () => {
  it('renders without crashing', async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(<App />);
      container = result.container;
    });
    expect(container!).toBeTruthy();
  });
});