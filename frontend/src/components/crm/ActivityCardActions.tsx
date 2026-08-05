import React from 'react';

export interface ActivityCardActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const ActivityCardActions: React.FC<ActivityCardActionsProps> = ({
  onEdit,
  onDelete,
  canDelete,
}) => {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        title="Edit activity"
        className="inline-flex items-center justify-center p-1 rounded text-text-secondary hover:text-brand-700 transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
      >
        <span className="material-symbols-outlined text-base">edit</span>
      </button>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete activity"
          className="inline-flex items-center justify-center p-1 rounded text-text-secondary hover:text-red-600 transition-colors"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      )}
    </div>
  );
};

export default ActivityCardActions;