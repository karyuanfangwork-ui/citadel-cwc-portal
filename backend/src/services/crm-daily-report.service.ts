import prisma from '../utils/prisma';
import { DailyOperationalCompanyRow, DailyOperationalReport, DailyOperationalTotals } from './crm-daily-report.types';
import { applyOutcomeMetrics, applyVolumeMetrics, emptyCompanyRow, emptyRow, MetricInput } from './crm-daily-report.metrics';
import { REPORT_TIMEZONE, dateKey, dateKeys, dayWindow } from './crm-report-window';

export interface DailyReportOptions { visibleOwnerIds: string[] | null; recordedByUserId?: string | null; }
export interface CompanyAttributionInput {
  accountId: string | null; contactId: string | null; leadId: string | null; opportunityId: string | null;
  account: { id: string; name: string } | null;
  contact: { account: { id: string; name: string } | null } | null;
  lead: { companyName: string | null; accountId?: string | null; account?: { id: string; name: string } | null } | null;
  opportunity: { account: { id: string; name: string } | null } | null;
}
export function resolveCompanyAttribution(activity: CompanyAttributionInput): { companyName: string; accountId: string | null } {
  const linkedCount = [activity.accountId, activity.contactId, activity.leadId, activity.opportunityId].filter(Boolean).length;
  const matchingContext = Boolean(activity.accountId && activity.opportunityId && activity.opportunity?.account?.id === activity.accountId);
  if (linkedCount > 1 && !matchingContext) return { companyName: 'Unassigned / Invalid linkage', accountId: null };
  if (activity.account?.name) return { companyName: activity.account.name, accountId: activity.account.id };
  if (activity.opportunity?.account?.name) return { companyName: activity.opportunity.account.name, accountId: activity.opportunity.account.id };
  if (activity.contact?.account?.name) return { companyName: activity.contact.account.name, accountId: activity.contact.account.id };
  if (activity.lead?.account?.name) return { companyName: activity.lead.account.name, accountId: activity.lead.account.id };
  if (activity.lead?.companyName) return { companyName: activity.lead.companyName, accountId: null };
  return { companyName: 'Unassigned / No company', accountId: null };
}
export function companyKey(companyName: string, accountId: string | null): string {
  return accountId ? `account:${accountId}` : `name:${companyName.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}
function visibleActivityWhere(owners: string[] | null) {
  if (owners === null) return {};
  return { OR: [
    { account: { ownerId: { in: owners }, deletedAt: null } },
    { contact: { account: { ownerId: { in: owners }, deletedAt: null } } },
    { lead: { ownerId: { in: owners, }, deletedAt: null } },
    { opportunity: { ownerId: { in: owners }, deletedAt: null } },
    { accountId: null, contactId: null, leadId: null, opportunityId: null, userId: { in: owners } },
  ] };
}
function activeEntityWhere() { return { OR: [
  { accountId: null, contactId: null, leadId: null, opportunityId: null },
  { account: { deletedAt: null } }, { contact: { deletedAt: null } }, { lead: { deletedAt: null } }, { opportunity: { deletedAt: null } },
] }; }
function ownerScope(owners: string[] | null) { return owners === null ? {} : { ownerId: { in: owners } }; }
export const ACTIVITY_METRIC_SELECT = {
  id: true, activityType: true, callCategory: true, callOutcome: true, emailOutcome: true, meetingOutcome: true, engagementOutcome: true,
  createdAt: true, outcomeRecordedAt: true, accountId: true, contactId: true, leadId: true, opportunityId: true,
  account: { select: { id: true, name: true, owner: { select: { firstName: true, lastName: true, email: true } } } }, contact: { select: { account: { select: { id: true, name: true, owner: { select: { firstName: true, lastName: true, email: true } } } } } },
  lead: { select: { id: true, title: true, contactName: true, companyName: true, accountId: true, owner: { select: { firstName: true, lastName: true, email: true } }, account: { select: { id: true, name: true, owner: { select: { firstName: true, lastName: true, email: true } } } } } },
  opportunity: { select: { account: { select: { id: true, name: true, owner: { select: { firstName: true, lastName: true, email: true } } } }, owner: { select: { firstName: true, lastName: true, email: true } } } },
} as const;
export function activityReportWhere(from: Date, to: Date, options: DailyReportOptions) {
  return { AND: [{ source: 'CRM' }, { OR: [{ createdAt: { gte: from, lte: to } }, { outcomeRecordedAt: { gte: from, lte: to } }] }, activeEntityWhere(), visibleActivityWhere(options.visibleOwnerIds), ...(options.recordedByUserId ? [{ userId: options.recordedByUserId }] : [])] };
}
const metricInput = (activity: any): MetricInput => ({ activityType: activity.activityType, callCategory: activity.callCategory, callOutcome: activity.callOutcome, emailOutcome: activity.emailOutcome, meetingOutcome: activity.meetingOutcome, engagementOutcome: activity.engagementOutcome });
const ACTIVITY_CHUNK_SIZE = 2000;
async function fetchActivitiesInChunks(where: ReturnType<typeof activityReportWhere>, chunkSize = ACTIVITY_CHUNK_SIZE) {
  const all: any[] = []; let cursor: { id: string } | undefined;
  for (;;) {
    const batch = await prisma.crmActivity.findMany({ where, select: ACTIVITY_METRIC_SELECT, orderBy: { id: 'asc' }, take: chunkSize, ...(cursor ? { cursor, skip: 1 } : {}) });
    all.push(...batch); if (batch.length < chunkSize) return all;
    cursor = { id: batch[batch.length - 1].id };
  }
}
export async function getDailyOperationalReport(fromDay: string, toDay: string, options: DailyReportOptions): Promise<DailyOperationalReport> {
  const { from, to } = dayWindow(fromDay, toDay); const rows = new Map(dateKeys(fromDay, toDay).map(key => [key, emptyRow(key)]));
  const byCompanyMap = new Map<string, DailyOperationalCompanyRow>();
  const companyRowFor = (name: string, accountId: string | null) => { const key = companyKey(name, accountId); const found = byCompanyMap.get(key); if (found) return found; const created = emptyCompanyRow(name, accountId); byCompanyMap.set(key, created); return created; };
  for (const activity of await fetchActivitiesInChunks(activityReportWhere(from, to, options))) {
    const attribution = resolveCompanyAttribution(activity); const company = companyRowFor(attribution.companyName, attribution.accountId); const input = metricInput(activity);
    const volume = rows.get(dateKey(activity.createdAt)); if (volume) { company.activityLoggedCount++; applyVolumeMetrics(volume, input); applyVolumeMetrics(company, input); }
    const outcome = rows.get(dateKey(activity.outcomeRecordedAt ?? activity.createdAt)); if (outcome) { company.activityOutcomeCount++; applyOutcomeMetrics(outcome, input); applyOutcomeMetrics(company, input); }
  }
  const opportunities = await prisma.crmOpportunity.findMany({ where: { ...ownerScope(options.visibleOwnerIds), deletedAt: null, OR: [{ wonAt: { gte: from, lte: to } }, { lostAt: { gte: from, lte: to } }] }, select: { wonAt: true, lostAt: true, account: { select: { id: true, name: true } } } });
  for (const opportunity of opportunities) { const company = companyRowFor(opportunity.account?.name ?? 'Unassigned / No company', opportunity.account?.id ?? null); if (opportunity.wonAt) { const row = rows.get(dateKey(opportunity.wonAt)); if (row) { row.merchantsSignedUp++; company.merchantsSignedUp++; } } if (opportunity.lostAt) { const row = rows.get(dateKey(opportunity.lostAt)); if (row) { row.merchantsDeclined++; company.merchantsDeclined++; } } }
  const leads = await prisma.crmLead.findMany({ where: { ...ownerScope(options.visibleOwnerIds), deletedAt: null, OR: [{ status: 'CONVERTED', convertedAt: { gte: from, lte: to } }, { status: 'LOST', convertedToOppId: null, lostAt: { gte: from, lte: to } }] }, select: { status: true, convertedAt: true, lostAt: true, convertedToOppId: true, companyName: true, accountId: true, account: { select: { id: true, name: true } } } });
  for (const lead of leads) { const company = companyRowFor(lead.account?.name || lead.companyName || 'Unassigned / No company', lead.account?.id ?? lead.accountId ?? null); if (lead.status === 'CONVERTED' && lead.convertedAt) { const row = rows.get(dateKey(lead.convertedAt)); if (row) { row.leadsConverted++; company.leadsConverted++; } } if (lead.status === 'LOST' && !lead.convertedToOppId && lead.lostAt) { const row = rows.get(dateKey(lead.lostAt)); if (row) { row.merchantsDeclined++; company.merchantsDeclined++; } } }
  const totals = emptyRow('TOTAL') as DailyOperationalTotals; for (const row of rows.values()) for (const key of Object.keys(totals) as Array<keyof DailyOperationalTotals>) if (key !== 'date') totals[key] += row[key];
  return { daily: [...rows.values()], totals, byCompany: [...byCompanyMap.values()].sort((a, b) => b.activityLoggedCount - a.activityLoggedCount || a.companyName.localeCompare(b.companyName)), period: { from, to, timezone: REPORT_TIMEZONE } };
}
export interface DetailRow { eventType: 'ACTIVITY' | 'LEAD_CONVERTED' | 'LEAD_LOST' | 'OPPORTUNITY_WON' | 'OPPORTUNITY_LOST'; volumeDate: string; outcomeDate: string; occurredAt: string; company: string; accountId: string; leadId: string; leadTitle: string; contactName: string; opportunityId: string; activityType: string; activitySubject: string; callCategory: string; callOutcome: string; emailOutcome: string; meetingOutcome: string; engagementOutcome: string; source: string; recordOwner: string; recordOwnerEmail: string; recordedBy: string; recordedByEmail: string; }
const blankDetail = () => ({ accountId: '', leadId: '', leadTitle: '', contactName: '', opportunityId: '', activityType: '', activitySubject: '', callCategory: '', callOutcome: '', emailOutcome: '', meetingOutcome: '', engagementOutcome: '', source: '', recordOwner: '', recordOwnerEmail: '', recordedBy: '', recordedByEmail: '' });
const personName = (person: { firstName: string; lastName: string; email: string }) => `${person.firstName} ${person.lastName}`.trim() || person.email;
export async function getDailyOperationalActivityDetail(fromDay: string, toDay: string, options: DailyReportOptions): Promise<DetailRow[]> {
  const { from, to } = dayWindow(fromDay, toDay);
  const activities = await prisma.crmActivity.findMany({ where: activityReportWhere(from, to, options), orderBy: { createdAt: 'asc' }, select: { ...ACTIVITY_METRIC_SELECT, subject: true, source: true, user: { select: { firstName: true, lastName: true, email: true } } } });
  const rows: DetailRow[] = activities.map((activity: any) => { const attribution = resolveCompanyAttribution(activity); const outcomeAt = activity.outcomeRecordedAt ?? activity.createdAt; const owner = activity.lead?.owner ?? activity.opportunity?.owner ?? activity.account?.owner ?? activity.contact?.account?.owner ?? activity.lead?.account?.owner; return { ...blankDetail(), eventType: 'ACTIVITY', volumeDate: dateKey(activity.createdAt), outcomeDate: dateKey(outcomeAt), occurredAt: activity.createdAt.toISOString(), company: attribution.companyName, accountId: attribution.accountId ?? '', leadId: activity.lead?.id ?? activity.leadId ?? '', leadTitle: activity.lead?.title ?? '', contactName: activity.lead?.contactName ?? '', opportunityId: activity.opportunityId ?? '', activityType: activity.activityType, activitySubject: activity.subject, callCategory: activity.callCategory ?? '', callOutcome: activity.callOutcome ?? '', emailOutcome: activity.emailOutcome ?? '', meetingOutcome: activity.meetingOutcome ?? '', engagementOutcome: activity.engagementOutcome ?? '', source: activity.source, recordOwner: owner ? personName(owner) : '', recordOwnerEmail: owner?.email ?? '', recordedBy: personName(activity.user), recordedByEmail: activity.user.email }; });
  const opportunities = await prisma.crmOpportunity.findMany({ where: { ...ownerScope(options.visibleOwnerIds), deletedAt: null, OR: [{ wonAt: { gte: from, lte: to } }, { lostAt: { gte: from, lte: to } }] }, select: { id: true, name: true, wonAt: true, lostAt: true, account: { select: { id: true, name: true } }, owner: { select: { firstName: true, lastName: true, email: true } } } });
  for (const opportunity of opportunities) { const at = opportunity.wonAt ?? opportunity.lostAt; if (!at) continue; rows.push({ ...blankDetail(), eventType: opportunity.wonAt ? 'OPPORTUNITY_WON' : 'OPPORTUNITY_LOST', volumeDate: '', outcomeDate: dateKey(at), occurredAt: at.toISOString(), company: opportunity.account?.name ?? 'Unassigned / No company', accountId: opportunity.account?.id ?? '', opportunityId: opportunity.id, activitySubject: opportunity.name, recordedBy: personName(opportunity.owner), recordedByEmail: opportunity.owner.email }); }
  const leads = await prisma.crmLead.findMany({ where: { ...ownerScope(options.visibleOwnerIds), deletedAt: null, OR: [{ status: 'CONVERTED', convertedAt: { gte: from, lte: to } }, { status: 'LOST', convertedToOppId: null, lostAt: { gte: from, lte: to } }] }, select: { id: true, title: true, status: true, convertedAt: true, lostAt: true, convertedToOppId: true, companyName: true, accountId: true, account: { select: { id: true, name: true } }, owner: { select: { firstName: true, lastName: true, email: true } } } });
  for (const lead of leads) { const at = lead.status === 'CONVERTED' ? lead.convertedAt : lead.lostAt; if (!at) continue; rows.push({ ...blankDetail(), eventType: lead.status === 'CONVERTED' ? 'LEAD_CONVERTED' : 'LEAD_LOST', volumeDate: '', outcomeDate: dateKey(at), occurredAt: at.toISOString(), company: lead.account?.name || lead.companyName || 'Unassigned / No company', accountId: lead.account?.id ?? lead.accountId ?? '', leadId: lead.id, leadTitle: lead.title, opportunityId: lead.convertedToOppId ?? '', recordedBy: personName(lead.owner), recordedByEmail: lead.owner.email }); }
  return rows.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
