import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { borrowerProfileService } from '../services/borrowerProfile.service';

class BorrowerProfileController {
  /**
   * GET /borrowers/check-duplicate — Check if a borrower exists for a given SSM or NRIC
   */
  checkDuplicate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const ssm = req.query.ssm as string | undefined;
    const nric = req.query.nric as string | undefined;

    if (!ssm && !nric) {
      throw new AppError('Provide ssm or nric query parameter', 400);
    }

    const result = await borrowerProfileService.checkDuplicate({ ssm, nric });
    res.json({ status: 'success', data: result });
  });

  /**
   * GET /borrowers — List borrower profiles with pagination & filters
   */
  list = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const borrowerType = req.query.borrowerType as string | undefined;
    const creditRiskRating = req.query.creditRiskRating as string | undefined;
    const amlRiskTier = req.query.amlRiskTier as string | undefined;
    const isSanctionedEntity = req.query.isSanctionedEntity === 'true' ? true : req.query.isSanctionedEntity === 'false' ? false : undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const search = req.query.search as string | undefined;

    const result = await borrowerProfileService.listBorrowerProfiles({
      page,
      limit,
      borrowerType,
      creditRiskRating,
      amlRiskTier,
      isSanctionedEntity,
      isActive,
      search,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /borrowers/:id — Get a single borrower profile
   */
  getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const profile = await borrowerProfileService.getBorrowerProfile(id);

    if (!profile) {
      throw new AppError('Borrower profile not found', 404);
    }

    res.json({ status: 'success', data: { profile } });
  });

  /**
   * POST /borrowers — Create a new borrower profile
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const profile = await borrowerProfileService.createBorrowerProfile(req.body);
    res.status(201).json({ status: 'success', data: { profile } });
  });

  /**
   * PATCH /borrowers/:id — Update a borrower profile
   */
  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const profile = await borrowerProfileService.updateBorrowerProfile(id, req.body);

    if (!profile) {
      throw new AppError('Borrower profile not found', 404);
    }

    res.json({ status: 'success', data: { profile } });
  });

  /**
   * DELETE /borrowers/:id — Soft-delete a borrower profile
   */
  delete = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const profile = await borrowerProfileService.deleteBorrowerProfile(id);

    if (!profile) {
      throw new AppError('Borrower profile not found', 404);
    }

    res.json({ status: 'success', message: 'Borrower profile deleted successfully' });
  });
}

export const borrowerProfileController = new BorrowerProfileController();