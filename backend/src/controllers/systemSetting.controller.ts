import { Response } from 'express';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';

const EMAIL_ENABLED_KEY = 'email_notifications_enabled';
const ONBOARDING_IT_AGENT_KEY = 'onboarding_it_agent_user_id';

export const getEmailNotificationsEnabled = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: EMAIL_ENABLED_KEY } });
  const enabled = setting ? setting.value === 'true' : true;
  res.json({ success: true, data: { enabled } });
});

export const setEmailNotificationsEnabled = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ success: false, message: '`enabled` must be a boolean' });
    return;
  }
  await prisma.systemSetting.upsert({
    where: { key: EMAIL_ENABLED_KEY },
    create: { key: EMAIL_ENABLED_KEY, value: String(enabled) },
    update: { value: String(enabled) },
  });
  invalidateEmailEnabledCache();
  res.json({ success: true, data: { enabled } });
});

/**
 * GET /admin/system-settings/onboarding-it-agent
 * Returns the user ID of the dedicated IT agent for onboarding notifications,
 * plus the user details for display. Returns null if not configured.
 */
export const getOnboardingItAgent = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: ONBOARDING_IT_AGENT_KEY } });
  let agent = null;
  if (setting && setting.value) {
    agent = await prisma.user.findUnique({
      where: { id: setting.value },
      select: { id: true, firstName: true, lastName: true, email: true, agentTeam: true },
    });
  }
  res.json({ success: true, data: { agent } });
});

/**
 * PUT /admin/system-settings/onboarding-it-agent
 * Body: { userId: string }
 * Sets the dedicated IT agent for onboarding notifications.
 * Validates that the user is an active IT team agent with AGENT or ADMIN role.
 */
export const setOnboardingItAgent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    throw new AppError('userId is required', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true, agentTeam: true, isActive: true,
      roles: { include: { role: { select: { name: true } } } } },
  });

  if (!user) throw new AppError('User not found', 404);
  if (!user.isActive) throw new AppError('User is not active', 400);
  if (user.agentTeam?.toUpperCase() !== 'IT') throw new AppError('User is not in the IT team', 400);

  const hasRole = user.roles.some(ur => ['AGENT', 'ADMIN'].includes(ur.role.name));
  if (!hasRole) throw new AppError('User must have AGENT or ADMIN role', 400);

  await prisma.systemSetting.upsert({
    where: { key: ONBOARDING_IT_AGENT_KEY },
    create: { key: ONBOARDING_IT_AGENT_KEY, value: userId },
    update: { value: userId },
  });

  res.json({
    success: true,
    data: {
      agent: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, agentTeam: user.agentTeam },
    },
  });
});

let _cacheInvalidator: (() => void) | null = null;
export function registerEmailEnabledCacheInvalidator(fn: () => void) {
  _cacheInvalidator = fn;
}
function invalidateEmailEnabledCache() {
  _cacheInvalidator?.();
}
