import prisma from '../../utils/prisma';
import type { BorrowerType, CreditProductType, ProcessingLane } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { PlatformAuditChainService } from '../../services/platformAuditChain.service';

const REQUIRED_FIELD_SET_NAME = 'Credit Required Fields';
const db = prisma as any;

type RuleSetContext = {
  tenantId: string;
  actorId: string;
  actorEmail: string;
  departmentId?: string | null;
  correlationId?: string | null;
};

export type RequiredFieldRuleInput = {
  fieldPath: string;
  fieldLabel: string;
  isMandatory: boolean;
  sortOrder: number;
  productType?: CreditProductType | null;
  lane?: ProcessingLane | null;
  borrowerType?: BorrowerType | null;
};

function requireAuditContext(context: RuleSetContext): void {
  if (!context.tenantId || !context.actorId || !context.actorEmail) {
    throw new AppError('Tenant and authenticated actor context are required for rule-set governance.', 500);
  }
}

function normalizedScope(rule: RequiredFieldRuleInput) {
  return {
    productType: rule.productType ?? null,
    lane: rule.lane ?? null,
    borrowerType: rule.borrowerType ?? null,
  };
}

function scopesOverlap(a: RequiredFieldRuleInput, b: RequiredFieldRuleInput): boolean {
  const left = normalizedScope(a);
  const right = normalizedScope(b);
  return (['productType', 'lane', 'borrowerType'] as const)
    .every((key) => left[key] === null || right[key] === null || left[key] === right[key]);
}

export function validateRequiredFieldRuleSet(rules: RequiredFieldRuleInput[]): string[] {
  const errors: string[] = [];
  if (rules.length === 0) return ['A required-field rule set must contain at least one rule.'];
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (!rule.fieldPath.trim() || !rule.fieldLabel.trim()) {
      errors.push(`Rule ${i + 1} must have a field path and label.`);
    }
    for (let j = 0; j < i; j += 1) {
      const prior = rules[j];
      if (prior.fieldPath === rule.fieldPath && scopesOverlap(prior, rule)) {
        errors.push(`Field ${rule.fieldPath} has overlapping scope definitions.`);
      }
    }
  }
  return errors;
}

type PersistedRequiredFieldRule = {
  kind: string;
  fieldPath: string | null;
  fieldLabel: string | null;
  isMandatory: boolean;
  sortOrder: number;
  productType: CreditProductType | null;
  lane: ProcessingLane | null;
  borrowerType: BorrowerType | null;
};

function validatePersistedRequiredFieldRuleSet(rules: PersistedRequiredFieldRule[]): string[] {
  const malformed = rules.some((rule) =>
    rule.kind !== 'REQUIRED_FIELD' || rule.fieldPath === null || rule.fieldLabel === null,
  );
  if (malformed) return ['The managed set contains a non-required-field rule or a rule missing its path or label.'];
  return validateRequiredFieldRuleSet(rules.map((rule) => ({
    fieldPath: rule.fieldPath as string,
    fieldLabel: rule.fieldLabel as string,
    isMandatory: rule.isMandatory,
    sortOrder: rule.sortOrder,
    productType: rule.productType,
    lane: rule.lane,
    borrowerType: rule.borrowerType,
  })));
}

function auditInput(
  context: RuleSetContext,
  action: string,
  resourceId: string,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown>,
  tx?: any,
) {
  return PlatformAuditChainService.appendEvent({
    tenantId: context.tenantId,
    departmentId: context.departmentId,
    actorId: context.actorId,
    actorEmail: context.actorEmail,
    action,
    resourceType: 'CreditRuleConfigSet',
    resourceId,
    correlationId: context.correlationId,
    oldValues,
    newValues,
  }, tx);
}

export class CreditRuleConfigSetService {
  async list() {
    return db.creditRuleConfigSet.findMany({
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      include: { rules: { orderBy: [{ sortOrder: 'asc' }, { fieldPath: 'asc' }] } },
    });
  }

  async get(id: string) {
    const set = await db.creditRuleConfigSet.findUnique({
      where: { id },
      include: { rules: { orderBy: [{ sortOrder: 'asc' }, { fieldPath: 'asc' }] } },
    });
    if (!set) throw new AppError('Required-field rule set not found.', 404);
    return set;
  }

  async create(input: { reason: string; rules: RequiredFieldRuleInput[] }, context: RuleSetContext) {
    requireAuditContext(context);
    const errors = validateRequiredFieldRuleSet(input.rules);
    if (errors.length > 0) throw new AppError(errors.join(' '), 400);
    if (!input.reason.trim()) throw new AppError('A change reason is required.', 400);

    return prisma.$transaction(async (tx) => {
      const latest = await tx.creditRuleConfigSet.findFirst({
        where: { name: REQUIRED_FIELD_SET_NAME },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const set = await tx.creditRuleConfigSet.create({
        data: {
          name: REQUIRED_FIELD_SET_NAME,
          version: (latest?.version ?? 0) + 1,
          status: 'DRAFT',
          reason: input.reason.trim(),
          createdById: context.actorId,
          effectiveFrom: new Date(),
        },
      });

      const ruleIds: string[] = [];
      const linkedExistingRuleIds: string[] = [];
      const preservedUnlinkedCandidateRuleIds: string[] = [];
      for (const rule of input.rules) {
        const scope = normalizedScope(rule);
        const matchingDrafts = await tx.creditRuleConfig.findMany({
          where: {
            kind: 'REQUIRED_FIELD',
            fieldPath: rule.fieldPath,
            productType: scope.productType,
            lane: scope.lane,
            borrowerType: scope.borrowerType,
            configSetId: null,
          },
          select: { id: true, fieldLabel: true, isMandatory: true, sortOrder: true, isActive: true },
        });
        if (matchingDrafts.some((row: any) => row.isActive)) {
          throw new AppError(`Field ${rule.fieldPath} already has an active unmanaged rule; review it before creating a managed set.`, 409);
        }
        const existing = matchingDrafts.length === 1 ? matchingDrafts[0] : undefined;
        const canLinkExisting = existing
          && existing.fieldLabel === rule.fieldLabel
          && existing.isMandatory === rule.isMandatory
          && existing.sortOrder === rule.sortOrder;
        if (canLinkExisting) {
          const linked = await tx.creditRuleConfig.update({
            where: { id: existing.id },
            data: { configSetId: set.id },
            select: { id: true },
          });
          ruleIds.push(linked.id);
          linkedExistingRuleIds.push(linked.id);
        } else {
          preservedUnlinkedCandidateRuleIds.push(...matchingDrafts.map((row: { id: string }) => row.id));
          const created = await tx.creditRuleConfig.create({
            data: {
              kind: 'REQUIRED_FIELD',
              ...scope,
              fieldPath: rule.fieldPath,
              fieldLabel: rule.fieldLabel,
              isMandatory: rule.isMandatory,
              sortOrder: rule.sortOrder,
              isActive: false,
              configSetId: set.id,
            },
            select: { id: true },
          });
          ruleIds.push(created.id);
        }
      }

      await auditInput(context, 'CREDIT_REQUIRED_FIELD_SET_CREATED', set.id, null, {
        status: 'DRAFT',
        version: set.version,
        reason: set.reason,
        ruleIds,
        linkedExistingRuleIds,
        preservedUnlinkedCandidateRuleIds,
        proposalSource: 'human-authored-versioned-proposal',
        candidateHandling: 'Link only exact-scope/content matches; preserve other candidates without changing their state or inferring prior actor attribution.',
      }, tx);

      return tx.creditRuleConfigSet.findUnique({
        where: { id: set.id },
        include: { rules: { orderBy: [{ sortOrder: 'asc' }, { fieldPath: 'asc' }] } },
      });
    });
  }

  async submit(id: string, context: RuleSetContext) {
    requireAuditContext(context);
    return prisma.$transaction(async (tx) => {
      const set = await tx.creditRuleConfigSet.findUnique({ where: { id }, include: { rules: true } });
      if (!set) throw new AppError('Required-field rule set not found.', 404);
      if (set.status !== 'DRAFT') throw new AppError('Only a DRAFT rule set can be submitted.', 409);
      if (set.createdById !== context.actorId) throw new AppError('Only the rule-set maker can submit this draft.', 403);
      const errors = validatePersistedRequiredFieldRuleSet(set.rules);
      if (errors.length > 0) throw new AppError(errors.join(' '), 400);

      const transition = await tx.creditRuleConfigSet.updateMany({
        where: { id, status: 'DRAFT', createdById: context.actorId },
        data: { status: 'SUBMITTED', submittedById: context.actorId, submittedAt: new Date() },
      });
      if (transition.count !== 1) throw new AppError('Rule set changed concurrently; reload and retry submission.', 409);
      const updated = await tx.creditRuleConfigSet.findUnique({ where: { id } });
      await auditInput(context, 'CREDIT_REQUIRED_FIELD_SET_SUBMITTED', id, { status: 'DRAFT' }, {
        status: 'SUBMITTED', version: set.version, reason: set.reason,
      }, tx);
      return updated;
    });
  }

  async approve(id: string, context: RuleSetContext) {
    requireAuditContext(context);
    return prisma.$transaction(async (tx) => {
      const set = await tx.creditRuleConfigSet.findUnique({ where: { id }, include: { rules: true } });
      if (!set) throw new AppError('Required-field rule set not found.', 404);
      if (set.status !== 'SUBMITTED') throw new AppError('Only a SUBMITTED rule set can be approved.', 409);
      if (context.actorId === set.createdById || context.actorId === set.submittedById) {
        throw new AppError('Rule-set approval requires a checker different from the maker.', 403);
      }
      const errors = validatePersistedRequiredFieldRuleSet(set.rules);
      if (errors.length > 0) throw new AppError(errors.join(' '), 400);

      const transition = await tx.creditRuleConfigSet.updateMany({
        where: { id, status: 'SUBMITTED', approvedById: null },
        data: { status: 'APPROVED', approvedById: context.actorId, approvedAt: new Date() },
      });
      if (transition.count !== 1) throw new AppError('Rule set changed concurrently; reload and retry approval.', 409);
      const updated = await tx.creditRuleConfigSet.findUnique({ where: { id } });
      await auditInput(context, 'CREDIT_REQUIRED_FIELD_SET_APPROVED', id, { status: 'SUBMITTED' }, {
        status: 'APPROVED', version: set.version, ruleCount: set.rules.length,
      }, tx);
      return updated;
    });
  }

  async activate(id: string, context: RuleSetContext, policyApprovalReference: string) {
    requireAuditContext(context);
    if (!policyApprovalReference?.trim() || policyApprovalReference.trim().length > 200) {
      throw new AppError('A policy-owner approval reference (up to 200 characters) is required to activate a rule set.', 400);
    }
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('credit-required-field-set-activation'))`;
      const set = await tx.creditRuleConfigSet.findUnique({ where: { id }, include: { rules: true } });
      if (!set) throw new AppError('Required-field rule set not found.', 404);
      if (set.status !== 'APPROVED') throw new AppError('Only an APPROVED rule set can be activated.', 409);
      if (context.actorId === set.createdById || context.actorId === set.submittedById || context.actorId === set.approvedById) {
        throw new AppError('Rule-set activation requires an authorized operator distinct from the maker and checker.', 403);
      }
      const errors = validatePersistedRequiredFieldRuleSet(set.rules);
      if (errors.length > 0) throw new AppError(errors.join(' '), 400);

      const unmanagedActiveRows = await tx.creditRuleConfig.count({
        where: { kind: 'REQUIRED_FIELD', isActive: true, configSetId: null },
      });
      if (unmanagedActiveRows > 0) {
        throw new AppError('Active unmanaged required-field rules exist. Reconcile them into a governed set before activation.', 409);
      }

      const now = new Date();
      const activeSets = await tx.creditRuleConfigSet.findMany({
        where: { name: REQUIRED_FIELD_SET_NAME, status: 'ACTIVE' },
        select: { id: true, version: true },
      });
      for (const activeSet of activeSets) {
        const [ruleCount, activeRuleCount] = await Promise.all([
          tx.creditRuleConfig.count({ where: { configSetId: activeSet.id, kind: 'REQUIRED_FIELD' } }),
          tx.creditRuleConfig.count({ where: { configSetId: activeSet.id, kind: 'REQUIRED_FIELD', isActive: true } }),
        ]);
        if (ruleCount === 0 || activeRuleCount !== ruleCount) {
          throw new AppError(`Active rule set v${activeSet.version} is incomplete or inconsistent; activation was rolled back.`, 409);
        }
        const deactivated = await tx.creditRuleConfig.updateMany({
          where: { configSetId: activeSet.id, kind: 'REQUIRED_FIELD', isActive: true },
          data: { isActive: false },
        });
        if (deactivated.count !== activeRuleCount) {
          throw new AppError(`Active rule set v${activeSet.version} changed concurrently; activation was rolled back.`, 409);
        }
        await tx.creditRuleConfigSet.update({
          where: { id: activeSet.id },
          data: { status: 'SUPERSEDED', effectiveTo: now },
        });
      }

      const transition = await tx.creditRuleConfigSet.updateMany({
        where: { id, status: 'APPROVED', approvedById: set.approvedById },
        data: {
          status: 'ACTIVE',
          activatedById: context.actorId,
          activatedAt: now,
          effectiveFrom: now,
          effectiveTo: null,
          policyApprovalReference: policyApprovalReference.trim(),
        },
      });
      if (transition.count !== 1) throw new AppError('Rule set changed concurrently; reload and retry activation.', 409);
      const updated = await tx.creditRuleConfigSet.findUnique({ where: { id } });

      const activatedRules = await tx.creditRuleConfig.updateMany({
        where: { configSetId: id, kind: 'REQUIRED_FIELD' },
        data: { isActive: true },
      });
      if (activatedRules.count !== set.rules.length || activatedRules.count === 0) {
        throw new AppError('Rule-set contents changed or are incomplete; activation was rolled back.', 409);
      }
      await auditInput(context, 'CREDIT_REQUIRED_FIELD_SET_ACTIVATED', id, { status: 'APPROVED' }, {
        status: 'ACTIVE',
        version: set.version,
        ruleCount: activatedRules.count,
        effectiveFrom: now.toISOString(),
        policyApprovalReference: policyApprovalReference.trim(),
      }, tx);
      return updated;
    });
  }
}

export const creditRuleConfigSetService = new CreditRuleConfigSetService();
