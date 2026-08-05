import React, { useState } from 'react';
import type { CrmActivity } from '../../services/crm.service';

interface Props {
  activities: CrmActivity[];
  overdueDeals?: number;
  staleLeads?: number;
  followUpDueToday?: number;
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-[#ffdad6]/40 text-[#ba1a1a]',
  MEDIUM: 'bg-[#86f2e4]/30 text-[#006a61]',
  LOW: 'bg-[#e5e7eb] text-[#64748b]',
};

const TASK_ICONS: Record<string, string> = {
  TASK: 'task_alt',
  CALL: 'call',
  EMAIL: 'mail',
  MEETING: 'groups',
  FOLLOW_UP: 'event',
  SITE_VISIT: 'location_on',
  NOTE: 'description',
  WHATSAPP: 'chat',
};

const MyTasksWidget: React.FC<Props> = ({ activities, overdueDeals = 0, staleLeads = 0, followUpDueToday = 0 }) => {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build task list: real tasks first, then synthetic alerts
  const realTasks = activities
    .filter((a) => a.activityType === 'TASK')
    .slice(0, 5);

  const syntheticTasks: { id: string; title: string; priority: string; icon: string; dueLabel: string }[] = [];
  if (overdueDeals > 0) {
    syntheticTasks.push({ id: '__overdue__', title: `Review ${overdueDeals} overdue deal${overdueDeals > 1 ? 's' : ''}`, priority: 'HIGH', icon: 'warning', dueLabel: 'Overdue' });
  }
  if (followUpDueToday > 0) {
    syntheticTasks.push({ id: '__followup__', title: `${followUpDueToday} follow-up${followUpDueToday > 1 ? 's' : ''} due today`, priority: 'MEDIUM', icon: 'rate_review', dueLabel: 'Today' });
  }
  if (staleLeads > 0) {
    syntheticTasks.push({ id: '__stale__', title: `${staleLeads} stale lead${staleLeads > 1 ? 's' : ''} need attention`, priority: 'LOW', icon: 'hourglass_top', dueLabel: 'Inactive 7+ days' });
  }

  const allTasks = [
    ...realTasks.map((t) => ({
      id: t.id,
      title: t.subject ?? t.description ?? 'Task',
      priority: 'MEDIUM' as string,
      icon: TASK_ICONS[t.activityType] ?? 'task_alt',
      dueLabel: (t as any).dueDate ?? t.scheduledAt ?? t.completedAt
        ? new Date((t as any).dueDate ?? t.scheduledAt ?? t.completedAt!).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
        : '',
    })),
    ...syntheticTasks,
  ].slice(0, 6);

  if (allTasks.length === 0) {
    return <p className="text-sm text-[#45464d] opacity-60 text-center py-6">No tasks due</p>;
  }

  return (
    <div className="space-y-4">
      {allTasks.map((task) => {
        const done = checked.has(task.id);
        return (
          <div key={task.id} className="flex items-center gap-4 p-2 rounded-lg hover:bg-[#f8f9ff] transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 flex-shrink-0 accent-[#006a61]"
              checked={done}
              onChange={() => toggle(task.id)}
              aria-label={`Mark "${task.title}" done`}
            />
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#86f2e4]/30 text-[#006a61]">
              <span className="material-symbols-outlined text-[18px]">{task.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[14px] font-semibold leading-snug ${done ? 'line-through text-[#45464d] opacity-60' : 'text-[#0b1c30]'}`}>
                {task.title}
              </p>
              {task.dueLabel && (
                <p className="text-[12px] text-[#45464d] opacity-70 mt-0.5">Due: {task.dueLabel}</p>
              )}
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase flex-shrink-0 ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.MEDIUM}`}>
              {task.priority === 'HIGH' ? 'HIGH' : task.priority === 'LOW' ? 'LOW' : 'MED'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MyTasksWidget;