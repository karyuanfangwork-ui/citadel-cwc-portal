import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { escalationRuleController } from '../escalationRule.controller';

jest.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    role: { findMany: jest.fn() },
    escalationRule: { create: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('../../utils/redis', () => ({
  createRedisClient: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
  })),
}));
jest.mock('../../utils/logger', () => ({ logger: { warn: jest.fn() } }));

const mockPrisma = prisma as unknown as {
  role: { findMany: jest.Mock };
  escalationRule: { create: jest.Mock; findMany: jest.Mock };
};

function makeResponse(done: () => void) {
  const response: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockImplementation(() => done()),
  };
  return response;
}

function run(handler: any, body: any = {}, query: any = {}) {
  return new Promise<{ response: any; next: jest.Mock }>((resolve) => {
    let response: any;
    const next = jest.fn(() => resolve({ response, next }));
    response = makeResponse(() => resolve({ response, next }));
    handler({ body, query, params: {} }, response, next);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.role.findMany.mockResolvedValue([{ name: 'DYNAMIC_ROLE' }]);
});

describe('escalation rule controller', () => {
  it('accepts a role loaded from the database and rejects unknown roles', async () => {
    mockPrisma.escalationRule.create.mockResolvedValue({ id: 'rule-1' });
    const accepted = await run(escalationRuleController.create, {
      requestTypeId: 'type-1', triggerHoursAfterBreach: 4, notifyRoles: ['DYNAMIC_ROLE'],
    });
    expect(accepted.response.status).toHaveBeenCalledWith(201);

    const rejected = await run(escalationRuleController.create, {
      requestTypeId: 'type-1', triggerHoursAfterBreach: 8, notifyRoles: ['UNKNOWN_ROLE'],
    });
    expect(rejected.response.status).toHaveBeenCalledWith(400);
    expect(rejected.response.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('valid role names') }));
  });

  it('returns 409 when the database reports a duplicate trigger', async () => {
    mockPrisma.escalationRule.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '5.22.0' }));
    const result = await run(escalationRuleController.create, {
      requestTypeId: 'type-1', triggerHoursAfterBreach: 4, notifyRoles: ['DYNAMIC_ROLE'],
    });
    expect(result.response.status).toHaveBeenCalledWith(409);
  });

  it('returns overview rules with nested request type details and server filters', async () => {
    mockPrisma.escalationRule.findMany.mockResolvedValue([{ id: 'rule-1', requestType: { id: 'type-1' } }]);
    const result = await run(escalationRuleController.listOverview, {}, { deskId: 'desk-1', categoryId: 'category-1' });
    expect(mockPrisma.escalationRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requestType: { serviceCategoryId: 'category-1', serviceCategory: { serviceDeskId: 'desk-1' } } },
      include: expect.objectContaining({ requestType: expect.any(Object) }),
      orderBy: { triggerHoursAfterBreach: 'asc' },
    }));
    expect(result.response.json).toHaveBeenCalledWith({ data: { rules: [{ id: 'rule-1', requestType: { id: 'type-1' } }] } });
  });
});
