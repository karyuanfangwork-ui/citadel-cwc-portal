/**
 * monitor.notify.test.ts
 *
 * Integration-style unit tests for the monitor job's notification behaviour:
 *  - EWS creation for covenant breaches → notifyMultiple called with RM + CREDIT_MANAGER
 *  - EWS creation for overdue payments → notifyMultiple called with RM
 *  - EWS creation for overdue reviews → notifyMultiple called with RM
 *  - EWS creation for overdue conditions → notifyMultiple called with RM + CREDIT_MANAGER
 *  - FK-based deduplication (covenantId / conditionId) instead of description-contains match
 */

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    covenantDefinition: {
      findMany: jest.fn(),
    },
    covenantTest: {
      findFirst: jest.fn(),
    },
    paymentEvent: {
      findMany: jest.fn(),
    },
    facilityHealth: {
      findMany: jest.fn(),
    },
    condition: {
      findMany: jest.fn(),
    },
    earlyWarningSignal: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    creditApplication: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../services/notification.service', () => ({
  notifyMultiple: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../utils/redis', () => ({
  getRedisConnectionConfig: jest.fn(() => ({ host: 'localhost', port: 6379 })),
}));

import prisma from '../../../utils/prisma';
import { notifyMultiple } from '../../../services/notification.service';
import { processDailyCheck } from '../monitor.job';

const mockNotifyMultiple = notifyMultiple as jest.MockedFunction<typeof notifyMultiple>;

// Helper to create a mock covenant definition
function mockCovenant(overrides: Record<string, any> = {}) {
  return {
    id: 'covenant-1',
    applicationId: 'app-1',
    description: 'Debt Service Coverage Ratio',
    covenantType: 'DEBT_SERVICE_COVERAGE',
    metricKey: 'dscr',
    threshold: 1.25,
    frequency: 'QUARTERLY',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockCovenantTest(overrides: Record<string, any> = {}) {
  return {
    id: 'test-1',
    covenantId: 'covenant-1',
    testDate: new Date('2020-01-01'),
    reportedValue: 1.0,
    isCompliant: false,
    testedById: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function mockApplication(overrides: Record<string, any> = {}) {
  return {
    id: 'app-1',
    assignedRmId: 'rm-user-1',
    assignedAnalystId: 'analyst-user-1',
    decisions: [],
    ...overrides,
  };
}

function mockCondition(overrides: Record<string, any> = {}) {
  return {
    id: 'condition-1',
    applicationId: 'app-1',
    title: 'Submit audited financials',
    description: 'Must submit audited financial statements',
    category: 'PRE_DISBURSEMENT',
    conditionType: 'PRECEDENT',
    status: 'PENDING',
    dueDate: new Date('2020-01-01'), // past date = overdue
    isFulfilled: false,
    fulfilledAt: null,
    fulfilledById: null,
    fulfilmentNotes: null,
    waiverReason: null,
    waivedAt: null,
    waivedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    decisionId: null,
    ...overrides,
  };
}

describe('Monitor Job — EWS Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no existing EWS signals
    (prisma.earlyWarningSignal.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.earlyWarningSignal.create as jest.Mock).mockResolvedValue({ id: 'ews-1' });
  });

  describe('Covenant breach notifications', () => {
    it('should call notifyMultiple with RM + CREDIT_MANAGER users when a covenant breach EWS is created', async () => {
      const covenant = mockCovenant();
      const test = mockCovenantTest({ isCompliant: false });

      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([covenant]);
      (prisma.covenantTest.findFirst as jest.Mock).mockResolvedValue(test);
      (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication({ assignedRmId: 'rm-user-1' }),
      );
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'cm-user-1' },
      ]);
      // No overdue payments, reviews, or conditions
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]);

      await processDailyCheck();

      expect(prisma.earlyWarningSignal.create).toHaveBeenCalled();
      expect(mockNotifyMultiple).toHaveBeenCalled();

      // Find the call for the covenant breach
      const notifyCalls = mockNotifyMultiple.mock.calls;
      const covenantCall = notifyCalls.find(
        (call: any[]) => call[1] === 'credit_covenant_breach',
      );
      expect(covenantCall).toBeDefined();
      expect(covenantCall![0]).toContain('rm-user-1');
      expect(covenantCall![0]).toContain('cm-user-1');
    });

    it('should use covenantId for deduplication instead of description-contains match', async () => {
      const covenant = mockCovenant();
      const test = mockCovenantTest({ isCompliant: false });

      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([covenant]);
      (prisma.covenantTest.findFirst as jest.Mock).mockResolvedValue(test);
      (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication({ assignedRmId: 'rm-user-1' }),
      );
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]);

      await processDailyCheck();

      // The findFirst call should use covenantId instead of description.contains
      const findFirstCalls = (prisma.earlyWarningSignal.findFirst as jest.Mock).mock.calls;
      const covenantFindCall = findFirstCalls.find(
        (call: any[]) => call[0]?.where?.covenantId !== undefined,
      );
      expect(covenantFindCall).toBeDefined();
      // Should NOT use description contains for dedup
      const descriptionContainsCall = findFirstCalls.find(
        (call: any[]) => call[0]?.where?.description?.contains !== undefined,
      );
      expect(descriptionContainsCall).toBeUndefined();
    });
  });

  describe('Overdue payment notifications', () => {
    it('should notify RM when a payment overdue EWS is created', async () => {
      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([
        { id: 'pay-1', applicationId: 'app-1', status: 'LATE_90', amount: 50000 },
      ]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication({ assignedRmId: 'rm-user-1' }),
      );

      await processDailyCheck();

      const notifyCalls = mockNotifyMultiple.mock.calls;
      const paymentCall = notifyCalls.find(
        (call: any[]) => call[1] === 'credit_payment_overdue',
      );
      expect(paymentCall).toBeDefined();
      expect(paymentCall![0]).toContain('rm-user-1');
    });
  });

  describe('Overdue review notifications', () => {
    it('should notify RM when a review overdue EWS is created', async () => {
      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'fh-1',
          applicationId: 'app-1',
          nextReviewDate: new Date('2020-01-01'),
          healthStatus: 'WATCH',
        },
      ]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication({ assignedRmId: 'rm-user-1' }),
      );

      await processDailyCheck();

      const notifyCalls = mockNotifyMultiple.mock.calls;
      const reviewCall = notifyCalls.find(
        (call: any[]) => call[1] === 'credit_review_overdue',
      );
      expect(reviewCall).toBeDefined();
      expect(reviewCall![0]).toContain('rm-user-1');
    });
  });

  describe('Overdue condition notifications', () => {
    it('should create EWS and notify RM + CREDIT_MANAGER for overdue conditions', async () => {
      const condition = mockCondition();

      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([condition]);
      (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication({ assignedRmId: 'rm-user-1' }),
      );
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'cm-user-1' },
      ]);

      await processDailyCheck();

      // EWS with signalType CONDITION_OVERDUE should be created
      const createCalls = (prisma.earlyWarningSignal.create as jest.Mock).mock.calls;
      const conditionEwsCall = createCalls.find(
        (call: any[]) => call[0]?.data?.signalType === 'CONDITION_OVERDUE',
      );
      expect(conditionEwsCall).toBeDefined();
      expect(conditionEwsCall![0].data.conditionId).toBe('condition-1');

      // Notification should be sent to RM + CREDIT_MANAGER
      const notifyCalls = mockNotifyMultiple.mock.calls;
      const conditionCall = notifyCalls.find(
        (call: any[]) => call[1] === 'credit_condition_overdue',
      );
      expect(conditionCall).toBeDefined();
      expect(conditionCall![0]).toContain('rm-user-1');
      expect(conditionCall![0]).toContain('cm-user-1');
    });

    it('should not create EWS for fulfilled conditions', async () => {
      // A fulfilled condition would NOT match the Prisma query (isFulfilled: false),
      // so we return empty array to simulate that Prisma filters it out
      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]); // No overdue conditions returned

      await processDailyCheck();

      const createCalls = (prisma.earlyWarningSignal.create as jest.Mock).mock.calls;
      const conditionEwsCall = createCalls.find(
        (call: any[]) => call[0]?.data?.signalType === 'CONDITION_OVERDUE',
      );
      expect(conditionEwsCall).toBeUndefined();
    });

    it('should not create EWS for waived conditions', async () => {
      // A waived condition would NOT match the Prisma query (waivedAt: null),
      // so we return empty array to simulate that Prisma filters it out
      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]); // No overdue conditions returned

      await processDailyCheck();

      const createCalls = (prisma.earlyWarningSignal.create as jest.Mock).mock.calls;
      const conditionEwsCall = createCalls.find(
        (call: any[]) => call[0]?.data?.signalType === 'CONDITION_OVERDUE',
      );
      expect(conditionEwsCall).toBeUndefined();
    });

    it('should use conditionId for deduplication of condition EWS', async () => {
      const condition = mockCondition();

      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([condition]);
      (prisma.creditApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication({ assignedRmId: 'rm-user-1' }),
      );
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      await processDailyCheck();

      const findFirstCalls = (prisma.earlyWarningSignal.findFirst as jest.Mock).mock.calls;
      const conditionFindCall = findFirstCalls.find(
        (call: any[]) => call[0]?.where?.conditionId !== undefined,
      );
      expect(conditionFindCall).toBeDefined();
      expect(conditionFindCall![0].where.conditionId).toBe('condition-1');
    });
  });

  describe('Deduplication — FK-based', () => {
    it('should skip EWS creation when an open EWS already exists for the same covenantId', async () => {
      const covenant = mockCovenant();
      const test = mockCovenantTest({ isCompliant: false });

      // Simulate existing open EWS
      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([covenant]);
      (prisma.covenantTest.findFirst as jest.Mock).mockResolvedValue(test);
      (prisma.earlyWarningSignal.findFirst as jest.Mock).mockImplementation(
        (args: any) => {
          if (args.where.covenantId) return Promise.resolve({ id: 'existing-ews' });
          return Promise.resolve(null);
        },
      );
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([]);

      await processDailyCheck();

      // No new EWS should be created for this covenant
      const createCalls = (prisma.earlyWarningSignal.create as jest.Mock).mock.calls;
      const covenantCall = createCalls.find(
        (call: any[]) => call[0]?.data?.covenantId === 'covenant-1',
      );
      expect(covenantCall).toBeUndefined();
    });

    it('should skip EWS creation when an open EWS already exists for the same conditionId', async () => {
      const condition = mockCondition();

      (prisma.covenantDefinition.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.facilityHealth.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.condition.findMany as jest.Mock).mockResolvedValue([condition]);
      (prisma.earlyWarningSignal.findFirst as jest.Mock).mockImplementation(
        (args: any) => {
          if (args.where.conditionId) return Promise.resolve({ id: 'existing-ews' });
          return Promise.resolve(null);
        },
      );

      await processDailyCheck();

      const createCalls = (prisma.earlyWarningSignal.create as jest.Mock).mock.calls;
      const conditionCall = createCalls.find(
        (call: any[]) => call[0]?.data?.conditionId === 'condition-1',
      );
      expect(conditionCall).toBeUndefined();
    });
  });
});