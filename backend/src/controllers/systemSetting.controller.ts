import { Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';

const EMAIL_ENABLED_KEY = 'email_notifications_enabled';

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

let _cacheInvalidator: (() => void) | null = null;
export function registerEmailEnabledCacheInvalidator(fn: () => void) {
  _cacheInvalidator = fn;
}
function invalidateEmailEnabledCache() {
  _cacheInvalidator?.();
}
