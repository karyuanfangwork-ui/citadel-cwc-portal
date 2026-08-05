import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { relatedPartyGroupService } from '../services/relatedPartyGroup.service';

class RelatedPartyGroupController {
  /**
   * GET /related-party-groups
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string | undefined;

    const result = await relatedPartyGroupService.listRelatedPartyGroups({
      page,
      limit,
      search,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /related-party-groups/:id
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const group = await relatedPartyGroupService.getRelatedPartyGroup(id);

    if (!group) {
      throw new AppError('Related party group not found', 404);
    }

    res.json({ status: 'success', data: { group } });
  });

  /**
   * POST /related-party-groups
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const group = await relatedPartyGroupService.createRelatedPartyGroup(req.body);
    res.status(201).json({ status: 'success', data: { group } });
  });

  /**
   * PATCH /related-party-groups/:id
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const group = await relatedPartyGroupService.updateRelatedPartyGroup(id, req.body);

    if (!group) {
      throw new AppError('Related party group not found', 404);
    }

    res.json({ status: 'success', data: { group } });
  });

  /**
   * DELETE /related-party-groups/:id
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const group = await relatedPartyGroupService.deleteRelatedPartyGroup(id);

    if (!group) {
      throw new AppError('Related party group not found', 404);
    }

    res.json({ status: 'success', message: 'Related party group deleted successfully' });
  });

  /**
   * POST /related-party-groups/:id/members
   */
  addMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const groupId = String(req.params.id);
    const member = await relatedPartyGroupService.addMember(groupId, req.body);

    if (!member) {
      throw new AppError('Related party group or borrower profile not found', 404);
    }

    res.status(201).json({ status: 'success', data: { member } });
  });

  /**
   * DELETE /related-party-members/:memberId
   */
  removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
    const memberId = String(req.params.memberId);
    const member = await relatedPartyGroupService.removeMember(memberId);

    if (!member) {
      throw new AppError('Related party member not found', 404);
    }

    res.json({ status: 'success', message: 'Member removed from group successfully' });
  });

  /**
   * GET /related-party-groups/:id/exposure
   * §7.2 — Group Exposure Aggregation
   */
  getGroupExposure = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const exposure = await relatedPartyGroupService.getGroupExposure(id);

    if (!exposure) {
      throw new AppError('Related party group not found', 404);
    }

    res.json({ status: 'success', data: { exposure } });
  });
}

export const relatedPartyGroupController = new RelatedPartyGroupController();