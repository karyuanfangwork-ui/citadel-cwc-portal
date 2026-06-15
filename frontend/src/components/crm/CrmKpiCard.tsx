import React from 'react';

export type KpiTrend = 'up' | 'down' | 'flat';

interface CrmKpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  trend?: KpiTrend;
  trendLabel?: string;
  trendPercent?: number; // e.g. 12 renders as "+12%", -2 renders as "-2%"
  trendPositive?: boolean;
  highlight?: boolean; // border-l-4 teal accent for featured metric
  subtitle?: string;   // e.g. "Vs 1,114 last month"
}

const CrmKpiCard: React.FC<CrmKpiCardProps> = ({
  label, value, icon, trend, trendLabel, trendPercent, trendPositive, highlight, subtitle,
}) => {
  const isPositive = trendPositive !== undefined ? trendPositive : trend === 'up';

  // Determine badge content: trendPercent takes priority
  const badgeContent = trendPercent !== undefined
    ? `${trendPercent >= 0 ? '+' : ''}${trendPercent}%`
    : trendLabel
      ? `${isPositive ? '+' : ''}${trendLabel}`
      : null;

  const badgeColor = trendPercent !== undefined
    ? (trendPercent >= 0
      ? 'bg-[#86f2e4]/30 text-[#006a61]'
      : 'bg-[#ffdad6]/40 text-[#ba1a1a]')
    : isPositive
      ? 'bg-[#86f2e4]/30 text-[#006a61]'
      : 'bg-[#ffdad6]/40 text-[#ba1a1a]';

  return (
    <div
      className={`bg-white border border-[#e2e8f0] rounded-xl p-4 flex flex-col justify-between shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#006a61] hover:shadow-md ${highlight ? 'border-l-4 border-l-[#006a61]' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-bold tracking-widest uppercase text-[#45464d] opacity-70 leading-tight">{label}</span>
        {badgeContent && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor}`}>
            {badgeContent}
          </span>
        )}
      </div>
      <div>
        <p className={`text-[28px] font-bold leading-tight ${highlight ? 'text-[#006a61]' : 'text-[#0b1c30]'}`}>{value}</p>
        {(subtitle || trend) && (
          <p className="text-[12px] text-[#45464d] mt-1 opacity-70 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">{icon}</span>
            {subtitle ?? (trend === 'up' ? 'Up this period' : trend === 'down' ? 'Down this period' : 'Stable')}
          </p>
        )}
      </div>
    </div>
  );
};

export default CrmKpiCard;