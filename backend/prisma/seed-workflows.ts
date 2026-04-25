import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultWorkflows = [
  {
    name: 'IT Simple',
    code: 'IT_SIMPLE',
    description: 'Simple IT support workflow (4 steps)',
    displayOrder: 1,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'IT Procurement',
    code: 'IT_PROCUREMENT',
    description: 'IT hardware/software procurement with executive approval chain',
    displayOrder: 2,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'Acknowledged', status: 'ACKNOWLEDGED_IT', icon: 'radio_button_checked' },
      { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'radio_button_checked' },
      { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'radio_button_checked' },
      { label: 'Pending Invoice', status: 'PENDING_INVOICE_IT', icon: 'radio_button_checked' },
      { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'radio_button_checked' },
      { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'radio_button_checked' },
      { label: 'Delivery', status: 'PENDING_DELIVERY_IT', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'HR General',
    code: 'HR_GENERAL',
    description: 'General HR support workflow (4 steps)',
    displayOrder: 3,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'In Progress', status: 'IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'HR Recruitment',
    code: 'HR_RECRUITMENT',
    description: 'HR hiring and recruitment workflow with CEO approval, interview stages, and LOA',
    displayOrder: 4,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL', icon: 'radio_button_checked' },
      { label: 'Job Posted', status: 'JOB_POSTED', icon: 'radio_button_checked' },
      { label: 'Manager Review', status: 'PENDING_MANAGER_REVIEW', icon: 'radio_button_checked' },
      { label: 'Interview', status: 'INTERVIEW_SCHEDULED', icon: 'radio_button_checked' },
      { label: 'Feedback', status: 'INTERVIEW_FEEDBACK_PENDING', icon: 'radio_button_checked' },
      { label: 'Screening', status: 'HR_SCREENING', icon: 'radio_button_checked' },
      { label: 'LOA Pending', status: 'LOA_PENDING_APPROVAL', icon: 'radio_button_checked' },
      { label: 'LOA Approved', status: 'LOA_APPROVED', icon: 'radio_button_checked' },
      { label: 'LOA Issued', status: 'LOA_ISSUED', icon: 'radio_button_checked' },
      { label: 'LOA Accepted', status: 'LOA_ACCEPTED', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'COMPLETED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'Finance',
    code: 'FINANCE',
    description: 'Finance purchase requisition workflow with CFO and Group CEO approval',
    displayOrder: 5,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'Pending Ack', status: 'FINANCE_PENDING_ACK', icon: 'radio_button_checked' },
      { label: 'Acknowledged', status: 'FINANCE_ACKNOWLEDGED', icon: 'radio_button_checked' },
      { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked' },
      { label: 'Group CEO', status: 'PENDING_GROUP_CEO_APPROVAL', icon: 'radio_button_checked' },
      { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked' },
      { label: 'Awaiting Confirmation', status: 'AWAITING_PAYMENT_CONFIRMATION', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'TICKET_CLOSED_FIN', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'Employee Onboarding',
    code: 'ONBOARDING',
    description: 'New employee onboarding workflow',
    displayOrder: 6,
    steps: [
      { label: 'Submitted', status: 'ONBOARDING_SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'HR Approval', status: 'ONBOARDING_PENDING_HR_APPROVAL', icon: 'radio_button_checked' },
      { label: 'Pre-Arrival', status: 'ONBOARDING_PRE_ARRIVAL_SETUP', icon: 'radio_button_checked' },
      { label: 'Day 1', status: 'ONBOARDING_DAY_1_ORIENTATION', icon: 'radio_button_checked' },
      { label: 'Week 1', status: 'ONBOARDING_WEEK_1_INTEGRATION', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'ONBOARDING_COMPLETED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'Employee Offboarding',
    code: 'OFFBOARDING',
    description: 'Employee offboarding workflow',
    displayOrder: 7,
    steps: [
      { label: 'Submitted', status: 'OFFBOARDING_SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'Notice Period', status: 'OFFBOARDING_NOTICE_PERIOD', icon: 'radio_button_checked' },
      { label: 'KT Phase', status: 'OFFBOARDING_KNOWLEDGE_TRANSFER', icon: 'radio_button_checked' },
      { label: 'Final Week', status: 'OFFBOARDING_FINAL_WEEK', icon: 'radio_button_checked' },
      { label: 'Exit Proc', status: 'OFFBOARDING_EXIT_PROCEDURES', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'OFFBOARDING_COMPLETED', icon: 'check_circle', isFinal: true },
    ]
  }
];

async function main() {
  console.log('🌱 Seeding workflow types...');

  for (const workflow of defaultWorkflows) {
    const existing = await prisma.workflowType.findUnique({
      where: { code: workflow.code }
    });

    if (existing) {
      // Update existing workflow and its steps
      await prisma.workflowType.update({
        where: { id: existing.id },
        data: {
          name: workflow.name,
          description: workflow.description,
          displayOrder: workflow.displayOrder,
        }
      });

      // Delete existing steps and recreate
      await prisma.workflowStep.deleteMany({
        where: { workflowTypeId: existing.id }
      });

      await prisma.workflowStep.createMany({
        data: workflow.steps.map((step, index) => ({
          workflowTypeId: existing.id,
          label: step.label,
          status: step.status,
          icon: step.icon,
          displayOrder: index + 1,
          isInitial: step.isInitial || false,
          isFinal: step.isFinal || false,
        }))
      });

      console.log(`✅ Updated workflow: ${workflow.code}`);
    } else {
      // Create new workflow with steps
      const created = await prisma.workflowType.create({
        data: {
          name: workflow.name,
          code: workflow.code,
          description: workflow.description,
          displayOrder: workflow.displayOrder,
          steps: {
            create: workflow.steps.map((step, index) => ({
              label: step.label,
              status: step.status,
              icon: step.icon,
              displayOrder: index + 1,
              isInitial: step.isInitial || false,
              isFinal: step.isFinal || false,
            }))
          }
        }
      });

      console.log(`✅ Created workflow: ${workflow.code}`);
    }
  }

  // Now link request types to workflows
  const requestTypeWorkflowMap: Record<string, string> = {
    'GET_IT_HELP': 'IT_SIMPLE',
    'EMAIL_MANAGEMENT': 'IT_SIMPLE',
    'REPORT_SYSTEM_PROBLEM': 'IT_SIMPLE',
    'NEW_HARDWARE': 'IT_PROCUREMENT',
    'SOFTWARE_INSTALLATION': 'IT_PROCUREMENT',
    'HR_QUESTION': 'HR_GENERAL',
    'NEW_HIRING': 'HR_RECRUITMENT',
    'EMPLOYEE_ONBOARDING': 'ONBOARDING',
    'EMPLOYEE_OFFBOARDING': 'OFFBOARDING',
    'PURCHASE_REQUISITION': 'FINANCE',
    'REIMBURSEMENT': 'FINANCE',
    'FINANCE_GENERAL': 'FINANCE',
  };

  for (const [requestTypeCode, workflowCode] of Object.entries(requestTypeWorkflowMap)) {
    const requestType = await prisma.requestType.findFirst({
      where: { code: requestTypeCode }
    });
    const workflow = await prisma.workflowType.findUnique({
      where: { code: workflowCode }
    });

    if (requestType && workflow) {
      await prisma.requestType.update({
        where: { id: requestType.id },
        data: { workflowTypeId: workflow.id }
      });
      console.log(`✅ Linked ${requestTypeCode} to ${workflowCode}`);
    }
  }

  console.log('🎉 Workflow seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding workflows:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });