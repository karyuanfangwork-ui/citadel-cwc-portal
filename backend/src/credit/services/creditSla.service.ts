import prisma from '../../utils/prisma';
import { ApplicationState } from '@prisma/client';
import { AuditChainService } from './auditChain.service';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// §2.2 — Credit SLA Policy Service
// ---------------------------------------------------------------------------
// Provides CRUD for SLA policies, SLA due-date calculation per application,
// breach detection, and notification/escalation when SLAs are breached.
// ---------------------------------------------------------------------------

interface CreateSlaPolicyInput {
  name: string;
  description?: string;
  targetState: string;
  slaHours: number;
  notifyRoles: string[];
  escalateAfterHours?: number;
  escalateToState?: string;
  productType?: string;
}

interface UpdateSlaPolicyInput {
  name?: string;
  description?: string;
  slaHours?: number;
  notifyRoles?: string[];
  escalateAfterHours?: number | null;
  escalateToState?: string | null;
  productType?: string | null;
  isActive?: boolean;
}

class CreditSlaService {
  // -------------------------------------------------------------------------
  // Policy CRUD
  // -------------------------------------------------------------------------

  async createPolicy(data: CreateSlaPolicyInput) {
    return prisma.creditSlaPolicy.create({ data });
  }

  async updatePolicy(id: string, data: UpdateSlaPolicyInput) {
    return prisma.creditSlaPolicy.update({ where: { id }, data });
  }

  async deletePolicy(id: string) {
    return prisma.creditSlaPolicy.update({ where: { id }, data: { isActive: false } });
  }

  async getPolicy(id: string) {
    return prisma.creditSlaPolicy.findUnique({ where: { id } });
  }

  async listPolicies(filters?: { targetState?: string; productType?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters?.targetState) where.targetState = filters.targetState;
    if (filters?.productType) where.productType = filters.productType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    return prisma.creditSlaPolicy.findMany({ where, orderBy: { targetState: 'asc' } });
  }

  // -------------------------------------------------------------------------
  // SLA due-date calculation
  // -------------------------------------------------------------------------

  /**
   * Compute the SLA deadline for a given application by finding matching policies
   * and returning the earliest due date.
   */
  async computeSlaDueDate(applicationId: string): Promise<Date | null> {
    const app = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { state: true, productType: true, createdAt: true },
    });
    if (!app) return null;

    // Find all active policies matching this state and product type
    const policies = await prisma.creditSlaPolicy.findMany({
      where: {
        targetState: app.state,
        isActive: true,
        OR: [
          { productType: null },           // global policy
          { productType: app.productType }, // product-specific policy
        ],
      },
      orderBy: { slaHours: 'asc' }, // most urgent first
    });

    if (policies.length === 0) return null;

    // Use the shortest SLA as the due date
    const minHours = policies[0].slaHours;
    const dueDate = new Date(app.createdAt.getTime() + minHours * 60 * 60 * 1000);
    return dueDate;
  }

  // -------------------------------------------------------------------------
  // Breach detection (called by the 15-min cron)
  // -------------------------------------------------------------------------

  /**
   * Check all active applications for SLA breaches.
   * For each breached policy, create a CreditSlaBreach record and notify.
   * Returns the number of new breaches detected.
   */
  async checkAndRecordBreaches(): Promise<number> {
    const now = new Date();
    let breachCount = 0;

    // Get all active SLA policies
    const policies = await prisma.creditSlaPolicy.findMany({
      where: { isActive: true },
    });

    for (const policy of policies) {
      // §3.1 — Branch-specific SLA hour overrides
      const branchOverrides = await prisma.creditSlaPolicyBranchOverride.findMany({
        where: { policyId: policy.id, isActive: true },
      });
      const overrideByBranch = new Map(branchOverrides.map(o => [o.branchId, o.slaHours]));

      // Candidate applications in the target state not yet breached for this policy
      const candidateApps = await prisma.creditApplication.findMany({
        where: {
          state: policy.targetState as ApplicationState,
          deletedAt: null,
          // Exclude applications that already have an un-resolved breach for this policy
          slaBreaches: {
            none: {
              policyId: policy.id,
              resolvedAt: null,
            },
          },
        },
        select: { id: true, applicationNo: true, branchId: true, createdAt: true, productType: true },
      });

      const breachedApps = candidateApps.filter(app => {
        const branchOverrideHours = app.branchId ? overrideByBranch.get(app.branchId) : undefined;
        const effectiveSlaHours = branchOverrideHours ?? policy.slaHours;
        const slaDeadline = new Date(now.getTime() - effectiveSlaHours * 60 * 60 * 1000);
        return app.createdAt <= slaDeadline;
      });

      for (const app of breachedApps) {
        // Product type filter — skip if policy is product-specific and doesn't match
        if (policy.productType && app.productType !== policy.productType) continue;

        try {
          await prisma.creditSlaBreach.create({
            data: {
              applicationId: app.id,
              policyId: policy.id,
              breachedAt: now,
            },
          });

          // Create audit event
          await AuditChainService.appendEvent(
            app.id,
            'SLA_BREACH',
            null, // system-generated
            `sla_breach_${policy.targetState.toLowerCase()}`,
            policy.targetState,
            policy.targetState,
            {
              policyId: policy.id,
              policyName: policy.name,
              slaHours: policy.slaHours,
              breachedAt: now.toISOString(),
            },
          );

          logger.warn(`[§2.2] SLA breach detected: app ${app.applicationNo}, policy ${policy.name}`);
          breachCount++;
        } catch (err: any) {
          // Unique constraint — breach already recorded
          if (err.code === 'P2002') continue;
          throw err;
        }
      }
    }

    return breachCount;
  }

  // -------------------------------------------------------------------------
  // Escalation (called by the 15-min cron after breach detection)
  // -------------------------------------------------------------------------

  /**
   * Check for breaches where escalation after-hours has elapsed and auto-escalate.
   * Returns the number of escalated applications.
   */
  async processEscalations(): Promise<number> {
    let escalationCount = 0;

    // Find un-escalated breaches where the policy has escalation configured
    const breaches = await prisma.creditSlaBreach.findMany({
      where: {
        escalatedAt: null, // not yet escalated
        resolvedAt: null,  // not yet resolved
        policy: {
          escalateAfterHours: { not: null },
          escalateToState: { not: null },
          isActive: true,
        },
      },
      include: {
        policy: true,
        application: { select: { id: true, state: true, applicationNo: true } },
      },
    });

    const now = new Date();

    for (const breach of breaches) {
      const escalateAfterMs = (breach.policy.escalateAfterHours ?? 0) * 60 * 60 * 1000;
      const escalationDeadline = new Date(breach.breachedAt.getTime() + escalateAfterMs);

      if (now < escalationDeadline) continue; // not time yet

      const escalateToState = breach.policy.escalateToState;
      if (!escalateToState) continue;

      // Advance the application state
      await prisma.creditApplication.update({
        where: { id: breach.applicationId },
        data: { state: escalateToState as ApplicationState },
      });

      // Mark breach as escalated
      await prisma.creditSlaBreach.update({
        where: { id: breach.id },
        data: {
          escalatedAt: now,
          escalationNotifiedAt: now,
        },
      });

      // Create audit event
      await AuditChainService.appendEvent(
        breach.applicationId,
        'SLA_ESCALATION',
        null, // system-generated
        `sla_escalation_to_${escalateToState.toLowerCase()}`,
        breach.application.state,
        escalateToState,
        {
          policyId: breach.policyId,
          policyName: breach.policy.name,
          breachedAt: breach.breachedAt.toISOString(),
          escalatedAt: now.toISOString(),
          notifyRoles: breach.policy.notifyRoles,
        },
      );

      logger.info(`[§2.2] SLA escalation: app ${breach.application.applicationNo} escalated to ${escalateToState}`);
      escalationCount++;
    }

    return escalationCount;
  }

  // -------------------------------------------------------------------------
  // Breach management
  // -------------------------------------------------------------------------

  /** Acknowledge a breach — marks that someone has seen it */
  async acknowledgeBreach(breachId: string, _userId: string) {
    return prisma.creditSlaBreach.update({
      where: { id: breachId },
      data: { acknowledgedAt: new Date() },
    });
  }

  /** Resolve a breach — marks it as addressed */
  async resolveBreach(breachId: string) {
    return prisma.creditSlaBreach.update({
      where: { id: breachId },
      data: { resolvedAt: new Date() },
    });
  }

  /** Get all active (un-resolved) breaches for a given application */
  async getApplicationBreaches(applicationId: string) {
    return prisma.creditSlaBreach.findMany({
      where: { applicationId, resolvedAt: null },
      include: { policy: true },
      orderBy: { breachedAt: 'desc' },
    });
  }

  /** Get all active breaches across the system (for dashboard) */
  async getAllActiveBreaches() {
    return prisma.creditSlaBreach.findMany({
      where: { resolvedAt: null },
      include: {
        policy: true,
        application: {
          select: {
            id: true,
            applicationNo: true,
            state: true,
            borrowerProfile: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { breachedAt: 'asc' },
    });
  }
}

export const creditSlaService = new CreditSlaService();