/**
 * §6.2 — Credit Policy Limit Enforcement Service
 *
 * Manages credit policy limits (single-borrower, sector, product concentration)
 * and evaluates applications against active limits.
 *
 * Hard block = exceeds maxValue → cannot submit
 * Soft warning = exceeds thresholdPct × maxValue → can submit with justification
 */

import { PolicyLimitType, ApplicationState } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { toBase } from './fxRate.service';

import prisma from '../../utils/prisma';

export interface PolicyEvaluationResult {
  blocks: PolicyBlock[];
  warnings: PolicyBlock[];
}

export interface PolicyBlock {
  limitId: string;
  limitType: PolicyLimitType;
  label: string;
  maxValue: number;
  currentValue: number;
  thresholdValue: number;
  proposedValue: number;
  severity: 'HARD' | 'SOFT';
  message: string;
}

const ACTIVE_STATES: ApplicationState[] = [
  'APPROVED' as ApplicationState,
  'OFFER' as ApplicationState,
  'ACCEPTED' as ApplicationState,
  'DISBURSED' as ApplicationState,
  'ACTIVE' as ApplicationState,
];

class PolicyLimitService {

  // ── CRUD ───────────────────────────────────────────────────────────

  async createLimit(data: {
    type: PolicyLimitType;
    label: string;
    maxValue: number;
    thresholdPct?: number;
    currency?: string;
    sector?: string;
    productType?: string;
    createdById: string;
  }) {
    if (data.type === 'SECTOR' && !data.sector) {
      throw new AppError('Sector is required for SECTOR type limits', 400);
    }
    if (data.type === 'PRODUCT' && !data.productType) {
      throw new AppError('Product type is required for PRODUCT type limits', 400);
    }
    return prisma.creditPolicyLimit.create({
      data: {
        type: data.type,
        label: data.label,
        maxValue: data.maxValue,
        thresholdPct: data.thresholdPct ?? 80,
        currency: data.currency ?? 'MYR',
        sector: data.sector,
        productType: data.productType,
        createdById: data.createdById,
      },
    });
  }

  async listLimits(filters?: { type?: PolicyLimitType; isActive?: boolean }) {
    const where: Record<string, unknown> = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    return prisma.creditPolicyLimit.findMany({
      where,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLimit(id: string) {
    const limit = await prisma.creditPolicyLimit.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!limit) throw new AppError('Policy limit not found', 404);
    return limit;
  }

  async updateLimit(id: string, data: {
    label?: string;
    maxValue?: number;
    thresholdPct?: number;
    isActive?: boolean;
    sector?: string | null;
    productType?: string | null;
  }) {
    await this.getLimit(id);
    return prisma.creditPolicyLimit.update({ where: { id }, data });
  }

  async deleteLimit(id: string) {
    await this.getLimit(id);
    return prisma.creditPolicyLimit.delete({ where: { id } });
  }

  // ── Enforcement ─────────────────────────────────────────────────────

  async evaluatePolicy(applicationId: string): Promise<PolicyEvaluationResult> {
    const appRaw = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        borrowerProfile: { select: { id: true, industry: true } },
        facilities: { select: { approvedAmount: true, amount: true } },
      },
    });
    if (!appRaw) throw new AppError('Application not found', 404);

    const app = appRaw as any;
    const appCurrency: string = app.currency ?? 'MYR';

    // §F23 — Convert proposed amount to base currency
    let proposedAmount = 0;
    for (const f of app.facilities as any[]) {
      const facCurrency: string = appCurrency; // Application-level currency
      const effectiveAmount = Number(f.approvedAmount ?? f.amount);
      proposedAmount += await toBase(effectiveAmount, facCurrency);
    }

    const blocks: PolicyBlock[] = [];
    const warnings: PolicyBlock[] = [];

    // 1) SINGLE_BORROWER limits
    const borrowerLimits = await prisma.creditPolicyLimit.findMany({
      where: { type: 'SINGLE_BORROWER', isActive: true },
    });
    if (borrowerLimits.length > 0 && app.borrowerProfileId) {
      const existing = await this.getExistingExposure(app.borrowerProfileId, applicationId);
      const total = existing + proposedAmount;
      for (const limit of borrowerLimits) {
        const hit = this.checkLimit(limit.id, 'SINGLE_BORROWER', limit.label, Number(limit.maxValue), Number(limit.thresholdPct), existing, total);
        if (hit.message) { hit.severity === 'HARD' ? blocks.push(hit) : warnings.push(hit); }
      }
    }

    // 2) SECTOR limits — sector comes from BorrowerProfile.industry
    const industry = app.borrowerProfile?.industry as string | null | undefined;
    if (industry) {
      const sectorLimits = await prisma.creditPolicyLimit.findMany({
        where: { type: 'SECTOR', sector: industry, isActive: true },
      });
      if (sectorLimits.length > 0) {
        const sectorExp = await this.getSectorExposure(industry, applicationId);
        const total = sectorExp + proposedAmount;
        for (const limit of sectorLimits) {
          const hit = this.checkLimit(limit.id, limit.type, limit.label, Number(limit.maxValue), Number(limit.thresholdPct), sectorExp, total);
          if (hit.message) { hit.severity === 'HARD' ? blocks.push(hit) : warnings.push(hit); }
        }
      }
    }

    // 3) PRODUCT limits
    if (app.productType) {
      const productLimits = await prisma.creditPolicyLimit.findMany({
        where: { type: 'PRODUCT', productType: app.productType as string, isActive: true },
      });
      if (productLimits.length > 0) {
        const productExp = await this.getProductExposure(app.productType as string, applicationId);
        const total = productExp + proposedAmount;
        for (const limit of productLimits) {
          const hit = this.checkLimit(limit.id, limit.type, limit.label, Number(limit.maxValue), Number(limit.thresholdPct), productExp, total);
          if (hit.message) { hit.severity === 'HARD' ? blocks.push(hit) : warnings.push(hit); }
        }
      }
    }

    return { blocks, warnings };
  }

  async isHardBlocked(applicationId: string): Promise<boolean> {
    const result = await this.evaluatePolicy(applicationId);
    return result.blocks.length > 0;
  }

  // ── Exposure helpers ────────────────────────────────────────────────

  private async getExistingExposure(borrowerProfileId: string, excludeId: string): Promise<number> {
    const facilities = await prisma.applicationFacility.findMany({
      where: {
        application: { borrowerProfileId, state: { in: ACTIVE_STATES }, id: { not: excludeId }, deletedAt: null },
      },
      select: { approvedAmount: true, amount: true, application: { select: { currency: true } } },
    });
    let total = 0;
    for (const f of facilities) {
      const currency: string = (f.application as any)?.currency ?? 'MYR';
      const effectiveAmount = Number(f.approvedAmount ?? f.amount);
      total += await toBase(effectiveAmount, currency);
    }
    return total;
  }

  private async getSectorExposure(industry: string, excludeId: string): Promise<number> {
    // Find all active borrowerProfiles in this industry
    const profiles = await prisma.borrowerProfile.findMany({
      where: { industry, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const profileIds = profiles.map(p => p.id);
    if (profileIds.length === 0) return 0;

    const facilities = await prisma.applicationFacility.findMany({
      where: {
        application: { borrowerProfileId: { in: profileIds }, state: { in: ACTIVE_STATES }, id: { not: excludeId }, deletedAt: null },
      },
      select: { approvedAmount: true, amount: true, application: { select: { currency: true } } },
    });
    let total = 0;
    for (const f of facilities) {
      const currency: string = (f.application as any)?.currency ?? 'MYR';
      const effectiveAmount = Number(f.approvedAmount ?? f.amount);
      total += await toBase(effectiveAmount, currency);
    }
    return total;
  }

  private async getProductExposure(productType: string, excludeId: string): Promise<number> {
    const facilities = await prisma.applicationFacility.findMany({
      where: {
        application: { productType: productType as any, state: { in: ACTIVE_STATES }, id: { not: excludeId }, deletedAt: null },
      },
      select: { approvedAmount: true, amount: true, application: { select: { currency: true } } },
    });
    let total = 0;
    for (const f of facilities) {
      const currency: string = (f.application as any)?.currency ?? 'MYR';
      const effectiveAmount = Number(f.approvedAmount ?? f.amount);
      total += await toBase(effectiveAmount, currency);
    }
    return total;
  }

  private checkLimit(
    limitId: string,
    limitType: PolicyLimitType,
    label: string,
    maxValue: number,
    thresholdPct: number,
    currentValue: number,
    proposedValue: number,
  ): PolicyBlock {
    const thresholdValue = maxValue * (thresholdPct / 100);
    if (proposedValue > maxValue) {
      return {
        limitId, limitType, label, maxValue, currentValue, thresholdValue, proposedValue,
        severity: 'HARD',
        message: `${label}: Proposed ${this.fmt(proposedValue)} exceeds limit ${this.fmt(maxValue)} (current: ${this.fmt(currentValue)})`,
      };
    }
    if (proposedValue > thresholdValue) {
      return {
        limitId, limitType, label, maxValue, currentValue, thresholdValue, proposedValue,
        severity: 'SOFT',
        message: `${label}: Proposed ${this.fmt(proposedValue)} exceeds threshold ${this.fmt(thresholdValue)} (limit: ${this.fmt(maxValue)})`,
      };
    }
    return {
      limitId, limitType, label, maxValue, currentValue, thresholdValue, proposedValue,
      severity: 'SOFT', message: '',
    };
  }

  private fmt(n: number): string {
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);
  }
}

export const policyLimitService = new PolicyLimitService();