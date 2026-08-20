import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import NotificationDropdown from '../NotificationDropdown';

vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    unreadCount: 12,
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
  it('keeps the unread badge visible while containing the pre-font bell label', () => {
    render(
      <MemoryRouter>
        <NotificationDropdown />
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Notifications' });
    const iconWrapper = screen.getByTestId('notification-icon-wrapper');
    const fallbackLabel = screen.getByText('notifications');

    expect(screen.getByText('12')).toBeVisible();
    expect(button).toHaveClass('w-10', 'h-10', 'min-w-0');
    expect(button).not.toHaveClass('overflow-hidden');
    expect(iconWrapper).toHaveClass('w-6', 'h-6', 'min-w-0', 'overflow-hidden');
    expect(iconWrapper).toContainElement(fallbackLabel);
  });
});
