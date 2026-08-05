import React from 'react';

interface FollowUp {
  id: string;
  title: string;
  contactName: string | null;
  followUpDate: string;
  followUpNote: string | null;
  entityType: 'lead' | 'opportunity';
}

interface Props {
  items: FollowUp[];
}

const TYPE_ICONS: Record<string, string> = {
  lead: 'lightbulb',
  opportunity: 'monetization_on',
  CALL: 'call',
  EMAIL: 'mail',
  MEETING: 'groups',
  SITE_VISIT: 'location_on',
  FOLLOW_UP: 'event',
  TASK: 'task_alt',
  WHATSAPP: 'chat',
  NOTE: 'description',
};

function getStatusBadge(followUpDate: string): { label: string; color: string } {
  const now = new Date();
  const date = new Date(followUpDate);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  if (date < todayStart) {
    return { label: 'OVERDUE', color: 'bg-[#ffdad6]/40 text-[#ba1a1a]' };
  }
  if (date >= todayStart && date < tomorrowEnd) {
    return { label: 'PENDING', color: 'bg-[#86f2e4]/30 text-[#006a61]' };
  }
  return { label: 'SCHEDULED', color: 'bg-[#e5e7eb] text-[#64748b]' };
}

const UpcomingFollowUpsWidget: React.FC<Props> = ({ items }) => {
  if (items.length === 0) {
    return <p className="text-sm text-[#45464d] opacity-60 text-center py-6">No upcoming follow-ups</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const date = new Date(item.followUpDate);
        const icon = TYPE_ICONS[item.entityType] ?? 'event';
        const badge = getStatusBadge(item.followUpDate);

        return (
          <div
            key={item.id}
            className="flex items-center gap-4 p-2 rounded-lg hover:bg-[#f8f9ff] transition-colors group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#86f2e4]/30 text-[#006a61]">
              <span className="material-symbols-outlined text-[18px]">{icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#0b1c30] truncate">{item.title}</p>
              <p className="text-[12px] text-[#45464d] opacity-70">
                {date.toLocaleString('en-MY', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${badge.color}`}>
              {badge.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default UpcomingFollowUpsWidget;