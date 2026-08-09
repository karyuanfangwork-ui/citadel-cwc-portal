import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { borrowerProfileService } from '../services/borrowerProfile.service';

class BorrowerProfileController {
  /**
   * GET /borrowers/stats — Aggregate borrower counts for KPI cards
   */
  stats = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const stats = await borrowerProfileService.getBorrowerStats();
    res.json({ status: 'success', data: stats });
  });

  /**
   * GET /borrowers/search — Search borrowers by NRIC, phone, email, name, etc.
   */
  search = asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = (req.query.q as string | undefined || '').trim();
    if (q.length < 2) {
      throw new AppError('Search query must be at least 2 characters', 400);
    }
    const results = await borrowerProfileService.searchBorrowers(q);
    res.json({ status: 'success', data: results });
  });

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
   * GET /borrowers/:id/contact-nric/reveal — Reveal plaintext contact NRIC (PII-logged)
   */
  revealContactNric = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    if (!req.user?.id) throw new AppError('Unauthenticated', 401);
    const nric = await borrowerProfileService.revealContactNric(id, req.user.id);
    if (nric === null) throw new AppError('Borrower profile not found or no NRIC on record', 404);
    res.json({ status: 'success', data: { nric } });
  });

  /**
   * POST /borrowers — Create a new borrower profile
   * Supports ?overrideDuplicate=true (admin override) to skip duplicate detection.
   */
  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const overrideDuplicate = req.body.overrideDuplicate === true;
    const userId = req.user?.id;

    // If overrideDuplicate is requested but user lacks credit:admin, deny
    if (overrideDuplicate && userId) {
      const userPermissions: string[] = (req.user as any)?.permissions ?? [];
      if (!userPermissions.includes('credit:admin')) {
        throw new AppError('Only administrators can override duplicate detection', 403);
      }
    }

    try {
      const profile = await borrowerProfileService.createBorrowerProfile(req.body, {
        overrideDuplicate,
        overrideReason: req.body.overrideReason,
        userId: req.user?.id,
        userPermissions: (req.user as any)?.permissions ?? [],
      });
      res.status(201).json({ status: 'success', data: { profile } });
    } catch (err: any) {
      if (err instanceof AppError && err.statusCode === 409) {
        // Duplicate detected — return conflict with details
        res.status(409).json({
          status: 'conflict',
          message: err.message,
          data: err.details,
        });
        return;
      }
      throw err;
    }
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