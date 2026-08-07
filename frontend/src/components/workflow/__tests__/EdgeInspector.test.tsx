import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EdgeInspector from '../EdgeInspector';
import { adminService } from '../../../services/admin.service';
import type { GraphEdge } from '../../../services/workflow-version.service';

vi.mock('../../../services/admin.service', () => ({
  adminService: {
    listStaff: vi.fn(),
  },
}));

const edge: GraphEdge = {
  id: 'edge-1',
  fromNodeId: 'acknowledged',
  toNodeId: 'cfo-approval',
  transitionLabel: 'SUBMIT',
  requiresComment: false,
  autoAssignRole: null,
  autoAssignUserId: null,
  allowedRoles: [],
  allowedExecutiveRoles: [],
};

describe('EdgeInspector', () => {
  it('includes active CFO staff in the exact-assignee selector', async () => {
    vi.mocked(adminService.listStaff).mockResolvedValue([
      { id: 'cfo-1', firstName: 'CFO', lastName: 'User', email: 'cfo@test.local', agentTeam: null, roles: ['CFO'] },
    ]);

    render(<EdgeInspector edge={edge} readOnly={false} onChange={vi.fn()} onDelete={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('option', { name: /CFO User.*cfo@test.local.*CFO/i })).toBeInTheDocument());
  });
});
