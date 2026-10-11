import { Response } from 'express';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { AuthRequest, hasRole } from '../middleware/auth.middleware';
import { principalFromAuth } from '../security/resource-scope.service';
import { getAgentDashboard } from '../services/agent-dashboard.service';
import { AgentDashboardValidatedQuery } from '../validators/agent-dashboard.validator';

export const getAgentDashboardController = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!hasRole(req, 'AGENT', 'ADMIN')) throw new AppError('Agent dashboard access is restricted to agents and admins', 403);
  const query = req.query as unknown as AgentDashboardValidatedQuery;
  const roles = req.user!.roles;
  if (query.scope === 'accessible' && !roles.includes('ADMIN')) throw new AppError('All accessible work is an admin scope', 403);
  if (query.scope === 'team' && (!roles.includes('AGENT') || !req.user!.agentTeam)) throw new AppError('My team scope is unavailable', 403);
  if (query.queue === 'unassigned' && query.scope === 'mine') throw new AppError('Unassigned work is not available in My work scope', 403);
  const data = await getAgentDashboard(principalFromAuth(req.user!), {
    ...query,
    limit: query.limit as 25 | 50 | 100,
  });
  res.json({ status: 'success', data });
});
