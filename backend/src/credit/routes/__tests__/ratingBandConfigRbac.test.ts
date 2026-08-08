/**
 * LOS-003 — Rating band / risk factor mutation routes must require credit:admin.
 *
 * DB-free: a 403 is produced by requirePermission() before any controller or
 * Prisma call runs, so prisma is mocked to a throwing stub to prove we never
 * reach it on the denied paths.
 */
import express from 'express';
import request from 'supertest';

// Injected identity for the mocked authenticate middleware.
let currentUser: { id: string; permissions: string[] } | null = null;

jest.mock('../../../middleware/auth.middleware', () => {
  const actual = jest.requireActual('../../../middleware/auth.middleware');
  const { AppError } = jest.requireActual('../../../middleware/error.middleware');
  return {
    __esModule: true,
    ...actual,
    // requirePermission is taken from `actual` — it is the code under test.
    authenticate: (req: any, _res: any, next: any) => {
      if (!currentUser) return next(new AppError('Not authenticated', 401));
      req.user = { ...currentUser, roles: [] };
      next();
    },
  };
});

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get() {
      throw new Error('prisma must not be reached on a denied route');
    },
  }),
}));

import ratingBandConfigRoutes from '../ratingBandConfig.routes';
import { errorHandler } from '../../../middleware/error.middleware';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/rating-bands', ratingBandConfigRoutes);
  app.use(errorHandler);
  return app;
}

const MUTATIONS: Array<[string, string]> = [
  ['post', '/rating-bands'],
  ['patch', '/rating-bands/11111111-1111-4111-8111-111111111111'],
  ['post', '/rating-bands/seed'],
  ['post', '/rating-bands/risk-factors'],
];

describe('LOS-003 rating band config RBAC', () => {
  it.each(MUTATIONS)('%s %s returns 403 without credit:admin', async (method, path) => {
    currentUser = { id: 'u1', permissions: ['credit:read', 'credit:write', 'credit:approve'] };
    const res = await (request(buildApp()) as any)[method](path).send({});
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/credit:admin/);
  });

  it.each(MUTATIONS)('%s %s passes the permission gate with credit:admin', async (method, path) => {
    currentUser = { id: 'u1', permissions: ['credit:admin'] };
    const res = await (request(buildApp()) as any)[method](path).send({});
    // The gate is passed; the request then reaches the controller and fails on
    // the throwing prisma stub (500) or on controller validation (400).
    // The contract asserted here is only: it is not a 403.
    expect(res.status).not.toBe(403);
  });
});