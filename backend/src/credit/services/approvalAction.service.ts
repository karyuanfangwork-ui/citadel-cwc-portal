import prisma from '../../utils/prisma';
import { ApprovalDecisionType, ApplicationState } from '@prisma/client';
import { approvalMatrixService } from './approvalMatrix.service';
import { checkSodConflict } from '../middleware/sod.middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmitApprovalActionData {
  applicationId: string;
  decision: 'APPROVE' | 'REJECT' | 'RETURN' | 'ESCALATE';
  comment?: string;
  isCommitteeVote?: boolean;
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
const AUTHORITY_HIERARCHY: Record<string, number> = {
  CREDIT_RM: 1,
  CREDIT_MANAGER: 2,
  SENIOR_CREDIT_OFFICER: 3,
  CREDIT_COMMITTEE: 4,
  BOARD_RISK_COMMITTEE: 5,
};

function hasSufficientAuthority(userAuthority: string, requiredAuthority: string): boolean {
  const userLevel = AUTHORITY_HIERARCHY[userAuthority] ?? 0;
  const requiredLevel = AUTHORITY_HIERARCHY[requiredAuthority] ?? 0;
  return userLevel >= requiredLevel;
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
    const { applicationId, decision, comment, isCommitteeVote, actorId, actorRoles } = data;

    // 1. Fetch the application with borrower profile
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        borrowerProfile: { select: { creditRiskRating: true, totalExposure: true } },
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
    const borrowerRating = application.borrowerProfile?.creditRiskRating ?? 'NR';
    const totalExposure = Number(application.borrowerProfile?.totalExposure ?? application.requestedAmount);

    const authorityResult = await approvalMatrixService.lookupApprovalAuthority(totalExposure, borrowerRating ?? 'NR');

    let authorityLevel: string | null = null;
    let requiredApproverCount = 1;

    if (authorityResult) {
      authorityLevel = authorityResult.authorityLevel;
      requiredApproverCount = authorityResult.requiredApproverCount;

      // 4. Check if user has sufficient authority
      const userHighestAuthority = this.getHighestAuthorityLevel(actorRoles);
      if (!hasSufficientAuthority(userHighestAuthority, authorityLevel)) {
        throw Object.assign(
          new Error(`Insufficient approval authority. This application requires '${authorityLevel}' level approval. Your highest authority is '${userHighestAuthority}'.`),
          { statusCode: 403 },
        );
      }
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

      // 7. Determine the resulting application state
      if (decision === 'APPROVE') {
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
        // Send back to ANALYSING
        newState = ApplicationState.CREDIT_ASSESSMENT as ApplicationState;
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
      },
    );

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

  /**
   * Create audit event for approval action.
   */
  private async createAuditEvent(
    applicationId: string,
    actorId: string,
    action: string,
    oldState: string,
    newState: string,
    metadata: Record<string, unknown>,
  ) {
    await prisma.creditAuditEvent.create({
      data: {
        applicationId,
        eventType: 'APPROVAL_ACTION',
        actorId,
        action,
        oldState,
        newState,
        metadata: metadata as any,
      },
    });
  }
}

export const approvalActionService = new ApprovalActionService();