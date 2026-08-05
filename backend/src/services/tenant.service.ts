import prisma from '../utils/prisma';
import { Tenant, TenantPlan } from '@prisma/client';

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: TenantPlan;
  isActive?: boolean;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  plan?: TenantPlan;
  isActive?: boolean;
}

class TenantService {
  /**
   * Get all tenants (admin only).
   */
  async listTenants(): Promise<Tenant[]> {
    return prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * Get a tenant by ID.
   */
  async getTenant(id: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { id } });
  }

  /**
   * Get a tenant by slug.
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { slug } });
  }

  /**
   * Create a new tenant.
   */
  async createTenant(data: CreateTenantInput): Promise<Tenant> {
    return prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan: data.plan ?? 'FREE',
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update a tenant.
   */
  async updateTenant(id: string, data: UpdateTenantInput): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-delete (deactivate) a tenant.
   */
  async deactivateTenant(id: string): Promise<Tenant> {
    return prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get tenant statistics — user count and request count.
   */
  async getTenantStats(id: string): Promise<{
    userCount: number;
    requestCount: number;
  }> {
    const [userCount, requestCount] = await Promise.all([
      prisma.user.count({ where: { tenantId: id } }),
      prisma.request.count({ where: { tenantId: id } }),
    ]);
    return { userCount, requestCount };
  }
}

export const tenantService = new TenantService();