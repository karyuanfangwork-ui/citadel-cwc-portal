import express from 'express';
import request from 'supertest';

let mockCurrentUser: { id: string; email: string; tenantId: string; permissions: string[] } | null = null;
const mockController = {
  approveVersion: jest.fn((req: any, res: any) => res.json({ status: 'ok', action: 'approve', id: req.params.id })),
  activateVersion: jest.fn((req: any, res: any) => res.json({ status: 'ok', action: 'activate', body: req.body })),
};

jest.mock('../../../middleware/auth.middleware', () => {
  const actual = jest.requireActual('../../../middleware/auth.middleware');
  const { AppError } = jest.requireActual('../../../middleware/error.middleware');
  return {
    __esModule: true,
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      if (!mockCurrentUser) return next(new AppError('Not authenticated', 401));
      req.user = { ...mockCurrentUser, roles: [] };
      next();
    },
  };
});

jest.mock('../../controllers/scorecard.controller', () => ({
  scorecardController: mockController,
}));

import scorecardVersionRoutes from '../scorecardVersion.routes';
import { errorHandler } from '../../../middleware/error.middleware';

const versionId = '11111111-1111-4111-8111-111111111111';
function app() {
  const server = express();
  server.use(express.json());
  server.use('/scorecard-versions', scorecardVersionRoutes);
  server.use(errorHandler);
  return server;
}

describe('scorecard version governance routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
  });

  it('requires authentication and credit:admin for lifecycle transitions', async () => {
    expect((await request(app()).post(`/scorecard-versions/${versionId}/approve`)).status).toBe(401);
    mockCurrentUser = { id: 'reader-1', email: 'reader@example.test', tenantId: 'tenant-1', permissions: ['credit:read'] };
    expect((await request(app()).post(`/scorecard-versions/${versionId}/approve`)).status).toBe(403);
    expect((await request(app()).post(`/scorecard-versions/${versionId}/activate`).send({})).status).toBe(403);
    expect(mockController.approveVersion).not.toHaveBeenCalled();
    expect(mockController.activateVersion).not.toHaveBeenCalled();
  });

  it('validates policy reference and market_conditions acknowledgment before activation', async () => {
    mockCurrentUser = { id: 'admin-1', email: 'admin@example.test', tenantId: 'tenant-1', permissions: ['credit:admin'] };
    const invalid = await request(app()).post(`/scorecard-versions/${versionId}/activate`).send({
      policyApprovalReference: 'POLICY-12345', marketConditionsAcknowledged: false,
    });
    expect(invalid.status).toBe(400);
    expect(mockController.activateVersion).not.toHaveBeenCalled();

    const valid = await request(app()).post(`/scorecard-versions/${versionId}/activate`).send({
      policyApprovalReference: 'POLICY-12345', marketConditionsAcknowledged: true,
    });
    expect(valid.status).toBe(200);
    expect(mockController.activateVersion).toHaveBeenCalledTimes(1);
  });
});
