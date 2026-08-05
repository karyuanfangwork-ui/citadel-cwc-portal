/**
 * P2-11 to P2-14: Atomic reference number generation
 *
 * Replaces the unsafe `count + 1` pattern with a transactional counter
 * that prevents duplicate reference numbers under concurrent requests.
 *
 * Usage:
 *   const refNum = await generateRequestRefNum('IT'); // → "IT-00042"
 */

import prisma from '../utils/prisma';

const MAX_RETRIES = 3;
const SEQ_PAD_LENGTH = 5; // e.g. "IT-00042"

/**
 * Generate the next atomic reference number for a given prefix.
 * Example: generateRequestRefNum('IT') → 'IT-00042'
 */
export async function generateRequestRefNum(prefix: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: string = await (prisma as any).$transaction(async (tx: any) => {
            let counter = await tx.requestCounter.findFirst({ where: { prefix } });

            if (!counter) {
                // Bootstrap: find the max existing sequence from requests with this prefix
                const lastRequest = await tx.request.findFirst({
                    where: { referenceNumber: { startsWith: `${prefix}-` } },
                    orderBy: { createdAt: 'desc' },
                });
                const maxSeq = lastRequest
                    ? parseInt(lastRequest.referenceNumber.split('-')[1], 10) || 0
                    : 0;

                counter = await tx.requestCounter.create({
                    data: { prefix, lastSeq: maxSeq + 1 },
                });
                return `${prefix}-${String(counter.lastSeq).padStart(SEQ_PAD_LENGTH, '0')}`;
            }

            // Atomic increment — safe under concurrency
            counter = await tx.requestCounter.update({
                where: { id: counter.id },
                data: { lastSeq: { increment: 1 } },
            });

            const candidate = `${prefix}-${String(counter.lastSeq).padStart(SEQ_PAD_LENGTH, '0')}`;

            // Verify uniqueness — if collision, find actual max and rebase
            const existing = await tx.request.findFirst({
                where: { referenceNumber: candidate },
            });
            if (existing) {
                // Counter is stale — rebase to actual max
                const lastRequest = await tx.request.findFirst({
                    where: { referenceNumber: { startsWith: `${prefix}-` } },
                    orderBy: { createdAt: 'desc' },
                });
                const actualMax = lastRequest
                    ? parseInt(lastRequest.referenceNumber.split('-')[1], 10) || 0
                    : 0;

                counter = await tx.requestCounter.update({
                    where: { id: counter.id },
                    data: { lastSeq: actualMax + 1 },
                });

                return `${prefix}-${String(counter.lastSeq).padStart(SEQ_PAD_LENGTH, '0')}`;
            }

            return candidate;
        });

        return result;
    }

    throw new Error(`Failed to generate reference number for prefix "${prefix}" after ${MAX_RETRIES} attempts`);
}