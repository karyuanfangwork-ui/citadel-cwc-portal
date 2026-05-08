import React from 'react';
const SkeletonCategoryCard = () => (
  <div className="bg-surface border border-cwc-border rounded-cwc-lg p-6 animate-pulse">
    <div className="flex items-center gap-4 mb-3">
      <div className="w-12 h-12 rounded-cwc-md bg-surface-muted" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-surface-muted rounded mb-2" />
        <div className="h-3 w-48 bg-surface-muted rounded" />
      </div>
    </div>
  </div>
);
export default SkeletonCategoryCard;