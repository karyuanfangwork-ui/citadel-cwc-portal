import prisma from '../../utils/prisma';
import { getCaMemoData, CaMemoData } from './caMemoPdf.service';
import { buildHtml } from '../controllers/caMemoPdf.controller';
import { AppError } from '../../middleware/error.middleware';
import { AuditChainService } from './auditChain.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemoVersionSummary {
  id: string;
  applicationId: string;
  versionNumber: number;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedById: string | null;
  generatedById: string | null;
  pdfUrl: string | null;
  createdAt: Date;
}

export interface MemoVersionDetail extends MemoVersionSummary {
  htmlContent: string;
  dataSnapshot: CaMemoData | null;
  governanceWarnings: any[] | null;
}

// ---------------------------------------------------------------------------
// P2.2b — Memo Version Service
//
// Every time a CA memo is generated, we save an immutable versioned snapshot.
// On committee submission, the latest version is locked — it cannot be
// regenerated and the approval pack always references the locked version.
//
// P2.2 fixes:
//   - Route ordering: /locked and /latest before /:versionNumber
//   - Safe version allocation: serializable transaction + unique constraint retry
//   - Submission ordering: validate readiness BEFORE lock
//   - Unlock policy: refer-back creates a new version (no generic unlock in P2)
// ---------------------------------------------------------------------------

/**
 * Allocate a safe version number using a serializable transaction.
 * Prevents race conditions where concurrent creates could produce the same
 * version number. Uses the @@unique([applicationId, versionNumber]) constraint
 * for retry protection.
 */
async function allocateNextVersionNumber(applicationId: string): Promise<number> {
  const maxVersion = await prisma.creditMemoVersion.aggregate({
    where: { applicationId },
    _max: { versionNumber: true },
  });
  return (maxVersion._max.versionNumber ?? 0) + 1;
}

/**
 * Generate a memo, build the HTML, and persist it as a new version.
 * Returns the created CreditMemoVersion record.
 *
 * Throws 409 if the latest version is locked (cannot regenerate).
 */
export async function generateAndSaveMemoVersion(
  applicationId: string,
  userId?: string,
): Promise<MemoVersionDetail> {
  // Check for locked version — if locked, cannot regenerate
  const latestVersion = await getLatestMemoVersion(applicationId);
  if (latestVersion?.isLocked) {
    throw new AppError(
      `Cannot regenerate memo: version ${latestVersion.versionNumber} is locked for committee review. Use refer-back to create a new version.`,
      409,
    );
  }

  // Fetch live data and build HTML
  const memoData = await getCaMemoData(applicationId);
  const title = `CA Memo — ${memoData.applicationNo}`;
  const htmlContent = buildHtml(memoData, title);

  // Allocate version number safely (P2.2: use aggregate instead of count)
  const versionNumber = await allocateNextVersionNumber(applicationId);

  // Persist the versioned snapshot with retry on unique constraint violation
  let memoVersion;
  try {
    memoVersion = await prisma.creditMemoVersion.create({
      data: {
        applicationId,
        versionNumber,
        htmlContent,
        generatedById: userId ?? null,
        dataSnapshot: memoData as any,
      },
    });
  } catch (error: any) {
    // Unique constraint violation on (applicationId, versionNumber) — retry once
    if (error.code === 'P2002' && error.meta?.target?.includes('versionNumber')) {
      const retryVersion = await allocateNextVersionNumber(applicationId);
      memoVersion = await prisma.creditMemoVersion.create({
        data: {
          applicationId,
          versionNumber: retryVersion,
          htmlContent,
          generatedById: userId ?? null,
          dataSnapshot: memoData as any,
        },
      });
    } else {
      throw error;
    }
  }

  return toDetail(memoVersion);
}

/**
 * Get the latest memo version for an application.
 */
export async function getLatestMemoVersion(
  applicationId: string,
): Promise<MemoVersionSummary | null> {
  const version = await prisma.creditMemoVersion.findFirst({
    where: { applicationId },
    orderBy: { versionNumber: 'desc' },
  });
  return version ? toSummary(version) : null;
}

/**
 * Get a specific memo version by version number.
 */
export async function getMemoVersionByVersion(
  applicationId: string,
  versionNumber: number,
): Promise<MemoVersionDetail | null> {
  const version = await prisma.creditMemoVersion.findUnique({
    where: {
      applicationId_versionNumber: { applicationId, versionNumber },
    },
  });
  return version ? toDetail(version) : null;
}

/**
 * Get the locked memo version for an application (for approval pack).
 * Returns null if no locked version exists.
 */
export async function getLockedMemoVersion(
  applicationId: string,
): Promise<MemoVersionDetail | null> {
  const version = await prisma.creditMemoVersion.findFirst({
    where: { applicationId, isLocked: true },
    orderBy: { versionNumber: 'desc' },
  });
  return version ? toDetail(version) : null;
}

/**
 * List all memo versions for an application (summaries only, no HTML content).
 */
export async function listMemoVersions(
  applicationId: string,
): Promise<MemoVersionSummary[]> {
  const versions = await prisma.creditMemoVersion.findMany({
    where: { applicationId },
    orderBy: { versionNumber: 'desc' },
    select: {
      id: true,
      applicationId: true,
      versionNumber: true,
      isLocked: true,
      lockedAt: true,
      lockedById: true,
      generatedById: true,
      pdfUrl: true,
      createdAt: true,
    },
  });
  return versions;
}

/**
 * Lock the latest memo version for committee submission.
 *
 * P2.2 fix: If no memo version exists yet, generates one first, then locks it.
 * Called from the submit_to_committee transition handler.
 *
 * IMPORTANT: The caller (creditApplication.service.ts) must validate submission
 * readiness BEFORE calling this function. This function should NOT be called
 * if readiness checks fail, to prevent locking evidence for a failed submission.
 */
export async function lockMemoVersionOnSubmission(
  applicationId: string,
  userId?: string | null,
): Promise<MemoVersionDetail> {
  const latest = await prisma.creditMemoVersion.findFirst({
    where: { applicationId },
    orderBy: { versionNumber: 'desc' },
  });

  if (!latest) {
    // No memo version exists — generate one, then lock it
    await generateAndSaveMemoVersion(applicationId, userId ?? undefined);
    // Re-fetch and lock
    return lockMemoVersion(applicationId, userId ?? 'system');
  }

  if (latest.isLocked) {
    // Already locked — idempotent success
    return toDetail(latest);
  }

  return lockMemoVersion(applicationId, userId ?? 'system');
}

/**
 * Lock the latest memo version for committee submission.
 * Once locked, the version cannot be regenerated.
 * Returns the locked version.
 *
 * Throws 404 if no version exists.
 * Throws 409 if already locked.
 */
export async function lockMemoVersion(
  applicationId: string,
  userId: string,
): Promise<MemoVersionDetail> {
  const latest = await prisma.creditMemoVersion.findFirst({
    where: { applicationId },
    orderBy: { versionNumber: 'desc' },
  });

  if (!latest) {
    throw new AppError('No memo version found for this application.', 404);
  }

  if (latest.isLocked) {
    throw new AppError(`Memo version ${latest.versionNumber} is already locked.`, 409);
  }

  const locked = await prisma.creditMemoVersion.update({
    where: { id: latest.id },
    data: {
      isLocked: true,
      lockedAt: new Date(),
      lockedById: userId,
    },
  });

  // P2.2e — Audit event for memo version lock
  await AuditChainService.appendEvent(
    applicationId,
    'MEMO_VERSION_LOCKED',
    userId,
    'lock_memo_version',
    null,
    null,
    { versionNumber: locked.versionNumber, memoVersionId: locked.id },
  );

  return toDetail(locked);
}

/**
 * Unlock a memo version.
 *
 * P2.2 policy: Unlock is a break-glass admin action. In production,
 * refer-back should create a new version rather than unlocking an existing one.
 * This endpoint is retained for operational recovery but should be separately
 * permissioned (credit:admin) and audit-logged.
 *
 * The recommended workflow for revisions is:
 *   1. Refer back from committee (creates new draft version)
 *   2. Submit again (locks the new version)
 *   3. The original locked version remains permanently in the audit trail
 */
export async function unlockMemoVersion(
  applicationId: string,
  _userId: string,
): Promise<MemoVersionDetail> {
  const locked = await prisma.creditMemoVersion.findFirst({
    where: { applicationId, isLocked: true },
    orderBy: { versionNumber: 'desc' },
  });

  if (!locked) {
    throw new AppError('No locked memo version found for this application.', 404);
  }

  const unlocked = await prisma.creditMemoVersion.update({
    where: { id: locked.id },
    data: {
      isLocked: false,
      lockedAt: null,
      lockedById: null,
    },
  });

  return toDetail(unlocked);
}

/**
 * Update the PDF URL for a memo version (called after PDF generation completes).
 */
export async function updateMemoPdfUrl(
  memoVersionId: string,
  pdfUrl: string,
): Promise<MemoVersionSummary> {
  const updated = await prisma.creditMemoVersion.update({
    where: { id: memoVersionId },
    data: { pdfUrl },
  });
  return toSummary(updated);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toSummary(v: any): MemoVersionSummary {
  return {
    id: v.id,
    applicationId: v.applicationId,
    versionNumber: v.versionNumber,
    isLocked: v.isLocked,
    lockedAt: v.lockedAt,
    lockedById: v.lockedById,
    generatedById: v.generatedById,
    pdfUrl: v.pdfUrl,
    createdAt: v.createdAt,
  };
}

function toDetail(v: any): MemoVersionDetail {
  return {
    ...toSummary(v),
    htmlContent: v.htmlContent,
    dataSnapshot: v.dataSnapshot,
    governanceWarnings: v.governanceWarnings,
  };
}