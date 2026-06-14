import React, { useState } from 'react';
import type { CrmActivity } from '../../services/crm.service';

interface Props {
  activities: CrmActivity[];
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MED: 'bg-gray-100 text-gray-600',
  LOW: 'bg-blue-50 text-blue-600',
};

const MyTasksWidget: React.FC<Props> = ({ activities }) => {
  const tasks = activities
    .filter((activity) => activity.activityType === 'TASK' || (activity as any).type === 'TASK')
    .slice(0, 5);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tasks.length === 0) {
    return <p className="text-sm text-[var(--text-secondary,#6b7280)] text-center py-6">No tasks due</p>;
  }

  return (
    <ul className="space-y-4">
      {tasks.map((task) => {
        const done = checked.has(task.id);
        const dueDate = (task as any).dueDate ?? task.scheduledAt ?? task.completedAt;
        return (
          <li key={task.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={done}
              onChange={() => toggle(task.id)}
              className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-snug ${done ? 'line-through text-[var(--text-secondary,#6b7280)]' : 'text-[var(--text-primary,#111827)]'}`}>
                {task.subject ?? task.description ?? 'Task'}
              </p>
              {dueDate && (
                <p className="text-[11px] text-[var(--text-secondary,#6b7280)] mt-0.5">
                  Due: {new Date(dueDate).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase flex-shrink-0 ${PRIORITY_STYLES.MED}`}>
              Med
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default MyTasksWidget;
