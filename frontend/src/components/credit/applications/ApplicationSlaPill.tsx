import React from 'react';

interface ApplicationSlaPillProps {
  text: string;
  color: string;
}

const ApplicationSlaPill: React.FC<ApplicationSlaPillProps> = ({ text, color }) => {
  const isOverdue = color === '#dc2626' || text.toLowerCase().includes('overdue');
  const isUrgent = color === '#ea580c' || text.toLowerCase().includes('left') || text.toLowerCase().includes('today');

  const bg = isOverdue
    ? 'var(--cr-error-container)'
    : isUrgent
      ? '#fff7ed'
      : '#f0fdf4';
  const fg = isOverdue
    ? 'var(--cr-on-error-container)'
    : isUrgent
      ? '#c2410c'
      : '#15803d';
  const icon = isOverdue ? 'warning' : isUrgent ? 'schedule' : 'check_circle';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em]"
      style={{ background: bg, color: fg }}
    >
      <span className="material-symbols-outlined text-[12px]">{icon}</span>
      {text}
    </span>
  );
};

export default ApplicationSlaPill;
