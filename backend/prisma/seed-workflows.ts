import { PrismaClient } from '@prisma/client';

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
    description: 'IT software procurement with executive approval chain (no asset registration)',
    displayOrder: 2,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'Acknowledged', status: 'ACKNOWLEDGED_IT', icon: 'radio_button_checked' },
      { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true },
      { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true },
      { label: 'Pending Invoice', status: 'PENDING_INVOICE_IT', icon: 'radio_button_checked' },
      { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true },
      { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'radio_button_checked' },
      { label: 'Delivery', status: 'PENDING_DELIVERY_IT', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'IT Hardware Procurement',
    code: 'IT_HARDWARE_PROCUREMENT',
    description: 'IT hardware procurement with executive approval chain and asset registration',
    displayOrder: 3,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'Acknowledged', status: 'ACKNOWLEDGED_IT', icon: 'radio_button_checked' },
      { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true },
      { label: 'CTO Approval', status: 'PENDING_CTO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true },
      { label: 'Pending Invoice', status: 'PENDING_INVOICE_IT', icon: 'radio_button_checked' },
      { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_IT', icon: 'radio_button_checked', slaPause: true },
      { label: 'Payment', status: 'PAYMENT_PROCESSING_IT', icon: 'radio_button_checked' },
      { label: 'Procurement', status: 'PROCUREMENT_IN_PROGRESS', icon: 'radio_button_checked' },
      { label: 'Ordered', status: 'HARDWARE_ORDERED', icon: 'radio_button_checked' },
      { label: 'Received', status: 'HARDWARE_RECEIVED', icon: 'radio_button_checked' },
      { label: 'Provisioned', status: 'SOFTWARE_PROVISIONED', icon: 'radio_button_checked' },
      { label: 'Resolved', status: 'RESOLVED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'HR General',
    code: 'HR_GENERAL',
    description: 'General HR support workflow (4 steps)',
    displayOrder: 4,
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
    displayOrder: 5,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'In Review', status: 'IN_REVIEW', icon: 'radio_button_checked' },
      { label: 'CEO Approval', status: 'PENDING_CEO_APPROVAL', icon: 'radio_button_checked', slaPause: true },
      { label: 'CEO Approved', status: 'CEO_APPROVED', icon: 'check_circle' },
      { label: 'Job Posted', status: 'JOB_POSTED', icon: 'radio_button_checked' },
      { label: 'Manager Review', status: 'PENDING_MANAGER_REVIEW', icon: 'radio_button_checked', slaPause: true },
      { label: 'Manager Approved', status: 'MANAGER_APPROVED', icon: 'check_circle' },
      { label: 'Interview', status: 'INTERVIEW_SCHEDULED', icon: 'radio_button_checked' },
      { label: 'Feedback', status: 'INTERVIEW_FEEDBACK_PENDING', icon: 'radio_button_checked' },
      { label: 'Screening', status: 'HR_SCREENING', icon: 'radio_button_checked' },
      { label: 'LOA Pending', status: 'LOA_PENDING_APPROVAL', icon: 'radio_button_checked', slaPause: true },
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
      { label: 'Submitted', status: 'FINANCE_PENDING_ACK', icon: 'check_circle', isInitial: true },
      { label: 'Acknowledged', status: 'FINANCE_ACKNOWLEDGED', icon: 'radio_button_checked' },
      { label: 'CFO Approval', status: 'PENDING_CFO_APPROVAL_FIN', icon: 'radio_button_checked', slaPause: true },
      { label: 'Group CEO', status: 'PENDING_GROUP_CEO_APPROVAL', icon: 'radio_button_checked', slaPause: true },
      { label: 'Payment', status: 'PAYMENT_PROCESSING_FIN', icon: 'radio_button_checked' },
      { label: 'Awaiting Confirmation', status: 'AWAITING_PAYMENT_CONFIRMATION', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'TICKET_CLOSED_FIN', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'Inter-Company Chargeback',
    code: 'INTERCOMPANY_CHARGEBACK',
    description: 'Inter-company chargeback workflow with From Entity and To Entity approval, then Finance team review',
    displayOrder: 8,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'From Entity Approver', status: 'PENDING_FROM_ENTITY_APPROVAL', icon: 'radio_button_checked', slaPause: true },
      { label: 'To Entity Approver', status: 'PENDING_TO_ENTITY_APPROVAL', icon: 'radio_button_checked', slaPause: true },
      { label: 'Finance Team', status: 'CHARGEBACK_FINANCE_REVIEW', icon: 'radio_button_checked', slaPause: true },
      { label: 'Awaiting Confirmation', status: 'AWAITING_CHARGEBACK_CONFIRMATION', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'CHARGEBACK_COMPLETED', icon: 'check_circle', isFinal: true },
    ]
  },
  {
    name: 'Employee Onboarding',
    code: 'ONBOARDING',
    description: 'New employee onboarding workflow',
    displayOrder: 6,
    steps: [
      { label: 'Submitted', status: 'ONBOARDING_SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'HR Approval', status: 'ONBOARDING_PENDING_HR_APPROVAL', icon: 'radio_button_checked', slaPause: true },
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
  },
  {
    name: 'Expense Reimbursement',
    code: 'EXPENSE_REIMBURSEMENT',
    description: 'Expense claim workflow with manager and Finance Head approval, then payment processing',
    displayOrder: 9,
    steps: [
      { label: 'Submitted', status: 'SUBMITTED', icon: 'check_circle', isInitial: true },
      { label: 'Manager Approval', status: 'PENDING_MANAGER_APPROVAL_FIN', icon: 'radio_button_checked', slaPause: true },
      { label: 'Finance Head', status: 'PENDING_FINANCE_HEAD_APPROVAL', icon: 'radio_button_checked', slaPause: true },
      { label: 'Payment', status: 'PAYMENT_PROCESSING', icon: 'radio_button_checked' },
      { label: 'Completed', status: 'REIMBURSEMENT_CLOSED', icon: 'check_circle', isFinal: true },
    ]
  }
];

export async function seedWorkflows(prisma: PrismaClient, retainAdminConfig: boolean = false) {
  console.log('🌱 Seeding workflow types...');

  if (retainAdminConfig) {
    console.log('⏭️  Skipping workflow types & steps (RETAIN_ADMIN_CONFIG enabled)');
    // Still link request types to existing workflows if needed
  } else {
    for (const workflow of defaultWorkflows) {
      const existing = await prisma.workflowType.findUnique({
        where: { code: workflow.code }
      });

      if (existing) {
        // Do NOT overwrite name/description — admin may have edited them via console.
        // Also do NOT overwrite steps — admin may have added/removed/reordered steps.
        console.log(`⏭️  Workflow already exists: ${workflow.code} — preserving admin config`);
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
                slaPause: step.slaPause || false,
              }))
            }
          }
        });

        console.log(`✅ Created workflow: ${workflow.code}`);
      }
    }

    // Backfill slaPause on existing workflow steps (for databases seeded before the SLA pause feature)
    const pauseStatuses = [
      'PENDING_CEO_APPROVAL', 'PENDING_CEO_APPROVAL_IT',
      'PENDING_MANAGER_APPROVAL_FIN', 'PENDING_MANAGER_REVIEW',
      'PENDING_CTO_APPROVAL_IT', 'PENDING_CFO_APPROVAL_IT', 'PENDING_CFO_APPROVAL_FIN',
      'PENDING_FINANCE_HEAD_APPROVAL',
      'PENDING_FROM_ENTITY_APPROVAL', 'PENDING_TO_ENTITY_APPROVAL',
      'PENDING_GROUP_CEO_APPROVAL',
      'ONBOARDING_PENDING_HR_APPROVAL',
      'LOA_PENDING_APPROVAL',
      'CHARGEBACK_FINANCE_REVIEW',
      'PENDING_INVOICE_IT',
    ];

    const stepsNeedingPause = await prisma.workflowStep.findMany({
      where: {
        status: { in: pauseStatuses },
        slaPause: false,
      },
    });

    let backfilled = 0;
    for (const step of stepsNeedingPause) {
      await prisma.workflowStep.update({
        where: { id: step.id },
        data: { slaPause: true },
      });
      backfilled++;
    }
    if (backfilled > 0) {
      console.log(`✅ Backfilled slaPause=true on ${backfilled} existing workflow steps`);
    }
  }

  // Link request types to workflows — always run (idempotent, only links if not already linked)
  const requestTypeWorkflowMap: Record<string, string> = {
    'GET_IT_HELP': 'IT_SIMPLE',
    'EMAIL_MANAGEMENT': 'IT_SIMPLE',
    'REPORT_SYSTEM_PROBLEM': 'IT_SIMPLE',
    'NEW_HARDWARE': 'IT_HARDWARE_PROCUREMENT',
    'SOFTWARE_INSTALLATION': 'IT_PROCUREMENT',
    'HR_QUESTION': 'HR_GENERAL',
    'NEW_HIRING': 'HR_RECRUITMENT',
    'EMPLOYEE_ONBOARDING': 'ONBOARDING',
    'EMPLOYEE_OFFBOARDING': 'OFFBOARDING',
    'PURCHASE_REQUISITION': 'FINANCE',
    'INTERCOMPANY_CHARGEBACK': 'INTERCOMPANY_CHARGEBACK',
    'BUDGET_PROPOSAL': 'FINANCE',
    'EXPENSE_CLAIM': 'EXPENSE_REIMBURSEMENT',
  };

  for (const [requestTypeCode, workflowCode] of Object.entries(requestTypeWorkflowMap)) {
    const requestType = await prisma.requestType.findFirst({
      where: { code: requestTypeCode }
    });
    const workflow = await prisma.workflowType.findUnique({
      where: { code: workflowCode }
    });

    if (requestType && workflow) {
      // Only link if not already linked — never overwrite admin's workflow assignment
      if (!requestType.workflowTypeId) {
        await prisma.requestType.update({
          where: { id: requestType.id },
          data: { workflowTypeId: workflow.id }
        });
        console.log(`✅ Linked ${requestTypeCode} to ${workflowCode}`);
      }
    }
  }

  console.log('✅ Workflow seeding completed!');
}

// To run standalone: npx tsx -e "import {PrismaClient} from '@prisma/client'; import {seedWorkflows} from './prisma/seed-workflows'; const p=new PrismaClient(); seedWorkflows(p).finally(()=>p.\$disconnect())"