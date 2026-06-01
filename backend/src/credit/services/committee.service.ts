import prisma from '../../utils/prisma';
import { CommitteeAttendance, AgendaItemDecisionType, ApplicationState } from '@prisma/client';
import { creditApplicationService } from './creditApplication.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListMeetingsOptions {
  page?: number;
  limit?: number;
  status?: string;
  meetingType?: string;
}

export interface CreateMeetingData {
  title: string;
  scheduledAt: string | Date;
  location?: string;
  quorumMin?: number;
  meetingType?: string;
}

export interface UpdateMeetingData {
  title?: string;
  scheduledAt?: string | Date;
  location?: string;
  status?: string;
  quorumMin?: number;
  meetingType?: string;
}

export interface AddMemberData {
  userId: string;
  role: string;
}

export interface AddAgendaItemData {
  applicationId: string;
  displayOrder: number;
  decisionType?: string;
  presentedById?: string;
}

export interface CastVoteData {
  vote: string;
  comments?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CommitteeService {
  // =========================================================================
  // Meeting CRUD
  // =========================================================================

  /**
   * List committee meetings with pagination and filters.
   */
  async listMeetings(options: ListMeetingsOptions) {
    const { page = 1, limit = 20, status, meetingType } = options;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (meetingType) where.meetingType = meetingType;

    const [meetings, total] = await Promise.all([
      prisma.committeeMeeting.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          members: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true } },
            },
          },
          agendaItems: {
            include: {
              application: {
                select: { id: true, applicationNo: true, state: true, requestedAmount: true },
              },
              presentedBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { displayOrder: 'asc' },
          },
        },
      }),
      prisma.committeeMeeting.count({ where }),
    ]);

    return {
      meetings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single committee meeting by ID with full details.
   */
  async getMeeting(id: string) {
    return prisma.committeeMeeting.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true } },
          },
        },
        agendaItems: {
          include: {
            application: {
              select: { id: true, applicationNo: true, state: true, requestedAmount: true, purpose: true },
            },
            presentedBy: { select: { id: true, firstName: true, lastName: true } },
            votes: {
              include: {
                member: {
                  include: {
                    user: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  /**
   * Create a new committee meeting.
   */
  async createMeeting(data: CreateMeetingData) {
    return prisma.committeeMeeting.create({
      data: {
        title: data.title,
        scheduledAt: new Date(data.scheduledAt),
        location: data.location ?? null,
        quorumMin: data.quorumMin ?? 3,
        meetingType: (data.meetingType as any) ?? 'REGULAR',
      },
      include: {
        members: true,
        agendaItems: true,
      },
    });
  }

  /**
   * Update a committee meeting.
   */
  async updateMeeting(id: string, data: UpdateMeetingData) {
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.location !== undefined) updateData.location = data.location;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.quorumMin !== undefined) updateData.quorumMin = data.quorumMin;
    if (data.meetingType !== undefined) updateData.meetingType = data.meetingType;

    return prisma.committeeMeeting.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        agendaItems: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  }

  /**
   * Delete a committee meeting.
   */
  async deleteMeeting(id: string) {
    return prisma.committeeMeeting.delete({
      where: { id },
    });
  }

  // =========================================================================
  // Members
  // =========================================================================

  /**
   * Add a member to a meeting.
   */
  async addMember(meetingId: string, data: AddMemberData) {
    try {
      return await prisma.committeeMember.create({
        data: {
          meetingId,
          userId: data.userId,
          role: data.role as any,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true } },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('This user is already a member of this meeting');
      }
      throw error;
    }
  }

  /**
   * Remove a member from a meeting.
   */
  async removeMember(meetingId: string, userId: string) {
    return prisma.committeeMember.delete({
      where: {
        meetingId_userId: { meetingId, userId },
      },
    });
  }

  /**
   * Update a member's attendance status.
   */
  async updateAttendance(meetingId: string, userId: string, attendance: string) {
    return prisma.committeeMember.update({
      where: {
        meetingId_userId: { meetingId, userId },
      },
      data: {
        attendance: attendance as CommitteeAttendance,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  // =========================================================================
  // Agenda Items
  // =========================================================================

  /**
   * Add an agenda item to a meeting.
   */
  async addAgendaItem(meetingId: string, data: AddAgendaItemData) {
    return prisma.committeeAgendaItem.create({
      data: {
        meetingId,
        applicationId: data.applicationId,
        displayOrder: data.displayOrder,
        decisionType: (data.decisionType as any) ?? 'APPROVE',
        presentedById: data.presentedById ?? null,
      },
      include: {
        application: {
          select: { id: true, applicationNo: true, state: true, requestedAmount: true },
        },
        presentedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Remove an agenda item.
   */
  async removeAgendaItem(itemId: string) {
    return prisma.committeeAgendaItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Reorder agenda items by providing an ordered array of item IDs.
   */
  async reorderAgenda(meetingId: string, itemIds: string[]) {
    const updates = itemIds.map((id, index) =>
      prisma.committeeAgendaItem.update({
        where: { id },
        data: { displayOrder: index + 1 },
      }),
    );

    await prisma.$transaction(updates);

    return prisma.committeeAgendaItem.findMany({
      where: { meetingId },
      orderBy: { displayOrder: 'asc' },
      include: {
        application: {
          select: { id: true, applicationNo: true, state: true },
        },
      },
    });
  }

  // =========================================================================
  // Voting
  // =========================================================================

  /**
   * Cast a vote on an agenda item.
   */
  async castVote(agendaItemId: string, memberId: string, data: CastVoteData) {
    try {
      return await prisma.committeeVote.create({
        data: {
          agendaItemId,
          memberId,
          vote: data.vote as any,
          comments: data.comments ?? null,
        },
        include: {
          member: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('This member has already voted on this agenda item');
      }
      throw error;
    }
  }

  /**
   * Get vote results (tally) for an agenda item.
   */
  async getVoteResults(agendaItemId: string) {
    const votes = await prisma.committeeVote.findMany({
      where: { agendaItemId },
      include: {
        member: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const tally = {
      APPROVE: 0,
      REJECT: 0,
      ABSTAIN: 0,
    };

    for (const v of votes) {
      tally[v.vote] = (tally[v.vote] as number) + 1;
    }

    return {
      votes,
      tally,
      totalVotes: votes.length,
    };
  }

  // =========================================================================
  // Quorum
  // =========================================================================

  /**
   * Check if a meeting has quorum.
   * Returns quorum status with present count, required count, and risk member flag.
   */
  async checkQuorum(meetingId: string) {
    const meeting = await prisma.committeeMeeting.findUnique({
      where: { id: meetingId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                jobTitle: true,
                department: true,
                roles: {
                  include: {
                    role: {
                      include: {
                        permissions: {
                          include: {
                            permission: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!meeting) return null;

    const presentMembers = meeting.members.filter(
      (m) => m.attendance === CommitteeAttendance.PRESENT,
    );

    // Check if at least one present member has "risk" in their permissions/role
    const hasRiskMember = presentMembers.some((m) => {
      const jobTitle = (m.user as any).jobTitle?.toLowerCase() ?? '';
      const department = (m.user as any).department?.toLowerCase() ?? '';
      const permissionNames = (m.user as any).roles?.flatMap?.((ur: any) =>
        ur.role.permissions?.map?.((rp: any) => rp.permission?.name?.toLowerCase() ?? '') ?? [],
      ) ?? [];

      return (
        jobTitle.includes('risk') ||
        department.includes('risk') ||
        permissionNames.some((p: string) => p.includes('risk'))
      );
    });

    return {
      quorumMet: presentMembers.length >= meeting.quorumMin,
      presentCount: presentMembers.length,
      requiredCount: meeting.quorumMin,
      hasRiskMember,
    };
  }

  // =========================================================================
  // Decision
  // =========================================================================

  /**
   * Finalize the decision for an agenda item by tallying votes.
   * - Majority APPROVE → decisionResult=APPROVE, transition app to APPROVED
   * - Majority REJECT → decisionResult=REJECT, transition app to REJECTED
   * - Otherwise → DEFER, do not change app state
   */
  async finalizeDecision(agendaItemId: string, actorId?: string) {
    const agendaItem = await prisma.committeeAgendaItem.findUnique({
      where: { id: agendaItemId },
      include: {
        votes: true,
        meeting: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!agendaItem) return null;

    if (agendaItem.decisionResult) {
      throw new Error('This agenda item has already been finalized');
    }

    // Check quorum before finalizing
    const quorum = await this.checkQuorum(agendaItem.meetingId);
    if (quorum && !quorum.quorumMet) {
      throw new Error(
        `Quorum not met. Present: ${quorum.presentCount}, Required: ${quorum.requiredCount}`,
      );
    }

    // Tally votes
    const tally = { APPROVE: 0, REJECT: 0, ABSTAIN: 0 };
    for (const v of agendaItem.votes) {
      tally[v.vote] = (tally[v.vote] as number) + 1;
    }

    let decisionResult: AgendaItemDecisionType;
    const nonAbstain = tally.APPROVE + tally.REJECT;

    if (nonAbstain === 0) {
      // All abstained — defer
      decisionResult = AgendaItemDecisionType.DEFER;
    } else if (tally.APPROVE > tally.REJECT) {
      decisionResult = AgendaItemDecisionType.APPROVE;
    } else if (tally.REJECT > tally.APPROVE) {
      decisionResult = AgendaItemDecisionType.REJECT;
    } else {
      // Tie — defer
      decisionResult = AgendaItemDecisionType.DEFER;
    }

    // Update agenda item with decision
    const updated = await prisma.committeeAgendaItem.update({
      where: { id: agendaItemId },
      data: {
        decisionResult,
        decidedAt: new Date(),
      },
      include: {
        application: {
          select: { id: true, applicationNo: true, state: true },
        },
      },
    });

    // Transition the linked application state if applicable
    const application = updated.application;
    if (application && application.state === ApplicationState.COMMITTEE_REVIEW) {
      try {
        if (decisionResult === AgendaItemDecisionType.APPROVE) {
          await creditApplicationService.transitionApplication(
            application.id,
            'approve',
            actorId,
            undefined,
            { skipApprovalChainCheck: true },
          );
        } else if (decisionResult === AgendaItemDecisionType.REJECT) {
          await creditApplicationService.transitionApplication(
            application.id,
            'reject',
            actorId,
            'Rejected by committee',
            { skipApprovalChainCheck: true },
          );
        }
        // DEFER: no state change
      } catch (err) {
        // Log but don't fail the decision if transition fails
        console.error(
          `Failed to transition application ${application.id} after committee decision:`,
          err,
        );
      }
    }

    return {
      agendaItem: updated,
      decisionResult,
      tally,
    };
  }

  // =========================================================================
  // Memo Generation
  // =========================================================================

  /**
   * Auto-generate a credit memo for an application.
   * Returns a JSON object with borrower summary, facility details,
   * latest score run, collateral summary, and recommendation.
   */
  async generateMemo(applicationId: string) {
    const application = await prisma.creditApplication.findUnique({
      where: { id: applicationId },
      include: {
        borrowerProfile: {
          select: {
            id: true,
            borrowerType: true,
            account: { select: { id: true, name: true } },
            contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        facilities: {
          include: {
            collaterals: {
              include: {
                insuranceCovers: true,
                liens: true,
              },
            },
            guarantees: true,
          },
        },
        scoreRuns: {
          orderBy: { runAt: 'desc' },
          take: 1,
        },
        assignedRm: { select: { id: true, firstName: true, lastName: true } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
      },
    }) as any;

    if (!application) return null;

    // Borrower summary
    const borrower = application.borrowerProfile;
    const borrowerSummary = {
      type: borrower?.borrowerType,
      name: borrower?.account?.name ?? `${borrower?.contact?.firstName ?? ''} ${borrower?.contact?.lastName ?? ''}`.trim(),
      registrationNo: borrower?.account?.registrationNo ?? null,
    };

    // Facility details
    const facilityDetails = (application.facilities ?? []).map((f: any) => ({
      facilityType: f.facilityType,
      amount: f.amount.toString(),
      tenorMonths: f.tenorMonths,
      ratePct: f.ratePct?.toString(),
      approvedAmount: f.approvedAmount?.toString(),
    }));

    // Latest score run
    const latestScoreRun = application.scoreRuns?.[0];
    const scoringSummary = latestScoreRun
      ? {
          riskRating: latestScoreRun.riskRating,
          totalScore: latestScoreRun.totalScore.toString(),
          isOverride: latestScoreRun.isOverride,
          overrideReason: latestScoreRun.overrideReason,
          runAt: latestScoreRun.runAt.toISOString(),
        }
      : null;

    // Collateral summary
    const collateralSummary = (application.facilities ?? []).flatMap((f: any) =>
      (f.collaterals ?? []).map((c: any) => ({
        type: c.collateralType,
        marketValue: c.marketValue?.toString(),
        forcedSaleValue: c.forcedSaleValue?.toString(),
        insuranceCoverRequired: c.insuranceCoverRequired,
        lienCount: c.liens?.length ?? 0,
      })),
    );

    // Recommendation based on score
    let recommendation: string;
    if (!latestScoreRun) {
      recommendation = 'PENDING_SCORE';
    } else {
      const highRiskRatings = ['D', 'CC', 'CCC', 'C'];
      const mediumRiskRatings = ['B', 'BB', 'BBB'];
      if (highRiskRatings.includes(latestScoreRun.riskRating)) {
        recommendation = 'REJECT';
      } else if (mediumRiskRatings.includes(latestScoreRun.riskRating)) {
        recommendation = 'REVIEW';
      } else {
        recommendation = 'APPROVE';
      }
    }

    return {
      applicationId: application.id,
      applicationNo: application.applicationNo,
      state: application.state,
      borrowerSummary,
      facilityDetails,
      scoringSummary,
      collateralSummary,
      requestedAmount: application.requestedAmount.toString(),
      currency: application.currency,
      purpose: application.purpose,
      assignedRm: application.assignedRm
        ? `${application.assignedRm.firstName} ${application.assignedRm.lastName}`
        : null,
      assignedAnalyst: application.assignedAnalyst
        ? `${application.assignedAnalyst.firstName} ${application.assignedAnalyst.lastName}`
        : null,
      recommendation,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const committeeService = new CommitteeService();