import { committeeService } from '../committee.service';
import { AgendaItemDecisionType, ApplicationState, CommitteeAttendance } from '@prisma/client';
import prisma from '../../../utils/prisma';

// ── Mocks ─────────────────────────────────────────────────────────────────
jest.mock('../../../utils/prisma', () => ({
  __esModule: true,
  default: {
    committeeVote: {
      create: jest.fn(),
    },
    committeeMember: {
      findUnique: jest.fn(),
    },
    committeeAgendaItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    committeeMeeting: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock('../creditApplication.service', () => ({
  creditApplicationService: {
    transitionApplication: jest.fn(),
  },
}));

jest.mock('../auditChain.service', () => ({
  AuditChainService: {
    appendEvent: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { creditApplicationService } from '../creditApplication.service';
import { AuditChainService } from '../auditChain.service';

const MEMBER_ID = 'member-001';
const USER_ID = 'user-001';
const AGENDA_ITEM_ID = 'agenda-001';
const MEETING_ID = 'meeting-001';

const baseVoteData = { vote: 'APPROVE', comments: 'Looks good' };

describe('committeeService.castVote — security checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Check 1: memberId must belong to the authenticated user ────────
  it('rejects when memberId does not belong to the authenticated user', async () => {
    (prisma.committeeMember.findUnique as jest.Mock).mockResolvedValue({
      id: MEMBER_ID,
      userId: 'user-OTHER',
      meetingId: MEETING_ID,
      attendance: CommitteeAttendance.PRESENT,
    });

    await expect(
      committeeService.castVote(AGENDA_ITEM_ID, MEMBER_ID, baseVoteData, USER_ID),
    ).rejects.toThrow('You are not authorized to vote as this member');

    expect(prisma.committeeVote.create).not.toHaveBeenCalled();
  });

  // ── Check 2: agenda item must belong to the same meeting as the member ──
  it('rejects when agenda item belongs to a different meeting than the member', async () => {
    (prisma.committeeMember.findUnique as jest.Mock).mockResolvedValue({
      id: MEMBER_ID,
      userId: USER_ID,
      meetingId: MEETING_ID,
      attendance: CommitteeAttendance.PRESENT,
    });
    (prisma.committeeAgendaItem.findUnique as jest.Mock).mockResolvedValue({
      id: AGENDA_ITEM_ID,
      meetingId: 'meeting-OTHER',
    });

    await expect(
      committeeService.castVote(AGENDA_ITEM_ID, MEMBER_ID, baseVoteData, USER_ID),
    ).rejects.toThrow('Agenda item does not belong to the same meeting as the member');

    expect(prisma.committeeVote.create).not.toHaveBeenCalled();
  });

  // ── Check 3: ABSENT members cannot vote ────────────────────────────
  it('rejects votes from members marked ABSENT', async () => {
    (prisma.committeeMember.findUnique as jest.Mock).mockResolvedValue({
      id: MEMBER_ID,
      userId: USER_ID,
      meetingId: MEETING_ID,
      attendance: CommitteeAttendance.ABSENT,
    });
    (prisma.committeeAgendaItem.findUnique as jest.Mock).mockResolvedValue({
      id: AGENDA_ITEM_ID,
      meetingId: MEETING_ID,
    });

    await expect(
      committeeService.castVote(AGENDA_ITEM_ID, MEMBER_ID, baseVoteData, USER_ID),
    ).rejects.toThrow('ABSENT members cannot vote');

    expect(prisma.committeeVote.create).not.toHaveBeenCalled();
  });

  // ── Happy path: valid member can vote ─────────────────────────────
  it('allows vote when all checks pass', async () => {
    (prisma.committeeMember.findUnique as jest.Mock).mockResolvedValue({
      id: MEMBER_ID,
      userId: USER_ID,
      meetingId: MEETING_ID,
      attendance: CommitteeAttendance.PRESENT,
    });
    (prisma.committeeAgendaItem.findUnique as jest.Mock).mockResolvedValue({
      id: AGENDA_ITEM_ID,
      meetingId: MEETING_ID,
    });
    (prisma.committeeVote.create as jest.Mock).mockResolvedValue({
      id: 'vote-001',
      agendaItemId: AGENDA_ITEM_ID,
      memberId: MEMBER_ID,
      vote: 'APPROVE',
    });

    const result = await committeeService.castVote(AGENDA_ITEM_ID, MEMBER_ID, baseVoteData, USER_ID);
    expect(result).toBeDefined();
    expect(prisma.committeeVote.create).toHaveBeenCalled();
  });

  // ── Check: member not found ───────────────────────────────────────
  it('rejects when member is not found', async () => {
    (prisma.committeeMember.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      committeeService.castVote(AGENDA_ITEM_ID, MEMBER_ID, baseVoteData, USER_ID),
    ).rejects.toThrow('Committee member not found');

    expect(prisma.committeeVote.create).not.toHaveBeenCalled();
  });

  // ── Check: agenda item not found ──────────────────────────────────
  it('rejects when agenda item is not found', async () => {
    (prisma.committeeMember.findUnique as jest.Mock).mockResolvedValue({
      id: MEMBER_ID,
      userId: USER_ID,
      meetingId: MEETING_ID,
      attendance: CommitteeAttendance.PRESENT,
    });
    (prisma.committeeAgendaItem.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      committeeService.castVote(AGENDA_ITEM_ID, MEMBER_ID, baseVoteData, USER_ID),
    ).rejects.toThrow('Agenda item not found');

    expect(prisma.committeeVote.create).not.toHaveBeenCalled();
  });
});

describe('committeeService.finalizeDecision — transition consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const agendaItem = {
    id: AGENDA_ITEM_ID,
    meetingId: MEETING_ID,
    applicationId: 'app-001',
    decisionResult: null,
    votes: [
      { vote: AgendaItemDecisionType.APPROVE },
      { vote: AgendaItemDecisionType.APPROVE },
      { vote: AgendaItemDecisionType.REJECT },
    ],
    application: {
      id: 'app-001',
      applicationNo: 'CA-001',
      state: ApplicationState.COMMITTEE_REVIEW,
    },
    meeting: { members: [] },
  };

  const presentMeeting = {
    id: MEETING_ID,
    quorumMin: 1,
    members: [
      {
        attendance: CommitteeAttendance.PRESENT,
        user: { jobTitle: 'Risk Manager', department: 'Risk', roles: [] },
      },
    ],
  };

  it('does not update agenda item when linked application transition fails', async () => {
    (prisma.committeeAgendaItem.findUnique as jest.Mock).mockResolvedValue(agendaItem);
    (prisma.committeeMeeting.findUnique as jest.Mock).mockResolvedValue(presentMeeting);
    (creditApplicationService.transitionApplication as jest.Mock).mockRejectedValue(new Error('transition failed'));

    await expect(
      committeeService.finalizeDecision(AGENDA_ITEM_ID, USER_ID),
    ).rejects.toThrow('transition failed');

    expect(creditApplicationService.transitionApplication).toHaveBeenCalledWith(
      'app-001',
      'approve',
      USER_ID,
      undefined,
      { skipApprovalChainCheck: true },
    );
    expect(prisma.committeeAgendaItem.update).not.toHaveBeenCalled();
    expect(AuditChainService.appendEvent).not.toHaveBeenCalled();
  });

  it('updates agenda item after linked application transition succeeds', async () => {
    (prisma.committeeAgendaItem.findUnique as jest.Mock).mockResolvedValue(agendaItem);
    (prisma.committeeMeeting.findUnique as jest.Mock).mockResolvedValue(presentMeeting);
    (creditApplicationService.transitionApplication as jest.Mock).mockResolvedValue({ id: 'app-001' });
    (prisma.committeeAgendaItem.update as jest.Mock).mockResolvedValue({
      ...agendaItem,
      decisionResult: AgendaItemDecisionType.APPROVE,
    });

    const result = await committeeService.finalizeDecision(AGENDA_ITEM_ID, USER_ID, 'Approved by committee');

    expect(result?.decisionResult).toBe(AgendaItemDecisionType.APPROVE);
    expect(prisma.committeeAgendaItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: AGENDA_ITEM_ID },
      data: expect.objectContaining({ decisionResult: AgendaItemDecisionType.APPROVE }),
    }));
    expect(AuditChainService.appendEvent).toHaveBeenCalledWith(
      'app-001',
      'COMMITTEE_FINALIZE',
      USER_ID,
      'finalize_approve',
      undefined,
      undefined,
      { comment: 'Approved by committee' },
    );
  });
});
