import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from './prisma';
import { runWithExecutionScope } from './execution-scope';

export interface DatabaseScope {
    tenantId: string;
    departmentIds: string[];
    actorId?: string;
}

export type ScopedTransactionClient = Prisma.TransactionClient;

function normalizeDepartmentIds(departmentIds: string[]): string[] {
    return Array.from(new Set(departmentIds.filter(Boolean))).sort();
}

async function applyDatabaseClaims(tx: Prisma.TransactionClient, scope: DatabaseScope): Promise<void> {
    const departmentIds = normalizeDepartmentIds(scope.departmentIds);
    const rlsRole = process.env.DATABASE_RLS_ROLE;
    if (rlsRole) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rlsRole)) {
            throw new Error('Invalid DATABASE_RLS_ROLE value');
        }
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${rlsRole}"`);
    }
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${scope.tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.department_ids', ${departmentIds.join(',')}, true)`;
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${scope.actorId ?? ''}, true)`;
}

export async function withDatabaseScope<T>(
    scope: DatabaseScope,
    fn: (tx: ScopedTransactionClient) => Promise<T>,
    client: PrismaClient = prisma as unknown as PrismaClient,
): Promise<T> {
    const departmentIds = normalizeDepartmentIds(scope.departmentIds);
    return runWithExecutionScope(
        { kind: 'tenant', tenantId: scope.tenantId, actorId: scope.actorId, departmentIds },
        () => client.$transaction(async (tx) => {
            await applyDatabaseClaims(tx, { ...scope, departmentIds });
            return fn(tx);
        }),
    );
}
