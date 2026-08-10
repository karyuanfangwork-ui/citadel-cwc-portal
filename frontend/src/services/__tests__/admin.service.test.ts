import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  default: {
    get: mockGet,
  },
}));

import { adminService } from '../admin.service';

describe('adminService.listUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: {
        data: {
          users: [],
          pagination: { page: 1, limit: 15, total: 0, totalPages: 0 },
        },
      },
    });
  });

  it('passes the abort signal and user filters to the users endpoint', async () => {
    const controller = new AbortController();

    await adminService.listUsers({
      page: 2,
      limit: 15,
      search: '  ah  ',
      role: 'AGENT',
      isActive: true,
      signal: controller.signal,
    });

    expect(mockGet).toHaveBeenCalledWith(
      '/users?page=2&limit=15&search=++ah++&role=AGENT&isActive=true',
      { signal: controller.signal },
    );
  });
});
