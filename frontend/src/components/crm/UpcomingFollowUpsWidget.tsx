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

const ENTITY_ICONS: Record<FollowUp['entityType'], string> = {
  lead: 'lightbulb',
  opportunity: 'monetization_on',
};

const UpcomingFollowUpsWidget: React.FC<Props> = ({ items }) => {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-secondary,#6b7280)] text-center py-6">No upcoming follow-ups</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const date = new Date(item.followUpDate);
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-subtle,#f9fafb)] transition-colors border border-transparent hover:border-[var(--border,#e5e7eb)] group cursor-pointer"
          >
            <div className="w-12 flex flex-col items-center bg-[var(--bg-subtle,#f3f4f6)] rounded-lg p-1.5 flex-shrink-0">
              <span className="text-[9px] uppercase font-bold text-brand-600">
                {date.toLocaleString('en-MY', { month: 'short' })}
              </span>
              <span className="text-lg font-bold leading-tight text-[var(--text-primary,#111827)]">{date.getDate()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary,#111827)] truncate">{item.title}</p>
              {item.contactName && (
                <div className="flex items-center gap-1 text-[var(--text-secondary,#6b7280)] text-[11px] mt-0.5">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  <span>{item.contactName}</span>
                </div>
              )}
              {item.followUpNote && (
                <p className="text-[11px] text-[var(--text-secondary,#6b7280)] truncate">{item.followUpNote}</p>
              )}
            </div>
            <span className="material-symbols-outlined text-[var(--text-secondary,#6b7280)] text-[18px] opacity-0 group-hover:opacity-100 transition-opacity">
              {ENTITY_ICONS[item.entityType]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default UpcomingFollowUpsWidget;
