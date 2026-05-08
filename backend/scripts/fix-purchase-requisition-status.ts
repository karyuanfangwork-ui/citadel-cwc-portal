/**
 * Migration script: Fix Purchase Requisitions stuck in SUBMITTED status
 * 
 * Purchase Requisitions should start with status FINANCE_PENDING_ACK,
 * but existing records may have been created with SUBMITTED status.
 * 
 * This script updates:
 * - All requests with requestType.code = 'PURCHASE_REQUISITION' AND status = 'SUBMITTED'
 *   → status = 'FINANCE_PENDING_ACK'
 * 
 * Run: npx ts-node scripts/fix-purchase-requisition-status.ts
 */

import { PrismaClient, RequestStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding Purchase Requisitions with SUBMITTED status...\n');

  // Find all PURCHASE_REQUISITION requests stuck in SUBMITTED status
  const stuckRequests = await prisma.request.findMany({
    where: {
      status: 'SUBMITTED',
      requestType: {
        code: 'PURCHASE_REQUISITION',
      },
    },
    include: {
      requestType: {
        select: { code: true, name: true },
      },
    },
  });

  if (stuckRequests.length === 0) {
    console.log('✅ No Purchase Requisitions found with SUBMITTED status.');
    console.log('   All Purchase Requisitions are already in the correct status.\n');
    return;
  }

  console.log(`📋 Found ${stuckRequests.length} Purchase Requisition(s) to update:\n`);
  stuckRequests.forEach((req, i) => {
    console.log(`   ${i + 1}. ${req.referenceNumber} (${req.requestType?.name || 'Unknown'})`);
    console.log(`      ID: ${req.id}`);
    console.log(`      Current Status: ${req.status}`);
    console.log(`      Created: ${req.createdAt.toISOString()}\n`);
  });

  // Update all stuck requests
  console.log('⏳ Updating status to FINANCE_PENDING_ACK...\n');

  const result = await prisma.request.updateMany({
    where: {
      status: 'SUBMITTED',
      requestType: {
        code: 'PURCHASE_REQUISITION',
      },
    },
    data: {
      status: 'FINANCE_PENDING_ACK' as RequestStatus,
    },
  });

  console.log(`✅ Successfully updated ${result.count} request(s).\n`);
  console.log('   Finance agents can now see the "Acknowledge Request" button.');
  console.log('   Workflow will proceed from FINANCE_PENDING_ACK → FINANCE_ACKNOWLEDGED → PENDING_CFO_APPROVAL_FIN\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });