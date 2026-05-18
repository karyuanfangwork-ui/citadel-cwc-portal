import { PrismaClient } from '@prisma/client';
import { installCreditAuditMiddleware } from '../credit/middleware/autoAudit.middleware';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

// Install credit module auto-audit middleware
// This automatically logs all create/update/delete on credit_* tables to AuditLog
installCreditAuditMiddleware(prisma);

export default prisma;
