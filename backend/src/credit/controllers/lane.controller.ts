/**
 * P2-2: Lane Controller
 *
 * API endpoints for processing lane determination and tab configuration.
 */

import { Request, Response } from 'express';
import { determineLaneWithConfig, getLaneTabs, persistLane, getRequiredApproverCount } from '../services/lane.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /applications/:id/lane
 * Returns the current lane for an application, re-evaluating if needed.
 * Uses DB-configurable thresholds via determineLaneWithConfig().
 */
export const getApplicationLane = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const app = await prisma.creditApplication.findUnique({
    where: { id },
    include: {
      borrowerProfile: {
        select: { borrowerType: true, annualTurnover: true },
      },
    },
  });

  if (!app) {
    return res.status(404).json({ status: 'error', message: 'Application not found' });
  }

  // Re-evaluate lane (uses DB-configurable thresholds)
  const determination = await determineLaneWithConfig(
    app.borrowerProfile?.borrowerType ?? 'CORPORATE',
    app.requestedAmount.toString(),
    app.borrowerProfile?.annualTurnover?.toString() ?? null,
  );

  res.json({
    status: 'success',
    data: {
      applicationId: app.id,
      lane: determination.lane,
      reason: determination.reason,
      requiredApproverCount: getRequiredApproverCount(determination.lane),
      persistedLane: app.lane,
    },
  });
};

/**
 * POST /applications/:id/lane
 * Re-evaluate and persist the lane for an application.
 */
export const reEvaluateLane = async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const determination = await persistLane(id);
    res.json({
      status: 'success',
      data: {
        applicationId: id,
        lane: determination.lane,
        reason: determination.reason,
        requiredApproverCount: getRequiredApproverCount(determination.lane),
      },
    });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ status: 'error', message: err.message });
    }
    throw err;
  }
};

/**
 * GET /applications/:id/tabs
 * Returns the tab list for an application filtered by lane + feature flags.
 */
export const getApplicationTabs = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const app = await prisma.creditApplication.findUnique({
    where: { id },
    include: {
      borrowerProfile: {
        select: { borrowerType: true, annualTurnover: true },
      },
    },
  });

  if (!app) {
    return res.status(404).json({ status: 'error', message: 'Application not found' });
  }

  // Determine lane using DB-configurable thresholds
  const determination = await determineLaneWithConfig(
    app.borrowerProfile?.borrowerType ?? 'CORPORATE',
    app.requestedAmount.toString(),
    app.borrowerProfile?.annualTurnover?.toString() ?? null,
  );

  // Fetch feature flags
  const flags = await prisma.featureFlag.findMany({
    where: { category: 'credit' },
    select: { key: true, enabled: true },
  });
  const featureFlags: Record<string, boolean> = {};
  for (const f of flags) {
    featureFlags[f.key] = f.enabled;
  }

  // Get tab list
  const tabs = getLaneTabs(determination.lane, featureFlags);

  res.json({
    status: 'success',
    data: {
      applicationId: app.id,
      lane: determination.lane,
      reason: determination.reason,
      tabs,
      featureFlags,
    },
  });
};