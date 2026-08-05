const mockRequestFindUnique = jest.fn();
const mockWorkflowTransitionFindMany = jest.fn();

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    request: { findUnique: mockRequestFindUnique },
    workflowTransition: { findMany: mockWorkflowTransitionFindMany },
  },
}));

jest.mock('../transitionPolicy.service', () => ({
  canActorTransition: jest.fn().mockResolvedValue({ allowed: true }),
}));

import { getAvailableTransitionsForRequest } from '../availableTransitions.service';

const actor = { userId: 'agent-1', roles: ['AGENT'], executiveRole: null };

function transition(
  id: string,
  toStatus: string,
  workflowTypeId: string | null,
  transitionLabel = 'SUBMIT',
) {
  return {
    id,
    fromStatus: 'SUBMITTED',
    toStatus,
    transitionLabel,
    requiresComment: false,
    allowedRoles: [],
    allowedExecutiveRoles: [],
    tenantId: null,
    workflowTypeId,
  };
}

describe('getAvailableTransitionsForRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestFindUnique.mockResolvedValue({
      status: 'SUBMITTED',
      tenantId: null,
      requestType: { workflowTypeId: 'it-simple' },
    });
  });

  it('does not leak global HR/Finance approval routes into IT_SIMPLE', async () => {
    mockWorkflowTransitionFindMany.mockResolvedValue([
      transition('it-review', 'IN_REVIEW', 'it-simple', 'ADVANCE'),
      transition('it-progress', 'IN_PROGRESS', 'it-simple', 'ADVANCE'),
      transition('global-ceo', 'PENDING_CEO_APPROVAL', null),
      transition('global-manager', 'PENDING_MANAGER_APPROVAL_FIN', null),
    ]);

    const result = await getAvailableTransitionsForRequest('request-1', actor);

    expect(result.map((item) => item.toStatus)).toEqual(['IN_REVIEW', 'IN_PROGRESS']);
  });

  it('keeps workflow-specific approval routes when the workflow has them', async () => {
    mockWorkflowTransitionFindMany.mockResolvedValue([
      transition('hr-ceo', 'PENDING_CEO_APPROVAL', 'hr-recruitment'),
      transition('global-ceo', 'PENDING_CEO_APPROVAL', null),
      transition('global-manager', 'PENDING_MANAGER_APPROVAL_FIN', null),
    ]);
    mockRequestFindUnique.mockResolvedValue({
      status: 'SUBMITTED',
      tenantId: null,
      requestType: { workflowTypeId: 'hr-recruitment' },
    });

    const result = await getAvailableTransitionsForRequest('request-2', actor);

    expect(result.map((item) => item.toStatus)).toEqual(['PENDING_CEO_APPROVAL']);
  });
});