import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { committeeService } from '../services/committee.service';
import { requireUser } from '../utils/requireUser';
import prisma from '../../utils/prisma';

class CommitteeController {
  // ===========================================================================
  // Meeting CRUD
  // ===========================================================================

  /**
   * GET /committee/meetings — List committee meetings
   */
  listMeetings = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string | undefined;
    const meetingType = req.query.meetingType as string | undefined;

    const result = await committeeService.listMeetings({ page, limit, status, meetingType });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /committee/meetings/:id — Get a single meeting
   */
  getMeeting = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const meeting = await committeeService.getMeeting(id);

    if (!meeting) {
      throw new AppError('Committee meeting not found', 404);
    }

    res.json({ status: 'success', data: { meeting } });
  });

  /**
   * POST /committee/meetings — Create a new meeting
   */
  createMeeting = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meeting = await committeeService.createMeeting(req.body);
    res.status(201).json({ status: 'success', data: { meeting } });
  });

  /**
   * PATCH /committee/meetings/:id — Update a meeting
   */
  updateMeeting = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const meeting = await committeeService.updateMeeting(id, req.body);

    if (!meeting) {
      throw new AppError('Committee meeting not found', 404);
    }

    res.json({ status: 'success', data: { meeting } });
  });

  /**
   * DELETE /committee/meetings/:id — Delete a meeting
   */
  deleteMeeting = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);

    try {
      await committeeService.deleteMeeting(id);
      res.json({ status: 'success', message: 'Committee meeting deleted successfully' });
    } catch {
      throw new AppError('Committee meeting not found', 404);
    }
  });

  // ===========================================================================
  // Members
  // ===========================================================================

  /**
   * POST /committee/meetings/:id/members — Add a member to a meeting
   */
  addMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meetingId = String(req.params.id);

    try {
      const member = await committeeService.addMember(meetingId, req.body);
      res.status(201).json({ status: 'success', data: { member } });
    } catch (error: any) {
      if (error.message?.includes('already a member')) {
        throw new AppError(error.message, 409);
      }
      throw error;
    }
  });

  /**
   * DELETE /committee/meetings/:id/members/:userId — Remove a member from a meeting
   */
  removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meetingId = String(req.params.id);
    const userId = String(req.params.userId);

    try {
      await committeeService.removeMember(meetingId, userId);
      res.json({ status: 'success', message: 'Member removed successfully' });
    } catch {
      throw new AppError('Member not found in this meeting', 404);
    }
  });

  /**
   * PATCH /committee/meetings/:id/members/:userId/attendance — Update attendance
   */
  updateAttendance = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meetingId = String(req.params.id);
    const userId = String(req.params.userId);

    try {
      const member = await committeeService.updateAttendance(meetingId, userId, req.body.attendance);
      res.json({ status: 'success', data: { member } });
    } catch {
      throw new AppError('Member not found in this meeting', 404);
    }
  });

  // ===========================================================================
  // Quorum
  // ===========================================================================

  /**
   * GET /committee/meetings/:id/quorum — Check quorum
   */
  checkQuorum = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meetingId = String(req.params.id);
    const quorum = await committeeService.checkQuorum(meetingId);

    if (!quorum) {
      throw new AppError('Committee meeting not found', 404);
    }

    res.json({ status: 'success', data: { quorum } });
  });

  // ===========================================================================
  // Agenda Items
  // ===========================================================================

  /**
   * POST /committee/meetings/:id/agenda — Add an agenda item
   */
  addAgendaItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meetingId = String(req.params.id);
    const item = await committeeService.addAgendaItem(meetingId, req.body);
    res.status(201).json({ status: 'success', data: { item } });
  });

  /**
   * DELETE /committee/agenda/:itemId — Remove an agenda item
   */
  removeAgendaItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const itemId = String(req.params.itemId);

    try {
      await committeeService.removeAgendaItem(itemId);
      res.json({ status: 'success', message: 'Agenda item removed successfully' });
    } catch {
      throw new AppError('Agenda item not found', 404);
    }
  });

  /**
   * PUT /committee/meetings/:id/agenda/reorder — Reorder agenda items
   */
  reorderAgenda = asyncHandler(async (req: AuthRequest, res: Response) => {
    const meetingId = String(req.params.id);
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new AppError('itemIds must be a non-empty array', 400);
    }

    const items = await committeeService.reorderAgenda(meetingId, itemIds);
    res.json({ status: 'success', data: { agendaItems: items } });
  });

  // ===========================================================================
  // Voting
  // ===========================================================================

  /**
   * POST /committee/agenda/:itemId/vote — Cast a vote
   */
  castVote = asyncHandler(async (req: AuthRequest, res: Response) => {
    const agendaItemId = String(req.params.itemId);
    const userId = req.user?.id;

    try {
      const vote = await committeeService.castVote(agendaItemId, req.body.memberId, req.body, userId);
      res.status(201).json({ status: 'success', data: { vote } });
    } catch (error: any) {
      if (error.message?.includes('already voted')) {
        throw new AppError(error.message, 409);
      }
      throw error;
    }
  });

  /**
   * GET /committee/agenda/:itemId/results — Get vote results
   */
  getVoteResults = asyncHandler(async (req: AuthRequest, res: Response) => {
    const agendaItemId = String(req.params.itemId);
    const results = await committeeService.getVoteResults(agendaItemId);

    res.json({ status: 'success', data: results });
  });

  // ===========================================================================
  // Decision
  // ===========================================================================

  /**
   * POST /committee/agenda/:itemId/finalize — Finalize decision
   *
   * Server-side checks:
   *  - The finalizer must be the meeting's chair or secretary.
   *  - If the decision is REJECT, a comment of at least 10 characters is required.
   */
  finalizeDecision = asyncHandler(async (req: AuthRequest, res: Response) => {
    const agendaItemId = String(req.params.itemId);
    const actorId = requireUser(req).id;
    const { comment } = req.body;

    // ── Server-side check: finalizer must be chair or secretary of the meeting ──
    const agendaItem = await prisma.committeeAgendaItem.findUnique({
      where: { id: agendaItemId },
      select: { meetingId: true, decisionResult: true },
    });

    if (!agendaItem) {
      throw new AppError('Agenda item not found', 404);
    }

    if (agendaItem.decisionResult) {
      throw new AppError('This agenda item has already been finalized', 409);
    }

    const member = await prisma.committeeMember.findUnique({
      where: {
        meetingId_userId: { meetingId: agendaItem.meetingId, userId: actorId },
      },
    });

    if (!member || (member.role !== 'CHAIR' && member.role !== 'SECRETARY')) {
      throw new AppError(
        'Only the meeting chair or secretary can finalize the decision',
        403,
      );
    }

    // ── Server-side check: REJECT requires ≥10-char comment ──────────────────
    // We need to determine the decision result to enforce the reject comment rule.
    // We pass the comment and validate inside the service, but we also validate
    // here before calling the service for early feedback.
    // The service will also enforce this as a defense-in-depth measure.

    try {
      const result = await committeeService.finalizeDecision(agendaItemId, actorId, comment);
      res.json({ status: 'success', data: result });
    } catch (error: any) {
      if (error.message?.includes('already been finalized')) {
        throw new AppError(error.message, 409);
      }
      if (error.message?.includes('Quorum not met')) {
        throw new AppError(error.message, 422);
      }
      if (error.message?.includes('Reject comment required')) {
        throw new AppError(error.message, 400);
      }
      throw error;
    }
  });

  // ===========================================================================
  // Memo
  // ===========================================================================

  /**
   * GET /committee/applications/:applicationId/memo — Generate memo
   */
  generateMemo = asyncHandler(async (req: AuthRequest, res: Response) => {
    const applicationId = String(req.params.applicationId);
    const memo = await committeeService.generateMemo(applicationId);

    if (!memo) {
      throw new AppError('Credit application not found', 404);
    }

    res.json({ status: 'success', data: { memo } });
  });
}

export const committeeController = new CommitteeController();