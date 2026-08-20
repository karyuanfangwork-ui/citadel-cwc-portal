import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import NotificationDropdown from '../NotificationDropdown';

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    unreadCount: 0,
    setUnreadCount: vi.fn(),
    recentNotification: null,
  }),
}));

vi.mock('../../services/notification.service', () => ({
  default: {
    getNotifications: vi.fn(),
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
}));

describe('NotificationDropdown', () => {
  it('contains the pre-font bell label inside the fixed notification control', () => {
    render(
      <MemoryRouter>
        <NotificationDropdown />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Notifications' });
    const fallbackLabel = screen.getByText('notifications');

    expect(button).toHaveClass('w-10', 'h-10', 'min-w-0', 'overflow-hidden');
    expect(fallbackLabel).toHaveClass('min-w-0', 'max-w-full', 'overflow-hidden');
  });
});
