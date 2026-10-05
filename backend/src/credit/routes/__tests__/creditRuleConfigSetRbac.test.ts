import express from 'express';
import request from 'supertest';

let currentUser: { id: string; email: string; tenantId: string; permissions: string[] } | null = null;

jest.mock('../../../middleware/auth.middleware', () => {
  const actual = jest.requireActual('../../../middleware/auth.middleware');
  const { AppError } = jest.requireActual('../../../middleware/error.middleware');
  return {
    __esModule: true,
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      if (!currentUser) return next(new AppError('Not authenticated', 401));
      req.user = { ...currentUser, roles: [] };
      next();
    },
  };
});

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditRuleConfig: {
      findUnique: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', kind: 'REQUIRED_FIELD', isActive: false, configSetId: null }),
      create: jest.fn().mockResolvedValue({ id: 'rule-new', kind: 'REQUIRED_FIELD', isActive: false }),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('../../services/creditRuleConfigSet.service', () => ({
  creditRuleConfigSetService: {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' }),
    create: jest.fn().mockResolvedValue({ id: 'new-set' }),
    submit: jest.fn().mockResolvedValue({ id: 'set' }),
    approve: jest.fn().mockResolvedValue({ id: 'set' }),
    activate: jest.fn().mockResolvedValue({ id: 'set' }),
  },
}));

import creditRuleConfigRoutes from '../creditRuleConfig.routes';
import { errorHandler } from '../../../middleware/error.middleware';
import prisma from '../../../utils/prisma';
import { creditRuleConfigSetService } from '../../services/creditRuleConfigSet.service';

const id = '11111111-1111-4111-8111-111111111111';
const mutations: Array<[string, string, Record<string, unknown>?]> = [
  ['post', '/credit/rule-config-sets', { reason: 'Policy review change', rules: [{ fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: true, sortOrder: 10 }] }],
  ['post', `/credit/rule-config-sets/${id}/submit`, {}],
  ['post', `/credit/rule-config-sets/${id}/approve`, {}],
  ['post', `/credit/rule-config-sets/${id}/activate`, { policyApprovalReference: 'POLICY-12345' }],
];

function app() {
  const server = express();
  server.use(express.json());
  server.use('/credit', creditRuleConfigRoutes);
  server.use(errorHandler);
  return server;
}

describe('required-field rule-set route authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
  });

  it('requires authentication to list sets', async () => {
    const response = await request(app()).get('/credit/rule-config-sets');
    expect(response.status).toBe(401);
  });

  it('requires credit:admin to list and read sets', async () => {
    currentUser = { id: 'user-1', email: 'user@example.test', tenantId: 'tenant-1', permissions: ['credit:read'] };
    expect((await request(app()).get('/credit/rule-config-sets')).status).toBe(403);
    expect((await request(app()).get(`/credit/rule-config-sets/${id}`)).status).toBe(403);
    expect(creditRuleConfigSetService.list).not.toHaveBeenCalled();
    expect(creditRuleConfigSetService.get).not.toHaveBeenCalled();
  });

  it.each(mutations)('%s %s requires credit:admin', async (method, path, body) => {
    currentUser = { id: 'user-1', email: 'user@example.test', tenantId: 'tenant-1', permissions: ['credit:read', 'credit:write'] };
    const response = await (request(app()) as any)[method](path).send(body ?? {});
    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/credit:admin/);
  });

  it('allows an administrator through the permission gate', async () => {
    currentUser = { id: 'admin-1', email: 'admin@example.test', tenantId: 'tenant-1', permissions: ['credit:admin'] };
    const response = await request(app()).post(`/credit/rule-config-sets/${id}/activate`).send({ policyApprovalReference: 'POLICY-12345' });
    expect(response.status).toBe(200);
    expect(creditRuleConfigSetService.activate).toHaveBeenCalledWith(id, expect.objectContaining({
      actorId: 'admin-1', actorEmail: 'admin@example.test', tenantId: 'tenant-1',
    }), 'POLICY-12345');
  });

  it('blocks direct activation through legacy required-field CRUD', async () => {
    currentUser = { id: 'admin-1', email: 'admin@example.test', tenantId: 'tenant-1', permissions: ['credit:admin'] };
    const response = await request(app()).patch(`/credit/rule-configs/${id}`).send({ isActive: true });
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/governed rule-set version/i);
    expect(prisma.creditRuleConfig.update).not.toHaveBeenCalled();
  });

  it('preserves required-field candidates from legacy deletion', async () => {
    currentUser = { id: 'admin-1', email: 'admin@example.test', tenantId: 'tenant-1', permissions: ['credit:admin'] };
    const response = await request(app()).delete(`/credit/rule-configs/${id}`);
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/cannot be deleted/i);
    expect(prisma.creditRuleConfig.delete).not.toHaveBeenCalled();
  });

  it('forces directly created required-field rules to remain inactive', async () => {
    currentUser = { id: 'admin-1', email: 'admin@example.test', tenantId: 'tenant-1', permissions: ['credit:admin'] };
    const response = await request(app()).post('/credit/rule-configs').send({
      kind: 'REQUIRED_FIELD', fieldPath: 'purpose', fieldLabel: 'Purpose', isMandatory: true, sortOrder: 10, isActive: true,
    });
    expect(response.status).toBe(201);
    expect(prisma.creditRuleConfig.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: 'REQUIRED_FIELD', isActive: false }),
    }));
  });
});
