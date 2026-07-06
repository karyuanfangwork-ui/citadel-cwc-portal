
import prisma from '../utils/prisma';

/** Regex to test if a string is a UUID. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an id param that may be a UUID or a referenceNumber (e.g. "IT-00001", "HR-00002")
 * to an actual DB record id (UUID).
 * Returns null if no matching request is found.
 *
 * Also accepts old-format reference numbers (e.g. "IT-1", "HR-2") by padding
 * the numeric portion to 5 digits before lookup.
 */
export async function resolveRequestId(idOrRef: string): Promise<string | null> {
    if (UUID_RE.test(idOrRef)) return idOrRef;

    // Try exact match first (handles new padded format like "IT-00001")
    let row = await prisma.request.findFirst({
        where: { referenceNumber: idOrRef, deletedAt: null },
        select: { id: true },
    });
    if (row) return row.id;

    // Fallback: normalize old-format reference numbers by padding the numeric portion
    // e.g. "IT-1" → "IT-00001", "FINANCE-3" → "FINANCE-00003"
    const normalized = idOrRef.replace(/^([A-Z]+)-(\d+)$/, (_, prefix, num) =>
        `${prefix}-${num.padStart(5, '0')}`,
    );
    if (normalized !== idOrRef) {
        row = await prisma.request.findFirst({
            where: { referenceNumber: normalized, deletedAt: null },
            select: { id: true },
        });
        if (row) return row.id;
    }

    return null;
}