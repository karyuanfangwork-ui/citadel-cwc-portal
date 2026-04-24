/**
 * Migration script: Populate descriptions for existing finance tickets
 * 
 * This script fixes tickets that were created before the auto-description
 * feature was implemented. It generates descriptions from customFields data.
 * 
 * Run with: npx tsx scripts/migrate-finance-descriptions.ts
 */

import { PrismaClient, RequestStatus } from '@prisma/client';

const prisma = new PrismaClient();

const FINANCE_REQUEST_TYPES = [
    'PURCHASE_REQUISITION',
    'INTERCOMPANY_CHARGEBACK',
    'BUDGET_PROPOSAL',
];

function generateDescription(
    requestTypeCode: string | null,
    customFields: Record<string, any> | null,
    formConfig: any[] | null
): string {
    const cf = customFields || {};
    
    if (requestTypeCode === 'PURCHASE_REQUISITION') {
        // Dynamic: read from formConfig to get labels for field IDs
        const parts: string[] = [];
        
        for (const [key, value] of Object.entries(cf)) {
            if (value === null || value === undefined || value === '') continue;
            
            // Skip file uploads
            if (typeof value === 'object' && value.s3Key) continue;
            
            // Find label from formConfig for dynamic field IDs
            let label = key;
            if (formConfig && Array.isArray(formConfig)) {
                const field = formConfig.find((f: any) => f.id === key);
                if (field?.label) {
                    const labelLower = field.label.toLowerCase();
                    // Order matters: check more specific matches first
                    if (labelLower.includes('justification')) {
                        label = 'Justification';
                    } else if (labelLower.includes('type of purchase') || labelLower.includes('purchase type')) {
                        label = 'Purchase Type';
                    } else if (labelLower.includes('vendor')) {
                        label = 'Vendor';
                    } else if (labelLower.includes('bu') || labelLower.includes('business unit')) {
                        label = 'Business Unit';
                    } else {
                        label = field.label;
                    }
                }
            }
            
            parts.push(`${label}: ${value}`);
        }
        
        if (parts.length > 0) {
            return `Purchase requisition - ${parts.join('. ')}.`;
        }
        return 'Purchase requisition submitted.';
    }
    
    if (requestTypeCode === 'INTERCOMPANY_CHARGEBACK') {
        const fromEntity = cf.chargeFromEntity || 'Unknown entity';
        const toEntity = cf.chargeToEntity || 'Unknown entity';
        const amount = cf.amount ? `RM ${cf.amount}` : 'Amount TBD';
        const costCenter = cf.costCenter || 'Not specified';
        const desc = cf.description || 'No description provided';
        return `Inter-company chargeback from ${fromEntity} to ${toEntity}. Amount: ${amount}. Cost center: ${costCenter}. Details: ${desc}.`;
    }
    
    if (requestTypeCode === 'BUDGET_PROPOSAL') {
        const department = cf.department || 'Unknown department';
        const period = cf.budgetPeriod || 'Unspecified period';
        const totalAmount = cf.totalAmount ? `RM ${cf.totalAmount}` : 'Amount TBD';
        const breakdown = cf.breakdown || 'No breakdown provided';
        const justification = cf.justification || 'No justification provided';
        return `Budget proposal for ${department} - ${period}. Total requested: ${totalAmount}. Breakdown: ${breakdown}. Justification: ${justification}.`;
    }
    
    return '';
}

async function main() {
    console.log('🔍 Finding finance tickets without descriptions...\n');

    // Find all finance requests with empty or null description
    const requests = await prisma.request.findMany({
        where: {
            requestType: {
                code: { in: FINANCE_REQUEST_TYPES },
            },
            OR: [
                { description: null },
                { description: '' },
            ],
        },
        include: {
            requestType: true,
        },
    });

    console.log(`Found ${requests.length} finance tickets without descriptions.\n`);

    if (requests.length === 0) {
        console.log('✅ No tickets to update.');
        return;
    }

    let updated = 0;
    let skipped = 0;

    for (const request of requests) {
        const requestTypeCode = request.requestType?.code;
        const formConfig = request.requestType?.formConfig as any[] | null;
        const customFields = request.customFields as Record<string, any> | null;
        
        const description = generateDescription(requestTypeCode, customFields, formConfig);
        
        if (!description) {
            console.log(`  ⏭️  Skipping ${request.referenceNumber} - unknown type: ${requestTypeCode}`);
            skipped++;
            continue;
        }

        await prisma.request.update({
            where: { id: request.id },
            data: { description },
        });
        console.log(`  ✅ Updated ${request.referenceNumber}: "${description.substring(0, 80)}..."`);
        updated++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`✅ Migration complete!`);
}

main()
    .catch((e) => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });