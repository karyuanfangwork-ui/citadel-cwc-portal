import React from 'react';

const T = {
  teal: '#006a61',
  textPrimary: '#0b1c30',
  textMuted: '#76777d',
  border: '#e2e8f0',
  error: '#ba1a1a',
};

interface Props {
  label: string;
  value: string;
  subtext?: string;
  valueColor?: string;
}

const Customer360KpiCard: React.FC<Props> = ({ label, value, subtext, valueColor }) => (
  <div
    className="bg-white rounded-xl border shadow-sm p-5 flex flex-col justify-between min-h-[140px]"
    style={{ borderColor: T.border }}
  >
    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
      {label}
    </p>
    <div className="mt-2">
      <p className="text-[36px] font-bold leading-tight" style={{ color: valueColor || T.textPrimary }}>
        {value}
      </p>
    </div>
    {subtext && (
      <p className="text-[13px] mt-1" style={{ color: T.textMuted }}>
        {subtext}
      </p>
    )}
  </div>
);

export default Customer360KpiCard;