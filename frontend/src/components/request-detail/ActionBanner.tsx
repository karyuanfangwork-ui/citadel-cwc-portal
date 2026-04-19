import React from 'react';
import { useBannerConfigs } from '../../hooks/useBannerConfigs';

type RequestRole = 'agent' | 'hiring_manager' | 'ceo' | 'staff';

interface ActionBannerProps {
  role: RequestRole;
  status: string;
  assignedToName?: string;
  onActionClick?: () => void;
}

const ActionBanner: React.FC<ActionBannerProps> = ({ role, status, assignedToName, onActionClick }) => {
  const { getBannerConfig, loading } = useBannerConfigs();
  if (loading) return null;

  const config = getBannerConfig(role, status, assignedToName);
  if (!config) return null;

  return (
    <div className={`mb-8 ${config.bgClass} border-2 ${config.borderClass} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-center gap-4">
        <div className={`size-11 rounded-full ${config.iconBgClass} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-xl ${config.iconColor}`}>{config.icon}</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
        </div>
        {onActionClick && (
          <button
            onClick={onActionClick}
            className="px-5 py-2.5 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            Take Action
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionBanner;
