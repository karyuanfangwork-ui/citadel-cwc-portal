export type CrmActivityReminderInput = {
  id: string;
  activityType: string;
  subject: string;
  scheduledAt: Date | null;
  opportunity?: { name: string } | null;
  lead?: { title: string } | null;
  account?: { name: string } | null;
  contact?: { firstName: string; lastName: string } | null;
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  NOTE: 'Note',
  TASK: 'Task',
  FOLLOW_UP: 'Follow-up',
  WHATSAPP: 'WhatsApp',
  SITE_VISIT: 'Site Visit',
};

export function formatCrmActivityType(activityType: string): string {
  return ACTIVITY_TYPE_LABELS[activityType]
    ?? activityType.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
}

export function formatCrmReminderScheduledTime(scheduledAt: Date | null): string {
  if (!scheduledAt) return '—';
  return scheduledAt.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildCrmActivityReminderVariables(activity: CrmActivityReminderInput): Record<string, string> {
  const activityTypeLabel = formatCrmActivityType(activity.activityType);
  const activitySubject = activity.subject.trim() || 'CRM activity';
  const contactName = [activity.contact?.firstName, activity.contact?.lastName].filter(Boolean).join(' ').trim();
  const relatedEntityLabel = activity.opportunity?.name
    ? `Opportunity: ${activity.opportunity.name}`
    : activity.lead?.title
      ? `Lead: ${activity.lead.title}`
      : activity.account?.name
        ? activity.account.name
        : contactName
          ? `Contact: ${contactName}`
          : activitySubject;

  return {
    activityId: activity.id,
    activitySubject,
    activityType: activity.activityType,
    activityTypeLabel,
    scheduledTime: formatCrmReminderScheduledTime(activity.scheduledAt),
    relatedEntityLabel,
    reminderTitle: `${activityTypeLabel} Reminder — ${relatedEntityLabel}`,
  };
}
