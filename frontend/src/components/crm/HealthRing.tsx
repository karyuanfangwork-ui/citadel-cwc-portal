import React from 'react';

interface HealthRingProps {
  score: number; // 0-100
  size?: number; // px, default 40
}

const HealthRing: React.FC<HealthRingProps> = ({ score, size = 40 }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let ringColor: string;
  let textColor: string;
  if (score >= 70) {
    ringColor = '#006a61';
    textColor = '#006a61';
  } else if (score >= 40) {
    ringColor = '#f59e0b';
    textColor = '#92400e';
  } else {
    ringColor = '#dc2626';
    textColor = '#dc2626';
  }

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {/* background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          opacity={0.2}
        />
        {/* progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-xs"
        style={{ color: textColor }}
      >
        {score}
      </span>
    </span>
  );
};

export default HealthRing;