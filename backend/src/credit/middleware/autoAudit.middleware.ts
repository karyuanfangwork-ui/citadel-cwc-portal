import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { getUserContext } from '../../lib/user-context';

/**
 * Auto-audit Prisma middleware for the Credit Module.
 * 
 * Appends to the shared Prisma client's middleware chain so that
 * every create/update/delete on credit_* tables is automatically
 * logged to the AuditLog table — no manual auditLog() calls needed.
 * 
 * Credit tables are identified by the Prisma model name prefix:
 *   - CreditApplication
 *   - CreditDocument
 *   - CreditDocumentVersion
 *   - BorrowerProfile
 *   - Scorecard / ScorecardVersion / ScoreRun
 *   - FinancialStatement / FinancialLineItem / FinancialRatio
 *   - Collateral / CollateralValuation / CollateralLien / InsuranceCover
 *   - Guarantee
 *   - CommitteeMeeting / CommitteeMember / CommitteeAgendaItem / CommitteeVote
 *   - ApprovalMatrix / ApprovalMatrixVersion
 *   - CreditRuleConfig / RatingBandConfig / RiskFactorMatrix / CreditSlaPolicy
 *   - Condition
 *   - FacilityHealth / CovenantDefinition / CovenantTest
 *   - PaymentEvent / EarlyWarningSignal
 *   - FeatureFlag (admin config changes)
 */

const CREDIT_MODELS = new Set([
  'CreditApplication',
  'ApplicationFacility',
  'ApplicationParty',
  'CreditDocument',
  'CreditDocumentVersion',
  'DocumentRequirement',
  'BorrowerProfile',
  'Director',
  'Shareholder',
  'UltimateBeneficialOwner',
  'RelatedPartyGroup',
  'CreditScorecard',
  'CreditScorecardVersion',
  'CreditScoreRun',
  'FinancialStatement',
  'FinancialLineItem',
  'FinancialRatio',
  'Collateral',
  'CollateralValuation',
  'CollateralLien',
  'InsuranceCover',
  'Guarantee',
  'CommitteeMeeting',
  'CommitteeMember',
  'CommitteeAgendaItem',
  'CommitteeVote',
  'ApprovalMatrix',
  'ApprovalMatrixVersion',
  'CreditRuleConfig',
  'RatingBandConfig',
  'RiskFactorMatrix',
  'CreditSlaPolicy',
  'CreditSlaPolicyBranchOverride',
  'CreditBureauCheck',
  'CreditDecision',
  'Condition',
  'FacilityHealth',
  'CovenantDefinition',
  'CovenantTest',
  'PaymentEvent',
  'EarlyWarningSignal',
  'FeatureFlag',
]);

const ACTION_MAP: Record<string, string> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
};

/**
 * Install the credit auto-audit middleware on a PrismaClient instance.
 * Call once at app bootstrap: installCreditAuditMiddleware(prisma)
 */
export function installCreditAuditMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    const model = params.model;
    const action = ACTION_MAP[params.action];

    // Only audit credit models and only write operations
    if (!model || !CREDIT_MODELS.has(model) || !action) {
      return next(params);
    }

    // For updates, capture the before-state
    let oldValues: Record<string, unknown> | undefined;
    if (params.action === 'update' || params.action === 'delete') {
      try {
        // Read the record before mutation
        // params.args.where contains the PK filter
        oldValues = await (prisma as any)[model.charAt(0).toLowerCase() + model.slice(1)].findUnique({
          where: params.args.where,
        });
      } catch {
        // If we can't read the old state (e.g. record already deleted), proceed without it
      }
    }

    // Execute the actual operation
    const result = await next(params);

    // Build audit log entry
    let newValues: Record<string, unknown> | undefined;
    if (params.action === 'create' || params.action === 'update') {
      newValues = result;
    }

    // Phase 5 — attribute the write to the real user via AsyncLocalStorage.
    // P1 audit hardening: fail closed instead of letting audit loss disappear
    // from the business operation.
    const userCtx = getUserContext();
    try {
      await prisma.auditLog.create({
        data: {
          userId: userCtx?.userId ?? null,
          userEmail: userCtx?.email ?? null,
          action: `CREDIT_${action}`,
          resourceType: model,
          resourceId: result?.id ?? params.args?.where?.id ?? null,
          oldValues: oldValues ? (oldValues as any) : undefined,
          newValues: newValues ? (newValues as any) : undefined,
          ipAddress: userCtx?.ipAddress ?? null,
          userAgent: userCtx?.userAgent ?? null,
        },
      });
    } catch (err: unknown) {
      logger.error('Credit auto-audit write failed', {
        model,
        action,
        err,
      });
      throw err;
    }

    return result;
  });

  logger.info('✅ Credit auto-audit Prisma middleware installed');
}