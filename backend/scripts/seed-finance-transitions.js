#!/usr/bin/env node
/**
 * Seed missing Finance workflow transitions into the database.
 *
 * Run with: node scripts/seed-finance-transitions.js
 *
 * This script is idempotent — it uses ON CONFLICT to skip existing rows.
 * Safe to run on production as part of deployment.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FINANCE_TRANSITIONS = [
  // Purchase Requisition
  { fromStatus: 'FINANCE_PENDING_ACK', toStatus: 'FINANCE_ACKNOWLEDGED', transitionLabel: 'ACKNOWLEDGE', requiresComment: false },
  { fromStatus: 'FINANCE_ACKNOWLEDGED', toStatus: 'FINANCE_IN_PROGRESS', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'FINANCE_ACKNOWLEDGED', toStatus: 'PENDING_CFO_APPROVAL_FIN', transitionLabel: 'ROUTE_TO_CFO', requiresComment: false },
  { fromStatus: 'FINANCE_IN_PROGRESS', toStatus: 'PENDING_CFO_APPROVAL_FIN', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'FINANCE_IN_PROGRESS', toStatus: 'TICKET_CLOSED_FIN', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_FIN', toStatus: 'CFO_APPROVED_FIN', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_CFO_APPROVAL_FIN', toStatus: 'CFO_REJECTED_FIN', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'PENDING_GROUP_DCEO_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'PAYMENT_PROCESSING_FIN', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'FINANCE_IN_PROGRESS', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'CFO_APPROVED_FIN', toStatus: 'COMPLETED', transitionLabel: 'COMPLETE', requiresComment: false },
  { fromStatus: 'CFO_REJECTED_FIN', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_GROUP_DCEO_APPROVAL', toStatus: 'GROUP_DCEO_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'GROUP_DCEO_APPROVED', toStatus: 'PAYMENT_PROCESSING_FIN', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'GROUP_DCEO_APPROVED', toStatus: 'FINANCE_ACKNOWLEDGED', transitionLabel: 'ACKNOWLEDGE', requiresComment: false },
  { fromStatus: 'GROUP_DCEO_REJECTED', toStatus: 'REJECTED', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PAYMENT_PROCESSING_FIN', toStatus: 'AWAITING_PAYMENT_CONFIRMATION', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'AWAITING_PAYMENT_CONFIRMATION', toStatus: 'PAYMENT_CONFIRMED_FIN', transitionLabel: 'CONFIRM', requiresComment: false },
  { fromStatus: 'AWAITING_PAYMENT_CONFIRMATION', toStatus: 'TICKET_CLOSED_FIN', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'PAYMENT_CONFIRMED_FIN', toStatus: 'TICKET_CLOSED_FIN', transitionLabel: 'CLOSE', requiresComment: false },
  { fromStatus: 'TICKET_CLOSED_FIN', toStatus: 'RESOLVED', transitionLabel: 'CLOSE', requiresComment: false },
  // Expense Reimbursement
  { fromStatus: 'SUBMITTED', toStatus: 'PENDING_MANAGER_APPROVAL_FIN', transitionLabel: 'SUBMIT', requiresComment: false },
  { fromStatus: 'PENDING_MANAGER_APPROVAL_FIN', toStatus: 'MANAGER_APPROVED_FIN', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_MANAGER_APPROVAL_FIN', toStatus: 'MANAGER_REJECTED_FIN', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'MANAGER_APPROVED_FIN', toStatus: 'PENDING_FINANCE_HEAD_APPROVAL', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'MANAGER_REJECTED_FIN', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PENDING_FINANCE_HEAD_APPROVAL', toStatus: 'FINANCE_HEAD_APPROVED', transitionLabel: 'APPROVE', requiresComment: false },
  { fromStatus: 'PENDING_FINANCE_HEAD_APPROVAL', toStatus: 'FINANCE_HEAD_REJECTED', transitionLabel: 'REJECT', requiresComment: true },
  { fromStatus: 'FINANCE_HEAD_APPROVED', toStatus: 'PAYMENT_PROCESSING', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'FINANCE_HEAD_REJECTED', toStatus: 'SUBMITTED', transitionLabel: 'RETURN', requiresComment: false },
  { fromStatus: 'PAYMENT_PROCESSING', toStatus: 'PAYMENT_COMPLETED', transitionLabel: 'ADVANCE', requiresComment: false },
  { fromStatus: 'PAYMENT_COMPLETED', toStatus: 'REIMBURSEMENT_CLOSED', transitionLabel: 'CLOSE', requiresComment: false },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const t of FINANCE_TRANSITIONS) {
    try {
      await prisma.workflowTransition.create({
        data: {
          fromStatus: t.fromStatus,
          toStatus: t.toStatus,
          transitionLabel: t.transitionLabel,
          requiresComment: t.requiresComment,
          isActive: true,
        },
      });
      created++;
      console.log(`✓ Created: ${t.fromStatus} → ${t.toStatus}`);
    } catch (e) {
      if (e.code === 'P2002') {
        // Unique constraint — already exists
        skipped++;
      } else {
        console.error(`✗ Error: ${t.fromStatus} → ${t.toStatus}: ${e.message}`);
      }
    }
  }

  console.log(`\nDone. Created: ${created}, Already existed: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});