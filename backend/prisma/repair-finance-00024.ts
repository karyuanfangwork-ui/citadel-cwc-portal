import 'dotenv/config';
import prisma from '../src/utils/prisma';
import { transitionRequest } from '../src/services/requestTransition.service';
import { resumeSla } from '../src/services/sla-pause.service';
import { notify } from '../src/services/notification.service';

const referenceNumber = 'FINANCE-00024';
const tenantId = '00000000-0000-0000-0000-000000000001';
const systemActor = 'ab251697-48ef-48eb-a36a-945180b7af42';

async function main() {
  const writeMode = process.argv.includes('--write');
  if (!writeMode || !process.argv.includes('--approve-local-finance-00024-repair')) {
    throw new Error('Refusing request repair. Re-run with --write --approve-local-finance-00024-repair after reviewing the target state.');
  }
  const request = await prisma.request.findFirst({
    where: { referenceNumber, tenantId },
    include: { requestType: true, serviceDesk: true, approvals: true },
  });
  if (!request) throw new Error(`${referenceNumber} was not found in the expected tenant`);
  if (request.serviceDesk?.code !== 'FINANCE' || request.requestType?.code !== 'PURCHASE_REQUISITION') {
    throw new Error(`${referenceNumber} is not a Finance Purchase Requisition`);
  }

  const ceoApproval = request.approvals.find((approval) => approval.approverType === 'CEO');
  if (request.status !== 'PENDING_CEO_APPROVAL_FIN' || ceoApproval?.status !== 'APPROVED') {
    throw new Error(`Refusing repair: expected pending Finance CEO request with approved CEO row; got ${request.status} / ${ceoApproval?.status ?? 'missing'}`);
  }

  const existingCfo = request.approvals.find((approval) => approval.approverType === 'CFO' && approval.status === 'PENDING');
  if (existingCfo) {
    console.log(JSON.stringify({ referenceNumber, writePerformed: false, reason: 'CFO approval already exists', cfoApprovalId: existingCfo.id }));
    return;
  }

  const cfo = await prisma.user.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ executiveRole: 'CFO' }, { roles: { some: { role: { name: 'CFO' } } } }],
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!cfo) throw new Error('No active CFO approver is configured for this tenant');

  await transitionRequest(request.id, 'PENDING_CFO_APPROVAL_FIN', {
    userId: systemActor,
    userName: 'Workflow Rectification',
    userRole: 'SYSTEM',
    tenantId,
    source: 'workflow-rectification/finance-00024',
    comment: 'Repair existing approved CEO decision and route to CFO',
    requestPatch: { assignedToId: cfo.id },
    skipTransitionPolicy: true,
    actor: { userId: systemActor, roles: ['SYSTEM'], executiveRole: null },
  });

  const cfoApproval = await prisma.requestApproval.create({
    data: { requestId: request.id, approverType: 'CFO', approverId: cfo.id, status: 'PENDING', comments: null },
  });
  await resumeSla(request.id);
  await prisma.requestActivity.create({
    data: {
      requestId: request.id,
      authorName: 'Workflow Rectification',
      activityType: 'APPROVAL',
      message: `Existing CEO approval reconciled; request routed to CFO (${cfo.firstName} ${cfo.lastName})`,
      isSystemGenerated: true,
      metadata: { source: 'workflow-rectification/finance-00024', previousStatus: request.status, newStatus: 'PENDING_CFO_APPROVAL_FIN', cfoApprovalId: cfoApproval.id },
    },
  });
  await notify({ userId: cfo.id, eventType: 'APPROVAL_REQUIRED', variables: { requestId: request.id, role: 'CFO' }, relatedRequestId: request.id });
  console.log(JSON.stringify({ referenceNumber, writePerformed: true, newStatus: 'PENDING_CFO_APPROVAL_FIN', cfoId: cfo.id, cfoApprovalId: cfoApproval.id }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
