import prisma from '../../utils/prisma';
import { ApprovalDecisionType, ApplicationState } from '@prisma/client';
import { approvalMatrixService } from './approvalMatrix.service';
import { ratingToOrdinal } from './approvalMatrix.service';
import { checkSodConflict } from '../middleware/sod.middleware';
import { formatCurrency } from '../utils/formatCurrency';
import { AuditChainService } from './auditChain.service';
import { notify } from '../../services/notification.service';
import { pushToUser } from '../../utils/sseClients';
import { logger } from '../../utils/logger';
import { computeBorrowerExposure } from './exposureCompute.service';
import { AppError } from '../../middleware/error.middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmitApprovalActionData {
  applicationId: string;
  decision: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE' | 'CONDITIONAL';
  comment?: string;
  isCommitteeVote?: boolean;
  rejectionReasonCode?: string;
  conditions?: { title: string; description?: string; category?: string; conditionType?: string; dueDate?: string | null }[];
  actorId: string;
  actorRoles: string[];
}

export interface ApprovalActionResult {
  decision: CreditDecisionRow;
  applicationState: string;
  approvalsCollected: number;
  approvalsRequired: number;
  isComplete: boolean;
}

interface CreditDecisionRow {
  id: string;
  applicationId: string;
  decisionType: string;
  decisionById: string;
  authorityLevel: string | null;
  comments: string | null;
  createdAt: Date;
}

// Authority level hierarchy — higher number = higher authority
export const AUTHORITY_HIERARCHY: Record<string, number> = {
  // New authority levels
  RM: 1,
  MANAGER: 2,
  COMMITTEE: 3,
  BOARD: 4,
  // Legacy aliases (remove after full DB migration)
  CREDIT_RM: 1,
  CREDIT_MANAGER: 2,
  SENIOR_CREDIT_OFFICER: 3,
  CREDIT_COMMITTEE: 4,
  BOARD_RISK_COMMITTEE: 5,
};

export function hasSufficientAuthority(userAuthority: string, requiredAuthority: string): boolean {
  const userLevel = AUTHORITY_HIERARCHY[userAuthority] ?? 0;
  const requiredLevel = AUTHORITY_HIERARCHY[requiredAuthority] ?? 0;
  return userLevel >= requiredLevel;
}

/**
 * Map authority level number to the role names that hold that authority.
 * Used by autoRouteNextApprover to find next-level approvers.
 */
export function getRoleNamesForAuthorityLevel(level: number): string[] {
  // Committee-level approval: find all CREDIT_MANAGER users
  // Board-level approval: find CREDIT_ADMIN and ADMIN users
  const mapping: Record<number, string[]> = {
    1: ['CREDIT_RM'],         // Tier 1: RM self-approval
    2: ['CREDIT_MANAGER'],    // Tier 2: Single manager approval
    3: ['CREDIT_MANAGER'],    // Tier 3: Committee (multiple managers)
    4: ['CREDIT_ADMIN'],      // Tier 4: Board/admin override
  };
  return mapping[level] ?? ['CREDIT_ADMIN'];
}

/**
 * Reverse mapping: given a set of user role names, return the highest
 * authority hierarchy numeric level the user holds.
 * Returns 0 if no recognised authority role is found.
 */
export function getUserAuthorityLevel(userRoles: string[]): number {
  let maxLevel = 0;
  for (const role of userRoles) {
    // Check if the role name itself is an authority key (e.g. CREDIT_MANAGER)
    if (AUTHORITY_HIERARCHY[role] !== undefined) {
      maxLevel = Math.max(maxLevel, AUTHORITY_HIERARCHY[role]);
    }
    // Also check level-to-role mapping (CREDIT_RM → level 1, CREDIT_MANAGER → level 2, etc.)
    for (let lvl = 1; lvl <= 4; lvl++) {
      if (getRoleNamesForAuthorityLevel(lvl).includes(role)) {
        maxLevel = Math.max(maxLevel, lvl);
      }
    }
  }
  return maxLevel;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ApprovalActionService {
  /**
   * Submit an approval action on a credit application.
   *
   * Flow:
   * 1. Lookup authority from matrix based on total exposure + borrower risk rating
   * 2. Check if user has required authority level
   * 3. Check SOD (RM cannot approve own app)
   * 4. If requiredApproverCount > 1, collect multiple approvals before advancing state
   * 5. On final approval, advance state; on reject, set rejected state; on return, go back to ANALYSING
   */
  async submitApprovalAction(data: SubmitApprovalActionData): Promise<ApprovalActionResult> {
    const { applicationId, decision, comment, isCommitteeVote, rejectionReasonCode, actorId, actorRoles } = data;

    // 1. Fetch the application with borrower profile
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        borrowerProfile: { select: { creditRiskRating: true } },
        decisions: {
          where: { decisionType: ApprovalDecisionType.APPROVE },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!application) {
      throw Object.assign(new Error('Credit application not found'), { statusCode: 404 });
    }

    // Only allow approval actions on certain states
    const approvalEligibleStates: ApplicationState[] = [
      ApplicationState.UNDERWRITING as ApplicationState,
      ApplicationState.CREDIT_ASSESSMENT as ApplicationState,
      ApplicationState.COMMITTEE_REVIEW as ApplicationState,
    ];

    if (!approvalEligibleStates.includes(application.state as ApplicationState)) {
      throw Object.assign(
        new Error(`Approval actions are not allowed on application in state '${application.state}'`),
        { statusCode: 400 },
      );
    }

    // 2. Check SOD — RM cannot approve own application
    if (application.assignedRmId === actorId) {
      throw Object.assign(
        new Error('Segregation of Duties violation: You cannot approve an application where you are the assigned Relationship Manager.'),
        { statusCode: 403 },
      );
    }

    // Also use the more thorough SOD check
    const sodConflict = await checkSodConflict(actorId, applicationId);
    if (sodConflict) {
      throw Object.assign(
        new Error('Segregation of Duties violation: You cannot approve this application due to conflicting roles.'),
        { statusCode: 403 },
      );
    }

    // 3. Lookup authority from approval matrix
    // §F2 — Use canonical exposure computation instead of stale BorrowerProfile.totalExposure
    const borrowerRating = application.borrowerProfile?.creditRiskRating ?? 'NR';
    const { totalExposure: liveExposure } = await computeBorrowerExposure(application.borrowerProfileId);
    const totalExposure = formatCurrency(liveExposure || application.requestedAmount) ?? 0;

    const authorityResult = await approvalMatrixService.lookupApprovalAuthority(totalExposure, borrowerRating ?? 'NR', application.branchId, application.lane);

    // P1-1 — Hard block: no matrix row means no configured approval path.
    // Without a matrix entry, there is no authority level or required approver count,
    // so any approval action would bypass governance controls entirely.
    if (!authorityResult) {
      throw new AppError(
        'No approval matrix entry matches this exposure/rating combination. Configure an approval matrix before proceeding.',
        403,
        { code: 'NO_APPROVAL_MATRIX' },
      );
    }

    let authorityLevel: string | null = authorityResult.authorityLevel;
    let requiredApproverCount = authorityResult.requiredApproverCount;

    // P1-1 — Board-band enforcement: exposures >= RM5M or risk rating CC/worse
    // must be approved by committee or board — never by a single manager.
    const BOARD_BAND_EXPOSURE_THRESHOLD = 5_000_000;
    const BOARD_BAND_RATING_ORDINAL = ratingToOrdinal('CC'); // CC or worse
    const currentRatingOrdinal = ratingToOrdinal(borrowerRating ?? 'NR');

    if (totalExposure >= BOARD_BAND_EXPOSURE_THRESHOLD || currentRatingOrdinal <= BOARD_BAND_RATING_ORDINAL) {
      const authorityOrdinal = AUTHORITY_HIERARCHY[authorityLevel!] ?? 0;
      if (authorityOrdinal < AUTHORITY_HIERARCHY['COMMITTEE']) {
        throw new AppError(
          'Board-band exposure or adverse rating requires committee-level or board-level approval.',
          403,
          { code: 'COMMITTEE_REQUIRED' },
        );
      }
    }

    // 4. Check if user has sufficient authority
    const userHighestAuthority = this.getHighestAuthorityLevel(actorRoles);
    if (!hasSufficientAuthority(userHighestAuthority, authorityLevel!)) {
      throw new AppError(
        `Insufficient approval authority. This application requires '${authorityLevel}' level approval. Your highest authority is '${userHighestAuthority}'.`,
        403,
        { code: 'INSUFFICIENT_AUTHORITY' },
      );
    }

    // 5–8. Atomic block: check duplicate, record decision, recount, advance state
    let creditDecision!: Awaited<ReturnType<typeof prisma.creditDecision.create>>;
    let newState = application.state;
    let approvalsCollected = 0;
    let isComplete = false;

    await prisma.$transaction(async (tx) => {
      // 5. Check for duplicate approval by same user (inside tx for consistency)
      if (decision === 'APPROVE') {
        const existingApproval = await tx.creditDecision.findFirst({
          where: {
            applicationId,
            decisionById: actorId,
            decisionType: ApprovalDecisionType.APPROVE,
          },
        });
        if (existingApproval) {
          throw Object.assign(
            new Error('You have already submitted an approval for this application.'),
            { statusCode: 400 },
          );
        }
      }

      // 6. Create the decision record
      creditDecision = await tx.creditDecision.create({
        data: {
          applicationId,
          decisionType: decision as ApprovalDecisionType,
          decisionById: actorId,
          authorityLevel,
          comments: comment ?? null,
        },
      });

      // §2.5 — Create conditions linked to this CONDITIONAL decision
      if (decision === 'CONDITIONAL' && data.conditions && data.conditions.length > 0) {
        await tx.condition.createMany({
          data: data.conditions.map((c) => ({
            applicationId,
            title: c.title,
            description: c.description ?? null,
            category: (c.category ?? 'PRE_DISBURSEMENT') as any,
            conditionType: (c.conditionType ?? 'PRECEDENT') as any,
            status: 'PENDING',
            isFulfilled: false,
            dueDate: c.dueDate ? new Date(c.dueDate) : null,
            decisionId: creditDecision.id,
          })),
        });
      }

      // 7. Determine the resulting application state
      if (decision === 'APPROVE' || decision === 'CONDITIONAL') {
        // Re-count distinct approvers inside the transaction to avoid race conditions
        const approveDecisions = await tx.creditDecision.findMany({
          where: {
            applicationId,
            decisionType: ApprovalDecisionType.APPROVE,
          },
          select: { decisionById: true },
        });
        const distinctApproverIds = new Set(approveDecisions.map((d) => d.decisionById));
        approvalsCollected = distinctApproverIds.size;

        if (approvalsCollected >= requiredApproverCount) {
          // Final approval — advance state
          newState = this.getNextApprovedState(application.state as ApplicationState) as ApplicationState;
          isComplete = true;
        } else {
          // More approvals needed
          isComplete = false;
        }
      } else if (decision === 'REJECT') {
        newState = ApplicationState.COMMITTEE_REVIEW as ApplicationState;
        // Map to the right "rejected" state from the existing state machine
        // The state machine uses REJECTED for committee rejection
        newState = ApplicationState.REJECTED as ApplicationState;
        isComplete = true;
      } else if (decision === 'RETURN') {
        // Refer back to analyst — transition to REFERRED_BACK state
        newState = ApplicationState.REFERRED_BACK as ApplicationState;
        isComplete = true;
      } else if (decision === 'ESCALATE') {
        // Stay in current state but flag for higher authority
        newState = application.state;
        isComplete = false;
      }

      // 8. Update application state if changed
      if (newState !== application.state) {
        const updateData: any = { state: newState };

        // Set decisionedAt if reaching a decisioned state
        if (isComplete && (decision === 'APPROVE' || decision === 'REJECT')) {
          updateData.decisionedAt = new Date();
        }

        // Set rejection reason if rejecting
        if (decision === 'REJECT' && comment) {
          updateData.rejectionReason = comment;
          updateData.rejectionReasonCode = rejectionReasonCode ?? null;
        }

        await tx.creditApplication.update({
          where: { id: applicationId },
          data: updateData,
        });
      }
    });

    // 9. Create audit event
    await this.createAuditEvent(
      applicationId,
      actorId,
      `approval_${decision.toLowerCase()}`,
      application.state,
      newState,
      {
        decision,
        authorityLevel,
        approvalsCollected,
        requiredApproverCount,
        comment,
        isCommitteeVote: isCommitteeVote ?? false,
        rejectionReasonCode,
      },
    );

    // §2.7 — Notify on rejection
    if (decision === 'REJECT') {
      const { rejectionService } = await import('./rejection.service');
      await rejectionService.notifyRejection(applicationId, rejectionReasonCode ?? 'OTHER', comment ?? null).catch(() => {});
    }

    // §4.2 — Auto-route next approver when more approvals are needed
    if ((decision === 'APPROVE' || decision === 'CONDITIONAL') && !isComplete) {
      const authorityLevelNum = authorityLevel
        ? AUTHORITY_HIERARCHY[authorityLevel] ?? 0
        : 0;
      await this.autoRouteNextApprover(
        applicationId,
        application.applicationNo ?? null,
        authorityLevelNum,
        requiredApproverCount,
        approvalsCollected,
        actorId,
      ).catch((err) => {
        logger.error(`[AutoRoute] Failed to route next approver for application ${applicationId}:`, err);
      });
    }

    return {
      decision: {
        id: creditDecision.id,
        applicationId: creditDecision.applicationId,
        decisionType: creditDecision.decisionType,
        decisionById: creditDecision.decisionById,
        authorityLevel: creditDecision.authorityLevel,
        comments: creditDecision.comments,
        createdAt: creditDecision.createdAt,
      },
      applicationState: newState,
      approvalsCollected: decision === 'APPROVE' ? approvalsCollected : 0,
      approvalsRequired: requiredApproverCount,
      isComplete,
    };
  }

  /**
   * Get the next state after a successful approval.
   */
  private getNextApprovedState(currentState: ApplicationState): string {
    // Based on the state machine in creditApplication.service.ts
    const stateAdvancements: Record<string, string> = {
      UNDERWRITING: 'CREDIT_ASSESSMENT',
      CREDIT_ASSESSMENT: 'COMMITTEE_REVIEW',
      COMMITTEE_REVIEW: 'APPROVED',
    };
    return stateAdvancements[currentState] ?? currentState;
  }

  /**
   * Get the highest authority level from a user's roles.
   */
  private getHighestAuthorityLevel(roles: string[]): string {
    let highest = '';
    let highestLevel = 0;
    for (const role of roles) {
      const level = AUTHORITY_HIERARCHY[role] ?? 0;
      if (level > highestLevel) {
        highestLevel = level;
        highest = role;
      }
    }
    return highest;
  }

  /**
   * Get all approval decisions for an application.
   */
  async getApplicationApprovals(applicationId: string) {
    return prisma.creditDecision.findMany({
      where: { applicationId },
      include: {
        decidedBy: { select: { id: true, firstName: true, lastName: true, department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /***
   * Create audit event for approval action — delegates to AuditChainService
   * for tamper-evident hash-chain creation.
   */
  private async createAuditEvent(
    applicationId: string,
    actorId: string,
    action: string,
    oldState: string,
    newState: string,
    metadata: Record<string, unknown>,
  ) {
    await AuditChainService.appendEvent(
      applicationId,
      'APPROVAL_ACTION',
      actorId,
      action,
      oldState,
      newState,
      metadata,
    );
  }

  // -----------------------------------------------------------------------
  // Auto-routing: notify the next-level approver(s) after an approval action
  // -----------------------------------------------------------------------

  /**
   * After an approval is submitted, if more approvals are needed,
   * find the next-level approvers and send them notifications.
   *
   * For committee-level (authority 4), this does NOT create individual
   * CreditDecision records — the committee meeting process handles that.
   */
  async autoRouteNextApprover(
    applicationId: string,
    applicationNo: string | null,
    currentAuthorityLevel: number,
    requiredApproverCount: number,
    approvalsCollected: number,
    currentApproverId: string,
  ): Promise<void> {
    // If all required approvals are collected, no routing needed — state will advance
    if (approvalsCollected >= requiredApproverCount) return;

    // Determine next authority level
    const nextLevel = currentAuthorityLevel + 1;
    const levelNames: Record<number, string> = {
      1: 'Relationship Manager',
      2: 'Credit Manager',
      3: 'Senior Credit Officer',
      4: 'Credit Committee',
      5: 'Board Risk Committee',
    };

    // Authority level 4 = committee — handled through CommitteeMeeting, not individual decisions
    if (nextLevel >= 4) {
      logger.info(
        `[AutoRoute] Application ${applicationId} requires committee-level approval (level ${nextLevel}). ` +
        'Committee meetings should be scheduled separately.',
      );
      // Notify the RM that committee review is needed
      const application = await prisma.creditApplication.findUnique({
        where: { id: applicationId },
        select: { assignedRmId: true },
      });
      if (application?.assignedRmId) {
        await this.notifyNextApprover(
          application.assignedRmId,
          applicationId,
          applicationNo,
          nextLevel,
          levelNames[nextLevel] ?? `Level ${nextLevel}`,
        );
      }
      return;
    }

    // Find users with the next authority level who can approve (SOD: exclude current approver)
    const nextAuthorityRoles = getRoleNamesForAuthorityLevel(nextLevel);
    const nextApprovers = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: currentApproverId }, // SOD: exclude current approver
        roles: {
          some: {
            role: {
              name: { in: nextAuthorityRoles },
              permissions: {
                some: {
                  permission: { name: 'credit:approve' },
                },
              },
            },
          },
        },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (nextApprovers.length === 0) {
      // Fallback: route to credit admin
      logger.warn(
        `[AutoRoute] No approvers found for authority level ${nextLevel}, falling back to CREDIT_ADMIN`,
      );
      const creditAdmins = await prisma.user.findMany({
        where: { isActive: true, roles: { some: { role: { name: 'CREDIT_ADMIN' } } } },
        select: { id: true, firstName: true, lastName: true },
      });
      if (creditAdmins.length === 0) {
        logger.warn(`[AutoRoute] No CREDIT_ADMIN users found either. Manual follow-up required for application ${applicationId}`);
        return;
      }
      for (const admin of creditAdmins) {
        await this.notifyNextApprover(admin.id, applicationId, applicationNo, nextLevel, 'Credit Admin (fallback)');
      }
      return;
    }

    // Notify all next-level approvers
    for (const approver of nextApprovers) {
      await this.notifyNextApprover(
        approver.id,
        applicationId,
        applicationNo,
        nextLevel,
        levelNames[nextLevel] ?? `Level ${nextLevel}`,
      );
    }
  }

  /**
   * Send an in-app notification + SSE push to a single approver.
   */
  private async notifyNextApprover(
    userId: string,
    applicationId: string,
    applicationNo: string | null,
    authorityLevel: number,
    levelName: string,
  ): Promise<void> {
    const displayId = applicationNo ?? applicationId.slice(0, 8);
    try {
      await notify({
        userId,
        eventType: 'credit_approval_requested',
        variables: {
          applicationId,
          applicationNo: displayId,
          authorityLevel: String(authorityLevel),
          levelName,
        },
      });

      // SSE push for My Work tab
      pushToUser(userId, 'approval_routed', {
        applicationId,
        authorityLevel,
        levelName,
      });
    } catch (err) {
      logger.error(`[AutoRoute] Failed to notify approver ${userId}:`, err);
    }
  }
}

export const approvalActionService = new ApprovalActionService();