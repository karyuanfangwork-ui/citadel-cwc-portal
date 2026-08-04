/**
 * P6-04: Transition Guards / Preconditions Tests
 *
 * Tests verify that guard predicates registered in transitionGuards.ts
 * correctly block or allow transitions based on:
 *  1. Comment-required for rejection transitions
 *  2. Assignment checks for IT procurement transitions
 *  3. Service-desk checks for IT-only transitions
 *  4. Role-based checks for CEO/CTO/CFO/Group DCEO approval decisions
 *  5. LOA preconditions (approved LOA, signed LOA)
 *  6. Onboarding completion (all tasks done)
 *  7. Offboarding phase guards (resignation letter, exit interview, tasks)
 *  9. Finance service-desk checks for FINANCE-only transitions
 *  10. Finance assignment checks for procurement/payment transitions
 *  11. Manager & Finance Head role-based approval checks
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports.
// jest.mock is hoisted, so we use a factory that returns mutable objects.
// We declare the mock object inside the factory to avoid TDZ issues.
// ---------------------------------------------------------------------------

const mockPrisma: any = {
  request: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  requestActivity: {
    create: jest.fn(),
  },
  requestParticipant: {
    findMany: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
  onboardingRequest: {
    findUnique: jest.fn(),
  },
  offboardingRequest: {
    findUnique: jest.fn(),
  },
  workflowHistory: {
    create: jest.fn(),
  },
  workflowCommandResult: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  outboxEvent: {
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

// Jest hoists jest.mock calls. The factory returns the mockPrisma object.
// Since mockPrisma is a const, jest hoists the mock call above it, but
// jest.mock factories are called lazily (when the module is first imported),
// so the const is initialized by then. This pattern works in practice.
jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../utils/workflowTransitions', () => ({
  isTerminalStatus: (status: string) =>
    [
      'RESOLVED', 'REJECTED', 'COMPLETED',
      'OFFBOARDING_COMPLETED', 'ONBOARDING_COMPLETED',
      'REIMBURSEMENT_CLOSED', 'TICKET_CLOSED_FIN',
      'CHARGEBACK_COMPLETED', 'LOA_REJECTED',
    ].includes(status),
  isValidTransition: jest.fn(),
  getTransitionMeta: jest.fn(),
  getValidNextStatuses: jest.fn(),
  getWorkflowForRequest: jest.fn(),
}));

jest.mock('../sla-pause.service', () => ({
  pauseSla: jest.fn(),
  resumeSla: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mock setup
// ---------------------------------------------------------------------------
import { transitionRequest, registerTransitionGuard } from '../requestTransition.service';
import { initTransitionGuards } from '../transitionGuards';

// Ensure guards are registered
initTransitionGuards();

// ---------------------------------------------------------------------------
// Helper: create a mock request object
// ---------------------------------------------------------------------------
function makeRequest(overrides: Record<string, any> = {}): any {
  return {
    id: 'req-001',
    status: 'SUBMITTED',
    version: 1,
    tenantId: 'tenant-001',
    assignedToId: null,
    serviceDesk: { code: 'IT' },
    requesterId: 'user-001',
    referenceNumber: 'IT-2025-001',
    customFields: {},
    slaPausedAt: null,
    requestType: {
      workflow: {
        steps: [],
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('P6-04: Transition Guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.request.findUnique.mockResolvedValue(null);
    mockPrisma.request.findFirst.mockImplementation(({ where }: any) =>
      mockPrisma.request.findUnique({ where }),
    );
    mockPrisma.request.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...makeRequest(), ...data }),
    );
    mockPrisma.request.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.request.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      mockPrisma.request.findUnique({ where }),
    );
    mockPrisma.requestActivity.create.mockResolvedValue({ id: 'act-001' });
    mockPrisma.requestParticipant.findMany.mockResolvedValue([]);
    mockPrisma.workflowHistory.create.mockResolvedValue({ id: 'hist-001' });
    mockPrisma.workflowCommandResult.findUnique.mockResolvedValue(null);
    mockPrisma.workflowCommandResult.create.mockResolvedValue({ id: 'cmd-001' });
    mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'out-001' });
    mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-001' });
    mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
  });

  // ── 1. Comment-required guard ──────────────────────────────────────────

  describe('1. Comment-required for rejections', () => {
    it('blocks REJECTED transition without comment', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'IN_PROGRESS' }),
      );

      await expect(
        transitionRequest('req-001', 'REJECTED', {
          userId: 'user-001',
          userName: 'Test User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/comment is required/i);
    });

    it('allows REJECTED transition with comment', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'IN_PROGRESS' }),
      );

      const result = await transitionRequest('req-001', 'REJECTED', {
        userId: 'user-001',
        userName: 'Test User',
        comment: 'Not approved by management',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('REJECTED');
    });

    it('blocks CEO_REJECTED_IT without comment', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_CEO_APPROVAL_IT' }),
      );

      await expect(
        transitionRequest('req-001', 'CEO_REJECTED_IT', {
          userId: 'user-001',
          userName: 'CEO User',
          metadata: { userRoles: ['CEO'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/comment is required/i);
    });
  });

  // ── 2. Assignment guard ────────────────────────────────────────────────

  describe('2. Assignment guard for IT procurement', () => {
    it('blocks PROCUREMENT_IN_PROGRESS→HARDWARE_ORDERED by non-assigned user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'PROCUREMENT_IN_PROGRESS',
          assignedToId: 'agent-001',
        }),
      );

      await expect(
        transitionRequest('req-001', 'HARDWARE_ORDERED', {
          userId: 'other-user',
          userName: 'Other User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only the assigned agent or admin/i);
    });

    it('allows PROCUREMENT_IN_PROGRESS→HARDWARE_ORDERED by assigned user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'PROCUREMENT_IN_PROGRESS',
          assignedToId: 'agent-001',
        }),
      );

      const result = await transitionRequest('req-001', 'HARDWARE_ORDERED', {
        userId: 'agent-001',
        userName: 'Assigned Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('allows PROCUREMENT_IN_PROGRESS→HARDWARE_ORDERED by admin', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'PROCUREMENT_IN_PROGRESS',
          assignedToId: 'agent-001',
        }),
      );

      const result = await transitionRequest('req-001', 'HARDWARE_ORDERED', {
        userId: 'admin-001',
        userName: 'Admin',
        userRole: 'ADMIN',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 3. Service-desk guard ──────────────────────────────────────────────

  describe('3. Service-desk guard for IT-only transitions', () => {
    it('blocks PROCUREMENT_IN_PROGRESS on non-IT service desk', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'SUBMITTED',
          serviceDesk: { code: 'HR' },
        }),
      );

      await expect(
        transitionRequest('req-001', 'PROCUREMENT_IN_PROGRESS', {
          userId: 'user-001',
          userName: 'Test User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/only allowed for IT service desk/i);
    });

    it('allows PROCUREMENT_IN_PROGRESS on IT service desk', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'SUBMITTED',
          serviceDesk: { code: 'IT' },
        }),
      );

      const result = await transitionRequest('req-001', 'PROCUREMENT_IN_PROGRESS', {
        userId: 'user-001',
        userName: 'Test User',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 4. Role-based approval guards ──────────────────────────────────────

  describe('4. Role-based approval guards', () => {
    it('blocks CEO_APPROVED_IT by non-CEO user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_CEO_APPROVAL_IT' }),
      );

      await expect(
        transitionRequest('req-001', 'CEO_APPROVED_IT', {
          userId: 'user-001',
          userName: 'Regular User',
          metadata: { userRoles: ['AGENT'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only the CEO/i);
    });

    it('allows CEO_APPROVED_IT by CEO user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_CEO_APPROVAL_IT' }),
      );

      const result = await transitionRequest('req-001', 'CEO_APPROVED_IT', {
        userId: 'ceo-001',
        userName: 'CEO User',
        metadata: { userRoles: ['CEO'] },
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('blocks CTO_APPROVED_IT by non-CTO user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_CTO_APPROVAL_IT' }),
      );

      await expect(
        transitionRequest('req-001', 'CTO_APPROVED_IT', {
          userId: 'user-001',
          userName: 'Regular User',
          metadata: { userRoles: ['AGENT'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only the CTO/i);
    });

    it('blocks CFO_APPROVED_FIN by non-CFO user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_CFO_APPROVAL_FIN', serviceDesk: { code: 'FINANCE' } }),
      );

      await expect(
        transitionRequest('req-001', 'CFO_APPROVED_FIN', {
          userId: 'user-001',
          userName: 'Regular User',
          metadata: { userRoles: ['AGENT'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only the CFO/i);
    });

    it('allows CFO_APPROVED_FIN by admin without CFO role', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_CFO_APPROVAL_FIN', serviceDesk: { code: 'FINANCE' } }),
      );

      const result = await transitionRequest('req-001', 'CFO_APPROVED_FIN', {
        userId: 'admin-001',
        userName: 'Admin',
        userRole: 'ADMIN',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('blocks LOA_APPROVED by non-HIRING_MANAGER', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'LOA_PENDING_APPROVAL' }),
      );

      await expect(
        transitionRequest('req-001', 'LOA_APPROVED', {
          userId: 'user-001',
          userName: 'HR Agent',
          metadata: { userRoles: ['AGENT'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only a Hiring Manager/i);
    });
  });

  // ── 5. LOA preconditions ───────────────────────────────────────────────

  describe('5. LOA preconditions', () => {
    it('blocks LOA_APPROVED→LOA_ISSUED without approved LOA', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'LOA_APPROVED',
          letterOfAcceptance: { approvedBy: null },
        }),
      );

      await expect(
        transitionRequest('req-001', 'LOA_ISSUED', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/LOA must be approved/i);
    });

    it('allows LOA_APPROVED→LOA_ISSUED with approved LOA', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'LOA_APPROVED',
          letterOfAcceptance: { approvedBy: 'mgr-001' },
        }),
      );

      const result = await transitionRequest('req-001', 'LOA_ISSUED', {
        userId: 'user-001',
        userName: 'HR Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('blocks LOA_ISSUED→LOA_ACCEPTED without signed LOA', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'LOA_ISSUED',
          letterOfAcceptance: { signedLoaFileUrl: null },
        }),
      );

      await expect(
        transitionRequest('req-001', 'LOA_ACCEPTED', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/Signed LOA must be uploaded/i);
    });

    it('allows LOA_ISSUED→LOA_ACCEPTED with signed LOA', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'LOA_ISSUED',
          letterOfAcceptance: { signedLoaFileUrl: 's3://loa/signed.pdf' },
        }),
      );

      const result = await transitionRequest('req-001', 'LOA_ACCEPTED', {
        userId: 'user-001',
        userName: 'HR Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 6. Onboarding completion guard ─────────────────────────────────────

  describe('6. Onboarding completion guard', () => {
    it('blocks ONBOARDING_COMPLETED with pending tasks', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'ONBOARDING_MONTH_3_MILESTONE' }),
      );
      mockPrisma.onboardingRequest.findUnique.mockResolvedValue({
        id: 'ob-001',
        tasks: [
          { status: 'COMPLETED' },
          { status: 'PENDING' },
        ],
      });

      await expect(
        transitionRequest('req-001', 'ONBOARDING_COMPLETED', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/task.*still incomplete/i);
    });

    it('allows ONBOARDING_COMPLETED with all tasks done', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'ONBOARDING_MONTH_3_MILESTONE' }),
      );
      mockPrisma.onboardingRequest.findUnique.mockResolvedValue({
        id: 'ob-001',
        tasks: [
          { status: 'COMPLETED' },
          { status: 'COMPLETED' },
        ],
      });

      const result = await transitionRequest('req-001', 'ONBOARDING_COMPLETED', {
        userId: 'user-001',
        userName: 'HR Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('allows ONBOARDING_COMPLETED with no tasks', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'ONBOARDING_MONTH_3_MILESTONE' }),
      );
      mockPrisma.onboardingRequest.findUnique.mockResolvedValue({
        id: 'ob-001',
        tasks: [],
      });

      const result = await transitionRequest('req-001', 'ONBOARDING_COMPLETED', {
        userId: 'user-001',
        userName: 'HR Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 7. Offboarding phase guards ────────────────────────────────────────

  describe('7. Offboarding phase guards', () => {
    it('blocks OFFBOARDING_FINAL_WEEK without resignation letter', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'OFFBOARDING_KNOWLEDGE_TRANSFER' }),
      );
      mockPrisma.offboardingRequest.findUnique.mockResolvedValue({
        resignationLetterAttached: false,
        exitInterviewScheduledDate: new Date(),
      });

      await expect(
        transitionRequest('req-001', 'OFFBOARDING_FINAL_WEEK', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/resignation letter must be attached/i);
    });

    it('blocks OFFBOARDING_FINAL_WEEK without exit interview scheduled', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'OFFBOARDING_KNOWLEDGE_TRANSFER' }),
      );
      mockPrisma.offboardingRequest.findUnique.mockResolvedValue({
        resignationLetterAttached: true,
        exitInterviewScheduledDate: null,
      });

      await expect(
        transitionRequest('req-001', 'OFFBOARDING_FINAL_WEEK', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/exit interview date must be scheduled/i);
    });

    it('allows OFFBOARDING_FINAL_WEEK with both preconditions met', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'OFFBOARDING_KNOWLEDGE_TRANSFER' }),
      );
      mockPrisma.offboardingRequest.findUnique.mockResolvedValue({
        resignationLetterAttached: true,
        exitInterviewScheduledDate: new Date(),
      });

      const result = await transitionRequest('req-001', 'OFFBOARDING_FINAL_WEEK', {
        userId: 'user-001',
        userName: 'HR Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('blocks OFFBOARDING_COMPLETED without EXIT_PROCEDURES phase', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'OFFBOARDING_EXIT_PROCEDURES' }),
      );
      mockPrisma.offboardingRequest.findUnique.mockResolvedValue({
        currentPhase: 'FINAL_WEEK',
        tasks: [],
      });

      await expect(
        transitionRequest('req-001', 'OFFBOARDING_COMPLETED', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/all phases must be completed/i);
    });

    it('blocks OFFBOARDING_COMPLETED with pending tasks', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'OFFBOARDING_EXIT_PROCEDURES' }),
      );
      mockPrisma.offboardingRequest.findUnique.mockResolvedValue({
        currentPhase: 'EXIT_PROCEDURES',
        tasks: [
          { status: 'COMPLETED' },
          { status: 'PENDING' },
        ],
      });

      await expect(
        transitionRequest('req-001', 'OFFBOARDING_COMPLETED', {
          userId: 'user-001',
          userName: 'HR Agent',
          skipValidation: true,
        }),
      ).rejects.toThrow(/task.*still incomplete/i);
    });

    it('allows OFFBOARDING_COMPLETED at EXIT_PROCEDURES with all tasks done', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'OFFBOARDING_EXIT_PROCEDURES' }),
      );
      mockPrisma.offboardingRequest.findUnique.mockResolvedValue({
        currentPhase: 'EXIT_PROCEDURES',
        tasks: [{ status: 'COMPLETED' }],
      });

      const result = await transitionRequest('req-001', 'OFFBOARDING_COMPLETED', {
        userId: 'user-001',
        userName: 'HR Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 9. Finance service-desk guard ──────────────────────────────────────

  describe('9. Finance service-desk guard', () => {
    it('blocks FINANCE_ACKNOWLEDGED on non-FINANCE service desk', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'SUBMITTED',
          serviceDesk: { code: 'IT' },
        }),
      );

      await expect(
        transitionRequest('req-001', 'FINANCE_ACKNOWLEDGED', {
          userId: 'user-001',
          userName: 'Test User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/only allowed for FINANCE or ESM service desk/i);
    });

    it('allows FINANCE_ACKNOWLEDGED on FINANCE service desk', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'SUBMITTED',
          serviceDesk: { code: 'FINANCE' },
        }),
      );

      const result = await transitionRequest('req-001', 'FINANCE_ACKNOWLEDGED', {
        userId: 'user-001',
        userName: 'Test User',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('blocks PENDING_CFO_APPROVAL_FIN on IT service desk', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'FINANCE_ACKNOWLEDGED',
          serviceDesk: { code: 'IT' },
        }),
      );

      await expect(
        transitionRequest('req-001', 'PENDING_CFO_APPROVAL_FIN', {
          userId: 'user-001',
          userName: 'Test User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/only allowed for FINANCE or ESM service desk/i);
    });
  });

  // ── 10. Finance assignment guard ──────────────────────────────────────

  describe('10. Finance assignment guard', () => {
    it('blocks FINANCE_IN_PROGRESS→TICKET_CLOSED_FIN by non-assigned user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'FINANCE_IN_PROGRESS',
          assignedToId: 'agent-001',
          serviceDesk: { code: 'FINANCE' },
        }),
      );

      await expect(
        transitionRequest('req-001', 'TICKET_CLOSED_FIN', {
          userId: 'other-user',
          userName: 'Other User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only the assigned agent or admin/i);
    });

    it('allows FINANCE_IN_PROGRESS→TICKET_CLOSED_FIN by assigned user', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'FINANCE_IN_PROGRESS',
          assignedToId: 'agent-001',
          serviceDesk: { code: 'FINANCE' },
        }),
      );

      const result = await transitionRequest('req-001', 'TICKET_CLOSED_FIN', {
        userId: 'agent-001',
        userName: 'Assigned Agent',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('allows FINANCE_IN_PROGRESS→TICKET_CLOSED_FIN by admin', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({
          status: 'FINANCE_IN_PROGRESS',
          assignedToId: 'agent-001',
          serviceDesk: { code: 'FINANCE' },
        }),
      );

      const result = await transitionRequest('req-001', 'TICKET_CLOSED_FIN', {
        userId: 'admin-001',
        userName: 'Admin',
        userRole: 'ADMIN',
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 11. Manager & Finance Head role guards ──────────────────────────────

  describe('11. Manager & Finance Head role guards', () => {
    it('blocks MANAGER_APPROVED_FIN by non-Manager', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_MANAGER_APPROVAL_FIN', serviceDesk: { code: 'FINANCE' } }),
      );

      await expect(
        transitionRequest('req-001', 'MANAGER_APPROVED_FIN', {
          userId: 'user-001',
          userName: 'Regular User',
          metadata: { userRoles: ['AGENT'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only a Manager/i);
    });

    it('allows MANAGER_APPROVED_FIN by Manager', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_MANAGER_APPROVAL_FIN', serviceDesk: { code: 'FINANCE' } }),
      );

      const result = await transitionRequest('req-001', 'MANAGER_APPROVED_FIN', {
        userId: 'mgr-001',
        userName: 'Manager User',
        metadata: { userRoles: ['MANAGER'] },
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('blocks FINANCE_HEAD_APPROVED by non-Finance-Head', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_FINANCE_HEAD_APPROVAL', serviceDesk: { code: 'FINANCE' } }),
      );

      await expect(
        transitionRequest('req-001', 'FINANCE_HEAD_APPROVED', {
          userId: 'user-001',
          userName: 'Regular User',
          metadata: { userRoles: ['AGENT'] },
          skipValidation: true,
        }),
      ).rejects.toThrow(/Only the Finance Head or CFO/i);
    });

    it('allows FINANCE_HEAD_APPROVED by Finance Head', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_FINANCE_HEAD_APPROVAL', serviceDesk: { code: 'FINANCE' } }),
      );

      const result = await transitionRequest('req-001', 'FINANCE_HEAD_APPROVED', {
        userId: 'fh-001',
        userName: 'Finance Head',
        metadata: { userRoles: ['FINANCE_HEAD'] },
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });

    it('allows FINANCE_HEAD_APPROVED by CFO (CFO can act as Finance Head)', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'PENDING_FINANCE_HEAD_APPROVAL', serviceDesk: { code: 'FINANCE' } }),
      );

      const result = await transitionRequest('req-001', 'FINANCE_HEAD_APPROVED', {
        userId: 'cfo-001',
        userName: 'CFO User',
        metadata: { userRoles: ['CFO'] },
        skipValidation: true,
        skipNotifications: true,
        skipSlaPause: true,
        skipAutoAssignment: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ── 8. Custom guard registration ───────────────────────────────────────

  describe('8. Custom guard registration', () => {
    it('supports registering additional guards at runtime', async () => {
      // Register a custom guard that always blocks
      registerTransitionGuard('IN_REVIEW→IN_PROGRESS', async () =>
        'Custom block: test guard',
      );

      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'IN_REVIEW' }),
      );

      await expect(
        transitionRequest('req-001', 'IN_PROGRESS', {
          userId: 'user-001',
          userName: 'Test User',
          skipValidation: true,
        }),
      ).rejects.toThrow(/Custom block: test guard/i);
    });
  });

  // ── 8. HTTP error mapping (AppError with correct status codes) ────────

  describe('8. Transition error mapping to AppError', () => {
    it('throws AppError 404 when the request does not exist', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(null);
      const { transitionRequest: tr } = await import('../requestTransition.service');

      await expect(
        tr('missing', 'RESOLVED', { userName: 'Test' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws AppError 422 for an invalid transition', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'SUBMITTED' }),
      );
      // The transitionValidation module is mocked, so the error comes from the mock's
      // isValidTransition returning false, which triggers the AppError.
      // We set skipValidation: false to exercise the validation path.
      const { transitionRequest: tr } = await import('../requestTransition.service');

      await expect(
        tr('req-001', 'PAYMENT_COMPLETED', { userName: 'Test', skipValidation: false }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('throws AppError 403 when a guard blocks', async () => {
      mockPrisma.request.findUnique.mockResolvedValue(
        makeRequest({ status: 'SUBMITTED', serviceDesk: { code: 'HR' } }),
      );
      const { transitionRequest: tr } = await import('../requestTransition.service');

      await expect(
        tr('req-001', 'PROCUREMENT_IN_PROGRESS', { userName: 'Test', skipValidation: true }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});