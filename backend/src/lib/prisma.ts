import { PrismaClient } from '@prisma/client';
import { installCreditAuditMiddleware } from '../credit/middleware/autoAudit.middleware';
import { getExecutionScope, isScopeBypassed, getScopeTenantId } from './execution-scope';
import { config } from '../config';

// Models that carry a tenantId column (root models only — child models are
// isolated through their FK to a root model and don't need tenantId).
// P02-06: This list is generated/verified by scripts/generate-tenant-models.ts
// and cross-checked by src/generated/tenant-models.ts.
const TENANT_SCOPED_MODELS = new Set([
  'user', 'request', 'asset', 'platformAuditEvent',
  'crmLead', 'crmAccount', 'crmOpportunity', 'crmContact', 'crmPipeline',
  'creditApplication', 'knowledgeBaseArticle', 'notification', 'auditLog',
  'announcement', 'announcementRead', 'onboardingRequest', 'offboardingRequest',
  'candidate', 'branch', 'entity', 'serviceDesk', 'serviceCategory', 'requestType',
  'escalationRule', 'systemSetting', 'featureFlag', 'notificationTemplate',
  'webhookSubscription',
  'requestCounter',
  'approvalPolicy',
  'approvalStep',
  'approvalMatrix',
  'catalogEntitlement',
  'serviceTarget',
  'department',
  'departmentMembership',
]);

// ── Tenant Scope Enforcement Mode ─────────────────────────────────────
// P02-06: Phased enforcement to allow gradual migration of call sites.
//
// 'warn'   — Log warnings for unscoped operations on tenant-scoped models,
//            but allow them through. This is the default for development.
// 'strict' — Block unscoped write operations (create/update/delete/upsert)
//            on tenant-scoped models. This is the target for production.
//            Reads (findMany/findFirst/findUnique/count/aggregate/groupBy)
//            are still allowed without scope but log deprecation warnings.
//
// Set TENANT_SCOPE_ENFORCE=strict in .env to enable strict enforcement.
const TENANT_SCOPE_ENFORCE: 'warn' | 'strict' =
    (process.env.TENANT_SCOPE_ENFORCE as 'warn' | 'strict') === 'strict' ? 'strict' : 'warn';

// Deduplicate warnings — only log once per model+operation combination
const _warnedKeys = new Set<string>();

// P1-09: Gate Prisma query/info logging by environment config.
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

                // Workflow history is append-only. DELETE is blocked at the
                // application boundary so parent Request FK cascades can still
                // remove history during legitimate request deletion.
                if (modelKey === 'workflowHistory' && ['delete', 'deleteMany'].includes(operation)) {
                    throw new Error('WORKFLOW_HISTORY_IMMUTABLE: workflow history cannot be deleted directly');
                }

                // ── Unscoped operations on tenant-scoped models ──
                if (isTenantScoped && !scope) {
                    const isRead = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'].includes(operation);
                    const isWrite = ['create', 'update', 'delete', 'updateMany', 'deleteMany', 'upsert'].includes(operation);

                    if (isWrite) {
                        if (TENANT_SCOPE_ENFORCE === 'strict') {
                            // P02-06 strict mode: block unscoped writes
                            throw new Error(
                                `TENANT_SCOPE_REQUIRED: ${operation} on ${modelKey} requires an execution scope. ` +
                                `Use runWithExecutionScope({ kind: 'tenant', tenantId }) or runWithTenant().`
                            );
                        }
                        // P02-06 warn mode: log once per model+op, then allow through
                        const warnKey = `w:${modelKey}:${operation}`;
                        if (!_warnedKeys.has(warnKey)) {
                            _warnedKeys.add(warnKey);
                            console.warn(
                                `[TENANT_SCOPE] Unscoped ${operation} on tenant-scoped model ${modelKey}. ` +
                                `Set TENANT_SCOPE_ENFORCE=strict to block this.`
                            );
                        }
                        return query(args);
                    }

                    if (isRead) {
                        // Reads without scope: log once per model+op, then allow
                        const warnKey = `r:${modelKey}:${operation}`;
                        if (!_warnedKeys.has(warnKey)) {
                            _warnedKeys.add(warnKey);
                            console.warn(
                                `[TENANT_SCOPE] Unscoped ${operation} on tenant-scoped model ${modelKey}. ` +
                                `This will be rejected in a future release. Use runWithExecutionScope().`
                            );
                        }
                        return query(args);
                    }
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