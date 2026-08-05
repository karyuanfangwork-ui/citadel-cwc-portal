import React from 'react';

// Reusable skeleton matching card pattern on CRM list pages
export const CrmCardSkeleton: React.FC = () => (
  <div className="bg-bg-surface border border-border rounded-xl p-5 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
    <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-2/3" />
  </div>
);

export default CrmCardSkeleton;