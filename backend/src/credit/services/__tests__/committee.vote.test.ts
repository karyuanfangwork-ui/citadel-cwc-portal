import { committeeService } from '../committee.service';
import { CommitteeAttendance } from '@prisma/client';
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
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

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