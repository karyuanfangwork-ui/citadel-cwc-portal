/**
 * LOS-004 — direct-ID application access must honour the caller's RM scope.
 */
import { requireApplicationAccess } from '../applicationAccess.middleware';
import { AppError } from '../../../middleware/error.middleware';
import prisma from '../../../utils/prisma';

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    creditApplication: { findFirst: jest.fn() },
  },
}));

const mockedFindFirst = (prisma as unknown as {
  creditApplication: { findFirst: jest.Mock };
}).creditApplication.findFirst;

const APP_ID = '11111111-1111-4111-8111-111111111111';
const RM_SCOPE = { OR: [{ assignedRmId: 'rm-1' }, { assignedAnalystId: 'rm-1' }] };

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { applicationId: APP_ID },
    query: {},
    user: { id: 'rm-1', roles: [], permissions: ['credit:read'] },
    rmScopeFilter: RM_SCOPE,
    ...overrides,
  } as any;
}

describe('requireApplicationAccess', () => {
  it('passes through for a bypass (admin) caller without querying', async () => {
    const next = jest.fn();
    await requireApplicationAccess()(makeReq({ rmScopeFilter: undefined }), {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it('allows an in-scope application', async () => {
    mockedFindFirst.mockResolvedValueOnce({ id: APP_ID });
    const next = jest.fn();
    await requireApplicationAccess()(makeReq(), {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(mockedFindFirst).toHaveBeenCalledWith({
      where: { id: APP_ID, deletedAt: null, AND: [RM_SCOPE] },
      select: { id: true },
    });
  });

  it('returns 404 for an out-of-scope application', async () => {
    mockedFindFirst.mockResolvedValueOnce(null);
    const next = jest.fn();
    await requireApplicationAccess()(makeReq(), {} as any, next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Credit application not found');
  });

  it('skips non-UUID params so literal subpaths are unaffected', async () => {
    const next = jest.fn();
    await requireApplicationAccess()(
      makeReq({ params: { applicationId: 'draft' } }), {} as any, next,
    );
    expect(next).toHaveBeenCalledWith();
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it('falls back to the :id param name', async () => {
    mockedFindFirst.mockResolvedValueOnce({ id: APP_ID });
    const next = jest.fn();
    await requireApplicationAccess()(makeReq({ params: { id: APP_ID } }), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('fails closed with 500 when the scope query throws', async () => {
    mockedFindFirst.mockRejectedValueOnce(new Error('db down'));
    const next = jest.fn();
    await requireApplicationAccess()(makeReq(), {} as any, next);
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(500);
  });
});