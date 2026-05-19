import { Response } from 'express';
import { AppError, asyncHandler } from '../../middleware/error.middleware';
import { AuthRequest } from '../../middleware/auth.middleware';
import { financialService } from '../services/financial.service';
import { requireUser } from '../utils/requireUser';

class FinancialController {
  // ===========================================================================
  // Statement CRUD
  // ===========================================================================

  /**
   * GET /borrowers/:borrowerProfileId/financials
   * List financial statements for a borrower
   */
  listStatements = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const statementType = req.query.statementType as string | undefined;
    const period = req.query.period as string | undefined;
    const status = req.query.status as string | undefined;
    const fiscalYearEnd = req.query.fiscalYearEnd as string | undefined;

    const result = await financialService.listStatements(borrowerProfileId, {
      page,
      limit,
      statementType,
      period,
      status,
      fiscalYearEnd,
    });

    res.json({ status: 'success', data: result });
  });

  /**
   * GET /financials/:id
   * Get a single financial statement with full details
   */
  getStatement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const statement = await financialService.getStatement(id);

    if (!statement) {
      throw new AppError('Financial statement not found', 404);
    }

    res.json({ status: 'success', data: { statement } });
  });

  /**
   * POST /borrowers/:borrowerProfileId/financials
   * Create a new financial statement
   */
  createStatement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = {
      ...req.body,
      borrowerProfileId: String(req.params.borrowerProfileId),
      enteredById: requireUser(req).id,
    };
    const statement = await financialService.createStatement(data);
    res.status(201).json({ status: 'success', data: { statement } });
  });

  /**
   * PATCH /financials/:id
   * Update a financial statement
   */
  updateStatement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    const statement = await financialService.updateStatement(id, req.body);

    if (!statement) {
      throw new AppError('Financial statement not found', 404);
    }

    res.json({ status: 'success', data: { statement } });
  });

  /**
   * DELETE /financials/:id
   * Soft-delete a financial statement (DRAFT only)
   */
  deleteStatement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);

    try {
      const statement = await financialService.deleteStatement(id);

      if (!statement) {
        throw new AppError('Financial statement not found', 404);
      }

      res.json({ status: 'success', message: 'Financial statement deleted successfully' });
    } catch (err: any) {
      if (err.message === 'Only DRAFT financial statements can be deleted') {
        throw new AppError(err.message, 400);
      }
      throw err;
    }
  });

  // ===========================================================================
  // Line Items
  // ===========================================================================

  /**
   * GET /financials/:id/line-items
   * List line items for a statement
   */
  listLineItems = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const lineItems = await financialService.listLineItems(statementId);

    res.json({ status: 'success', data: { lineItems } });
  });

  /**
   * POST /financials/:id/line-items
   * Batch upsert line items for a statement
   */
  upsertLineItems = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const { items } = req.body;
    const lineItems = await financialService.upsertLineItems(statementId, items);

    res.json({ status: 'success', data: { lineItems } });
  });

  // ===========================================================================
  // Balance Sheet Validation
  // ===========================================================================

  /**
   * POST /financials/:id/validate
   * Validate balance sheet balance
   */
  validateBalanceSheet = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const result = await financialService.validateBalanceSheet(statementId);

    res.json({ status: 'success', data: result });
  });

  // ===========================================================================
  // Maker-Checker Workflow
  // ===========================================================================

  /**
   * POST /financials/:id/submit
   * Submit a DRAFT statement for review
   */
  submitForReview = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const actor = requireUser(req);
    const actorId = actor.id;
    const isAdmin = actor.permissions.includes('credit:admin');

    try {
      const statement = await financialService.submitForReview(statementId, actorId, isAdmin);

      res.json({ status: 'success', data: { statement } });
    } catch (err: any) {
      if (err.message.includes('Only DRAFT') || err.message.includes('cannot submit')) {
        throw new AppError(err.message, 400);
      }
      throw err;
    }
  });

  /**
   * POST /financials/:id/review
   * Review (approve/reject) a statement
   */
  reviewStatement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const reviewer = requireUser(req);
    const reviewedById = reviewer.id;
    const isAdmin = reviewer.permissions.includes('credit:admin');
    const { decision } = req.body;

    if (!decision || !['APPROVE', 'REJECT'].includes(decision)) {
      throw new AppError('Decision must be "APPROVE" or "REJECT"', 400);
    }

    try {
      const statement = await financialService.reviewStatement(statementId, reviewedById, decision, isAdmin);

      res.json({ status: 'success', data: { statement } });
    } catch (err: any) {
      if (err.message.includes('Only REVIEWED') || err.message.includes('reviewer must be different')) {
        throw new AppError(err.message, 400);
      }
      throw err;
    }
  });

  // ===========================================================================
  // Ratios
  // ===========================================================================

  /**
   * POST /financials/:id/compute-ratios
   * Compute financial ratios from line items
   */
  computeRatios = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const ratios = await financialService.computeRatios(statementId);

    res.json({ status: 'success', data: { ratios, count: ratios.length } });
  });

  /**
   * GET /financials/:id/ratios
   * List computed ratios for a statement
   */
  listRatios = asyncHandler(async (req: AuthRequest, res: Response) => {
    const statementId = String(req.params.id);
    const category = req.query.category as string | undefined;
    const ratioKey = req.query.ratioKey as string | undefined;

    const ratios = await financialService.listRatios(statementId, { category, ratioKey });

    res.json({ status: 'success', data: { ratios } });
  });

  // ===========================================================================
  // Trend Analysis
  // ===========================================================================

  /**
   * GET /borrowers/:borrowerProfileId/trends
   * Get trend analysis for a borrower's financial ratios
   */
  getTrendAnalysis = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);
    const ratioKey = req.query.ratioKey as string | undefined;
    const category = req.query.category as string | undefined;

    const result = await financialService.getTrendAnalysis(borrowerProfileId, ratioKey, category);

    res.json({ status: 'success', data: result });
  });

  // ===========================================================================
  // Exposure Aggregation
  // ===========================================================================

  /**
   * GET /borrowers/:borrowerProfileId/exposure
   * Get total exposure for a borrower
   */
  getExposure = asyncHandler(async (req: AuthRequest, res: Response) => {
    const borrowerProfileId = String(req.params.borrowerProfileId);

    const result = await financialService.getExposure(borrowerProfileId);

    res.json({ status: 'success', data: result });
  });
}

export const financialController = new FinancialController();