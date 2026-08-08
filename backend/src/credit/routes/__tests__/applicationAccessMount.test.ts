/**
 * LOS-004 — the parent-level mount must guard nested application routers,
 * not just GET /applications/:id.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: { creditApplication: { findFirst: jest.fn() } },
}));

import prisma from '../../../utils/prisma';
import { applyRmScope } from '../../middleware/rmScope.middleware';
import { requireApplicationAccess } from '../../middleware/applicationAccess.middleware';
import { errorHandler } from '../../../middleware/error.middleware';

const mockedFindFirst = (prisma as unknown as {
  creditApplication: { findFirst: jest.Mock };
}).creditApplication.findFirst;

const APP_ID = '11111111-1111-4111-8111-111111111111';

function buildApp(user: { id: string; roles: string[]; permissions: string[] }) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.user = user; next(); });

  // Mirrors the mount order used in credit.routes.ts:
  // Guard mounted once at /applications/:applicationId
  app.use('/applications/:applicationId', applyRmScope(), requireApplicationAccess());

  // Nested application router mounted at /applications (same as production).
  // /draft must be declared before /:id to avoid being shadowed by the param route.
  const applicationRoutes = express.Router();
  applicationRoutes.get('/draft', (_req, res) => { res.json({ draft: true }); });
  applicationRoutes.get('/:id', (_req, res) => { res.json({ ok: true }); });
  applicationRoutes.get('/:applicationId/facilities', (_req, res) => { res.json({ facilities: true }); });
  app.use('/applications', applicationRoutes);

  app.use(errorHandler);
  return app;
}

const RM = { id: 'rm-1', roles: ['CREDIT_RM'], permissions: ['credit:read'] };
const ADMIN = { id: 'admin-1', roles: ['CREDIT_ADMIN'], permissions: ['credit:read', 'credit:admin'] };

describe('LOS-004 parent mount', () => {
  it('blocks an out-of-scope nested resource with 404', async () => {
    mockedFindFirst.mockResolvedValueOnce(null);
    const res = await request(buildApp(RM)).get(`/applications/${APP_ID}/facilities`);
    expect(res.status).toBe(404);
  });

  it('blocks an out-of-scope detail read with 404', async () => {
    mockedFindFirst.mockResolvedValueOnce(null);
    const res = await request(buildApp(RM)).get(`/applications/${APP_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.ok).toBeUndefined();
  });

  it('allows an in-scope read', async () => {
    mockedFindFirst.mockResolvedValueOnce({ id: APP_ID });
    const res = await request(buildApp(RM)).get(`/applications/${APP_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('does not query scope for an admin caller', async () => {
    const res = await request(buildApp(ADMIN)).get(`/applications/${APP_ID}`);
    expect(res.status).toBe(200);
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it('leaves the literal /applications/draft path working', async () => {
    // 'draft' is not a UUID, so the guard passes it through without querying.
    // Express matches /applications/draft against the guard mount at
    // /applications/:applicationId but requireApplicationAccess skips the
    // query because 'draft' fails the UUID regex check.
    const res = await request(buildApp(RM)).get('/applications/draft');
    expect(res.status).toBe(200);
    expect(res.body.draft).toBe(true);
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });
});