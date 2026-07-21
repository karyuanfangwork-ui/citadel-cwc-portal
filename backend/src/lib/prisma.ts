import { PrismaClient } from '@prisma/client';
import { installCreditAuditMiddleware } from '../credit/middleware/autoAudit.middleware';
import { getExecutionScope, isScopeBypassed, getScopeTenantId } from './execution-scope';
import { config } from '../config';

// Models that carry a tenantId column (root models only — child models are
// isolated through their FK to a root model and don't need tenantId).
// P02-06: This list is generated/verified by the tenant-model completeness test.
const TENANT_SCOPED_MODELS = new Set([
  'user', 'request', 'asset',
  'crmLead', 'crmAccount', 'crmOpportunity', 'crmContact', 'crmPipeline',
  'creditApplication', 'knowledgeBaseArticle', 'notification', 'auditLog',
  'announcement', 'announcementRead', 'onboardingRequest', 'offboardingRequest',
  'candidate', 'branch', 'entity', 'serviceDesk', 'serviceCategory', 'requestType',
  'escalationRule', 'systemSetting', 'featureFlag', 'notificationTemplate',
  'webhookSubscription', // P2-06: was missing — webhook data was unfiltered by tenant
  'requestCounter',      // P2-06: added — counter must be scoped per tenant
  'approvalPolicy',      // P2-06: approval policies are per-tenant
  'approvalStep',        // P2-06: approval steps are per-tenant (through policy)
  'approvalMatrix',      // P2-06: approval matrices are per-tenant
  'catalogEntitlement',  // P2-06: catalog entitlements are per-tenant
  'serviceTarget',        // P2-06: SLA targets are per-tenant
  'department',          // P2-07: departments are per-tenant
  'departmentMembership', // P2-07: memberships are per-tenant
  'role',                // P2-07: roles are per-tenant (after migration)
]);

// P1-09: Gate Prisma query/info logging by environment config.
// Production default: warn + error only (no query logging).
// Enable PRISMA_LOG_QUERIES=true in .env to log queries (dev/debug only).
function getPrismaLogLevels(): Array<'query' | 'info' | 'warn' | 'error'> {
  const levels: Array<'query' | 'info' | 'warn' | 'error'> = ['warn', 'error'];
  if (config.logging.prismaLogQueries) {
    levels.unshift('query', 'info');
  }
  return levels;
}

const baseClient = new PrismaClient({
  log: getPrismaLogLevels(),
});

// Install credit module auto-audit middleware
installCreditAuditMiddleware(baseClient);

export const prisma = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const modelKey = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';
        const isTenantScoped = TENANT_SCOPED_MODELS.has(modelKey);
        const scope = getExecutionScope();

        // ── Fail-closed: tenant-scoped models MUST have a scope ──
        // P02-06 (Findings #3–#4): If no scope is set, reject the query
        // for tenant-scoped models. This prevents cross-tenant data leaks.
        if (isTenantScoped && !scope) {
          // Backward compatibility: if this is a read from an unscoped context,
          // allow it through but log a deprecation warning.
          // In a future release, this will throw.
          if (
            operation === 'findMany' || operation === 'findFirst' ||
            operation === 'findUnique' || operation === 'count' ||
            operation === 'aggregate' || operation === 'groupBy'
          ) {
            // P02-06: Soft enforcement — log warning but don't block yet.
            // TODO: Enable strict mode after all call sites are migrated.
            console.warn(
              `[TENANT_SCOPE] Unscoped ${operation} on tenant-scoped model ${modelKey}. ` +
              `This will be rejected in a future release. Use runWithExecutionScope().`
            );
            return query(args);
          }
          // Write operations without scope are always blocked for tenant-scoped models
          throw new Error(
            `TENANT_SCOPE_REQUIRED: ${operation} on ${modelKey} requires an execution scope. ` +
            `Use runWithExecutionScope({ kind: 'tenant', tenantId }) or runWithTenant().`
          );
        }

        // ── Platform/system scope bypasses tenant filtering ──
        if (isScopeBypassed()) {
          return query(args);
        }

        // ── Tenant scope: inject tenantId ──
        const tenantId = getScopeTenantId();
        if (!tenantId || !isTenantScoped) {
          return query(args);
        }

        // Inject tenantId into read queries
        if (
          operation === 'findMany' || operation === 'findFirst' ||
          operation === 'findUnique' || operation === 'count' ||
          operation === 'aggregate' || operation === 'groupBy'
        ) {
          (args as any).where = { ...(args as any).where, tenantId };
        } else if (operation === 'create') {
          (args as any).data = { ...(args as any).data, tenantId };
        } else if (operation === 'upsert') {
          (args as any).create = { ...(args as any).create, tenantId };
          (args as any).where = { ...(args as any).where, tenantId };
        } else if (
          operation === 'update' || operation === 'delete' ||
          operation === 'updateMany' || operation === 'deleteMany'
        ) {
          (args as any).where = { ...(args as any).where, tenantId };
        }

        return query(args);
      },
    },
  },
});

export type PrismaClientWithTenant = typeof prisma;
export default prisma;