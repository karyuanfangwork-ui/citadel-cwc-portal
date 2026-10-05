import express from 'express';
import request from 'supertest';

let currentUser: { id: string; permissions: string[] } | null = null;

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

jest.mock('../../services/configHealth.service', () => ({
  checkCreditConfigurationHealth: jest.fn(),
}));

import configurationReadinessRoutes from '../configurationReadiness.routes';
import { checkCreditConfigurationHealth } from '../../services/configHealth.service';
import { errorHandler } from '../../../middleware/error.middleware';

function buildApp() {
  const app = express();
  app.use('/configuration-readiness', configurationReadinessRoutes);
  app.use(errorHandler);
  return app;
}

describe('credit configuration readiness route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = null;
  });

  it('requires authentication', async () => {
    const response = await request(buildApp()).get('/configuration-readiness/');

    expect(response.status).toBe(401);
    expect(checkCreditConfigurationHealth).not.toHaveBeenCalled();
  });

  it('requires credit:admin and does not query readiness for unauthorized credit users', async () => {
    currentUser = { id: 'user-1', permissions: ['credit:read'] };

    const response = await request(buildApp()).get('/configuration-readiness/');

    expect(response.status).toBe(403);
    expect(checkCreditConfigurationHealth).not.toHaveBeenCalled();
  });

  it('returns read-only readiness data to credit admins', async () => {
    const readiness = { ready: false, checks: [{ name: 'rating-bands', ok: false, status: 'BLOCKED', severity: 'BLOCKING', observed: 0 }] };
    currentUser = { id: 'admin-1', permissions: ['credit:admin'] };
    (checkCreditConfigurationHealth as jest.Mock).mockResolvedValue(readiness);

    const response = await request(buildApp()).get('/configuration-readiness/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'success', data: readiness });
    expect(checkCreditConfigurationHealth).toHaveBeenCalledTimes(1);
  });
});
