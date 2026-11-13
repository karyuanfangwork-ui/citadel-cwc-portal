import { Request, Response } from 'express';

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    request: { findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    requestApproval: { count: jest.fn() },
    user: { findFirst: jest.fn() },
    requestActivity: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import prisma from '../utils/prisma';
import { putHrExecutiveApproverChoice } from '../controllers/hrExecutiveChoice.controller';

const db = prisma as jest.Mocked<typeof prisma>;
const request = {
  id: '00000000-0000-0000-0000-000000000010', tenantId: '00000000-0000-0000-0000-000000000001',
  requesterId: '00000000-0000-0000-0000-000000000002', status: 'SUBMITTED', version: 1,
  executiveApproverId: null, executiveApproverRole: null, requestType: { code: 'NEW_HIRING' },
};
const body = { executiveApproverId: '00000000-0000-0000-0000-000000000003', executiveApproverRole: 'GROUP_DCEO', version: 1 };
const actor = { id: request.requesterId, tenantId: request.tenantId, firstName: 'Requester', lastName: 'Test' };

async function invoke(overrides: Record<string, unknown> = {}) {
  const req = { params: { id: request.id }, body: { ...body }, user: { ...actor }, ...overrides } as unknown as Request;
  const res = { json: jest.fn() } as unknown as Response;
  let error: any;
  await putHrExecutiveApproverChoice(req, res, (e: any) => { error = e; });
  await new Promise(resolve => setImmediate(resolve));
  return { error, res };
}

beforeEach(() => {
  jest.clearAllMocks();
  (db.request.findFirst as jest.Mock).mockResolvedValue(request);
  (db.requestApproval.count as jest.Mock).mockResolvedValue(0);
  (db.user.findFirst as jest.Mock).mockResolvedValue({ id: body.executiveApproverId, firstName: 'Alain', lastName: 'Test' });
  (db.request.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  (db.request.findUnique as jest.Mock).mockResolvedValue({ ...request, executiveApproverId: body.executiveApproverId, executiveApproverRole: body.executiveApproverRole, version: 2 });
  (db.$transaction as jest.Mock).mockImplementation((fn: any) => fn(db));
});

test('requester selects an eligible executive with version CAS and audit in one transaction', async () => {
  const { error, res } = await invoke();
  expect(error).toBeUndefined();
  expect(db.request.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ id: request.id, tenantId: request.tenantId, version: 1, status: 'SUBMITTED' }),
    data: expect.objectContaining({ executiveApproverId: body.executiveApproverId, executiveApproverRole: 'GROUP_DCEO', version: { increment: 1 } }),
  }));
  expect(db.requestActivity.create).toHaveBeenCalled();
  expect((res.json as jest.Mock)).toHaveBeenCalled();
});

test.each([
  ['non-requester', { user: { ...actor, id: '00000000-0000-0000-0000-000000000011' } }, 403],
  ['self-selection', { body: { ...body, executiveApproverId: actor.id } }, 422],
  ['stale version', { body: { ...body, version: 2 } }, 409],
  ['invalid role', { body: { ...body, executiveApproverRole: 'CFO' } }, 400],
])('%s is rejected without mutation', async (_name, overrides, status) => {
  const { error } = await invoke(overrides);
  expect(error?.statusCode).toBe(status);
  expect(db.request.updateMany).not.toHaveBeenCalled();
});

test('missing target or already-routed request is rejected', async () => {
  (db.user.findFirst as jest.Mock).mockResolvedValue(null);
  expect((await invoke()).error?.statusCode).toBe(422);
  (db.request.findFirst as jest.Mock).mockResolvedValue({ ...request, status: 'PENDING_CEO_APPROVAL' });
  expect((await invoke()).error?.statusCode).toBe(409);
});

test('racing route prevents choice write via CAS and rolls back audit', async () => {
  (db.request.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  expect((await invoke()).error?.statusCode).toBe(409);
  expect(db.requestActivity.create).not.toHaveBeenCalled();
});
