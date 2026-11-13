import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { resolveRequestId } from '../utils/resolve';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { transitionHttpRequest } from '../utils/httpRequestTransition';
import { AuthRequest } from '../middleware/auth.middleware';

/** HR-only job posting after the single selected executive has approved. */
export const markHrJobPosted = asyncHandler(async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user;
  if (!actor?.roles?.some(role => role === 'AGENT' || role === 'ADMIN') ||
      (!actor.roles.includes('ADMIN') && actor.agentTeam?.trim().toUpperCase() !== 'HR')) {
    throw new AppError('Only HR agents may post hiring jobs', 403);
  }
  const id = await resolveRequestId(String(req.params.id));
  if (!id) throw new AppError('Request not found', 404);
  const request = await prisma.request.findFirst({
    where: { id, tenantId: actor.tenantId, deletedAt: null },
    include: { requestType: true, approvals: { where: { status: 'APPROVED', approverType: { in: ['CEO', 'GROUP_DCEO'] } } } },
  });
  if (!request || !actor.tenantId) throw new AppError('Request not found', 404);
  if (request.requestType?.code !== 'NEW_HIRING') throw new AppError('Job posting is only available for HR new hiring', 422);
  const expectedRole = request.status === 'CEO_APPROVED' ? 'CEO' : request.status === 'GROUP_DCEO_APPROVED' ? 'GROUP_DCEO' : null;
  if (!expectedRole) throw new AppError('The selected executive must approve before job posting', 409);
  if (request.executiveApproverId && (request.executiveApproverRole !== expectedRole ||
      !request.approvals.some(approval => approval.approverId === request.executiveApproverId && approval.approverType === expectedRole))) {
    throw new AppError('Saved executive selection does not match the approved decision', 409);
  }
  // Existing in-flight records without a choice need separate reviewed repair.
  if (!request.executiveApproverId) throw new AppError('Historical executive approval requires review before job posting', 409);
  const { jobPostingUrl, notes } = req.body;
  const customFields = { ...((request.customFields as Record<string, unknown>) || {}), jobPostingUrl, jobPostingNotes: notes, jobPostedAt: new Date().toISOString() };
  const updated = await transitionHttpRequest({
    req, request, toStatus: 'JOB_POSTED', source: 'approval.mark-job-posted', comment: notes,
    requestPatch: { customFields },
    transactionMutations: async tx => {
      await tx.requestActivity.create({ data: {
        requestId: id, authorId: actor.id, authorName: `${actor.firstName} ${actor.lastName}`.trim(),
        authorRole: 'HR Agent', activityType: 'SYSTEM',
        message: `Job posted${jobPostingUrl ? ': ' + jobPostingUrl : ''}`, isSystemGenerated: true,
      } });
    },
  });
  res.json({ status: 'success', data: { request: updated } });
});
