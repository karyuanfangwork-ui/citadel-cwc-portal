import prisma from '../utils/prisma';
import {
  DailyOperationalReport,
  DailyOperationalRow,
  DailyOperationalTotals,
  DailyOperationalCompanyRow,
} from './crm-daily-report.types';

type VisibleOwnerIds = string[] | null;

const REPORT_TIMEZONE = 'Asia/Kuala_Lumpur';

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function emptyRow(date: string): DailyOperationalRow {
  return {
    date,
    emailsSent: 0,
    emailBounces: 0,
    newCalls: 0,
    followUpCalls: 0,
    callEngagement: 0,
    interested: 0,
    noAnswer: 0,
    notInterested: 0,
    wrongNumber: 0,
    notReachable: 0,
    meetings: 0,
    meetingsArranged: 0,
    meetingsPresented: 0,
    merchantsSignedUp: 0,
    merchantsDeclined: 0,
  };
}

function emptyCompanyRow(companyName: string, accountId: string | null): DailyOperationalCompanyRow {
  const { date: _date, ...metrics } = emptyRow('COMPANY');
  return { companyName, accountId, activityCount: 0, ...metrics };
}

export interface CompanyAttributionInput {
  accountId: string | null;
  contactId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  account: { id: string; name: string } | null;
  contact: { account: { id: string; name: string } | null } | null;
  lead: { companyName: string | null } | null;
  opportunity: { account: { id: string; name: string } | null } | null;
}

export function resolveCompanyAttribution(activity: CompanyAttributionInput): { companyName: string; accountId: string | null } {
  const linkedCount = [activity.accountId, activity.contactId, activity.leadId, activity.opportunityId].filter(Boolean).length;
  if (linkedCount > 1) return { companyName: 'Unassigned / Invalid linkage', accountId: null };
  if (activity.account?.name) return { companyName: activity.account.name, accountId: activity.account.id };
  if (activity.opportunity?.account?.name) return { companyName: activity.opportunity.account.name, accountId: activity.opportunity.account.id };
  if (activity.contact?.account?.name) return { companyName: activity.contact.account.name, accountId: activity.contact.account.id };
  if (activity.lead?.companyName) return { companyName: activity.lead.companyName, accountId: null };
  return { companyName: 'Unassigned / No company', accountId: null };
}

function dateKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    keys.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function visibleActivityWhere(visibleOwnerIds: VisibleOwnerIds) {
  if (visibleOwnerIds === null) return {};
  return {
    OR: [
      { account: { ownerId: { in: visibleOwnerIds }, deletedAt: null } },
      { contact: { account: { ownerId: { in: visibleOwnerIds }, deletedAt: null } } },
      { lead: { ownerId: { in: visibleOwnerIds }, deletedAt: null } },
      { opportunity: { ownerId: { in: visibleOwnerIds }, deletedAt: null } },
      {
        accountId: null,
        contactId: null,
        leadId: null,
        opportunityId: null,
        userId: { in: visibleOwnerIds },
      },
    ],
  };
}

function activeEntityWhere() {
  return {
    OR: [
      { accountId: null, contactId: null, leadId: null, opportunityId: null },
      { account: { deletedAt: null } },
      { contact: { deletedAt: null } },
      { lead: { deletedAt: null } },
      { opportunity: { deletedAt: null } },
    ],
  };
}

function addActivity(row: Omit<DailyOperationalRow, 'date'>, activity: {
  activityType: string;
  callCategory: string | null;
  callOutcome: string | null;
  emailOutcome: string | null;
  meetingOutcome: string | null;
  engagementOutcome: string | null;
}) {
  if (activity.activityType === 'EMAIL') {
    if (activity.emailOutcome === 'BOUNCED') row.emailBounces++;
    else row.emailsSent++;
  }

  if (activity.activityType === 'CALL' || activity.activityType === 'FOLLOW_UP') {
    if (activity.callCategory === 'FOLLOW_UP_CALL' || activity.activityType === 'FOLLOW_UP') row.followUpCalls++;
    else row.newCalls++;

    if (activity.callOutcome && activity.callOutcome !== 'NO_ANSWER' && activity.callOutcome !== 'NOT_REACHABLE') {
      row.callEngagement++;
    }
    if (activity.engagementOutcome === 'INTERESTED' || activity.callOutcome === 'INTERESTED') row.interested++;
    if (activity.callOutcome === 'NO_ANSWER') row.noAnswer++;
    if (activity.callOutcome === 'NOT_INTERESTED' || activity.engagementOutcome === 'NOT_INTERESTED') row.notInterested++;
    if (activity.callOutcome === 'WRONG_NUMBER') row.wrongNumber++;
    if (activity.callOutcome === 'NOT_REACHABLE') row.notReachable++;
  }

  if (activity.activityType === 'MEETING') {
    row.meetings++;
    if (activity.meetingOutcome === 'ARRANGED') row.meetingsArranged++;
    if (activity.meetingOutcome === 'COMPLETED') row.meetingsPresented++;
  }
}

export async function getDailyOperationalReport(
  from: Date,
  to: Date,
  visibleOwnerIds: VisibleOwnerIds = null,
): Promise<DailyOperationalReport> {
  const keys = dateKeys(from, to);
  const rows = new Map(keys.map((key) => [key, emptyRow(key)]));

  const activities = await prisma.crmActivity.findMany({
    where: {
      AND: [
        { createdAt: { gte: from, lte: to } },
        activeEntityWhere(),
        visibleActivityWhere(visibleOwnerIds),
      ],
    },
    select: {
      activityType: true,
      callCategory: true,
      callOutcome: true,
      emailOutcome: true,
      meetingOutcome: true,
      engagementOutcome: true,
      createdAt: true,
      accountId: true,
      contactId: true,
      leadId: true,
      opportunityId: true,
      account: { select: { id: true, name: true } },
      contact: { select: { account: { select: { id: true, name: true } } } },
      lead: { select: { companyName: true } },
      opportunity: { select: { account: { select: { id: true, name: true } } } },
    },
  });

  const byCompanyMap = new Map<string, DailyOperationalCompanyRow>();

  for (const activity of activities) {
    const row = rows.get(dateKey(activity.createdAt));
    if (!row) continue;
    addActivity(row, activity);
    const attribution = resolveCompanyAttribution(activity);
    const companyKey = `${attribution.accountId ?? ''}:${attribution.companyName}`;
    const companyRow = byCompanyMap.get(companyKey) ?? emptyCompanyRow(attribution.companyName, attribution.accountId);
    companyRow.activityCount++;
    addActivity(companyRow, activity);
    byCompanyMap.set(companyKey, companyRow);
  }

  const leadOwnerWhere = visibleOwnerIds === null ? {} : { ownerId: { in: visibleOwnerIds } };
  const lifecycleLeads = await prisma.crmLead.findMany({
    where: {
      ...leadOwnerWhere,
      deletedAt: null,
      OR: [
        { status: 'CONVERTED', convertedAt: { gte: from, lte: to } },
        { status: 'LOST', updatedAt: { gte: from, lte: to } },
      ],
    },
    select: {
      status: true,
      convertedAt: true,
      updatedAt: true,
      companyName: true,
      account: { select: { id: true, name: true } },
    },
  });

  for (const lead of lifecycleLeads) {
    const eventDate = lead.status === 'CONVERTED' && lead.convertedAt ? lead.convertedAt : lead.updatedAt;
    const row = rows.get(dateKey(eventDate));
    if (!row) continue;
    if (lead.status === 'CONVERTED') row.merchantsSignedUp++;
    if (lead.status === 'LOST') row.merchantsDeclined++;
    const companyName = lead.account?.name || lead.companyName || 'Unassigned / No company';
    const companyKey = `${lead.account?.id ?? ''}:${companyName}`;
    const companyRow = byCompanyMap.get(companyKey) ?? emptyCompanyRow(companyName, lead.account?.id ?? null);
    if (lead.status === 'CONVERTED') companyRow.merchantsSignedUp++;
    if (lead.status === 'LOST') companyRow.merchantsDeclined++;
    byCompanyMap.set(companyKey, companyRow);
  }

  const totals = emptyRow('TOTAL') as DailyOperationalTotals;
  for (const row of rows.values()) {
    for (const key of Object.keys(totals) as Array<keyof DailyOperationalTotals>) {
      if (key !== 'date') totals[key] += row[key];
    }
  }

  return {
    daily: [...rows.values()],
    totals,
    byCompany: [...byCompanyMap.values()].sort((a, b) => b.activityCount - a.activityCount || a.companyName.localeCompare(b.companyName)),
    period: { from, to, timezone: REPORT_TIMEZONE },
  };
}

export async function getDailyOperationalActivityDetail(
  from: Date,
  to: Date,
  visibleOwnerIds: VisibleOwnerIds = null,
): Promise<Record<string, unknown>[]> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      AND: [
        { createdAt: { gte: from, lte: to } },
        activeEntityWhere(),
        visibleActivityWhere(visibleOwnerIds),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      activityType: true,
      subject: true,
      createdAt: true,
      leadId: true,
      accountId: true,
      contactId: true,
      opportunityId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      account: { select: { id: true, name: true } },
      contact: { select: { account: { select: { id: true, name: true } } } },
      lead: { select: { id: true, title: true, contactName: true, companyName: true } },
      opportunity: { select: { account: { select: { id: true, name: true } } } },
    },
  });

  return activities.map((activity) => {
    const attribution = resolveCompanyAttribution(activity);
    return {
      date: dateKey(activity.createdAt),
      createdAt: activity.createdAt.toISOString(),
      company: attribution.companyName,
      leadId: activity.lead?.id ?? activity.leadId ?? '',
      leadTitle: activity.lead?.title ?? '',
      contactName: activity.lead?.contactName ?? '',
      activityType: activity.activityType,
      activitySubject: activity.subject,
      recordedBy: `${activity.user.firstName} ${activity.user.lastName}`.trim() || activity.user.email,
      recordedByEmail: activity.user.email,
    };
  });
}
