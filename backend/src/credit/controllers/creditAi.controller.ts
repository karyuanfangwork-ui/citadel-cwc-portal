import { Request, Response, NextFunction } from 'express';
import * as duplicateSvc from '../services/creditDuplicate.service';
import * as redFlagSvc from '../services/creditRedFlag.service';
import * as narrativeSvc from '../services/creditNarrative.service';
import * as complianceSvc from '../services/creditAiCompliance.service';
import * as exceptionSvc from '../services/creditAutoException.service';
import { listInteractions, recordFieldOverride } from '../services/credit-ai.service';

function getUserId(req: Request): string {
  return (req as any).user?.id ?? '';
}

// ── A6: Duplicate Detection ──────────────────────────────────────────────────

export async function checkDuplicates(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await duplicateSvc.findDuplicatesByApp(String(req.params.appId));
    res.json({ status: 'success', data: result });
  } catch (e) { next(e); }
}

// ── A5: Red Flags ─────────────────────────────────────────────────────────────

export async function generateRedFlags(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await redFlagSvc.generateRedFlags(String(req.params.appId), getUserId(req));
    res.json({ status: 'success', data: result });
  } catch (e) { next(e); }
}

// ── A4: Risk Narrative ────────────────────────────────────────────────────────

export async function generateNarrative(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await narrativeSvc.generateRiskNarrative(String(req.params.appId), getUserId(req));
    res.json({ status: 'success', data: result });
  } catch (e) { next(e); }
}

// ── A13: Compliance Check ─────────────────────────────────────────────────────

export async function runComplianceCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await complianceSvc.runAiComplianceCheck(String(req.params.appId), getUserId(req));
    res.json({ status: 'success', data: result });
  } catch (e) { next(e); }
}

// ── A15: Auto-Exception Detection ─────────────────────────────────────────────

export async function detectExceptions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await exceptionSvc.detectPolicyExceptions(String(req.params.appId), getUserId(req));
    res.json({ status: 'success', data: result });
  } catch (e) { next(e); }
}

// ── AI Interaction Audit ──────────────────────────────────────────────────────

export async function getInteractions(req: Request, res: Response, next: NextFunction) {
  try {
    const interactions = await listInteractions(String(req.params.appId));
    res.json({ status: 'success', data: { interactions } });
  } catch (e) { next(e); }
}

// ── Human Override ────────────────────────────────────────────────────────────

export async function recordOverride(req: Request, res: Response, next: NextFunction) {
  try {
    const { feature, fieldName, aiValue, overriddenValue, reason } = req.body;
    if (!feature || !fieldName || !reason) {
      return res.status(400).json({ status: 'error', message: 'feature, fieldName, and reason required' });
    }
    const override = await recordFieldOverride({
      feature,
      entityType: 'CREDIT_APPLICATION',
      entityId: String(req.params.appId),
      userId: getUserId(req),
      fieldName,
      aiValue: String(aiValue ?? ''),
      overriddenValue: String(overriddenValue ?? ''),
      reason,
    });
    res.status(201).json({ status: 'success', data: { override } });
  } catch (e) { next(e); }
}