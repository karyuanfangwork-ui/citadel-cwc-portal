/**
 * Migration script: Create IT_HARDWARE_PROCUREMENT workflow and link request types
 * Run with: npx tsx migrate_workflows.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting workflow migration...');

  // 1. Create or update IT_HARDWARE_PROCUREMENT workflow type
  const hwWorkflow = await prisma.workflowType.upsert({
    where: { code: 'IT_HARDWARE_PROCUREMENT' },
    update: {
      name: 'IT Hardware Procurement',
      description: 'IT hardware procurement with executive approval chain and asset registration',
      displayOrder: 3,
    },
    create: {
      name: 'IT Hardware Procurement',
      code: 'IT_HARDWARE_PROCUREMENT',
      description: 'IT hardware procurement with executive approval chain and asset registration',
      displayOrder: 3,
    },
  });
  console.log(`✅ Created/found IT_HARDWARE_PROCUREMENT workflow: ${hwWorkflow.id}`);

  // 2. Delete existing steps for this workflow (to recreate)
  await prisma.workflowStep.deleteMany({
    where: { workflowTypeId: hwWorkflow.id },
  });

  // 3. Create workflow steps for IT_HARDWARE_PROCUREMENT
  const hwSteps = [
    { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true, displayOrder: 1 },
    { label: 'Acknowledged', status: 'ACKNOWLEDGED_IT', icon: 'radio_button_checked', displayOrder: 2 },
    { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true, displayOrder: 3 },
    { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true, displayOrder: 4 },
    { label: 'Pending Invoice', status: 'PENDING_INVOICE_IT', icon: 'radio_button_checked', displayOrder: 5 },
    { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true, displayOrder: 6 },
    { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'radio_button_checked', displayOrder: 7 },
    { label: 'Procurement', status: 'PROCUREMENT_IN_PROGRESS', icon: 'radio_button_checked', displayOrder: 8 },
    { label: 'Ordered', status: 'HARDWARE_ORDERED', icon: 'radio_button_checked', displayOrder: 9 },
    { label: 'Received', status: 'HARDWARE_RECEIVED', icon: 'radio_button_checked', displayOrder: 10 },
    { label: 'Provisioned', status: 'SOFTWARE_PROVISIONED', icon: 'radio_button_checked', displayOrder: 11 },
    { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true, displayOrder: 12 },
  ];

  for (const step of hwSteps) {
    await prisma.workflowStep.create({
      data: {
        workflowTypeId: hwWorkflow.id,
        ...step,
      },
    });
  }
  console.log(`✅ Created ${hwSteps.length} steps for IT_HARDWARE_PROCUREMENT`);

  // 4. Update IT_PROCUREMENT workflow (software)
  const swWorkflow = await prisma.workflowType.upsert({
    where: { code: 'IT_PROCUREMENT' },
    update: {
      name: 'IT Procurement',
      description: 'IT software procurement with executive approval chain (no asset registration)',
      displayOrder: 2,
    },
    create: {
      name: 'IT Procurement',
      code: 'IT_PROCUREMENT',
      description: 'IT software procurement with executive approval chain (no asset registration)',
      displayOrder: 2,
    },
  });
  console.log(`✅ Updated/found IT_PROCUREMENT workflow: ${swWorkflow.id}`);

  // Delete and recreate steps for IT_PROCUREMENT (software)
  await prisma.workflowStep.deleteMany({
    where: { workflowTypeId: swWorkflow.id },
  });

  const swSteps = [
    { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true, displayOrder: 1 },
    { label: 'Acknowledged', status: 'ACKNOWLEDGED_IT', icon: 'radio_button_checked', displayOrder: 2 },
    { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true, displayOrder: 3 },
    { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true, displayOrder: 4 },
    { label: 'Pending Invoice', status: 'PENDING_INVOICE_IT', icon: 'radio_button_checked', displayOrder: 5 },
    { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true, displayOrder: 6 },
    { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'radio_button_checked', displayOrder: 7 },
    { label: 'Delivery', status: 'PENDING_DELIVERY_IT', icon: 'radio_button_checked', displayOrder: 8 },
    { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true, displayOrder: 9 },
  ];

  for (const step of swSteps) {
    await prisma.workflowStep.create({
      data: {
        workflowTypeId: swWorkflow.id,
        ...step,
      },
    });
  }
  console.log(`✅ Created ${swSteps.length} steps for IT_PROCUREMENT`);

  // 5. Link NEW_HARDWARE → IT_HARDWARE_PROCUREMENT, SOFTWARE_INSTALLATION → IT_PROCUREMENT
  const hwRequestType = await prisma.requestType.findFirst({ where: { code: 'NEW_HARDWARE' } });
  const swRequestType = await prisma.requestType.findFirst({ where: { code: 'SOFTWARE_INSTALLATION' } });

  if (hwRequestType) {
    await prisma.requestType.update({
      where: { id: hwRequestType.id },
      data: { workflowTypeId: hwWorkflow.id },
    });
    console.log(`✅ Linked NEW_HARDWARE → IT_HARDWARE_PROCUREMENT`);
  } else {
    console.log('⚠️ NEW_HARDWARE request type not found');
  }

  if (swRequestType) {
    await prisma.requestType.update({
      where: { id: swRequestType.id },
      data: { workflowTypeId: swWorkflow.id },
    });
    console.log(`✅ Linked SOFTWARE_INSTALLATION → IT_PROCUREMENT`);
  } else {
    console.log('⚠️ SOFTWARE_INSTALLATION request type not found');
  }

  // 6. Verify
  const allWorkflows = await prisma.workflowType.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { displayOrder: 'asc' },
  });
  console.log('\n📋 All workflows:');
  for (const wf of allWorkflows) {
    console.log(`  ${wf.code}: ${wf.name} (${wf.id})`);
  }

  const hwCheck = await prisma.requestType.findFirst({
    where: { code: 'NEW_HARDWARE' },
    include: { workflow: true },
  });
  console.log(`\n🔍 NEW_HARDWARE → ${hwCheck?.workflow?.code || 'NONE'} (${hwCheck?.workflow?.name || 'N/A'})`);

  const swCheck = await prisma.requestType.findFirst({
    where: { code: 'SOFTWARE_INSTALLATION' },
    include: { workflow: true },
  });
  console.log(`🔍 SOFTWARE_INSTALLATION → ${swCheck?.workflow?.code || 'NONE'} (${swCheck?.workflow?.name || 'N/A'})`);

  await prisma.$disconnect();
  console.log('\n✅ Migration complete!');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});