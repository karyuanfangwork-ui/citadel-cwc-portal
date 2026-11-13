import { describe, expect, it, vi } from 'vitest';
import { hrRouteConfig } from '../workflowModalConfig';
import approvalService from '../../services/approval.service';

describe('HR routing modal', () => {
  it('cannot select another executive and routes to saved CEO', async () => {
    const route = vi.spyOn(approvalService, 'routeToCEO').mockResolvedValue({} as never);
    const config = hrRouteConfig({ executiveApproverId: 'saved-ceo', executiveApproverRole: 'CEO' });
    expect(config.fields.some(field => field.type === 'select')).toBe(false);
    await config.onSubmit('request-id', { notes: 'Review', executiveId: 'different-user' });
    expect(route).toHaveBeenCalledWith('request-id', 'saved-ceo', 'Review');
    route.mockRestore();
  });

  it('routes only the saved Group DCEO', async () => {
    const route = vi.spyOn(approvalService, 'routeToGroupDceoHR').mockResolvedValue({} as never);
    await hrRouteConfig({ executiveApproverId: 'saved-deputy', executiveApproverRole: 'GROUP_DCEO' })
      .onSubmit('request-id', { executiveId: 'different-user' });
    expect(route).toHaveBeenCalledWith('request-id', undefined, 'saved-deputy');
    route.mockRestore();
  });
});
