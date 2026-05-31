import prisma from '../../utils/prisma';
import { BureauProvider, RiskRating } from '@prisma/client';

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

  for (const check of checks) {
    if (check.ccrisSaaFlag) caps.push({ reason: 'ccris_saa', maxRating: 'BBB' });
    if ((check.ccrisMissedPayments12Months ?? 0) >= 3) caps.push({ reason: 'ccris_missed_3', maxRating: 'BB' });
    if (check.ccrisLegalActionFlag) caps.push({ reason: 'ccris_legal_action', maxRating: 'B' });
    if (check.ccrisBankruptcyFlag) caps.push({ reason: 'ccris_bankruptcy', maxRating: 'C' });
    if (check.ctosAdverseFlag) caps.push({ reason: 'ctos_adverse', maxRating: 'BB' });
    if (check.ctosBankruptcyFlag) caps.push({ reason: 'ctos_bankruptcy', maxRating: 'C' });
    const score = check.ctosScore;
    if (score !== null && score !== undefined) {
      if (score < 300) caps.push({ reason: 'ctos_score_lt_300', maxRating: 'B' });
      else if (score < 500) caps.push({ reason: 'ctos_score_lt_500', maxRating: 'BB' });
    }
  }

  return caps;
}

export async function isBureauCheckFresh(applicationId: string): Promise<{ fresh: boolean; staleProviders: string[] }> {
  const checks = await prisma.creditBureauCheck.findMany({ where: { applicationId } });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const staleProviders: string[] = [];
  for (const check of checks) {
    const reportDate = check.ccrisReportDate ?? check.ctosReportDate ?? check.runDate;
    if (!reportDate || reportDate < cutoff) {
      staleProviders.push(check.provider);
    }
  }

  return { fresh: staleProviders.length === 0, staleProviders };
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
  return prisma.bureauChecklist.upsert({
    where: { applicationId },
    create: { applicationId, tickedById: userId, tickedAt: new Date(), ...data },
    update: { tickedById: userId, tickedAt: new Date(), ...data },
  });
}

export async function getBureauChecklist(applicationId: string) {
  return prisma.bureauChecklist.findUnique({ where: { applicationId } });
}

export async function isBureauChecklistComplete(applicationId: string): Promise<boolean> {
  const checklist = await getBureauChecklist(applicationId);
  if (!checklist) return false;
  return (
    checklist.ccrisUploaded &&
    checklist.ctosUploaded &&
    checklist.amlScreeningDone &&
    (checklist.noAdverseRecord || Boolean(checklist.adverseExceptionReason))
  );
}

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
    include: { runBy: { select: { id: true, firstName: true, lastName: true } } },
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
    include: { runBy: { select: { id: true, firstName: true, lastName: true } } },
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
    include: { runBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function remove(id: string) {
  return prisma.creditBureauCheck.delete({ where: { id } });
}
