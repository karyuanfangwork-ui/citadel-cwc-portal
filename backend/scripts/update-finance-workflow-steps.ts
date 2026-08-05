import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FINANCE_WORKFLOW_ID = '23a42e44-23eb-4eaa-9a7f-7c7e392e7b05';

async function main() {
  console.log('🔄 Updating FINANCE workflow steps for Purchase Requisition...\n');

  // Delete old steps
  const deleteResult = await prisma.workflowStep.deleteMany({
    where: { workflowTypeId: FINANCE_WORKFLOW_ID }
  });
  console.log(`✅ Deleted ${deleteResult.count} old steps\n`);

  // Create new steps for Purchase Requisition workflow
  const newSteps = [
    { label: 'Submitted', status: 'FINANCE_PENDING_ACK', icon: 'check_circle', displayOrder: 1, isInitial: true, isFinal: false },
    { label: 'Acknowledged', status: 'FINANCE_ACKNOWLEDGED', icon: 'radio_button_checked', displayOrder: 2, isInitial: false, isFinal: false },
    { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked', displayOrder: 3, isInitial: false, isFinal: false },
    { label: 'Group Deputy CEO', status: 'PENDING_GROUP_DCEO_APPROVAL', icon: 'radio_button_checked', displayOrder: 4, isInitial: false, isFinal: false },
    { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked', displayOrder: 5, isInitial: false, isFinal: false },
    { label: 'Completed', status: 'TICKET_CLOSED_FIN', icon: 'check_circle', displayOrder: 6, isInitial: false, isFinal: true },
  ];

  for (const step of newSteps) {
    await prisma.workflowStep.create({
      data: {
        workflowTypeId: FINANCE_WORKFLOW_ID,
        ...step
      }
    });
    console.log(`✅ Created step: ${step.displayOrder}. ${step.label} (${step.status})`);
  }

  console.log('\n🎉 FINANCE workflow steps updated successfully!');
  console.log('\nNew steps:');
  console.log('1. Submitted → FINANCE_PENDING_ACK');
  console.log('2. Acknowledged → FINANCE_ACKNOWLEDGED');
  console.log('3. CFO Approval → PENDING_CFO_APPROVAL_FIN');
  console.log('4. Group Deputy CEO → PENDING_GROUP_DCEO_APPROVAL');
  console.log('5. Payment → PAYMENT_PROCESSING_FIN');
  console.log('6. Completed → TICKET_CLOSED_FIN');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });