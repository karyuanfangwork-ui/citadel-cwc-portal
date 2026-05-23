import { Request, Response } from 'express';
import { policyExplainerService } from '../services/policyExplainer.service';

/**
 * GET /api/v1/approvals/policy-explainer
 * Query params:
 *   type  — 'itsm' | 'credit'
 *   id    — requestId (for ITSM) or applicationId (for credit)
 *
 * Returns a human-readable explanation of why the current user
 * is seeing an approval item in their queue.
 */
export const getPolicyExplanation = async (req: Request, res: Response) => {
  try {
    const type = String(req.query.type || '').toLowerCase();
    const id = String(req.query.id || '');
    const currentUserId = (req as any).user?.id;

    if (!type || !['itsm', 'credit'].includes(type)) {
      res.status(400).json({
        status: 'error',
        message: "Query param 'type' must be 'itsm' or 'credit'",
      });
      return;
    }

    if (!id) {
      res.status(400).json({
        status: 'error',
        message: "Query param 'id' is required",
      });
      return;
    }

    if (!currentUserId) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
      return;
    }

    if (type === 'itsm') {
      const explanation = await policyExplainerService.explainItsmPolicy(id, currentUserId);
      res.json({ status: 'success', data: explanation });
    } else {
      const explanation = await policyExplainerService.explainCreditPolicy(id, currentUserId);
      res.json({ status: 'success', data: explanation });
    }
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Failed to generate policy explanation',
    });
  }
};