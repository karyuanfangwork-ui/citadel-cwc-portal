import { Response } from 'express';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { tenantService } from '../services/tenant.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { TenantPlan } from '@prisma/client';

const VALID_PLANS: string[] = Object.values(TenantPlan);

/**
 * List all tenants (admin only).
 * GET /api/v1/tenants
 */
export const listTenants = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const tenants = await tenantService.listTenants();
  res.json({ data: tenants });
});

/**
 * Get a single tenant by ID.
 * GET /api/v1/tenants/:id
 */
export const getTenant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const tenant = await tenantService.getTenant(id);
  if (!tenant) {
    throw new AppError('Tenant not found', 404);
  }
  res.json({ data: tenant });
});

/**
 * Create a new tenant (admin only).
 * POST /api/v1/tenants
 */
export const createTenant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, slug, plan, isActive } = req.body;

  if (!name || !slug) {
    throw new AppError('name and slug are required', 400);
  }

  if (plan && !VALID_PLANS.includes(plan)) {
    throw new AppError(`Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}`, 400);
  }

  const tenant = await tenantService.createTenant({
    name,
    slug,
    plan: plan as TenantPlan | undefined,
    isActive,
  });

  res.status(201).json({ data: tenant });
});

/**
 * Update a tenant.
 * PUT /api/v1/tenants/:id
 */
export const updateTenant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, slug, plan, isActive } = req.body;

  if (plan && !VALID_PLANS.includes(plan)) {
    throw new AppError(`Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}`, 400);
  }

  const tenant = await tenantService.updateTenant(id, {
    name,
    slug,
    plan: plan as TenantPlan | undefined,
    isActive,
  });

  res.json({ data: tenant });
});

/**
 * Deactivate a tenant (soft delete).
 * DELETE /api/v1/tenants/:id
 */
export const deactivateTenant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  await tenantService.deactivateTenant(id);
  res.json({ data: { id, deactivated: true } });
});

/**
 * Get tenant statistics.
 * GET /api/v1/tenants/:id/stats
 */
export const getTenantStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const tenant = await tenantService.getTenant(id);
  if (!tenant) {
    throw new AppError('Tenant not found', 404);
  }
  const stats = await tenantService.getTenantStats(id);
  res.json({ data: stats });
});