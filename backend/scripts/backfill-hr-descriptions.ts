/**
 * Backfill: Auto-generate descriptions for HR requests with blank descriptions.
 * Covers NEW_HIRING and HR_QUESTION request types.
 * 
 * Usage: npx tsx scripts/backfill-hr-descriptions.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateDescription(
    code: string,
    customFields: Record<string, any> | null,
    formConfig: any[] | null,
): string {
    const cf = customFields || {};
    const parts: string[] = [];

    for (const [key, value] of Object.entries(cf)) {
        if (value === null || value === undefined || value === '') continue;
        if (typeof value === 'object' && value.s3Key) continue;

        let label = key;
        if (formConfig && Array.isArray(formConfig)) {
            const field = formConfig.find((f: any) => f.id === key);
            if (field?.label) label = field.label;
        }

        parts.push(`${label}: ${value}`);
    }

    const prefix = code === 'NEW_HIRING' ? 'New hiring request' : 'HR inquiry';

    if (parts.length > 0) {
        return `${prefix} - ${parts.join('. ')}.`;
    }
    return `${prefix} submitted.`;
}

async function main() {
    // Find HR requests with blank descriptions
    const requests = await prisma.request.findMany({
        where: {
            requestType: { code: { in: ['NEW_HIRING', 'HR_QUESTION'] } },
            OR: [{ description: null }, { description: '' }],
        },
        include: { requestType: true },
    });

    console.log(`Found ${requests.length} HR requests with blank descriptions.`);

    let updated = 0;
    for (const request of requests) {
        const description = generateDescription(
            request.requestType?.code || '',
            request.customFields as Record<string, any>,
            request.requestType?.formConfig as any[] | null,
        );

        await prisma.request.update({
            where: { id: request.id },
            data: { description },
        });

        console.log(`  [${request.referenceNumber}] -> "${description}"`);
        updated++;
    }

    console.log(`\nUpdated ${updated} requests.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());