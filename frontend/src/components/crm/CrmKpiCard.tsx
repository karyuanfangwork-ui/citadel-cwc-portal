import React from 'react';

export type KpiTrend = 'up' | 'down' | 'flat';

interface CrmKpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: KpiTrend;
  trendLabel?: string;
  trendPositive?: boolean;
}

const CrmKpiCard: React.FC<CrmKpiCardProps> = ({ label, value, icon, trend, trendLabel, trendPositive }) => {
  const trendIcon = trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'horizontal_rule';
  const isPositive = trendPositive !== undefined ? trendPositive : trend === 'up';
  const trendColor = trendLabel
    ? isPositive ? 'text-emerald-700' : 'text-red-600'
    : 'text-[var(--text-secondary,#6b7280)]';

  return (
    <div className="bg-white border border-[var(--border,#e5e7eb)] rounded-xl p-4 flex flex-col justify-between h-32 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex justify-between items-start gap-3">
        <span className="text-xs font-semibold text-[var(--text-secondary,#6b7280)] leading-tight">{label}</span>
        <span className="material-symbols-outlined text-brand-600 text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-[var(--text-primary,#111827)] leading-tight">{value}</p>
        {trendLabel && (
          <div className={`flex items-center gap-1 mt-0.5 ${trendColor}`}>
            <span className="material-symbols-outlined text-[14px]">{trendIcon}</span>
            <span className="text-[11px] font-semibold">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrmKpiCard;
