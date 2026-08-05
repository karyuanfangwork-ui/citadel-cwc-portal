/**
 * Atomicity test for it-workflow.controller.ts — verifies that post-transition
 * Request writes are folded into the transition command boundary, not performed
 * as separate writes.
 */
const mockTransitionRequest = jest.fn();
const mockPrisma = {
  request: { findUnique: jest.fn(), update: jest.fn() },
};

jest.mock('../../services/requestTransition.service', () => ({
  transitionRequest: mockTransitionRequest,
}));
jest.mock('../../utils/prisma', () => ({ __esModule: true, default: mockPrisma }));
jest.mock('../../utils/resolve', () => ({ resolveRequestId: jest.fn().mockResolvedValue('req-1') }));
jest.mock('../../services/notification.service', () => ({ notify: jest.fn() }));
jest.mock('../../utils/audit', () => ({ auditLog: jest.fn() }));
jest.mock('../../services/reassign.service', () => ({ reassignToTeam: jest.fn() }));
jest.mock('../../services/attachmentAccess.service', () => ({ registerUpload: jest.fn() }));
jest.mock('../../middleware/auth.middleware', () => ({ hasRole: jest.fn().mockReturnValue(true) }));

// Must import after mocks
import { markProcurement } from '../it-workflow.controller';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    params: { id: 'req-1' },
    body: { orderNumber: 'PO-9', vendor: 'Acme', estimatedDelivery: '2026-09-01' },
    user: { id: 'u1', firstName: 'IT', roles: ['AGENT'] },
    ...overrides,
  } as any;
}

function mockRes() {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
}

describe('markProcurement atomicity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.request.findUnique.mockResolvedValue({
      id: 'req-1',
      customFields: { existing: 'keep' },
      requesterId: 'u1',
    });
    mockTransitionRequest.mockResolvedValue({ success: true, request: { id: 'req-1' } });
  });

  it('commits procurement fields inside the transition, not as a second write', async () => {
    const req = mockReq();
    const res = mockRes();

    await markProcurement(req, res);

    // prisma.request.update must NOT be called outside the command boundary
    expect(mockPrisma.request.update).not.toHaveBeenCalled();

    // transitionRequest must have been called with the customFields in requestPatch
    expect(mockTransitionRequest).toHaveBeenCalledTimes(1);
    const [, toStatus, options] = mockTransitionRequest.mock.calls[0];
    expect(toStatus).toBe('PROCUREMENT_IN_PROGRESS');
    expect(options.requestPatch.customFields).toMatchObject({
      existing: 'keep',
      procurement: {
        orderNumber: 'PO-9',
        vendor: 'Acme',
        estimatedDelivery: '2026-09-01',
      },
    });
  });
});