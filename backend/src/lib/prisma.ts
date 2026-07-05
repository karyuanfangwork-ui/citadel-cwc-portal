import { PrismaClient } from '@prisma/client';
import { installCreditAuditMiddleware } from '../credit/middleware/autoAudit.middleware';
import { getTenantId } from './tenant-context';
import { config } from '../config';

// Models that carry a tenantId column (root models only — child models are
// isolated through their FK to a root model and don't need tenantId).
const TENANT_SCOPED_MODELS = new Set([
  'user', 'request', 'asset',
  'crmLead', 'crmAccount', 'crmOpportunity', 'crmContact', 'crmPipeline',
  'creditApplication', 'knowledgeBaseArticle', 'notification', 'auditLog',
  'announcement', 'announcementRead', 'onboardingRequest', 'offboardingRequest',
  'candidate', 'branch', 'entity', 'serviceDesk', 'serviceCategory', 'requestType',
  'escalationRule', 'systemSetting', 'featureFlag', 'notificationTemplate',
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
        const tenantId = getTenantId();
        const modelKey = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';

        if (!tenantId || !TENANT_SCOPED_MODELS.has(modelKey)) {
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