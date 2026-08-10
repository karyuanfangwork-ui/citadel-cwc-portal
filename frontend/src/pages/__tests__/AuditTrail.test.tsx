import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuditTrail from '../../../pages/AuditTrail';
import { auditLogService } from '../../services/auditLog.service';

vi.mock('../../services/auditLog.service', () => ({
  auditLogService: {
    getLogs: vi.fn(),
  },
}));

describe('AuditTrail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditLogService.getLogs).mockResolvedValue({
      status: 'success',
      data: {
        logs: [{
          id: 'audit-1',
          userId: 'user-1',
          userEmail: 'admin@test.local',
          action: 'USER_UPDATED',
          resourceType: 'user',
          resourceId: 'resource-1',
          ipAddress: null,
          userAgent: null,
          oldValues: { isActive: true },
          newValues: { isActive: false },
          createdAt: '2026-08-10T12:00:00.000Z',
          user: { id: 'user-1', firstName: 'Admin', lastName: 'User', email: 'admin@test.local' },
        }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
  });

  it('uses the canonical global audit endpoint and supports resource-id filtering', async () => {
    render(<MemoryRouter><AuditTrail /></MemoryRouter>);

    await waitFor(() => expect(auditLogService.getLogs).toHaveBeenCalledWith({ page: 1, limit: 20 }));

    fireEvent.change(screen.getByPlaceholderText('Paste resource ID...'), {
      target: { value: 'resource-1' },
    });

    await waitFor(() => expect(auditLogService.getLogs).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      resourceId: 'resource-1',
    }));
  });

  it('renders JSON and object before/after values consistently', async () => {
    render(<MemoryRouter><AuditTrail /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText('USER_UPDATED')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(screen.getByText(/"isActive": true/)).toBeInTheDocument();
    expect(screen.getByText(/"isActive": false/)).toBeInTheDocument();
  });
});
