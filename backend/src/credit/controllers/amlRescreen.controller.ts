import { Response } from 'express';
import { amlRescreenService } from '../services/amlRescreen.service';
import { AmlRescreenOutcome, AmlRescreenAction } from '@prisma/client';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';

// ---------------------------------------------------------------------------
// §2.8 — AML Rescreen Event Controller
// ---------------------------------------------------------------------------

const VALID_OUTCOMES: string[] = Object.values(AmlRescreenOutcome);
const VALID_ACTIONS: string[] = Object.values(AmlRescreenAction);

/** POST /api/v1/credit/borrowers/:borrowerId/aml-rescreen — trigger + log */
export const triggerRescreen = asyncHandler(async (req: AuthRequest, res: Response) => {
  const borrowerId = req.params.borrowerId as string;
  const user = req.user!;
  const { applicationId, screeningSource, outcome, hitDetails, actionTaken, actionNotes } = req.body;

  if (!screeningSource) throw new AppError('screeningSource is required', 400);
  if (!outcome || !VALID_OUTCOMES.includes(outcome as string)) throw new AppError(`Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(', ')}`, 400);
  if (!actionTaken || !VALID_ACTIONS.includes(actionTaken as string)) throw new AppError(`Invalid actionTaken. Must be one of: ${VALID_ACTIONS.join(', ')}`, 400);

  const event = await amlRescreenService.triggerRescreen({
    borrowerProfileId: borrowerId,
    applicationId,
    triggeredById: user.id,
    screeningSource: screeningSource as string,
    outcome: outcome as AmlRescreenOutcome,
    hitDetails,
    actionTaken: actionTaken as AmlRescreenAction,
    actionNotes,
  });

  res.status(201).json({ success: true, data: event });
});

/** GET /api/v1/credit/borrowers/:borrowerId/aml-rescreen — history */
export const getRescreenHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const borrowerId = req.params.borrowerId as string;
  const history = await amlRescreenService.getHistory(borrowerId);
  res.json({ success: true, data: history });
});

/** PATCH /api/v1/credit/aml-rescreen/:eventId/review — compliance review */
export const reviewRescreenEvent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const eventId = req.params.eventId as string;
  const user = req.user!;
  const { reviewNotes } = req.body;
  const updated = await amlRescreenService.reviewEvent(eventId, user.id, reviewNotes);
  res.json({ success: true, data: updated });
});