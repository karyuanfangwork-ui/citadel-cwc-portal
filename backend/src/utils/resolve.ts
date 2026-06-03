import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Regex to test if a string is a UUID. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an id param that may be a UUID or a referenceNumber (e.g. "IT-1", "HR-2")
 * to an actual DB record id (UUID).
 * Returns null if no matching request is found.
 */
export async function resolveRequestId(idOrRef: string): Promise<string | null> {
    if (UUID_RE.test(idOrRef)) return idOrRef;
    const row = await prisma.request.findFirst({
        where: { referenceNumber: idOrRef, deletedAt: null },
        select: { id: true },
    });
    return row?.id ?? null;
}