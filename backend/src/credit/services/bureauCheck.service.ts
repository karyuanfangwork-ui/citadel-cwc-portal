import prisma from '../../utils/prisma';
import { BureauProvider, RiskRating } from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';
import { recalcScore } from './recalc.service';
import { getNumberPolicy, getStringPolicy } from './policyParameter.service';

// ── Bureau Rating Caps (Wave 3) ───────────────────────────────────────────────

export const RATING_ORDER: RiskRating[] = [
  'AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D',
];

export interface BureauCapInput {
  reason: string;
  maxRating: RiskRating;
}

export interface BureauCapResult {
  effectiveRating: RiskRating;
  capsApplied: string[];
}

function asRiskRating(value: string, fallback: RiskRating): RiskRating {
  return RATING_ORDER.includes(value as RiskRating) ? value as RiskRating : fallback;
}

export function applyBureauCaps(baseRating: RiskRating, caps: BureauCapInput[]): BureauCapResult {
  let effectiveIdx = RATING_ORDER.indexOf(baseRating);
  const capsApplied: string[] = [];

  for (const cap of caps) {
    const capIdx = RATING_ORDER.indexOf(cap.maxRating);
    if (capIdx > effectiveIdx) {
      effectiveIdx = capIdx;
      capsApplied.push(cap.reason);
    }
  }

  return { effectiveRating: RATING_ORDER[effectiveIdx], capsApplied };
}

export async function getBureauCapsForApplication(applicationId: string): Promise<BureauCapInput[]> {
  const checks = await prisma.creditBureauCheck.findMany({ where: { applicationId } });
  const caps: BureauCapInput[] = [];

  const [
    ccrisSaaMaxRating,
    ccrisMissedThreshold,
    ccrisMissedMaxRating,
    ccrisLegalMaxRating,
    ccrisBankruptcyMaxRating,
    ctosAdverseMaxRating,
    ctosBankruptcyMaxRating,
    ctosLt300Threshold,
    ctosLt300MaxRating,
    ctosLt500Threshold,
    ctosLt500MaxRating,
  ] = await Promise.all([
    getStringPolicy('bureau.cap.ccris_saa.max_rating', 'BBB'),
    getNumberPolicy('bureau.cap.ccris_missed_payments.threshold', 3),
    getStringPolicy('bureau.cap.ccris_missed_payments.max_rating', 'BB'),
    getStringPolicy('bureau.cap.ccris_legal_action.max_rating', 'B'),
    getStringPolicy('bureau.cap.ccris_bankruptcy.max_rating', 'C'),
    getStringPolicy('bureau.cap.ctos_adverse.max_rating', 'BB'),
    getStringPolicy('bureau.cap.ctos_bankruptcy.max_rating', 'C'),
    getNumberPolicy('bureau.cap.ctos_score_lt_300.threshold', 300),
    getStringPolicy('bureau.cap.ctos_score_lt_300.max_rating', 'B'),
    getNumberPolicy('bureau.cap.ctos_score_lt_500.threshold', 500),
    getStringPolicy('bureau.cap.ctos_score_lt_500.max_rating', 'BB'),
  ]);

  for (const check of checks) {
    if (check.ccrisSaaFlag) caps.push({ reason: 'ccris_saa', maxRating: asRiskRating(ccrisSaaMaxRating, 'BBB') });
    if ((check.ccrisMissedPayments12Months ?? 0) >= ccrisMissedThreshold) {
      caps.push({ reason: `ccris_missed_${ccrisMissedThreshold}`, maxRating: asRiskRating(ccrisMissedMaxRating, 'BB') });
    }
    if (check.ccrisLegalActionFlag) caps.push({ reason: 'ccris_legal_action', maxRating: asRiskRating(ccrisLegalMaxRating, 'B') });
    if (check.ccrisBankruptcyFlag) caps.push({ reason: 'ccris_bankruptcy', maxRating: asRiskRating(ccrisBankruptcyMaxRating, 'C') });
    if (check.ctosAdverseFlag) caps.push({ reason: 'ctos_adverse', maxRating: asRiskRating(ctosAdverseMaxRating, 'BB') });
    if (check.ctosBankruptcyFlag) caps.push({ reason: 'ctos_bankruptcy', maxRating: asRiskRating(ctosBankruptcyMaxRating, 'C') });
    const score = check.ctosScore;
    if (score !== null && score !== undefined) {
      if (score < ctosLt300Threshold) caps.push({ reason: `ctos_score_lt_${ctosLt300Threshold}`, maxRating: asRiskRating(ctosLt300MaxRating, 'B') });
      else if (score < ctosLt500Threshold) caps.push({ reason: `ctos_score_lt_${ctosLt500Threshold}`, maxRating: asRiskRating(ctosLt500MaxRating, 'BB') });
    }
  }

  return caps;
}

export async function getBureauFreshnessDays(): Promise<number> {
  return getNumberPolicy('bureau.freshness_days', 90);
}

export async function isBureauCheckFresh(applicationId: string): Promise<{ fresh: boolean; staleProviders: string[] }> {
  const checks = await prisma.creditBureauCheck.findMany({ where: { applicationId } });
  const freshnessDays = await getBureauFreshnessDays();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - freshnessDays);

  const staleProviders: string[] = [];
  for (const check of checks) {
    const reportDate = check.ccrisReportDate ?? check.ctosReportDate ?? check.runDate;
    if (!reportDate || reportDate < cutoff) {
      staleProviders.push(check.provider);
    }
  }

  return { fresh: staleProviders.length === 0, staleProviders };
}

// ── Bureau Checklist — Tick Enforcement ─────────────────────────────────────
//
// Before setting ccrisUploaded=true or ctosUploaded=true, verify that:
//   1. A CreditBureauCheck row exists with the correct provider and attachedDocId
//   2. The linked CreditDocument has verificationStatus = 'VERIFIED'
//
// This prevents ticking without a verified bureau report PDF uploaded.

/**
 * Validate that a bureau report PDF has been uploaded and verified before
 * ticking the corresponding checklist item.
 */
async function requireVerifiedBureauDoc(
  applicationId: string,
  provider: BureauProvider,
  fieldLabel: string,
): Promise<void> {
  const app = await prisma.creditApplication.findUnique({
    where: { id: applicationId },
    select: { lane: true },
  });

  // Personal Fast is intentionally streamlined: bureau checklist ticks are
  // allowed without a supporting uploaded PDF attachment.
  if (app?.lane === 'PERSONAL_FAST') {
    return;
  }

  const bureauCheck = await prisma.creditBureauCheck.findFirst({
    where: { applicationId, provider },
    include: { attachedDoc: true },
  });

  if (!bureauCheck?.attachedDocId) {
    throw new AppError(
      `Bureau report PDF must be uploaded (${provider}) before ticking ${fieldLabel}.`,
      400,
    );
  }

  if (bureauCheck.attachedDoc?.verificationStatus !== 'VERIFIED') {
    throw new AppError(
      `Bureau report PDF must be verified by a credit officer before ticking ${fieldLabel}. Document status: ${bureauCheck.attachedDoc?.verificationStatus ?? 'PENDING'}`,
      400,
    );
  }
}

export async function upsertBureauChecklist(
  applicationId: string,
  userId: string,
  data: {
    ccrisUploaded?: boolean;
    ctosUploaded?: boolean;
    noAdverseRecord?: boolean;
    adverseExceptionReason?: string;
    amlScreeningDone?: boolean;
  },
) {
  const {
    ccrisUploaded,
    ctosUploaded,
    noAdverseRecord,
    adverseExceptionReason,
    amlScreeningDone,
  } = data;

  // ── Tick enforcement: ccrisUploaded requires verified CCRIS doc ──
  if (ccrisUploaded) {
    await requireVerifiedBureauDoc(applicationId, 'CCRIS_BORROWER_UPLOAD' as BureauProvider, 'ccrisUploaded');
  }

  // ── Tick enforcement: ctosUploaded requires verified CTOS doc ──
  if (ctosUploaded) {
    await requireVerifiedBureauDoc(applicationId, 'CTOS' as BureauProvider, 'ctosUploaded');
  }

  // ── If ticking any checkbox, clear verifiedById (must re-verify) ──
  const hasTickChange = ccrisUploaded !== undefined || ctosUploaded !== undefined
    || noAdverseRecord !== undefined || amlScreeningDone !== undefined;

  const checklistData = {
    ccrisUploaded,
    ctosUploaded,
    noAdverseRecord,
    adverseExceptionReason,
    amlScreeningDone,
  };

  const result = await prisma.bureauChecklist.upsert({
    where: { applicationId },
    create: {
      applicationId,
      tickedById: userId,
      tickedAt: new Date(),
      ...checklistData,
    },
    update: {
      tickedById: userId,
      tickedAt: new Date(),
      ...checklistData,
      // Any tick change invalidates the previous verification
      ...(hasTickChange ? { verifiedById: null, verifiedAt: null } : {}),
    },
  });

  // Phase 2 — event-driven recalc: bureau caps affect the final rating
  recalcScore(applicationId, 'bureau_checklist_update', {
    sourceUpdatedAt: new Date(),
  }).catch(() => {});

  return result;
}

export async function getBureauChecklist(applicationId: string) {
  return prisma.bureauChecklist.findUnique({
    where: { applicationId },
    include: {
      tickedBy: { select: { id: true, firstName: true, lastName: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function isBureauChecklistComplete(applicationId: string): Promise<boolean> {
  const [app, checklist] = await Promise.all([
    prisma.creditApplication.findUnique({
      where: { id: applicationId },
      select: { lane: true },
    }),
    prisma.bureauChecklist.findUnique({ where: { applicationId } }),
  ]);

  if (!checklist) return false;

  const isPersonalFast = app?.lane === 'PERSONAL_FAST';
  return (
    checklist.amlScreeningDone &&
    (checklist.noAdverseRecord || Boolean(checklist.adverseExceptionReason)) &&
    (isPersonalFast || (checklist.ccrisUploaded && checklist.ctosUploaded))
  );
}

export async function isBureauChecklistVerified(applicationId: string): Promise<boolean> {
  const checklist = await prisma.bureauChecklist.findUnique({ where: { applicationId } });
  if (!checklist) return false;
  return checklist.verifiedById !== null;
}

// ── Verify Checklist (maker-checker) ────────────────────────────────────────
//
// A supervisor (credit:approve) verifies the bureau checklist after the
// analyst ticks all items. The verifier must be a different person from
// the one who ticked the checklist.

export async function verifyChecklist(
  applicationId: string,
  verifiedById: string,
): Promise<any> {
  const checklist = await prisma.bureauChecklist.findUnique({
    where: { applicationId },
    include: {
      tickedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!checklist) {
    throw new AppError('Bureau checklist not found for this application.', 404);
  }

  // Must be complete before verifying (Personal Fast uses the streamlined rule set).
  if (!(await isBureauChecklistComplete(applicationId))) {
    throw new AppError(
      'Bureau checklist must be complete before verification.',
      400,
    );
  }

  // Maker-checker: verifier cannot be the same person who ticked
  if (checklist.tickedById && checklist.tickedById === verifiedById) {
    throw new AppError(
      'Checklist verification requires a different officer from the one who ticked the items.',
      400,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.bureauChecklist.update({
      where: { applicationId },
      data: {
        verifiedById,
        verifiedAt: new Date(),
      },
      include: {
        tickedBy: { select: { id: true, firstName: true, lastName: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Log audit event
    await AuditChainService.appendEvent(
      applicationId,
      'BUREAU_CHECKLIST_VERIFIED',
      verifiedById,
      'verify',
      undefined,
      undefined,
      { verifiedById },
      tx as any,
    );

    return result;
  });

  return updated;
}

// ── Bureau Check CRUD ───────────────────────────────────────────────────────

export interface CreateBureauCheckData {
  provider: BureauProvider;
  subjectName?: string | null;
  runDate?: string | null;
  runById?: string | null;
  hasHits?: boolean | null;
  findings?: string | null;
  attachedDocId?: string | null;
}

export async function listByApplication(applicationId: string) {
  return prisma.creditBureauCheck.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
    include: {
      runBy: { select: { id: true, firstName: true, lastName: true } },
      attachedDoc: { select: { id: true, verificationStatus: true, fileName: true, classification: true } },
    },
  });
}

export async function create(applicationId: string, data: CreateBureauCheckData) {
  return prisma.creditBureauCheck.create({
    data: {
      applicationId,
      provider: data.provider,
      subjectName: data.subjectName ?? null,
      runDate: data.runDate ? new Date(data.runDate) : null,
      runById: data.runById ?? null,
      hasHits: data.hasHits ?? null,
      findings: data.findings ?? null,
      attachedDocId: data.attachedDocId ?? null,
    },
    include: {
      runBy: { select: { id: true, firstName: true, lastName: true } },
      attachedDoc: { select: { id: true, verificationStatus: true, fileName: true, classification: true } },
    },
  });
}

export async function update(id: string, data: Partial<CreateBureauCheckData>) {
  return prisma.creditBureauCheck.update({
    where: { id },
    data: {
      provider: data.provider,
      subjectName: data.subjectName,
      runDate: data.runDate ? new Date(data.runDate) : data.runDate === null ? null : undefined,
      runById: data.runById,
      hasHits: data.hasHits,
      findings: data.findings,
      attachedDocId: data.attachedDocId,
    },
    include: {
      runBy: { select: { id: true, firstName: true, lastName: true } },
      attachedDoc: { select: { id: true, verificationStatus: true, fileName: true, classification: true } },
    },
  });
}

export async function remove(id: string) {
  return prisma.creditBureauCheck.delete({ where: { id } });
}